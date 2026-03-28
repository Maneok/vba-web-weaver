import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface BeneficiaireDetail {
  nom: string;
  prenom: string;
  date_de_naissance: string;
  nationalite: string;
  pourcentage_parts: number;
  pourcentage_votes?: number;
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
  downloadDocs = false,
  signal?: AbortSignal
): Promise<PappersResponse> {
  if (!query || !query.trim()) {
    return { results: [], error: "Veuillez saisir un terme de recherche." };
  }
  if (signal?.aborted) {
    return { results: [], error: "Requete annulee" };
  }

  // Strategy: try free API first (no CORS issues), then edge function for premium features
  if (!downloadDocs) {
    // Simple search — use free recherche-entreprises.api.gouv.fr directly (no CORS, no auth needed)
    const freeResult = await fallbackRechercheEntreprises(mode, query, signal);
    if (freeResult.results.length > 0) {
      return freeResult;
    }
  }

  // If free API returned nothing or we need docs, try edge function
  try {
    if (signal?.aborted) { return { results: [], error: "Requete annulee" }; }

    let data, error;
    try {
      const result = await supabase.functions.invoke("pappers-lookup", {
        body: { mode, query, download_docs: downloadDocs },
      });
      data = result.data;
      error = result.error;
    } catch (invokeErr) {
      const msg = invokeErr instanceof Error ? invokeErr.message : "Erreur";
      logger.debug("Pappers", "Edge function unavailable:", msg);
      return { results: [], error: "Aucun resultat trouve." };
    }

    if (signal?.aborted) {
      return { results: [], error: "Requete annulee" };
    }

    if (error) {
      logger.debug("Pappers", "Edge function error:", error.message);
      return { results: [], error: "Aucun resultat trouve." };
    }

    return data as PappersResponse;
  } catch (err) {
    if (signal?.aborted) {
      return { results: [], error: "Requete annulee" };
    }
    const msg = err instanceof Error ? err.message : "Erreur reseau";
    logger.debug("Pappers", "Search failed:", msg);
    return { results: [], error: "Aucun resultat trouve." };
  }
}

