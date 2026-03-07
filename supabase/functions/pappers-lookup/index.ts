import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAPPERS_API_KEY = Deno.env.get("PAPPERS_API_KEY") ?? "";
const PAPPERS_BASE = "https://api.pappers.fr/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  if (f.includes("SELAS")) return "SELAS";
  if (f.includes("SELARL")) return "SELAS";
  if (f.includes("EARL")) return "EARL";
  if (f === "SA" || f.startsWith("SA ") || f.includes(" SA")) return "SA";
  if (f.includes("ASSOCIATION")) return "ASSOCIATION";
  if (f.includes("INDIVIDUELLE") || f.includes("ENTREPRENEUR") || f.includes("EI") || f.includes("MICRO")) return "ENTREPRISE INDIVIDUELLE";
  return forme;
}

function mapEffectif(tranche: string | undefined): string {
  if (!tranche) return "0 SALARIE";
  const t = tranche.toLowerCase();
  if (t.includes("0") || t.includes("aucun")) return "0 SALARIE";
  if (t.includes("1") || t.includes("2")) return "1 OU 2 SALARIES";
  if (t.includes("3") || t.includes("5")) return "3 A 5 SALARIES";
  if (t.includes("6") || t.includes("10")) return "6 A 10 SALARIES";
  if (t.includes("11") || t.includes("50")) return "11 A 50 SALARIES";
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

async function searchBySiren(siren: string): Promise<PappersCompany | null> {
  const clean = siren.replace(/\s/g, "");
  const res = await fetch(
    `${PAPPERS_BASE}/entreprise?api_token=${PAPPERS_API_KEY}&siren=${clean}`
  );
  if (!res.ok) return null;
  return await res.json();
}

async function searchByName(nom: string): Promise<PappersCompany[]> {
  const res = await fetch(
    `${PAPPERS_BASE}/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(nom)}&par_page=5`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.resultats ?? [];
}

async function searchByDirigeant(nom: string): Promise<PappersCompany[]> {
  const res = await fetch(
    `${PAPPERS_BASE}/recherche-dirigeants?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(nom)}&par_page=5`
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
}

async function downloadDocument(
  url: string,
  _token: string,
  siren: string,
  docType: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string | null> {
  try {
    const downloadUrl = `${url}?api_token=${PAPPERS_API_KEY}`;
    const res = await fetch(downloadUrl);
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
    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (e) {
    console.error("Download error:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    if (!PAPPERS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PAPPERS_API_KEY not configured. Set it in Supabase Edge Function secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let results: PappersCompany[] = [];
    let singleResult: PappersCompany | null = null;

    switch (mode) {
      case "siren":
        singleResult = await searchBySiren(query);
        if (singleResult) results = [singleResult];
        break;
      case "nom":
        results = await searchByName(query);
        break;
      case "dirigeant":
        results = await searchByDirigeant(query);
        break;
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ results: [], message: "Aucun resultat trouve" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mapped = [];
    for (const company of results) {
      const documentUrls: Record<string, string> = {};

      if (download_docs && company.documents && company.siren) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        for (const doc of company.documents.slice(0, 3)) {
          if (doc.url_telechargement && doc.type) {
            const storedUrl = await downloadDocument(
              doc.url_telechargement,
              doc.token ?? "",
              company.siren,
              doc.type.toLowerCase().replace(/\s+/g, "_"),
              supabaseUrl,
              serviceKey
            );
            if (storedUrl) {
              documentUrls[doc.type] = storedUrl;
            }
          }
        }
      }

      mapped.push({
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
        representants: (company.representants ?? []).map((r) => ({
          nom: `${(r.nom ?? "").toUpperCase()} ${r.prenom ?? ""}`,
          qualite: r.qualite ?? "",
        })),
        documents_disponibles: (company.documents ?? []).slice(0, 5).map((d) => ({
          type: d.type ?? "",
          date: d.date_depot ?? "",
          url: d.url_telechargement ?? "",
        })),
        document_urls: documentUrls,
      });
    }

    return new Response(
      JSON.stringify({ results: mapped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
