import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAPPERS_API_KEY = Deno.env.get("PAPPERS_API_KEY") || "";
const PAPPERS_BASE = "https://api.pappers.fr/v2";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface CompanyData {
  siren: string;
  raison_sociale: string;
  forme_juridique: string;
  forme_juridique_raw: string;
  adresse: string;
  code_postal: string;
  ville: string;
  ape: string;
  libelle_ape: string;
  capital: number;
  date_creation: string;
  effectif: string;
  dirigeant: string;
  beneficiaires_effectifs: string;
  beneficiaires_details: Array<{
    nom: string;
    prenom: string;
    date_de_naissance: string;
    nationalite: string;
    pourcentage_parts: number;
  }>;
  representants: Array<{ nom: string; qualite: string }>;
  documents_disponibles: Array<{ type: string; date: string; url: string }>;
  document_urls: Record<string, string>;
  source: "pappers" | "insee" | "datagouv";
}

interface PappersCompany {
  siren?: string;
  nom_entreprise?: string;
  denomination?: string;
  forme_juridique?: string;
  adresse_ligne_1?: string;
  code_postal?: string;
  ville?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  capital?: number;
  date_creation?: string;
  tranche_effectif?: string;
  representants?: Array<{
    nom?: string;
    prenom?: string;
    qualite?: string;
    date_prise_poste?: string;
  }>;
  beneficiaires_effectifs?: Array<{
    nom?: string;
    prenom?: string;
    date_de_naissance_formatee?: string;
    nationalite?: string;
    pourcentage_parts?: number;
    pourcentage_votes?: number;
  }>;
  documents?: Array<{
    type?: string;
    date_depot?: string;
    url_telechargement?: string;
    token?: string;
  }>;
}

function mapFormeJuridique(forme: string | undefined): string {
  if (!forme) return "SARL";
  const f = forme.toUpperCase();
  if (f.includes("SAS") && !f.includes("SASU")) return "SAS";
  if (f.includes("SASU")) return "SAS";
  if (f.includes("SARL") && !f.includes("EURL")) return "SARL";
  if (f.includes("EURL")) return "EURL";
  if (f.includes("SCI")) return "SCI";
  if (f.includes("SCP")) return "SCP";
  if (f.includes("SELARL")) return "SELARL";
  if (f.includes("SELAS")) return "SELAS";
  if (f.includes("EARL")) return "EARL";
  if (f === "SA" || f.startsWith("SA ") || f.includes(" SA")) return "SA";
  if (f.includes("ASSOCIATION")) return "ASSOCIATION";
  if (f.includes("INDIVIDUELLE") || f.includes("ENTREPRENEUR") || f.includes("EI") || f.includes("MICRO")) return "ENTREPRISE INDIVIDUELLE";
  return forme;
}

function mapEffectif(tranche: string | undefined): string {
  if (!tranche) return "0 SALARIE";
  const t = tranche.toLowerCase().trim();
  if (t === "0" || t.includes("aucun") || t === "0 salarié" || t === "0 salarie") return "0 SALARIE";
  // Extract first number for range matching
  const num = parseInt(t.replace(/[^\d]/g, ""), 10);
  if (isNaN(num)) return t.toUpperCase();
  if (num === 0) return "0 SALARIE";
  if (num <= 2) return "1 OU 2 SALARIES";
  if (num <= 5) return "3 A 5 SALARIES";
  if (num <= 10) return "6 A 10 SALARIES";
  if (num <= 50) return "11 A 50 SALARIES";
  return "PLUS DE 50";
}

function formatSiren(siren: string): string {
  const clean = siren.replace(/\s/g, "");
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
  }
  return siren;
}

function buildDirigeant(representants: PappersCompany["representants"]): string {
  if (!representants || representants.length === 0) return "";
  const dirigeant = representants.find(
    (r) => r.qualite?.toUpperCase().includes("PRESIDENT") ||
           r.qualite?.toUpperCase().includes("GERANT") ||
           r.qualite?.toUpperCase().includes("DIRECTEUR")
  ) || representants[0];
  return `${(dirigeant.nom ?? "").toUpperCase()} ${dirigeant.prenom ?? ""}`;
}

function buildBeneficiaires(befs: PappersCompany["beneficiaires_effectifs"]): string {
  if (!befs || befs.length === 0) return "";
  return befs
    .map((b) => {
      const pct = b.pourcentage_parts ?? b.pourcentage_votes ?? 0;
      return `${(b.nom ?? "").toUpperCase()} ${b.prenom ?? ""} (${pct}%)`;
    })
    .join(" / ");
}

function buildBeneficiairesDetails(befs: PappersCompany["beneficiaires_effectifs"]): CompanyData["beneficiaires_details"] {
  if (!befs || befs.length === 0) return [];
  return befs.map((b) => ({
    nom: (b.nom ?? "").toUpperCase(),
    prenom: b.prenom ?? "",
    date_de_naissance: b.date_de_naissance_formatee ?? "",
    nationalite: b.nationalite ?? "Francaise",
    pourcentage_parts: b.pourcentage_parts ?? b.pourcentage_votes ?? 0,
  }));
}

