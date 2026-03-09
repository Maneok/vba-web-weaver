import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

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

// FIX 8: dlLogs was module-level and grew unboundedly across requests
// Now reset per request in the handler
let dlLogs: string[] = [];

async function downloadAndStore(
  supabase: any,
  token: string,
  url: string,
  path: string,
): Promise<string | null> {
  try {
    dlLogs.push(`[DL] === DEBUT URL=${url} PATH=${path}`);
    dlLogs.push(`[DL] Token: ${token ? "present" : "missing"}`);

    const res = await fetch(url, {
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/pdf, application/octet-stream, */*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(60000),
    });

    dlLogs.push(`[DL] HTTP ${res.status} | CT=${res.headers.get("content-type")} | CL=${res.headers.get("content-length")} | CD=${res.headers.get("content-disposition")}`);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "impossible de lire le body");
      dlLogs.push(`[DL] ERREUR HTTP ${res.status} ${res.statusText}: ${errorBody.substring(0, 200)}`);

      if (res.status === 401) {
        dlLogs.push("[DL] TOKEN EXPIRÉ");
        cachedToken = null;
        tokenExpiry = 0;
      }
      return null;
    }

    const buffer = await res.arrayBuffer();
    dlLogs.push(`[DL] Buffer: ${buffer.byteLength} bytes`);

    const headerBytes = new Uint8Array(buffer.slice(0, 10));
    const headerStr = String.fromCharCode(...headerBytes);
    dlLogs.push(`[DL] Header: "${headerStr}"`);

    const isPDF = headerStr.startsWith("%PDF");
    const isHTML = headerStr.toLowerCase().startsWith("<!doc") || headerStr.toLowerCase().startsWith("<html");

    if (isHTML) {
      const htmlContent = new TextDecoder().decode(buffer).substring(0, 300);
      dlLogs.push(`[DL] HTML DETECTE (pas un PDF!): ${htmlContent}`);
      return null;
    }

    if (!isPDF && buffer.byteLength < 100) {
      dlLogs.push(`[DL] Fichier trop petit et pas PDF: ${buffer.byteLength} bytes`);
      return null;
    }

    dlLogs.push(`[DL] Fichier valide: ${isPDF ? "PDF" : "binaire"} (${buffer.byteLength} bytes)`);

    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, new Uint8Array(buffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      dlLogs.push(`[DL] ERREUR STORAGE: ${JSON.stringify(error)}`);
      return null;
    }

    // FIX 5: Use createSignedUrl for private bucket instead of getPublicUrl
    const { data: signedData, error: signErr } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 7 * 24 * 60 * 60); // 7 days

    let finalUrl: string | null = null;
    if (signedData?.signedUrl) {
      finalUrl = signedData.signedUrl;
    } else {
      dlLogs.push(`[DL] SignedUrl fallback: ${signErr?.message}`);
      const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(path);
      finalUrl = urlData?.publicUrl || null;
    }
    dlLogs.push(`[DL] STOCKÉ OK: ${finalUrl}`);
    return finalUrl;

  } catch (e) {
    dlLogs.push(`[DL] EXCEPTION: ${(e as Error).message} | ${(e as Error).stack?.substring(0, 200)}`);
    return null;
  }
}

// Financial parsing — supports both complete and simplified formats
function parseFinancials(bilansSaisis: any[]): any[] {
  if (!bilansSaisis || bilansSaisis.length === 0) return [];

  return bilansSaisis.slice(0, 3).map((bilan: any) => {
    // Handle both flat structure and nested bilanSaisi structure
    const data = bilan.data ?? bilan.donnees ?? {};
    const nestedPages = bilan?.bilanSaisi?.bilan?.detail?.pages ?? [];
    const pages = data.pages ?? data;

    // Try nested liasse-based lookup first (bilanSaisi.bilan.detail.pages[].liasses[])
    const getValFromLiasses = (pageNum: number, code: string): number | null => {
      if (nestedPages.length === 0) return null;
      const page = nestedPages.find((p: any) => p.numero === pageNum);
      if (!page) return null;
      const liasse = (page.liasses ?? []).find((l: any) => l.code === code);
      if (!liasse) return null;
      const raw = liasse.m1 || liasse.m3 || "0";
      return parseInt(String(raw).replace(/^0+/, "") || "0");
    };

    const getValue = (codes: string[], pageHint?: number): number | null => {
      // Try nested structure first
      if (nestedPages.length > 0 && pageHint != null) {
        const v = getValFromLiasses(pageHint, codes[0]);
        if (v !== null) return v;
      }
      // Fallback to flat structure
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

    const identite = bilan?.bilanSaisi?.bilan?.identite ?? {};

    return {
      dateCloture: bilan.dateCloture ?? bilan.date_cloture ?? identite.dateClotureExercice ?? "",
      chiffreAffaires: getValue(["FJ", "210", "214", "218"], 3),
      resultat: getValue(["HN", "310"], 4),
      capital: getValue(["DA"], 2),
      totalBilan: getValue(["EE", "180"], 2),
      effectif: getValue(["YP", "376"], 11),
      dettes: getValue(["EC"], 2),
      capitauxPropres: getValue(["DL"], 2),
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

  // Parse dirigeants — INPI structure: individu.descriptionPersonne
  const dirigeants = pouvoirs
    .filter((p: any) => p.typeDePersonne === "INDIVIDU")
    .map((p: any) => {
      const desc = p.individu?.descriptionPersonne ?? {};
      const prenoms = desc.prenoms ?? [];
      const prenom = Array.isArray(prenoms) ? (prenoms[0] ?? "") : String(prenoms);
      return {
        nom: (desc.nom ?? p.individu?.nom ?? "").toUpperCase(),
        prenom,
        qualite: p.roleEntreprise ?? p.roleEnEntreprise ?? "",
        dateNaissance: desc.dateDeNaissance ?? "",
        nationalite: desc.nationalite ?? "",
        lieuNaissance: desc.lieuDeNaissance ?? "",
      };
    });

  // Parse BE: beneficiaireEffectif field does NOT exist in INPI API
  const beneficiaires: any[] = pouvoirs
    .filter((p: any) => {
      const be = p.beneficiaireEffectif;
      return be === true || be === "true" || be === "O" || be === "OUI";
    })
    .map((p: any) => {
      const desc = p.individu?.descriptionPersonne ?? {};
      const prenoms = desc.prenoms ?? [];
      const prenom = Array.isArray(prenoms) ? (prenoms[0] ?? "") : String(prenoms);
      return {
        nom: (desc.nom ?? "").toUpperCase(),
        prenom,
        dateNaissance: desc.dateDeNaissance ?? "",
        nationalite: desc.nationalite ?? "",
        pourcentageParts: p.pourcentageDetentionCapital ?? 0,
        pourcentageVotes: p.pourcentageDetentionDroitVote ?? 0,
        modalitesControle: p.modalitesDeControle ?? "",
      };
    });

  console.log("[INPI BE] Pouvoirs:", pouvoirs.length, "| BE:", beneficiaires.length, "| Dirigeants:", dirigeants.length);

  // Fallback: deduce BE from structure when none declared
  if (beneficiaires.length === 0 && dirigeants.length > 0) {
    const formeCode = companyRaw?.formality?.formeJuridique ?? "";
    const forme = (description.formeJuridique ?? entreprise.formeJuridique ?? formeCode).toUpperCase();
    const isAssocieUnique = description.indicateurAssocieUnique === true ||
      forme.includes("SASU") || forme.includes("EURL") || forme.includes("SNC");

    if (isAssocieUnique || dirigeants.length === 1) {
      beneficiaires.push({
        nom: dirigeants[0].nom,
        prenom: dirigeants[0].prenom,
        dateNaissance: dirigeants[0].dateNaissance || "",
        nationalite: dirigeants[0].nationalite || "",
        pourcentageParts: 100,
        pourcentageVotes: 100,
        modalitesControle: "Dirigeant unique (deduit)",
      });
      console.log("[INPI BE] Fallback: dirigeant unique = BE 100%");
    }
  }

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
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { siren } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", status: "error", documents: [], companyData: null, financials: [], totalDocuments: 0, storedCount: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = String(siren).replace(/[\s.\-]/g, "");
    if (!/^\d{9,14}$/.test(cleanSiren)) {
      return new Response(JSON.stringify({ error: "Format SIREN invalide", status: "error", documents: [], companyData: null, financials: [], totalDocuments: 0, storedCount: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // FIX 8: Reset dlLogs per request to prevent unbounded growth
    dlLogs = [];
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
      await supabase.storage.createBucket("kyc-documents", { public: false });
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

    // Track auth time for token refresh
    const authTime = Date.now();
    let currentToken = token;

    if (attachments) {
      const actes = attachments.actes ?? [];
      const bilans = attachments.bilans ?? [];
      const bilansSaisis = attachments.bilansSaisis ?? [];

      console.log(`[INPI] Found ${actes.length} actes, ${bilans.length} bilans, ${bilansSaisis.length} bilansSaisis`);

      // Separate statuts from other actes, prioritize statuts
      const statutsActes: any[] = [];
      const autresActes: any[] = [];
      for (const acte of actes) {
        let isStatutActe = false;
        if (acte.typeRdd && Array.isArray(acte.typeRdd)) {
          isStatutActe = acte.typeRdd.some((t: any) => {
            const ta = String(t.typeActe || "").toLowerCase();
            const dec = String(t.decision || "").toLowerCase();
            return ta.includes("statut") || dec.includes("statut");
          });
        }
        if (isStatutActe) statutsActes.push(acte);
        else autresActes.push(acte);
      }
      console.log(`[INPI] Statuts: ${statutsActes.length}, Autres actes: ${autresActes.length}`);
      const actesToProcess = [...statutsActes.slice(0, 2), ...autresActes.slice(0, 3)];

      for (const acte of actesToProcess) {
        // Re-auth if token is older than 5 minutes
        if (Date.now() - authTime > 5 * 60 * 1000) {
          console.log("[INPI] Token potentiellement expiré, re-authentification...");
          cachedToken = null;
          tokenExpiry = 0;
          const newAuth = await getINPIToken();
          if (newAuth.token) {
            currentToken = newAuth.token;
            console.log("[INPI] Nouveau token obtenu");
          } else {
            console.error("[INPI] Re-auth failed:", newAuth.error);
          }
        }

        const acteId = acte.id;
        let acteType = "Acte";
        if (acte.typeRdd && Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0) {
          acteType = String(acte.typeRdd[0]?.typeActe || acte.typeRdd[0]?.decision || "Acte");
        } else if (typeof acte.typeRdd === "string") {
          acteType = acte.typeRdd;
        } else if (acte.type) {
          acteType = String(acte.type);
        }
        const acteDate = String(acte.dateDepot ?? acte.date ?? "");
        let nature = "";
        if (acte.typeRdd && Array.isArray(acte.typeRdd)) {
          nature = acte.typeRdd.map((t: any) => String(t.decision || t.typeActe || "")).filter(Boolean).join(", ");
        } else {
          nature = String(acte.nature ?? "");
        }
        const nomDoc = String(acte.nomDocument ?? "");
        const label = nature ? `${acteType} — ${nature} — ${acteDate}` : `${acteType} — ${nomDoc || "depot"} ${acteDate}`;
        const safeType = acteType.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const storagePath = `${cleanSiren}/${safeType}_${acteDate || acteId}.pdf`;

        const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
        const publicUrl = await downloadAndStore(supabase, currentToken, downloadUrl, storagePath);

        const isStatuts = (acte.typeRdd && Array.isArray(acte.typeRdd))
          ? acte.typeRdd.some((t: any) =>
              String(t.typeActe || "").toLowerCase().includes("statut") ||
              String(t.decision || "").toLowerCase().includes("statut"))
          : String(acteType).toLowerCase().includes("statut");
        const isPV = acteType.toLowerCase().includes("pv") || nature.toLowerCase().includes("pv") || nature.toLowerCase().includes("assembl");

        if (publicUrl) {
          documents.push({
            type: isStatuts ? "Statuts" : isPV ? "PV AG" : "Actes",
            label,
            url: publicUrl,
            source: "inpi",
            available: true,
            status: "auto",
            storedInSupabase: true,
          });
        } else {
          // Fallback: return INPI direct link (needs auth token to download)
          documents.push({
            type: isStatuts ? "Statuts" : isPV ? "PV AG" : "Actes",
            label,
            url: downloadUrl,
            inpiSiren: cleanSiren,
            source: "inpi",
            available: true,
            status: "lien_direct",
            storedInSupabase: false,
            needsAuth: true,
          });
        }
      }

      for (const bilan of bilans.slice(0, 3)) {
        // Re-auth if token is older than 5 minutes
        if (Date.now() - authTime > 5 * 60 * 1000) {
          console.log("[INPI] Token potentiellement expiré (bilans), re-authentification...");
          cachedToken = null;
          tokenExpiry = 0;
          const newAuth = await getINPIToken();
          if (newAuth.token) {
            currentToken = newAuth.token;
            console.log("[INPI] Nouveau token obtenu");
          }
        }

        const bilanId = bilan.id;
        const dateCloture = String(bilan.dateCloture ?? bilan.date_cloture ?? "");
        const typeBilan = String(bilan.typeBilan ?? "Comptes annuels");
        const storagePath = `${cleanSiren}/comptes_${dateCloture || bilanId}.pdf`;

        const downloadUrl = `${INPI_BASE}/bilans/${bilanId}/download`;
        const publicUrl = await downloadAndStore(supabase, currentToken, downloadUrl, storagePath);

        if (publicUrl) {
          documents.push({
            type: "Comptes annuels",
            label: `${typeBilan} — Cloture ${dateCloture}`,
            url: publicUrl,
            source: "inpi",
            available: true,
            status: "auto",
            storedInSupabase: true,
          });
        } else {
          documents.push({
            type: "Comptes annuels",
            label: `${typeBilan} — Cloture ${dateCloture}`,
            url: downloadUrl,
            inpiSiren: cleanSiren,
            source: "inpi",
            available: true,
            status: "lien_direct",
            storedInSupabase: false,
            needsAuth: true,
          });
        }
      }

      financials = parseFinancials(bilansSaisis);
    }

    // Generate Extrait RNE (equivalent Kbis) as HTML from INPI data
    // FIX 9: Escape HTML to prevent XSS from INPI data
    const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    if (companyData && companyRaw) {
      try {
        const adr = companyData.adresse ?? {};
        const adresseStr = escHtml([adr.numVoie, adr.typeVoie, adr.voie].filter(Boolean).join(" "));
        const denomination = escHtml(companyData.denomination || "");
        const today = new Date().toLocaleDateString("fr-FR");
        const todayISO = new Date().toISOString().slice(0, 10);

        const dirigeantsHtml = (companyData.dirigeants ?? [])
          .map((d: any) => `<div class="field"><span class="label">${escHtml(d.qualite || "Dirigeant")}</span><span class="value">${escHtml(d.nom)} ${escHtml(d.prenom)}${d.dateNaissance ? " — né(e) le " + escHtml(d.dateNaissance) : ""}${d.nationalite ? " — " + escHtml(d.nationalite) : ""}</span></div>`)
          .join("\n");
        const beHtml = (companyData.beneficiaires ?? [])
          .map((b: any) => `<div class="field"><span class="label">${escHtml(b.nom)} ${escHtml(b.prenom)}</span><span class="value">${b.pourcentageParts ?? 0}% parts — ${b.pourcentageVotes ?? 0}% votes${b.nationalite ? " — " + escHtml(b.nationalite) : ""}</span></div>`)
          .join("\n");

        const extraitHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Extrait RNE — ${denomination} — ${cleanSiren}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
  h1 { text-align: center; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; font-size: 22px; }
  h2 { color: #1a1a2e; margin-top: 30px; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
  .field { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
  .label { font-weight: bold; width: 250px; color: #555; flex-shrink: 0; }
  .value { flex: 1; }
  .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>EXTRAIT DU REGISTRE NATIONAL DES ENTREPRISES</h1>
<p style="text-align:center;color:#666;">Source : INPI &mdash; ${today}</p>

<h2>Identité</h2>
<div class="field"><span class="label">Dénomination</span><span class="value">${denomination}</span></div>
<div class="field"><span class="label">SIREN</span><span class="value">${cleanSiren}</span></div>
<div class="field"><span class="label">Forme juridique</span><span class="value">${escHtml(companyData.formeJuridiqueLabel || companyData.formeJuridique || "")}</span></div>
<div class="field"><span class="label">Capital</span><span class="value">${companyData.capital || 0} ${escHtml(companyData.deviseCapital || "EUR")}${companyData.capitalVariable ? " (variable)" : ""}</span></div>
<div class="field"><span class="label">Date immatriculation</span><span class="value">${escHtml(companyData.dateImmatriculation || "")}</span></div>
<div class="field"><span class="label">Durée</span><span class="value">${escHtml(companyData.duree || "")} ans</span></div>
<div class="field"><span class="label">Date clôture exercice</span><span class="value">${escHtml(companyData.dateClotureExercice || "")}</span></div>

<h2>Siège social</h2>
<div class="field"><span class="label">Adresse</span><span class="value">${adresseStr}</span></div>
<div class="field"><span class="label">Code postal</span><span class="value">${escHtml(adr.codePostal || "")}</span></div>
<div class="field"><span class="label">Commune</span><span class="value">${escHtml(adr.commune || "")}</span></div>

<h2>Activité</h2>
<div class="field"><span class="label">Activité principale</span><span class="value">${escHtml(companyData.activitePrincipale || "")}</span></div>
<div class="field"><span class="label">Objet social</span><span class="value">${escHtml((companyData.objetSocial || "").substring(0, 500))}</span></div>

<h2>Dirigeants</h2>
${dirigeantsHtml || '<div class="field"><span class="value" style="color:#999;">Aucun dirigeant déclaré</span></div>'}

<h2>Bénéficiaires effectifs</h2>
${beHtml || '<div class="field"><span class="value" style="color:#999;">Aucun bénéficiaire effectif déclaré</span></div>'}

<div class="footer">
  Document généré automatiquement depuis les données INPI<br>
  Ce document n'a pas de valeur légale officielle
</div>
</body></html>`;

        const extraitPath = cleanSiren + "/extrait_rne_" + todayISO + ".html";
        const encoder = new TextEncoder();
        const { error: uploadErr } = await supabase.storage
          .from("kyc-documents")
          .upload(extraitPath, encoder.encode(extraitHtml), {
            contentType: "text/html; charset=utf-8",
            upsert: true,
          });

        if (!uploadErr) {
          // FIX 5: Use signed URL for private bucket
          const { data: signedRne } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(extraitPath, 7 * 24 * 60 * 60);
          const rneUrl = signedRne?.signedUrl || (() => {
            const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(extraitPath);
            return urlData?.publicUrl || "";
          })();
          documents.unshift({
            type: "kbis",
            label: "Extrait RNE (équivalent Kbis) — " + today,
            url: rneUrl,
            source: "inpi",
            available: true,
            status: "auto",
            storedInSupabase: true,
            dateDepot: todayISO,
          });
          console.log("[INPI] Extrait RNE HTML généré et stocké");
        } else {
          console.error("[INPI] Extrait RNE upload error:", uploadErr.message);
        }
      } catch (e) {
        console.error("[INPI] Extrait RNE generation error:", (e as Error).message);
      }
    }

    console.log(`[INPI] === Done: ${documents.length} docs, ${documents.filter((d: any) => d.storedInSupabase).length} stored, ${financials.length} financial years ===`);

    return new Response(JSON.stringify({
      documents,
      companyData,
      financials,
      totalDocuments: documents.length,
      storedCount: documents.filter((d: any) => d.storedInSupabase).length,
      status: "ok",
      // FIX 28: Only include dlLogs in non-production for debugging
      ...(Deno.env.get("ENVIRONMENT") !== "production" ? { _dlLogs: dlLogs } : {}),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // FIX 27: Don't leak internal error details to client
    console.error("[INPI] Unhandled error:", (error as Error).message, (error as Error).stack?.substring(0, 300));
    return new Response(JSON.stringify({
      error: "Service INPI temporairement indisponible",
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
