import { supabase } from "@/integrations/supabase/client";

export interface BeneficiaireDetail {
  nom: string;
  prenom: string;
  date_de_naissance: string;
  nationalite: string;
  pourcentage_parts: number;
}

export interface PappersResult {
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
  beneficiaires_details?: BeneficiaireDetail[];
  representants: Array<{ nom: string; qualite: string }>;
  documents_disponibles: Array<{ type: string; date: string; url: string }>;
  document_urls: Record<string, string>;
  source?: "pappers" | "insee" | "datagouv";
}

export interface PappersResponse {
  results: PappersResult[];
  message?: string;
  error?: string;
  source?: "pappers" | "insee" | "datagouv";
}

export type SearchMode = "siren" | "nom" | "dirigeant";

export async function searchPappers(
  mode: SearchMode,
  query: string,
  downloadDocs = false
): Promise<PappersResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("pappers-lookup", {
      body: { mode, query, download_docs: downloadDocs },
    });

    if (error) {
      // Edge function failed — try direct data.gouv.fr fallback from client
      console.warn("Edge function failed, trying direct fallback:", error.message);
      return await fallbackDataGouv(mode, query);
    }

    return data as PappersResponse;
  } catch {
    // Network error — try direct fallback
    return await fallbackDataGouv(mode, query);
  }
}

async function fallbackDataGouv(mode: SearchMode, query: string): Promise<PappersResponse> {
  try {
    const clean = query.replace(/\s/g, "");

    if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
      const siren = clean.slice(0, 9);
      const res = await fetch(
        `https://entreprise.data.gouv.fr/api/sirene/v3/unites_legales/${siren}`
      );
      if (!res.ok) {
        return { results: [], error: "Aucun resultat trouve sur data.gouv.fr", source: "datagouv" };
      }
      const data = await res.json();
      const ul = data.unite_legale;
      if (!ul) return { results: [], error: "Donnees non disponibles", source: "datagouv" };

      const siege = ul.etablissement_siege;
      return {
        results: [{
          siren: `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}`,
          raison_sociale: (ul.denomination || ul.nom_raison_sociale || "").toUpperCase(),
          forme_juridique: "SARL",
          forme_juridique_raw: ul.categorie_juridique ?? "",
          adresse: (siege?.geo_adresse || "").toUpperCase(),
          code_postal: siege?.code_postal ?? "",
          ville: (siege?.libelle_commune ?? "").toUpperCase(),
          ape: ul.activite_principale ?? "",
          libelle_ape: "",
          capital: 0,
          date_creation: ul.date_creation ?? "",
          effectif: "0 SALARIE",
          dirigeant: "",
          beneficiaires_effectifs: "",
          beneficiaires_details: [],
          representants: [],
          documents_disponibles: [],
          document_urls: {},
          source: "datagouv",
        }],
        source: "datagouv",
      };
    }

    // Name search fallback
    if (mode === "nom" || mode === "dirigeant") {
      const res = await fetch(
        `https://entreprise.data.gouv.fr/api/sirene/v1/full_text/${encodeURIComponent(query)}?per_page=5`
      );
      if (!res.ok) return { results: [], error: "Recherche echouee", source: "datagouv" };
      const data = await res.json();
      const results: PappersResult[] = (data.etablissement ?? []).slice(0, 5).map((e: Record<string, string>) => ({
        siren: e.siren ? `${e.siren.slice(0, 3)} ${e.siren.slice(3, 6)} ${e.siren.slice(6, 9)}` : "",
        raison_sociale: (e.nom_raison_sociale || e.l1_normalisee || "").toUpperCase(),
        forme_juridique: "SARL",
        forme_juridique_raw: e.libelle_nature_juridique_entreprise ?? "",
        adresse: (e.geo_adresse || "").toUpperCase(),
        code_postal: e.code_postal ?? "",
        ville: (e.libelle_commune ?? "").toUpperCase(),
        ape: e.activite_principale ?? "",
        libelle_ape: e.libelle_activite_principale ?? "",
        capital: 0,
        date_creation: e.date_creation ?? "",
        effectif: "0 SALARIE",
        dirigeant: "",
        beneficiaires_effectifs: "",
        beneficiaires_details: [],
        representants: [],
        documents_disponibles: [],
        document_urls: {},
        source: "datagouv" as const,
      }));
      return { results, source: "datagouv" };
    }

    return { results: [], error: "Mode de recherche non supporte en mode fallback", source: "datagouv" };
  } catch {
    return { results: [], error: "Toutes les sources de donnees sont indisponibles" };
  }
}

// Check gel des avoirs registry
export async function checkGelAvoirs(siren: string, dirigeant: string): Promise<{
  matched: boolean;
  matches: string[];
}> {
  try {
    const res = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-et-sanctions",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { matched: false, matches: [] };

    const data = await res.json();
    const registreNational = data.Publications ?? data.registreNationalDesGels ?? [];

    const cleanSiren = siren.replace(/\s/g, "").toLowerCase();
    const cleanDirigeant = dirigeant.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches: string[] = [];

    const searchText = JSON.stringify(registreNational).toLowerCase();

    if (cleanSiren && searchText.includes(cleanSiren)) {
      matches.push(`SIREN ${siren} trouve dans le registre des gels d'avoirs`);
    }

    if (cleanDirigeant && cleanDirigeant.length > 3) {
      const nameParts = cleanDirigeant.split(/\s+/).filter(p => p.length > 2);
      for (const part of nameParts) {
        if (searchText.includes(part)) {
          matches.push(`Nom "${part}" trouve dans le registre des gels d'avoirs`);
          break;
        }
      }
    }

    return { matched: matches.length > 0, matches };
  } catch {
    // API unreachable — don't block the process
    return { matched: false, matches: [] };
  }
}
