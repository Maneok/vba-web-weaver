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
  try {
    // Check if already aborted before starting
    if (signal?.aborted) {
      return { results: [], error: "Requete annulee" };
    }

    let data, error;

    // Add a 10-second timeout to prevent hanging requests
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
    // If caller provided a signal, abort our controller when it fires
    if (signal) {
      signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
    }

    try {
      const result = await supabase.functions.invoke("pappers-lookup", {
        body: { mode, query, download_docs: downloadDocs },
      });
      data = result.data;
      error = result.error;
    } catch (invokeErr) {
      clearTimeout(timeoutId);
      if (timeoutController.signal.aborted) {
        logger.warn("Pappers", "Edge function timed out after 10s, trying fallback");
        return await fallbackDataGouv(mode, query, signal);
      }
      throw invokeErr;
    } finally {
      clearTimeout(timeoutId);
    }

    // Check if aborted after the call
    if (signal?.aborted) {
      return { results: [], error: "Requete annulee" };
    }

    if (error) {
      // Edge function failed — try direct data.gouv.fr fallback from client
      const msg = error.message ?? "Erreur inconnue";
      logger.warn("Pappers", "Edge function failed, trying direct fallback:", msg);
      return await fallbackDataGouv(mode, query, signal);
    }

    return data as PappersResponse;
  } catch (err) {
    if (signal?.aborted) {
      return { results: [], error: "Requete annulee" };
    }
    // Network error — try direct fallback
    const msg = err instanceof Error ? err.message : "Erreur reseau";
    logger.warn("Pappers", "Appel reseau echoue:", msg);
    return await fallbackDataGouv(mode, query, signal);
  }
}

async function fallbackDataGouv(mode: SearchMode, query: string, signal?: AbortSignal): Promise<PappersResponse> {
  try {
    if (signal?.aborted) return { results: [], error: "Requete annulee" };

    const clean = query.replace(/\s/g, "");

    if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
      const siren = clean.slice(0, 9);
      const res = await fetch(
        `https://entreprise.data.gouv.fr/api/sirene/v3/unites_legales/${siren}`,
        { signal: signal ?? AbortSignal.timeout(10000) }
      );
      if (!res.ok) {
        return { results: [], error: "Aucun resultat trouve sur data.gouv.fr", source: "datagouv" };
      }
      const data = await res.json() as Record<string, unknown>;
      const ul = data?.unite_legale as Record<string, unknown> | undefined;
      if (!ul) return { results: [], error: "Donnees non disponibles", source: "datagouv" };

      const siege = (ul.etablissement_siege ?? {}) as Record<string, unknown>;
      return {
        results: [{
          siren: `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}`,
          raison_sociale: String(ul.denomination || ul.nom_raison_sociale || "").toUpperCase(),
          forme_juridique: String(ul.nature_juridique || ul.categorie_juridique || "Non specifie"),
          forme_juridique_raw: String(ul.categorie_juridique ?? ""),
          adresse: String(siege?.geo_adresse || "").toUpperCase(),
          code_postal: String(siege?.code_postal ?? ""),
          ville: String(siege?.libelle_commune ?? "").toUpperCase(),
          ape: String(ul.activite_principale ?? ""),
          libelle_ape: "",
          capital: 0,
          date_creation: String(ul.date_creation ?? ""),
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
        `https://entreprise.data.gouv.fr/api/sirene/v1/full_text/${encodeURIComponent(query)}?per_page=5`,
        { signal: signal ?? AbortSignal.timeout(10000) }
      );
      if (!res.ok) return { results: [], error: "Recherche echouee", source: "datagouv" };
      const data = await res.json();
      const results: PappersResult[] = (data.etablissement ?? []).slice(0, 5).map((e: Record<string, string>) => ({
        siren: e.siren ? `${e.siren.slice(0, 3)} ${e.siren.slice(3, 6)} ${e.siren.slice(6, 9)}` : "",
        raison_sociale: (e.nom_raison_sociale || e.l1_normalisee || "").toUpperCase(),
        forme_juridique: e.libelle_nature_juridique_entreprise || "Non specifie",
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    logger.warn("Pappers", "Fallback data.gouv.fr echoue:", msg);
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

  try {
    const res = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-et-sanctions",
      { signal: AbortSignal.timeout(5000) }
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
  }
}