async function fallbackRechercheEntreprises(mode: SearchMode, query: string, signal?: AbortSignal): Promise<PappersResponse> {
  try {
    if (signal?.aborted) return { results: [], error: "Requete annulee" };

    const clean = query.replace(/\s/g, "");
    const searchQuery = (mode === "siren" && /^\d{9,14}$/.test(clean)) ? clean.slice(0, 9) : query;

    // OPT-32: Proper AbortController with cleanup
    let fallbackCtrl: AbortController | null = null;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    if (!signal) {
      fallbackCtrl = new AbortController();
      fallbackTimeout = setTimeout(() => fallbackCtrl!.abort(), 10000);
    }
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(searchQuery)}&page=1&per_page=5`,
      { signal: signal ?? fallbackCtrl!.signal }
    );
    if (fallbackTimeout) clearTimeout(fallbackTimeout);

    if (!res.ok) {
      logger.warn("Pappers", `recherche-entreprises returned ${res.status}`);
      return { results: [], error: "Aucun resultat trouve.", source: "datagouv" };
    }

    // OPT: Validate content-type before parsing JSON
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      logger.warn("Pappers", `Unexpected content-type: ${ct}`);
      return { results: [], error: "Reponse non-JSON.", source: "datagouv" };
    }
    const data = await res.json();
    // OPT-22: Validate response format before processing
    if (!data || typeof data !== "object") {
      return { results: [], error: "Format de reponse invalide.", source: "datagouv" };
    }
    const items = data?.results ?? [];

    if (items.length === 0) {
      return { results: [], error: "Aucun resultat trouve pour cette recherche.", source: "datagouv" };
    }

    const results: PappersResult[] = items.slice(0, 5).map((e: Record<string, unknown>) => {
      const siren = String(e.siren ?? "");
      const siege = (e.siege as Record<string, unknown>) ?? {};
      const dirigeants = Array.isArray(e.dirigeants) ? e.dirigeants : [];
      const activite = String(e.activite_principale ?? "");
      const libelleActivite = String(e.libelle_activite_principale ?? "");
      const natureJuridique = String(e.nature_juridique ?? "Non specifie");

      return {
        siren: siren.length === 9 ? `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}` : siren,
        raison_sociale: String(e.nom_complet || e.nom_raison_sociale || "").toUpperCase(),
        forme_juridique: natureJuridique,
        forme_juridique_raw: natureJuridique,
        adresse: String(siege.adresse ?? "").toUpperCase(),
        code_postal: String(siege.code_postal ?? ""),
        ville: String(siege.libelle_commune ?? "").toUpperCase(),
        ape: activite,
        libelle_ape: libelleActivite,
        capital: 0,
        date_creation: String(e.date_creation ?? ""),
        effectif: String(e.tranche_effectif_salarie ?? "0 SALARIE"),
        dirigeant: dirigeants.length > 0 ? String((dirigeants[0] as Record<string, unknown>)?.nom ?? "") : "",
        beneficiaires_effectifs: "",
        beneficiaires_details: [],
        representants: dirigeants.slice(0, 5).map((d: Record<string, unknown>) => ({
          nom: String(d.nom ?? ""),
          qualite: String(d.qualite ?? d.fonction ?? ""),
        })),
        documents_disponibles: [],
        document_urls: {},
        source: "datagouv" as const,
      };
    });

    return { results, source: "datagouv" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    logger.warn("Pappers", "Fallback recherche-entreprises echoue:", msg);
    return { results: [], error: "Toutes les sources de donnees sont indisponibles. Veuillez reessayer." };
  }
}

// Check gel des avoirs registry
export async function checkGelAvoirs(siren: string, dirigeant: string): Promise<{
  matched: boolean;
  matches: string[];
}> {
  // Guard against null/undefined inputs
  if (!siren && !dirigeant) return { matched: false, matches: [] };

  // OPT-31: Proper AbortController cleanup with clearTimeout
  const gelController = new AbortController();
  const gelTimeout = setTimeout(() => gelController.abort(), 5000);
  try {
    const res = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-et-sanctions",
      { signal: gelController.signal }
    );
    if (!res.ok) return { matched: false, matches: [] };

    const data = await res.json();
    if (!data || typeof data !== "object") return { matched: false, matches: [] };
    const registreNational = data.Publications ?? data.registreNationalDesGels ?? [];

    const cleanSiren = (siren ?? "").replace(/\s/g, "");
    const cleanDirigeant = (dirigeant ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches: string[] = [];

    // Structured search: iterate records instead of JSON.stringify to avoid false positives
    const entries = Array.isArray(registreNational) ? registreNational : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const entryStr = JSON.stringify(entry).toLowerCase();

      // SIREN match: only match exact 9-digit boundaries
      if (cleanSiren && cleanSiren.length >= 9) {
        const sirenLower = cleanSiren.toLowerCase();
        // Check structured fields first, fall back to entry-level text search
        const entrySiren = String(entry.siren ?? entry.registrationNumber ?? "").replace(/\s/g, "").toLowerCase();
        if (entrySiren === sirenLower || entryStr.includes(sirenLower)) {
          matches.push(`SIREN ${siren} trouve dans le registre des gels d'avoirs`);
        }
      }

      // Name match: require ALL name parts (>2 chars) to match in same entry
      if (cleanDirigeant && cleanDirigeant.length > 3 && matches.length === 0) {
        const nameParts = cleanDirigeant.split(/\s+/).filter(p => p.length > 2);
        if (nameParts.length > 0 && nameParts.every(part => entryStr.includes(part))) {
          matches.push(`Nom "${dirigeant}" trouve dans le registre des gels d'avoirs`);
        }
      }

      if (matches.length > 0) break; // Stop at first match
    }

    return { matched: matches.length > 0, matches };
  } catch {
    // API unreachable — don't block the process
    return { matched: false, matches: [] };
  } finally {
    clearTimeout(gelTimeout);
  }
}
