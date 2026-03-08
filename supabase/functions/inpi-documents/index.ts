import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";

// ====== CORRECTION 2: Token cache ======
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getINPIToken(): Promise<{ token: string | null; error: string | null }> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    console.log("[INPI] Using cached token");
    return { token: cachedToken, error: null };
  }

  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) {
    return { token: null, error: "INPI_USERNAME ou INPI_PASSWORD manquant dans les secrets Supabase" };
  }

  try {
    console.log("[INPI] Authentification en cours...");
    const res = await fetch(`${INPI_BASE}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[INPI] Auth failed: ${res.status} ${res.statusText} — ${body}`);
      if (res.status === 403 && body.includes("connection_type_not_allowed")) {
        return { token: null, error: "Compte INPI sans acces API. Demandez l'acces API sur data.inpi.fr" };
      }
      return { token: null, error: `INPI auth failed (${res.status}): ${body || res.statusText}` };
    }

    const data = await res.json();
    const token = data.token ?? null;
    if (token) {
      cachedToken = token;
      tokenExpiry = now + 8 * 60 * 1000; // 8 minutes
      console.log("[INPI] Auth OK — token cached for 8 min");
    } else {
      console.error("[INPI] Auth response sans token:", JSON.stringify(data));
      return { token: null, error: "Reponse INPI sans champ token" };
    }
    return { token, error: null };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("[INPI] Auth exception:", msg);
    return { token: null, error: `INPI auth exception: ${msg}` };
  }
}

