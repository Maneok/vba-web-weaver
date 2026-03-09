import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

// Probleme 5: Mapping codes INSEE -> libelles
const FORMES_JURIDIQUES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "1100": "Entrepreneur individuel",
  "1200": "Entrepreneur individuel",
  "1300": "Entrepreneur individuel",
  "5410": "SARL", "5411": "SARL", "5422": "SARL", "5426": "SARL",
  "5430": "SARL", "5431": "SARL", "5432": "SARL", "5442": "SARL",
  "5443": "SARL", "5451": "SARL", "5453": "SARL", "5460": "SARL",
  "5499": "EURL", "5498": "EURL",
  "5510": "SA", "5511": "SA", "5515": "SA", "5520": "SA",
  "5522": "SA", "5525": "SA", "5530": "SA", "5531": "SA",
  "5532": "SA", "5538": "SA", "5539": "SA", "5540": "SA",
  "5542": "SA", "5543": "SA", "5546": "SA", "5547": "SA",
  "5548": "SA", "5551": "SA", "5552": "SA", "5553": "SA",
  "5554": "SA", "5555": "SA", "5559": "SA", "5560": "SA",
  "5570": "SA", "5585": "SA", "5599": "SA",
  "5710": "SAS", "5720": "SASU",
  "6540": "SCI", "6541": "SCI", "6542": "SCI", "6543": "SCI", "6544": "SCI",
  "6551": "Societe civile", "6554": "Societe civile", "6558": "Societe civile",
  "6560": "SCP", "6561": "SCP", "6562": "SCP", "6563": "SCP",
  "6564": "SCP", "6565": "SCP", "6566": "SCP",
  "6577": "Societe civile", "6578": "Societe civile", "6585": "Societe civile",
  "6588": "Societe civile", "6589": "Societe civile", "6595": "Societe civile",
  "6596": "Societe civile", "6597": "Societe civile", "6598": "Societe civile",
  "6599": "Societe civile",
  "5191": "SELARL", "5192": "SELAS", "5193": "SELAFA", "5194": "SELCA",
  "5195": "SEL", "5196": "SELEURL", "5470": "SELARL",
  "9210": "Association loi 1901", "9220": "Syndicat", "9221": "Syndicat",
  "9222": "Syndicat", "9223": "Syndicat", "9224": "Syndicat",
  "9230": "Association loi 1901", "9240": "Association loi 1901",
  "5610": "SNC", "5615": "SNC", "5620": "SNC", "5625": "SNC",
  "5630": "SNC", "5631": "SNC", "5632": "SNC",
  "5800": "EARL",
  "2110": "ENTREPRISE INDIVIDUELLE", "2120": "ENTREPRISE INDIVIDUELLE",
  "2210": "ENTREPRISE INDIVIDUELLE", "2310": "ENTREPRISE INDIVIDUELLE",
  "2320": "ENTREPRISE INDIVIDUELLE", "2385": "ENTREPRISE INDIVIDUELLE",
  "2400": "ENTREPRISE INDIVIDUELLE", "2700": "ENTREPRISE INDIVIDUELLE",
  "2900": "ENTREPRISE INDIVIDUELLE",
};

function buildAddress(siege: any): string {
  const parts: string[] = [];
  if (siege.numero_voie) parts.push(siege.numero_voie);
  if (siege.type_voie) parts.push(siege.type_voie);
  if (siege.libelle_voie) parts.push(siege.libelle_voie);
  const streetAddress = parts.join(" ").trim();
  if (streetAddress && streetAddress.length > 3) return streetAddress.toUpperCase();
  const fallback = siege.geo_adresse ?? siege.adresse ?? "";
  if (fallback && !fallback.includes("[nd]")) return fallback.toUpperCase();
  return "";
}

// ====== INPI Auth with token cache ======
const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";
let cachedToken: string | null = null;
let tokenExpiry = 0;
let tokenRefreshing: Promise<string | null> | null = null;

async function getINPIToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  // Prevent thundering herd: reuse in-flight refresh
  if (tokenRefreshing) return tokenRefreshing;
  tokenRefreshing = _refreshINPIToken();
  try { return await tokenRefreshing; } finally { tokenRefreshing = null; }
}