// ======= LEVEL 1: PAPPERS API =======
async function searchPappersBySiren(siren: string): Promise<PappersCompany | null> {
  if (!PAPPERS_API_KEY) return null;
  try {
    const clean = siren.replace(/\s/g, "");
    const res = await fetch(
      `${PAPPERS_BASE}/entreprise?api_token=${PAPPERS_API_KEY}&siren=${clean}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function searchPappersByName(nom: string): Promise<PappersCompany[]> {
  if (!PAPPERS_API_KEY) return [];
  try {
    const res = await fetch(
      `${PAPPERS_BASE}/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(nom)}&par_page=5`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.resultats ?? [];
  } catch {
    return [];
  }
}

async function searchPappersByDirigeant(nom: string): Promise<PappersCompany[]> {
  if (!PAPPERS_API_KEY) return [];
  try {
    const res = await fetch(
      `${PAPPERS_BASE}/recherche-dirigeants?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(nom)}&par_page=5`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results: PappersCompany[] = [];
    for (const d of data.resultats ?? []) {
      if (d.entreprises) {
        for (const e of d.entreprises) {
          results.push(e);
        }
      }
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ======= LEVEL 2: DATA.GOUV.FR (free, no key) =======
interface DataGouvResponse {
  unite_legale?: {
    siren?: string;
    denomination?: string;
    nom_raison_sociale?: string;
    categorie_juridique?: string;
    date_creation?: string;
    tranche_effectifs?: string;
    activite_principale?: string;
    etablissement_siege?: {
      geo_adresse?: string;
      code_postal?: string;
      libelle_commune?: string;
      adresse_ligne_1?: string;
    };
    etablissements?: Array<{
      nic?: string;
      geo_adresse?: string;
      code_postal?: string;
      libelle_commune?: string;
    }>;
  };
}

async function searchDataGouvBySiren(siren: string): Promise<CompanyData | null> {
  const clean = siren.replace(/\s/g, "");
  try {
    const res = await fetch(
      `https://entreprise.data.gouv.fr/api/sirene/v3/unites_legales/${clean}`
    );
    if (!res.ok) return null;
    const data: DataGouvResponse = await res.json();
    const ul = data.unite_legale;
    if (!ul) return null;

    const siege = ul.etablissement_siege;
    const catJurMap: Record<string, string> = {
      "1000": "ENTREPRISE INDIVIDUELLE", "5410": "SARL", "5420": "SARL",
      "5498": "EURL", "5499": "EURL", "5710": "SAS", "5720": "SAS",
      "6540": "SCI", "6541": "SCI", "6542": "SCI",
    };
    const forme = catJurMap[ul.categorie_juridique ?? ""] || "SARL";

    return {
      siren: formatSiren(ul.siren ?? clean),
      raison_sociale: (ul.denomination || ul.nom_raison_sociale || "").toUpperCase(),
      forme_juridique: forme,
      forme_juridique_raw: ul.categorie_juridique ?? "",
      adresse: (siege?.geo_adresse || siege?.adresse_ligne_1 || "").toUpperCase(),
      code_postal: siege?.code_postal ?? "",
      ville: (siege?.libelle_commune ?? "").toUpperCase(),
      ape: ul.activite_principale ?? "",
      libelle_ape: "",
      capital: 0,
      date_creation: ul.date_creation ?? "",
      effectif: mapEffectif(ul.tranche_effectifs),
      dirigeant: "",
      beneficiaires_effectifs: "",
      beneficiaires_details: [],
      representants: [],
      documents_disponibles: [],
      document_urls: {},
      source: "datagouv",
    };
  } catch {
    return null;
  }
}