async function getCompanyData(token: string, siren: string): Promise<any> {
  try {
    console.log(`[INPI] GET /companies/${siren}`);
    const res = await fetch(`${INPI_BASE}/companies/${siren}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      // Invalidate token on 401
      if (res.status === 401) { cachedToken = null; tokenExpiry = 0; }
      console.error(`[INPI] companies/${siren}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[INPI] Company data OK for ${siren}`);
    return data;
  } catch (e) {
    console.error("[INPI] getCompanyData error:", (e as Error).message);
    return null;
  }
}

async function getAttachments(token: string, siren: string): Promise<any> {
  try {
    console.log(`[INPI] GET /companies/${siren}/attachments`);
    const res = await fetch(`${INPI_BASE}/companies/${siren}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (res.status === 401) { cachedToken = null; tokenExpiry = 0; }
      console.error(`[INPI] attachments/${siren}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[INPI] Attachments OK — actes: ${(data.actes ?? []).length}, bilans: ${(data.bilans ?? []).length}`);
    return data;
  } catch (e) {
    console.error("[INPI] getAttachments error:", (e as Error).message);
    return null;
  }
}

async function downloadAndStore(
  supabase: any,
  token: string,
  url: string,
  storagePath: string,
): Promise<string | null> {
  try {
    console.log(`[INPI] Downloading ${url}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[INPI] Download failed: ${res.status} for ${url}`);
      return null;
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    console.log(`[INPI] Downloaded ${uint8.length} bytes, uploading to ${storagePath}`);

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(storagePath, uint8, {
        contentType: blob.type || "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("[INPI] Storage upload error:", error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(storagePath);

    console.log(`[INPI] Stored OK: ${storagePath}`);
    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("[INPI] Download/store error:", (e as Error).message);
    return null;
  }
}

// Financial parsing — supports both complete and simplified formats
function parseFinancials(bilansSaisis: any[]): any[] {
  if (!bilansSaisis || bilansSaisis.length === 0) return [];

  return bilansSaisis.slice(0, 3).map((bilan: any) => {
    const data = bilan.data ?? bilan.donnees ?? {};
    const pages = data.pages ?? data;

    const getValue = (codes: string[]): number | null => {
      for (const code of codes) {
        for (const key of Object.keys(pages)) {
          const page = pages[key];
          if (typeof page !== "object") continue;
          for (const row of Object.values(page as Record<string, any>)) {
            if (row?.code === code || key === code) {
              const v = row?.m1 ?? row?.valeur ?? row?.montant ?? null;
              if (v !== null && v !== undefined) return Number(v);
            }
          }
        }
        if (data[code]) {
          const v = data[code]?.m1 ?? data[code]?.m3 ?? data[code]?.valeur ?? null;
          if (v !== null && v !== undefined) return Number(v);
        }
      }
      return null;
    };

    return {
      dateCloture: bilan.dateCloture ?? bilan.date_cloture ?? "",
      chiffreAffaires: getValue(["FJ", "210", "214", "218"]),
      resultat: getValue(["HN", "310"]),
      capital: getValue(["DA"]),
      totalBilan: getValue(["EE", "180"]),
      effectif: getValue(["YP", "376"]),
      dettes: getValue(["EC"]),
      capitauxPropres: getValue(["DL"]),
    };
  });
}

// ====== CORRECTION 1: Parse Personne Morale ======
function parsePersonneMorale(companyRaw: any): any {
  const formality = companyRaw.formality ?? companyRaw;
  const content = formality?.content ?? companyRaw;
  const pm = content?.personneMorale ?? companyRaw?.personneMorale ?? {};

  const identite = pm?.identite ?? {};
  const entreprise = identite?.entreprise ?? {};
  const description = identite?.description ?? {};
  const adresseEntreprise = pm?.adresseEntreprise ?? pm?.etablissementPrincipal?.adresse ?? {};
  const adresse = adresseEntreprise?.adresse ?? adresseEntreprise ?? {};
  const composition = pm?.composition ?? {};
  const pouvoirs = composition?.pouvoirs ?? [];

  const dirigeants = pouvoirs
    .filter((p: any) => !p.beneficiaireEffectif)
    .map((p: any) => ({
      nom: (p.individu?.nom ?? p.nom ?? "").toUpperCase(),
      prenom: p.individu?.prenom ?? p.prenom ?? "",
      qualite: p.roleEnEntreprise ?? p.qualite ?? "",
      dateNaissance: p.individu?.dateDeNaissance ?? "",
      nationalite: p.individu?.nationalite ?? "",
      lieuNaissance: p.individu?.lieuDeNaissance ?? "",
    }));

  const beneficiaires = pouvoirs
    .filter((p: any) => p.beneficiaireEffectif === true)
    .map((p: any) => ({
      nom: (p.individu?.nom ?? p.nom ?? "").toUpperCase(),
      prenom: p.individu?.prenom ?? p.prenom ?? "",
      dateNaissance: p.individu?.dateDeNaissance ?? "",
      nationalite: p.individu?.nationalite ?? "",
      pourcentageParts: p.pourcentageDetentionCapital ?? 0,
      pourcentageVotes: p.pourcentageDetentionDroitVote ?? 0,
      modalitesControle: p.modalitesDeControle ?? "",
    }));

  const etablissements = (companyRaw.etablissements ?? []).map((e: any) => ({
    siret: e.siret ?? "",
    adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
    codePostal: e.adresse?.codePostal ?? "",
    commune: e.adresse?.commune ?? "",
    estSiege: e.roleEtablissement === "siege" || e.estSiege === true,
    activite: e.activitePrincipale ?? "",
    enseigne: e.enseigne ?? "",
  }));

  const historique = (content?.historique ?? companyRaw?.historique ?? []).slice(0, 30).map((h: any) => ({
    date: h.dateEffet ?? h.date ?? "",
    type: h.typeModification ?? h.type ?? "",
    description: h.description ?? h.libelle ?? "",
    detail: h.detail ?? "",
  }));

  const numVoie = adresse.numVoie ?? "";
  const typeVoie = adresse.typeVoie ?? "";
  const voie = adresse.voie ?? adresse.libelle ?? "";

  return {
    typePersonne: "morale",
    denomination: entreprise.denomination ?? companyRaw.denomination ?? "",
    sigle: entreprise.sigle ?? "",
    formeJuridique: entreprise.formeJuridique ?? description.formeJuridique ?? "",
    formeJuridiqueLabel: description.libelleFormeJuridique ?? "",
    capital: description.montantCapital ?? 0,
    deviseCapital: description.deviseCapital ?? "EUR",
    capitalVariable: description.capitalVariable === true || description.capitalVariable === "true",
    objetSocial: description.objet ?? description.objetSocial ?? "",
    duree: description.duree ?? "",
    dateClotureExercice: description.dateClotureExerciceSocial ?? description.dateClotureExercice ?? "",
    dateImmatriculation: description.dateImmatriculation ?? companyRaw.dateImmatriculation ?? "",
    dateDebutActivite: description.dateDebutActivite ?? "",
    ess: description.economeSocialeSolidaire === true || description.ess === true,
    societeMission: description.societeMission === true,
    associeUnique: description.associeUnique === true || description.associeUnique === "true",
    natureGerance: description.natureGerance ?? "",
    activitePrincipale: description.activitePrincipale ?? "",
    adresse: {
      numVoie,
      typeVoie,
      voie,
      codePostal: adresse.codePostal ?? "",
      commune: adresse.commune ?? "",
      codeInsee: adresse.codeInsee ?? adresse.codeCommune ?? "",
      pays: adresse.pays ?? "FRANCE",
      complement: adresse.complementLocalisation ?? "",
    },
    domiciliataire: adresseEntreprise?.domiciliataire ?? null,
    diffusionCommerciale: companyRaw.diffusionCommerciale !== false,
    nonDiffusible: companyRaw.statutDiffusion === "N" || companyRaw.nonDiffusible === true,
    dirigeants,
    beneficiaires,
    etablissements,
    historique,
    eirl: false,
  };
}

// ====== CORRECTION 1: Parse Personne Physique (EI, micro, liberal, agent commercial) ======
function parsePersonnePhysique(companyRaw: any): any {
  const formality = companyRaw.formality ?? companyRaw;
  const content = formality?.content ?? companyRaw;
  const pp = content?.personnePhysique ?? companyRaw?.personnePhysique ?? {};

  const identite = pp?.identite ?? {};
  const entrepreneur = identite?.entrepreneur ?? {};
  const descPersonne = entrepreneur?.descriptionPersonne ?? {};
  const descEntreprise = entrepreneur?.descriptionEntreprise ?? identite?.description ?? {};

  // Address
  const adresseEntreprise = pp?.adresseEntreprise ?? pp?.etablissementPrincipal?.adresse ?? {};
  const adresse = adresseEntreprise?.adresse ?? adresseEntreprise ?? {};

  // Activity from etablissementPrincipal or autresEtablissements
  const etabPrincipal = pp?.etablissementPrincipal ?? {};
  const activites = etabPrincipal?.activites ?? [];
  const autresEtab = pp?.autresEtablissements ?? [];
  const activite0 = activites[0] ?? autresEtab[0]?.activites?.[0] ?? {};

  // EIRL detection
  const isEirl = identite?.eirl === true || identite?.eirl?.indicateur === true;

  const nom = (descPersonne.nom ?? descPersonne.nomNaissance ?? pp.nom ?? "").toUpperCase();
  const prenom = descPersonne.prenoms ?? descPersonne.prenom ?? pp.prenom ?? "";
  const dateNaissance = descPersonne.dateDeNaissance ?? "";
  const nationalite = descPersonne.nationalite ?? "";

  // Build denomination from nom/prenom for EI
  const denomination = descEntreprise.denomination ?? `${prenom} ${nom}`.trim();

  const numVoie = adresse.numVoie ?? "";
  const typeVoie = adresse.typeVoie ?? "";
  const voie = adresse.voie ?? adresse.libelle ?? "";

  const etablissements = (companyRaw.etablissements ?? []).map((e: any) => ({
    siret: e.siret ?? "",
    adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
    codePostal: e.adresse?.codePostal ?? "",
    commune: e.adresse?.commune ?? "",
    estSiege: e.roleEtablissement === "siege" || e.estSiege === true,
    activite: e.activitePrincipale ?? "",
    enseigne: e.enseigne ?? "",
  }));

  const historique = (content?.historique ?? companyRaw?.historique ?? []).slice(0, 30).map((h: any) => ({
    date: h.dateEffet ?? h.date ?? "",
    type: h.typeModification ?? h.type ?? "",
    description: h.description ?? h.libelle ?? "",
    detail: h.detail ?? "",
  }));

  return {
    typePersonne: "physique",
    denomination: denomination.toUpperCase(),
    sigle: "",
    formeJuridique: isEirl ? "EIRL" : "Entrepreneur individuel",
    formeJuridiqueLabel: isEirl ? "Entrepreneur individuel a responsabilite limitee" : "Entrepreneur individuel",
    capital: 0,
    deviseCapital: "EUR",
    capitalVariable: false,
    objetSocial: activite0?.descriptionDetaillee ?? descEntreprise?.objet ?? "",
    duree: "",
    dateClotureExercice: descEntreprise?.dateClotureExercice ?? "",
    dateImmatriculation: descEntreprise?.dateImmatriculation ?? companyRaw.dateImmatriculation ?? "",
    dateDebutActivite: descEntreprise?.dateDebutActivite ?? etabPrincipal?.dateDebutActivite ?? "",
    ess: false,
    societeMission: false,
    associeUnique: false,
    natureGerance: "",
    activitePrincipale: activite0?.codeAPE ?? descEntreprise?.activitePrincipale ?? "",
    adresse: {
      numVoie,
      typeVoie,
      voie,
      codePostal: adresse.codePostal ?? "",
      commune: adresse.commune ?? "",
      codeInsee: adresse.codeInsee ?? adresse.codeCommune ?? "",
      pays: adresse.pays ?? "FRANCE",
      complement: adresse.complementLocalisation ?? "",
    },
    domiciliataire: adresseEntreprise?.domiciliataire ?? null,
    diffusionCommerciale: companyRaw.diffusionCommerciale !== false,
    nonDiffusible: companyRaw.statutDiffusion === "N" || companyRaw.nonDiffusible === true,
    // For EI, the entrepreneur is both dirigeant and sole owner
    dirigeants: [{
      nom,
      prenom,
      qualite: "Entrepreneur individuel",
      dateNaissance,
      nationalite,
      lieuNaissance: descPersonne.lieuDeNaissance ?? "",
    }],
    beneficiaires: [],
    etablissements,
    historique,
    eirl: isEirl,
  };
}

// ====== CORRECTION 1: Parse Exploitation agricole ======
function parseExploitation(companyRaw: any): any {
  const formality = companyRaw.formality ?? companyRaw;
  const content = formality?.content ?? companyRaw;
  const expl = content?.exploitation ?? companyRaw?.exploitation ?? {};

  const identite = expl?.identite ?? {};
  const entrepreneur = identite?.entrepreneur ?? {};
  const descPersonne = entrepreneur?.descriptionPersonne ?? {};
  const descEntreprise = identite?.description ?? {};

  const adresseExpl = expl?.adresseEntreprise ?? {};
  const adresse = adresseExpl?.adresse ?? adresseExpl ?? {};

  const nom = (descPersonne.nom ?? "").toUpperCase();
  const prenom = descPersonne.prenoms ?? descPersonne.prenom ?? "";

  const numVoie = adresse.numVoie ?? "";
  const typeVoie = adresse.typeVoie ?? "";
  const voie = adresse.voie ?? adresse.libelle ?? "";

  const historique = (content?.historique ?? companyRaw?.historique ?? []).slice(0, 30).map((h: any) => ({
    date: h.dateEffet ?? h.date ?? "",
    type: h.typeModification ?? h.type ?? "",
    description: h.description ?? h.libelle ?? "",
    detail: h.detail ?? "",
  }));

  return {
    typePersonne: "exploitation",
    denomination: descEntreprise?.denomination ?? `${prenom} ${nom}`.trim().toUpperCase(),
    sigle: "",
    formeJuridique: "EARL",
    formeJuridiqueLabel: "Exploitation agricole",
    capital: 0,
    deviseCapital: "EUR",
    capitalVariable: false,
    objetSocial: descEntreprise?.objet ?? "",
    duree: "",
    dateClotureExercice: descEntreprise?.dateClotureExercice ?? "",
    dateImmatriculation: companyRaw.dateImmatriculation ?? "",
    dateDebutActivite: descEntreprise?.dateDebutActivite ?? "",
    ess: false,
    societeMission: false,
    associeUnique: false,
    natureGerance: "",
    activitePrincipale: descEntreprise?.activitePrincipale ?? "",
    adresse: {
      numVoie,
      typeVoie,
      voie,
      codePostal: adresse.codePostal ?? "",
      commune: adresse.commune ?? "",
      codeInsee: adresse.codeInsee ?? "",
      pays: adresse.pays ?? "FRANCE",
      complement: adresse.complementLocalisation ?? "",
    },
    domiciliataire: null,
    diffusionCommerciale: companyRaw.diffusionCommerciale !== false,
    nonDiffusible: companyRaw.statutDiffusion === "N" || companyRaw.nonDiffusible === true,
    dirigeants: nom ? [{ nom, prenom, qualite: "Exploitant", dateNaissance: descPersonne.dateDeNaissance ?? "", nationalite: descPersonne.nationalite ?? "", lieuNaissance: "" }] : [],
    beneficiaires: [],
    etablissements: (companyRaw.etablissements ?? []).map((e: any) => ({
      siret: e.siret ?? "",
      adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
      codePostal: e.adresse?.codePostal ?? "",
      commune: e.adresse?.commune ?? "",
      estSiege: e.roleEtablissement === "siege" || e.estSiege === true,
      activite: e.activitePrincipale ?? "",
      enseigne: e.enseigne ?? "",
    })),
    historique,
    eirl: false,
  };
}

// ====== CORRECTION 1: Smart dispatch based on content type ======
function extractCompanyData(companyRaw: any): any {
  if (!companyRaw) return null;

  const formality = companyRaw.formality ?? companyRaw;
  const content = formality?.content ?? companyRaw;

  if (content?.personneMorale || companyRaw?.personneMorale) {
    console.log("[INPI] Detected: Personne Morale");
    return parsePersonneMorale(companyRaw);
  }
  if (content?.personnePhysique || companyRaw?.personnePhysique) {
    console.log("[INPI] Detected: Personne Physique (EI/micro/liberal)");
    return parsePersonnePhysique(companyRaw);
  }
  if (content?.exploitation || companyRaw?.exploitation) {
    console.log("[INPI] Detected: Exploitation agricole");
    return parseExploitation(companyRaw);
  }

  // Fallback: try to extract basic data from top-level fields
  console.log("[INPI] Unknown structure — extracting top-level fields");
  return {
    typePersonne: "unknown",
    denomination: companyRaw.denomination ?? companyRaw.nom_complet ?? "",
    sigle: "",
    formeJuridique: companyRaw.formeJuridique ?? "",
    formeJuridiqueLabel: "",
    capital: 0,
    deviseCapital: "EUR",
    capitalVariable: false,
    objetSocial: "",
    duree: "",
    dateClotureExercice: "",
    dateImmatriculation: companyRaw.dateImmatriculation ?? "",
    dateDebutActivite: "",
    ess: false,
    societeMission: false,
    associeUnique: false,
    natureGerance: "",
    activitePrincipale: "",
    adresse: { numVoie: "", typeVoie: "", voie: "", codePostal: "", commune: "", codeInsee: "", pays: "FRANCE", complement: "" },
    domiciliataire: null,
    diffusionCommerciale: true,
    nonDiffusible: companyRaw.statutDiffusion === "N",
    dirigeants: [],
    beneficiaires: [],
    etablissements: [],
    historique: [],
    eirl: false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { siren } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", status: "error", documents: [], companyData: null, financials: [], totalDocuments: 0, storedCount: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");
    console.log(`[INPI] === Start for SIREN ${cleanSiren} ===`);

    // CORRECTION 2: Use cached token
    const { token, error: authError } = await getINPIToken();
    if (!token) {
      return new Response(JSON.stringify({
        documents: [],
        companyData: null,
        financials: [],
        totalDocuments: 0,
        storedCount: 0,
        status: "partial",
        error: authError || "INPI authentication failed",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      await supabase.storage.createBucket("kyc-documents", { public: true });
    } catch {
      // Bucket may already exist
    }

    // CORRECTION 1: Smart dispatch for PM / PP / Exploitation
    const companyRaw = await getCompanyData(token, cleanSiren);
    const companyData = extractCompanyData(companyRaw);

    // Get attachments (actes + bilans)
    const attachments = await getAttachments(token, cleanSiren);
    const documents: any[] = [];
    let financials: any[] = [];

    if (attachments) {
      const actes = attachments.actes ?? [];
      const bilans = attachments.bilans ?? [];
      const bilansSaisis = attachments.bilansSaisis ?? [];

      console.log(`[INPI] Found ${actes.length} actes, ${bilans.length} bilans, ${bilansSaisis.length} bilansSaisis`);

      for (const acte of actes.slice(0, 5)) {
        const acteId = acte.id;
        const acteType = acte.typeRdd ?? acte.type ?? "Acte";
        const acteDate = acte.dateDepot ?? acte.date ?? "";
        const nature = acte.nature ?? "";
        const label = nature ? `${acteType} — ${nature} — ${acteDate}` : `${acteType} — ${acteDate}`;
        const storagePath = `${cleanSiren}/${acteType.replace(/\s/g, "_")}_${acteDate || acteId}.pdf`;

        const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
        const publicUrl = await downloadAndStore(supabase, token, downloadUrl, storagePath);

        const isStatuts = acteType.toLowerCase().includes("statut") || nature.toLowerCase().includes("statut");

        documents.push({
          type: isStatuts ? "Statuts" : "Actes",
          label,
          url: publicUrl ?? downloadUrl,
          source: "inpi",
          available: true,
          status: publicUrl ? "auto" : "lien",
          storedInSupabase: !!publicUrl,
        });
      }

      for (const bilan of bilans.slice(0, 3)) {
        const bilanId = bilan.id;
        const dateCloture = bilan.dateCloture ?? bilan.date_cloture ?? "";
        const typeBilan = bilan.typeBilan ?? "Comptes annuels";
        const storagePath = `${cleanSiren}/comptes_${dateCloture || bilanId}.pdf`;

        const downloadUrl = `${INPI_BASE}/bilans/${bilanId}/download`;
        const publicUrl = await downloadAndStore(supabase, token, downloadUrl, storagePath);

        documents.push({
          type: "Comptes annuels",
          label: `${typeBilan} — Cloture ${dateCloture}`,
          url: publicUrl ?? downloadUrl,
          source: "inpi",
          available: true,
          status: publicUrl ? "auto" : "lien",
          storedInSupabase: !!publicUrl,
        });
      }

      financials = parseFinancials(bilansSaisis);
    }

    console.log(`[INPI] === Done: ${documents.length} docs, ${documents.filter((d: any) => d.storedInSupabase).length} stored, ${financials.length} financial years ===`);

    return new Response(JSON.stringify({
      documents,
      companyData,
      financials,
      totalDocuments: documents.length,
      storedCount: documents.filter((d: any) => d.storedInSupabase).length,
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[INPI] Unhandled error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      documents: [],
      companyData: null,
      financials: [],
      totalDocuments: 0,
      storedCount: 0,
      status: "partial",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