async function _refreshINPIToken(): Promise<string | null> {
  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) return null;

  try {
    const res = await fetch(`${INPI_BASE}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error(`[INPI] Auth failed: ${res.status}`); return null; }
    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      tokenExpiry = Date.now() + 8 * 60 * 1000;
      return data.token;
    }
    return null;
  } catch (e) {
    console.error("[INPI] Auth error:", (e as Error).message);
    return null;
  }
}

// ====== INPI Company Data Parsing ======
function parseINPICompany(raw: any): any {
  if (!raw) return null;

  const formality = raw.formality ?? raw;
  const content = formality?.content ?? raw;

  // Personne Morale
  const pm = content?.personneMorale ?? raw?.personneMorale;
  if (pm) {
    const identite = pm?.identite ?? {};
    const entreprise = identite?.entreprise ?? {};
    const description = identite?.description ?? {};
    const adresseEnt = pm?.adresseEntreprise ?? pm?.etablissementPrincipal?.adresse ?? {};
    const adresse = adresseEnt?.adresse ?? adresseEnt ?? {};
    const pouvoirs = (pm?.composition?.pouvoirs ?? []);

    // Parse dirigeants from pouvoirs — INPI structure: individu.descriptionPersonne
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
          date_naissance: desc.dateDeNaissance ?? "",
          nationalite: desc.nationalite ?? "",
        };
      });

    // Parse BE: field beneficiaireEffectif does NOT exist in INPI API
    // Check for it anyway (future-proofing), then fallback to deduction
    const beneficiaires = pouvoirs
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
          date_naissance: desc.dateDeNaissance ?? "",
          nationalite: desc.nationalite ?? "",
          pourcentage_parts: p.pourcentageDetentionCapital ?? 0,
          pourcentage_votes: p.pourcentageDetentionDroitVote ?? 0,
          role: p.roleEntreprise ?? "",
          source: "INPI",
        };
      });

    console.log("[INPI BE] Pouvoirs total:", pouvoirs.length,
      "| Dont BE:", beneficiaires.length,
      "| Dirigeants:", dirigeants.length);

    // Fallback: if no BE declared, deduce from structure
    if (beneficiaires.length === 0 && dirigeants.length > 0) {
      const forme = (description.formeJuridique ?? entreprise.formeJuridique ?? formality?.formeJuridique ?? "").toUpperCase();
      const isAssocieUnique = description.indicateurAssocieUnique === true ||
        forme.includes("SASU") || forme.includes("EURL") || forme.includes("SNC");

      // P5-21: Guard against empty dirigeants array
      if ((isAssocieUnique || dirigeants.length === 1) && dirigeants[0]) {
        beneficiaires.push({
          nom: dirigeants[0].nom,
          prenom: dirigeants[0].prenom,
          date_naissance: dirigeants[0].date_naissance || "",
          nationalite: dirigeants[0].nationalite || "",
          pourcentage_parts: 100,
          pourcentage_votes: 100,
          role: dirigeants[0].qualite || "Dirigeant unique",
          source: "INPI (deduit)",
        });
        console.log("[INPI BE] Fallback: dirigeant unique utilise comme BE a 100%");
      }
    }

    const numVoie = adresse.numVoie ?? "";
    const typeVoie = adresse.typeVoie ?? "";
    const voie = adresse.voie ?? adresse.libelle ?? "";
    const adresseStr = [numVoie, typeVoie, voie].filter(Boolean).join(" ").toUpperCase();

    return {
      type: "morale",
      denomination: (entreprise.denomination ?? raw.denomination ?? "").toUpperCase(),
      formeJuridique: description.libelleFormeJuridique ?? entreprise.formeJuridique ?? "",
      formeJuridiqueCode: entreprise.formeJuridique ?? "",
      capital: description.montantCapital ?? 0,
      adresse: adresseStr,
      codePostal: adresse.codePostal ?? "",
      commune: (adresse.commune ?? "").toUpperCase(),
      dirigeants,
      beneficiaires,
      objetSocial: description.objet ?? description.objetSocial ?? "",
      duree: description.duree ?? "",
      dateClotureExercice: description.dateClotureExerciceSocial ?? "",
      dateImmatriculation: description.dateImmatriculation ?? raw.dateImmatriculation ?? "",
      dateDebutActivite: description.dateDebutActivite ?? "",
      activitePrincipale: description.activitePrincipale ?? "",
      ess: description.economeSocialeSolidaire === true,
      societeMission: description.societeMission === true,
      associeUnique: description.associeUnique === true || description.associeUnique === "true",
      capitalVariable: description.capitalVariable === true || description.capitalVariable === "true",
      domiciliataire: adresseEnt?.domiciliataire ?? null,
      nonDiffusible: raw.statutDiffusion === "N",
      etatAdministratif: raw.etatAdministratif ?? "A",
      etablissements: (raw.etablissements ?? []).map((e: any) => ({
        siret: e.siret ?? "",
        adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
        commune: e.adresse?.commune ?? "",
        est_siege: e.roleEtablissement === "siege" || e.estSiege === true,
      })),
    };
  }

  // Personne Physique (EI)
  const pp = content?.personnePhysique ?? raw?.personnePhysique;
  if (pp) {
    const identite = pp?.identite ?? {};
    const entrepreneur = identite?.entrepreneur ?? {};
    const desc = entrepreneur?.descriptionPersonne ?? {};
    const descEnt = entrepreneur?.descriptionEntreprise ?? identite?.description ?? {};
    const adresseEnt = pp?.adresseEntreprise ?? pp?.etablissementPrincipal?.adresse ?? {};
    const adresse = adresseEnt?.adresse ?? adresseEnt ?? {};

    const nom = (desc.nom ?? desc.nomNaissance ?? "").toUpperCase();
    const prenom = desc.prenoms ?? desc.prenom ?? "";
    const denomination = descEnt.denomination ?? `${prenom} ${nom}`.trim();

    const numVoie = adresse.numVoie ?? "";
    const typeVoie = adresse.typeVoie ?? "";
    const voie = adresse.voie ?? adresse.libelle ?? "";
    const adresseStr = [numVoie, typeVoie, voie].filter(Boolean).join(" ").toUpperCase();

    const isEirl = identite?.eirl === true || identite?.eirl?.indicateur === true;

    return {
      type: "physique",
      denomination: denomination.toUpperCase(),
      formeJuridique: isEirl ? "EIRL" : "Entrepreneur individuel",
      formeJuridiqueCode: "",
      capital: 0,
      adresse: adresseStr,
      codePostal: adresse.codePostal ?? "",
      commune: (adresse.commune ?? "").toUpperCase(),
      dirigeants: [{ nom, prenom, qualite: "Entrepreneur individuel", date_naissance: desc.dateDeNaissance ?? "", nationalite: desc.nationalite ?? "" }],
      beneficiaires: [],
      objetSocial: descEnt?.objet ?? "",
      duree: "",
      dateClotureExercice: descEnt?.dateClotureExercice ?? "",
      dateImmatriculation: descEnt?.dateImmatriculation ?? raw.dateImmatriculation ?? "",
      dateDebutActivite: descEnt?.dateDebutActivite ?? "",
      activitePrincipale: descEnt?.activitePrincipale ?? "",
      ess: false, societeMission: false, associeUnique: false, capitalVariable: false,
      domiciliataire: adresseEnt?.domiciliataire ?? null,
      nonDiffusible: raw.statutDiffusion === "N",
      etatAdministratif: raw.etatAdministratif ?? "A",
      etablissements: (raw.etablissements ?? []).map((e: any) => ({
        siret: e.siret ?? "", adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
        commune: e.adresse?.commune ?? "", est_siege: e.roleEtablissement === "siege" || e.estSiege === true,
      })),
    };
  }

  // Exploitation agricole
  const expl = content?.exploitation ?? raw?.exploitation;
  if (expl) {
    const identite = expl?.identite ?? {};
    const desc = identite?.entrepreneur?.descriptionPersonne ?? {};
    const descEnt = identite?.description ?? {};
    const adresseExpl = expl?.adresseEntreprise ?? {};
    const adresse = adresseExpl?.adresse ?? adresseExpl ?? {};
    const nom = (desc.nom ?? "").toUpperCase();
    const prenom = desc.prenoms ?? desc.prenom ?? "";
    const adresseStr = [adresse.numVoie, adresse.typeVoie, adresse.voie].filter(Boolean).join(" ").toUpperCase();

    return {
      type: "exploitation",
      denomination: (descEnt?.denomination ?? `${prenom} ${nom}`.trim()).toUpperCase(),
      formeJuridique: "EARL", formeJuridiqueCode: "",
      capital: 0, adresse: adresseStr, codePostal: adresse.codePostal ?? "",
      commune: (adresse.commune ?? "").toUpperCase(),
      dirigeants: nom ? [{ nom, prenom, qualite: "Exploitant", date_naissance: desc.dateDeNaissance ?? "", nationalite: desc.nationalite ?? "" }] : [],
      beneficiaires: [], objetSocial: descEnt?.objet ?? "", duree: "", dateClotureExercice: "",
      dateImmatriculation: raw.dateImmatriculation ?? "", dateDebutActivite: descEnt?.dateDebutActivite ?? "",
      activitePrincipale: descEnt?.activitePrincipale ?? "",
      ess: false, societeMission: false, associeUnique: false, capitalVariable: false,
      domiciliataire: null, nonDiffusible: raw.statutDiffusion === "N",
      etatAdministratif: raw.etatAdministratif ?? "A",
      etablissements: (raw.etablissements ?? []).map((e: any) => ({
        siret: e.siret ?? "", adresse: [e.adresse?.numVoie, e.adresse?.typeVoie, e.adresse?.voie].filter(Boolean).join(" "),
        commune: e.adresse?.commune ?? "", est_siege: e.roleEtablissement === "siege" || e.estSiege === true,
      })),
    };
  }

  return null;
}

// ====== Geocoding via Nominatim (fallback for GPS) ======
async function geocodeAddress(adresse: string, codePostal: string, ville: string): Promise<{ latitude: number | null; longitude: number | null }> {
  const noGps = { latitude: null, longitude: null };
  const q = [adresse, codePostal, ville].filter(Boolean).join(", ");
  if (!q || q.length < 5) return noGps;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LCB-FT-Matrice/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      }
    }
  } catch {
    console.log("[Nominatim] Geocoding failed");
  }
  return noGps;
}

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { mode, query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query requis", results: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clean = (query as string).replace(/[\s.\-]/g, "");
    const isSirenMode = mode === "siren" && /^\d{9,14}$/.test(clean);
    const siren9 = isSirenMode ? clean.slice(0, 9) : "";
    const pappersKey = Deno.env.get("PAPPERS");
    const sources: string[] = [];

    // ====== PHASE 1: INPI (source principale) ======
    let inpiResult: any = null;
    if (isSirenMode && siren9) {
      const token = await getINPIToken();
      if (token) {
        try {
          console.log(`[INPI] GET /companies/${siren9}`);
          const res = await fetch(`${INPI_BASE}/companies/${siren9}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const raw = await res.json();
            inpiResult = parseINPICompany(raw);
            if (inpiResult) {
              sources.push("INPI");
              console.log(`[INPI] Company parsed: ${inpiResult.denomination} (${inpiResult.type})`);

              // Get siret from etablissements
              const siegeEtab = inpiResult.etablissements?.find((e: any) => e.est_siege);
              const siret = siegeEtab?.siret ?? raw.etablissements?.[0]?.siret ?? "";

              // Get APE from raw
              const ape = raw.activitePrincipale ?? inpiResult.activitePrincipale ?? "";
              const libelleApe = raw.libelleActivitePrincipale ?? "";

              inpiResult.siret = siret;
              inpiResult.siren = siren9;
              inpiResult.ape = ape;
              inpiResult.libelleApe = libelleApe;
              inpiResult.effectif = raw.trancheEffectifSalarie ?? "";
              inpiResult.dateCreation = raw.dateCreation ?? inpiResult.dateImmatriculation ?? "";
            }
          } else {
            console.error(`[INPI] companies/${siren9}: ${res.status}`);
            if (res.status === 401) { cachedToken = null; tokenExpiry = 0; }
          }
        } catch (e) {
          console.error("[INPI] Company fetch error:", (e as Error).message);
        }
      }
    }

    // ====== PHASE 2: Pappers enrichment ======
    let pappersData: any = null;
    if (pappersKey && siren9) {
      try {
        const pRes = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(pappersKey)}&siren=${siren9}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (pRes.ok) {
          pappersData = await pRes.json();
          sources.push("Pappers");
          console.log("[Pappers] Enrichment OK");
        }
      } catch {
        console.log("[Pappers] Enrichment failed");
      }
    }

    // ====== PHASE 3: Annuaire Entreprises (fallback, name search, or GPS enrichment) ======
    let annuaireResults: any[] = [];
    let annuaireGps: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
    if (true) { // Always call Annuaire: as fallback, for name search, or for GPS data
      try {
        let url: string;
        if (isSirenMode) {
          url = `https://recherche-entreprises.api.gouv.fr/search?q=${siren9}`;
        } else {
          url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=5`;
        }
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          annuaireResults = data.results ?? [];
          if (annuaireResults.length > 0) {
            if (!sources.includes("AnnuaireEntreprises")) sources.push("AnnuaireEntreprises");
            // Extract GPS from first matching result
            const firstSiege = annuaireResults[0]?.siege;
            if (firstSiege?.latitude != null && firstSiege?.longitude != null) {
              annuaireGps = { latitude: parseFloat(firstSiege.latitude), longitude: parseFloat(firstSiege.longitude) };
            }
          }
          console.log(`[Annuaire] ${annuaireResults.length} result(s)`);
        }
      } catch {
        console.log("[Annuaire] Failed");
      }
    }

    // ====== BUILD UNIFIED RESULTS ======
    let results: any[];

    if (isSirenMode && (inpiResult || pappersData)) {
      // Merge INPI + Pappers into single result
      const telephone = pappersData?.telephone ?? "";
      const email = pappersData?.email ?? "";
      const siteWeb = pappersData?.site_web ?? "";

      // Capital: INPI first, then Pappers
      let capital = inpiResult?.capital ?? 0;
      let capitalSource = capital > 0 ? "INPI" : "";
      if (!capital && pappersData?.capital > 0) {
        capital = pappersData.capital;
        capitalSource = "Pappers";
      }

      // Address: INPI first, then Pappers, then Annuaire
      let adresse = inpiResult?.adresse ?? "";
      let cp = inpiResult?.codePostal ?? "";
      let ville = inpiResult?.commune ?? "";
      if (!adresse && pappersData?.siege) {
        adresse = (pappersData.siege.adresse_ligne_1 ?? "").toUpperCase();
        cp = pappersData.siege.code_postal ?? "";
        ville = (pappersData.siege.ville ?? "").toUpperCase();
      }

      // Denomination: INPI first
      const denomination = inpiResult?.denomination ?? (pappersData?.nom_entreprise ?? pappersData?.denomination ?? "").toUpperCase();

      // Forme: INPI first, then Pappers
      let formeJuridique = inpiResult?.formeJuridique ?? "";
      let formeRaw = formeJuridique;
      if (!formeJuridique && pappersData?.forme_juridique) {
        formeJuridique = pappersData.forme_juridique;
        formeRaw = pappersData.forme_juridique;
      }
      // Map INPI code to standard label
      const codeFormeInpi = inpiResult?.formeJuridiqueCode ?? "";
      if (codeFormeInpi && FORMES_JURIDIQUES[codeFormeInpi]) {
        formeJuridique = FORMES_JURIDIQUES[codeFormeInpi];
      }

      // Dirigeants: INPI first, merge with Pappers representants
      const dirigeants = inpiResult?.dirigeants ?? [];
      if (dirigeants.length === 0 && pappersData?.representants) {
        for (const rep of pappersData.representants) {
          dirigeants.push({
            nom: (rep.nom ?? "").toUpperCase(),
            prenom: rep.prenom ?? "",
            qualite: rep.qualite ?? "",
            date_naissance: rep.date_de_naissance ?? "",
            nationalite: rep.nationalite ?? "",
          });
        }
      }

      // BE: INPI first, then Pappers (Pappers usually more detailed)
      let beneficiaires = inpiResult?.beneficiaires ?? [];
      console.log(`[BE] INPI beneficiaires: ${beneficiaires.length}`, JSON.stringify(beneficiaires));
      console.log(`[BE] Pappers beneficiaires_effectifs: ${pappersData?.beneficiaires_effectifs?.length ?? 0}`, JSON.stringify(pappersData?.beneficiaires_effectifs ?? []));
      if (beneficiaires.length === 0 && pappersData?.beneficiaires_effectifs) {
        beneficiaires = pappersData.beneficiaires_effectifs.map((be: any) => ({
          nom: (be.nom ?? "").toUpperCase(),
          prenom: be.prenom ?? "",
          date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
          nationalite: be.nationalite ?? "",
          pourcentage_parts: be.pourcentage_parts ?? 0,
          pourcentage_votes: be.pourcentage_votes ?? 0,
        }));
      } else if (pappersData?.beneficiaires_effectifs?.length > 0) {
        // Pappers has more detail — use Pappers for BE if available
        beneficiaires = pappersData.beneficiaires_effectifs.map((be: any) => ({
          nom: (be.nom ?? "").toUpperCase(),
          prenom: be.prenom ?? "",
          date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
          nationalite: be.nationalite ?? "",
          pourcentage_parts: be.pourcentage_parts ?? 0,
          pourcentage_votes: be.pourcentage_votes ?? 0,
        }));
      }

      // Dédupliquer BE par nom de famille
      const seenBE = new Set<string>();
      beneficiaires = beneficiaires.filter((b: any) => {
        const key = (b.nom || "").toUpperCase().trim();
        if (!key) return true;
        if (seenBE.has(key)) return false;
        seenBE.add(key);
        return true;
      });

      // Si un BE n'a pas de prénom mais qu'un dirigeant avec le même nom en a un, le compléter
      for (const be of beneficiaires) {
        if (!be.prenom) {
          const dir = dirigeants.find((d: any) => (d.nom || "").toUpperCase() === (be.nom || "").toUpperCase());
          if (dir?.prenom) be.prenom = dir.prenom;
        }
      }

      // Finances from Pappers
      const finances: any[] = [];
      if (pappersData?.finances && Object.keys(pappersData.finances).length > 0) {
        const years = Object.keys(pappersData.finances).sort().reverse();
        for (const yr of years.slice(0, 3)) {
          const f = pappersData.finances[yr];
          if (f) finances.push({ annee: yr, ca: f.ca ?? f.chiffre_affaires ?? null, resultat: f.resultat ?? null, effectif: f.effectif ?? null });
        }
      }

      // Representants with entreprises_dirigees from Pappers
      const representants = (pappersData?.representants ?? []).map((rep: any) => ({
        nom: rep.nom ?? "", prenom: rep.prenom ?? "", qualite: rep.qualite ?? "",
        date_prise_de_poste: rep.date_prise_de_poste ?? "",
        entreprises_dirigees: (rep.entreprises_dirigees ?? []).map((ent: any) => ({
          siren: (ent.siren ?? "").replace(/\s/g, ""),
          denomination: ent.denomination ?? ent.nom_entreprise ?? "",
          qualite: ent.qualite ?? "",
          date_prise_de_poste: ent.date_prise_de_poste ?? "",
          statut_rcs: ent.statut_rcs ?? "",
          date_creation: ent.date_creation ?? "",
        })),
      }));

      const dirigeantPrincipal = dirigeants.length > 0 && dirigeants[0]
        ? `${dirigeants[0].nom} ${dirigeants[0].prenom}`.trim().toUpperCase()
        : "";

      // APE: INPI or Pappers
      const ape = inpiResult?.ape ?? pappersData?.code_naf ?? "";
      const libelleApe = inpiResult?.libelleApe ?? pappersData?.libelle_code_naf ?? "";

      // Siret
      const siret = inpiResult?.siret ?? pappersData?.siege?.siret ?? "";

      // Effectif
      const effectif = inpiResult?.effectif ?? pappersData?.effectif ?? "0 SALARIE";

      // GPS: Pappers siege, then Annuaire, then Nominatim fallback
      let gps = { latitude: null as number | null, longitude: null as number | null };
      if (pappersData?.siege?.latitude != null && pappersData?.siege?.longitude != null) {
        gps = { latitude: parseFloat(pappersData.siege.latitude), longitude: parseFloat(pappersData.siege.longitude) };
      } else if (annuaireGps.latitude != null) {
        gps = annuaireGps;
      }
      if (gps.latitude == null && adresse) {
        gps = await geocodeAddress(adresse, cp, ville);
      }

      results = [{
        siren: `${siren9.slice(0, 3)} ${siren9.slice(3, 6)} ${siren9.slice(6, 9)}`,
        siret,
        raison_sociale: denomination,
        forme_juridique: formeJuridique,
        forme_juridique_code: codeFormeInpi || (pappersData?.forme_juridique_code ?? ""),
        forme_juridique_raw: formeRaw,
        adresse,
        code_postal: cp,
        ville,
        latitude: gps.latitude,
        longitude: gps.longitude,
        ape,
        libelle_ape: libelleApe,
        capital,
        capital_source: capitalSource,
        date_creation: inpiResult?.dateCreation ?? pappersData?.date_creation ?? "",
        effectif,
        dirigeant: dirigeantPrincipal,
        dirigeants,
        telephone,
        email,
        site_web: siteWeb,
        beneficiaires_effectifs: beneficiaires,
        finances,
        representants,
        nombre_etablissements: inpiResult?.etablissements?.length ?? pappersData?.nombre_etablissements ?? 1,
        etat_administratif: inpiResult?.etatAdministratif ?? pappersData?.statut ?? "A",
        complements: {},
        etablissements: (inpiResult?.etablissements ?? []).slice(0, 5),
        sources,
        source: sources[0] ?? "unknown",
      }];
    } else {
      // Fallback: Annuaire Entreprises only (name search or INPI+Pappers failed)
      results = await Promise.all(annuaireResults.slice(0, 10).map(async (r: any) => {
        const siege = r.siege ?? {};
        const dirigeants = (r.dirigeants ?? []).map((d: any) => ({
          nom: d.nom ?? "", prenom: d.prenom ?? "",
          qualite: d.qualite ?? d.fonction ?? "",
          date_naissance: d.date_de_naissance ?? "",
          nationalite: d.nationalite ?? "",
        }));

        const siren = (r.siren ?? "").replace(/\s/g, "");
        const codeFormeJuridique = String(r.nature_juridique ?? "");
        const formeLabel = FORMES_JURIDIQUES[codeFormeJuridique] ?? r.libelle_nature_juridique ?? codeFormeJuridique;
        const adresse = buildAddress(siege);

        // Pappers enrichment per result for name searches
        let capital = 0;
        let capitalSource = "";
        let telephone = "";
        let email = "";
        let siteWeb = "";
        let beneficiaires: any[] = [];
        let finances: any[] = [];
        let representants: any[] = [];
        let pappersAdresse = "";
        let pappersCp = "";
        let pappersVille = "";

        if (pappersKey && siren) {
          try {
            const pRes = await fetch(
              `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(pappersKey)}&siren=${siren}`,
              { signal: AbortSignal.timeout(6000) }
            );
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.capital > 0) { capital = pData.capital; capitalSource = "Pappers"; }
              telephone = pData.telephone ?? "";
              email = pData.email ?? "";
              siteWeb = pData.site_web ?? "";
              if (pData.siege) {
                pappersAdresse = pData.siege.adresse_ligne_1 ?? "";
                pappersCp = pData.siege.code_postal ?? "";
                pappersVille = pData.siege.ville ?? "";
              }
              beneficiaires = (pData.beneficiaires_effectifs ?? []).map((be: any) => ({
                nom: be.nom ?? "", prenom: be.prenom ?? "",
                date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
                nationalite: be.nationalite ?? "",
                pourcentage_parts: be.pourcentage_parts ?? 0,
                pourcentage_votes: be.pourcentage_votes ?? 0,
              }));
              if (pData.finances && Object.keys(pData.finances).length > 0) {
                const years = Object.keys(pData.finances).sort().reverse();
                for (const yr of years.slice(0, 3)) {
                  const f = pData.finances[yr];
                  if (f) finances.push({ annee: yr, ca: f.ca ?? f.chiffre_affaires ?? null, resultat: f.resultat ?? null, effectif: f.effectif ?? null });
                }
              }
              representants = (pData.representants ?? []).map((rep: any) => ({
                nom: rep.nom ?? "", prenom: rep.prenom ?? "", qualite: rep.qualite ?? "",
                date_prise_de_poste: rep.date_prise_de_poste ?? "",
                entreprises_dirigees: (rep.entreprises_dirigees ?? []).map((ent: any) => ({
                  siren: (ent.siren ?? "").replace(/\s/g, ""),
                  denomination: ent.denomination ?? ent.nom_entreprise ?? "",
                  qualite: ent.qualite ?? "", date_prise_de_poste: ent.date_prise_de_poste ?? "",
                  statut_rcs: ent.statut_rcs ?? "", date_creation: ent.date_creation ?? "",
                })),
              }));
            }
          } catch { /* Pappers unavailable */ }
        }
        if (!capital && (r.capital ?? 0) > 0) { capital = r.capital; capitalSource = "data.gouv"; }

        // GPS: Annuaire siege first, then Nominatim fallback
        let lat: number | null = siege.latitude != null ? parseFloat(siege.latitude) : null;
        let lon: number | null = siege.longitude != null ? parseFloat(siege.longitude) : null;
        if (lat == null || lon == null) {
          const finalAddr = adresse || pappersAdresse.toUpperCase();
          const finalCp = siege.code_postal || pappersCp || "";
          const finalVille = (siege.libelle_commune ?? siege.commune ?? "").toUpperCase() || pappersVille.toUpperCase();
          if (finalAddr) {
            const geo = await geocodeAddress(finalAddr, finalCp, finalVille);
            lat = geo.latitude;
            lon = geo.longitude;
          }
        }

        return {
          siren: siren ? `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}` : "",
          siret: siege.siret ?? "",
          raison_sociale: (r.nom_complet ?? r.nom_raison_sociale ?? "").toUpperCase(),
          forme_juridique: formeLabel,
          forme_juridique_code: codeFormeJuridique,
          forme_juridique_raw: r.libelle_nature_juridique ?? formeLabel,
          adresse: adresse || pappersAdresse.toUpperCase(),
          code_postal: siege.code_postal || pappersCp || "",
          ville: (siege.libelle_commune ?? siege.commune ?? "").toUpperCase() || pappersVille.toUpperCase(),
          latitude: lat,
          longitude: lon,
          ape: siege.activite_principale ?? r.activite_principale ?? "",
          libelle_ape: siege.libelle_activite_principale ?? r.libelle_activite_principale ?? "",
          capital, capital_source: capitalSource,
          date_creation: r.date_creation ?? "",
          effectif: r.tranche_effectif_salarie ?? siege.tranche_effectif_salarie ?? "0 SALARIE",
          dirigeant: dirigeants.length > 0 && dirigeants[0] ? `${dirigeants[0].nom} ${dirigeants[0].prenom}`.trim().toUpperCase() : "",
          dirigeants, telephone, email, site_web: siteWeb,
          beneficiaires_effectifs: beneficiaires,
          finances, representants,
          nombre_etablissements: r.nombre_etablissements ?? 1,
          etat_administratif: r.etat_administratif ?? "A",
          complements: r.complements ?? {},
          etablissements: (r.matching_etablissements ?? []).slice(0, 5).map((e: any) => ({
            siret: e.siret ?? "", adresse: e.adresse ?? "",
            commune: e.libelle_commune ?? "", est_siege: e.est_siege ?? false,
          })),
          sources: ["AnnuaireEntreprises", ...(pappersKey ? ["Pappers"] : [])],
          source: "annuaire_entreprises",
        };
      }));
    }

    return new Response(JSON.stringify({
      results,
      total: results.length,
      sources,
      source: sources[0] ?? "annuaire_entreprises",
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[enterprise-lookup] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "Erreur interne du service de recherche entreprise", results: [], status: "unavailable" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