async function searchDataGouvByName(nom: string): Promise<CompanyData[]> {
  try {
    const res = await fetch(
      `https://entreprise.data.gouv.fr/api/sirene/v1/full_text/${encodeURIComponent(nom)}?per_page=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results: CompanyData[] = [];
    for (const e of data.etablissement ?? []) {
      results.push({
        siren: formatSiren(e.siren ?? ""),
        raison_sociale: (e.nom_raison_sociale || e.l1_normalisee || "").toUpperCase(),
        forme_juridique: mapFormeJuridique(e.libelle_nature_juridique_entreprise),
        forme_juridique_raw: e.libelle_nature_juridique_entreprise ?? "",
        adresse: (e.geo_adresse || "").toUpperCase(),
        code_postal: e.code_postal ?? "",
        ville: (e.libelle_commune ?? "").toUpperCase(),
        ape: e.activite_principale ?? "",
        libelle_ape: e.libelle_activite_principale ?? "",
        capital: 0,
        date_creation: e.date_creation ?? "",
        effectif: mapEffectif(e.tranche_effectifs),
        dirigeant: "",
        beneficiaires_effectifs: "",
        beneficiaires_details: [],
        representants: [],
        documents_disponibles: [],
        document_urls: {},
        source: "datagouv",
      });
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ======= DOCUMENT DOWNLOAD (Pappers only) =======
async function downloadDocument(
  url: string,
  siren: string,
  docType: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string | null> {
  try {
    const downloadUrl = `${url}?api_token=${PAPPERS_API_KEY}`;
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const supabase = createClient(supabaseUrl, serviceKey);
    const filePath = `${siren.replace(/\s/g, "")}/${docType}_${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(filePath, uint8, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }
    const { data: urlData, error: signError } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(filePath, 7 * 24 * 3600);
    if (signError || !urlData?.signedUrl) {
      console.error("Signed URL error:", signError);
      return null;
    }
    return urlData.signedUrl;
  } catch (e) {
    console.error("Download error:", e);
    return null;
  }
}

// ======= MAP PAPPERS COMPANY TO STANDARD FORMAT =======
function mapPappersCompany(company: PappersCompany): CompanyData {
  return {
    siren: formatSiren(company.siren ?? ""),
    raison_sociale: (company.nom_entreprise ?? company.denomination ?? "").toUpperCase(),
    forme_juridique: mapFormeJuridique(company.forme_juridique),
    forme_juridique_raw: company.forme_juridique ?? "",
    adresse: (company.adresse_ligne_1 ?? "").toUpperCase(),
    code_postal: company.code_postal ?? "",
    ville: (company.ville ?? "").toUpperCase(),
    ape: company.code_naf ?? "",
    libelle_ape: company.libelle_code_naf ?? "",
    capital: company.capital ?? 0,
    date_creation: company.date_creation ?? "",
    effectif: mapEffectif(company.tranche_effectif),
    dirigeant: buildDirigeant(company.representants),
    beneficiaires_effectifs: buildBeneficiaires(company.beneficiaires_effectifs),
    beneficiaires_details: buildBeneficiairesDetails(company.beneficiaires_effectifs),
    representants: (company.representants ?? []).map((r) => ({
      nom: `${(r.nom ?? "").toUpperCase()} ${r.prenom ?? ""}`,
      qualite: r.qualite ?? "",
    })),
    documents_disponibles: (company.documents ?? []).slice(0, 5).map((d) => ({
      type: d.type ?? "",
      date: d.date_depot ?? "",
      url: d.url_telechargement ?? "",
    })),
    document_urls: {},
    source: "pappers",
  };
}

// ======= MAIN HANDLER =======
Deno.serve(async (req: Request) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non autorise" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { mode, query, download_docs } = body as {
      mode: "siren" | "nom" | "dirigeant";
      query: string;
      download_docs?: boolean;
    };

    if (!query || !mode) {
      return new Response(
        JSON.stringify({ error: "mode and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validModes = ["siren", "nom", "dirigeant"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: "mode invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof query !== "string" || query.length > 200) {
      return new Response(
        JSON.stringify({ error: "query invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate SIREN format when in siren mode
    if (mode === "siren") {
      const cleanQuery = query.replace(/[\s.\-]/g, "");
      if (!/^\d{9,14}$/.test(cleanQuery)) {
        return new Response(
          JSON.stringify({ error: "Format SIREN/SIRET invalide" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let results: CompanyData[] = [];
    let source: "pappers" | "datagouv" = "pappers";

    // ===== LEVEL 1: Try Pappers =====
    if (PAPPERS_API_KEY) {
      try {
        switch (mode) {
          case "siren": {
            const result = await searchPappersBySiren(query);
            if (result) results = [mapPappersCompany(result)];
            break;
          }
          case "nom": {
            const nameResults = await searchPappersByName(query);
            results = nameResults.map(mapPappersCompany);
            break;
          }
          case "dirigeant": {
            const dirResults = await searchPappersByDirigeant(query);
            results = dirResults.map(mapPappersCompany);
            break;
          }
        }
      } catch (e) {
        console.error("Pappers API failed:", e);
      }
    }

    // ===== LEVEL 2: Fallback to data.gouv.fr =====
    if (results.length === 0) {
      source = "datagouv";
      try {
        switch (mode) {
          case "siren": {
            const dgResult = await searchDataGouvBySiren(query);
            if (dgResult) results = [dgResult];
            break;
          }
          case "nom":
          case "dirigeant": {
            results = await searchDataGouvByName(query);
            break;
          }
        }
      } catch (e) {
        console.error("data.gouv.fr API failed:", e);
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ results: [], message: "Aucun resultat trouve", source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download documents if requested (Pappers only)
    if (download_docs && source === "pappers" && PAPPERS_API_KEY) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      for (const company of results) {
        for (const doc of company.documents_disponibles.slice(0, 3)) {
          if (doc.url && doc.type) {
            const storedUrl = await downloadDocument(
              doc.url,
              company.siren,
              doc.type.toLowerCase().replace(/\s+/g, "_"),
              supabaseUrl,
              serviceKey
            );
            if (storedUrl) {
              company.document_urls[doc.type] = storedUrl;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ results, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[pappers-lookup] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: "Erreur interne du service Pappers" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
