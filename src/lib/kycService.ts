import { supabase } from "@/integrations/supabase/client";

// ====== TYPES ======

export interface Dirigeant {
  nom: string;
  prenom: string;
  qualite: string;
  date_naissance?: string;
  nationalite?: string;
}

export interface EnterpriseResult {
  siren: string;
  siret: string;
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
  dirigeants: Dirigeant[];
  nombre_etablissements: number;
  etat_administratif: string;
  etablissements: Array<{ siret: string; adresse: string; commune: string; est_siege: boolean }>;
  source: string;
}

export interface SanctionMatch {
  person: string;
  score: number;
  datasets: string[];
  caption: string;
  isPPE: boolean;
  details: string;
}

export interface SanctionsResult {
  matches: SanctionMatch[];
  checked: number;
  hasCriticalMatch: boolean;
  hasPPE: boolean;
  status: "OK" | "ALERTE" | "ATTENTION" | "ERREUR";
}

export interface BodaccAnnonce {
  date: string;
  type: string;
  description: string;
  tribunal: string;
  isProcedureCollective: boolean;
}

export interface BodaccResult {
  annonces: BodaccAnnonce[];
  hasProcedureCollective: boolean;
  alertes: string[];
  malus: number;
  status: "OK" | "ALERTE" | "ATTENTION" | "ERREUR";
}

export interface GooglePlaceInfo {
  name: string;
  address: string;
  businessStatus: string;
  rating: number | null;
  totalRatings: number;
  isOpen: boolean | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
}

export interface GooglePlacesResult {
  found: boolean;
  place: GooglePlaceInfo | null;
  alertes: string[];
  mapsUrl: string;
  mapsEmbedUrl: string | null;
  status: "OK" | "ATTENTION" | "ERREUR" | "INDISPONIBLE";
}

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  hasAlertKeyword: boolean;
  matchedKeywords: string[];
}

export interface NewsResult {
  articles: NewsArticle[];
  alertes: string[];
  hasNegativeNews: boolean;
  status: "OK" | "ALERTE" | "AUCUN_ARTICLE" | "ERREUR" | "INDISPONIBLE";
}

export interface NetworkNode {
  id: string;
  label: string;
  type: "company" | "person";
  siren?: string;
  isSource?: boolean;
  dateCreation?: string;
  ville?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  label: string;
}

export interface NetworkAlert {
  type: string;
  message: string;
  severity: "orange" | "red";
}

export interface NetworkResult {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  alertes: NetworkAlert[];
  totalCompanies: number;
  totalPersons: number;
  status: "OK" | "ALERTE" | "ATTENTION" | "ERREUR";
}

export interface DocumentInfo {
  type: string;
  label: string;
  url: string;
  source: "pappers" | "inpi" | "auto";
  available: boolean;
}

export interface DocumentsResult {
  documents: DocumentInfo[];
  total: number;
  autoRecovered: number;
  status: "OK" | "ERREUR";
}

export interface ScreeningState {
  enterprise: { loading: boolean; data: EnterpriseResult[] | null; error: string | null };
  sanctions: { loading: boolean; data: SanctionsResult | null; error: string | null };
  bodacc: { loading: boolean; data: BodaccResult | null; error: string | null };
  google: { loading: boolean; data: GooglePlacesResult | null; error: string | null };
  news: { loading: boolean; data: NewsResult | null; error: string | null };
  network: { loading: boolean; data: NetworkResult | null; error: string | null };
  documents: { loading: boolean; data: DocumentsResult | null; error: string | null };
}

export const INITIAL_SCREENING: ScreeningState = {
  enterprise: { loading: false, data: null, error: null },
  sanctions: { loading: false, data: null, error: null },
  bodacc: { loading: false, data: null, error: null },
  google: { loading: false, data: null, error: null },
  news: { loading: false, data: null, error: null },
  network: { loading: false, data: null, error: null },
  documents: { loading: false, data: null, error: null },
};

// ====== API CALLS ======

async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// Direct client-side fallback for enterprise-lookup (Annuaire Entreprises is free, no CORS issues)
async function enterpriseFallback(mode: string, query: string): Promise<{ results: EnterpriseResult[] }> {
  const clean = query.replace(/\s/g, "");
  let url: string;
  if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
    url = `https://recherche-entreprises.api.gouv.fr/search?q=${clean.slice(0, 9)}`;
  } else {
    url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=5`;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`API returned ${res.status}`);

  const data = await res.json();
  const results: EnterpriseResult[] = (data.results ?? []).slice(0, 10).map((r: Record<string, unknown>) => {
    const siege = (r.siege ?? {}) as Record<string, unknown>;
    const dirigeants = ((r.dirigeants ?? []) as Array<Record<string, string>>).map(d => ({
      nom: d.nom ?? "",
      prenom: d.prenom ?? "",
      qualite: d.qualite ?? d.fonction ?? "",
      date_naissance: d.date_de_naissance ?? "",
      nationalite: d.nationalite ?? "",
    }));

    return {
      siren: r.siren ? `${(r.siren as string).slice(0, 3)} ${(r.siren as string).slice(3, 6)} ${(r.siren as string).slice(6, 9)}` : "",
      siret: (siege.siret as string) ?? "",
      raison_sociale: ((r.nom_complet as string) ?? "").toUpperCase(),
      forme_juridique: (r.nature_juridique as string) ?? "",
      forme_juridique_raw: (r.libelle_nature_juridique as string) ?? "",
      adresse: ((siege.adresse as string) ?? "").toUpperCase(),
      code_postal: (siege.code_postal as string) ?? "",
      ville: ((siege.libelle_commune as string) ?? "").toUpperCase(),
      ape: (siege.activite_principale as string) ?? (r.activite_principale as string) ?? "",
      libelle_ape: (siege.libelle_activite_principale as string) ?? "",
      capital: (r.capital as number) ?? 0,
      date_creation: (r.date_creation as string) ?? "",
      effectif: (r.tranche_effectif_salarie as string) ?? "0 SALARIE",
      dirigeant: dirigeants.length > 0 ? `${dirigeants[0].nom} ${dirigeants[0].prenom}`.trim().toUpperCase() : "",
      dirigeants,
      nombre_etablissements: (r.nombre_etablissements as number) ?? 1,
      etat_administratif: (r.etat_administratif as string) ?? "A",
      etablissements: [],
      source: "annuaire_entreprises",
    };
  });

  return { results };
}

export async function searchEnterprise(mode: string, query: string): Promise<{ results: EnterpriseResult[]; error?: string }> {
  try {
    const data = await callEdgeFunction<{ results: EnterpriseResult[] }>("enterprise-lookup", { mode, query });
    return data;
  } catch {
    try {
      return await enterpriseFallback(mode, query);
    } catch (e) {
      return { results: [], error: String(e) };
    }
  }
}

export async function checkSanctions(
  persons: Array<{ nom: string; prenom?: string; dateNaissance?: string; nationalite?: string }>,
  siren?: string
): Promise<SanctionsResult> {
  try {
    return await callEdgeFunction<SanctionsResult>("sanctions-check", { persons, siren });
  } catch {
    return { matches: [], checked: 0, hasCriticalMatch: false, hasPPE: false, status: "ERREUR" };
  }
}

export async function checkBodacc(siren: string, raison_sociale?: string): Promise<BodaccResult> {
  try {
    return await callEdgeFunction<BodaccResult>("bodacc-check", { siren, raison_sociale });
  } catch {
    return { annonces: [], hasProcedureCollective: false, alertes: [], malus: 0, status: "ERREUR" };
  }
}

export async function verifyGooglePlaces(raison_sociale: string, ville?: string): Promise<GooglePlacesResult> {
  try {
    return await callEdgeFunction<GooglePlacesResult>("google-places-verify", { raison_sociale, ville });
  } catch {
    return { found: false, place: null, alertes: [], mapsUrl: "", mapsEmbedUrl: null, status: "ERREUR" };
  }
}

export async function checkNews(raison_sociale: string, dirigeant?: string): Promise<NewsResult> {
  try {
    return await callEdgeFunction<NewsResult>("news-check", { raison_sociale, dirigeant });
  } catch {
    return { articles: [], alertes: [], hasNegativeNews: false, status: "ERREUR" };
  }
}

export async function analyzeNetwork(
  siren: string,
  dirigeants: Dirigeant[]
): Promise<NetworkResult> {
  try {
    return await callEdgeFunction<NetworkResult>("dirigeants-network", { siren, dirigeants });
  } catch {
    return { nodes: [], edges: [], alertes: [], totalCompanies: 0, totalPersons: 0, status: "ERREUR" };
  }
}

export async function fetchDocuments(siren: string, raison_sociale?: string): Promise<DocumentsResult> {
  try {
    return await callEdgeFunction<DocumentsResult>("documents-fetch", { siren, raison_sociale });
  } catch {
    return { documents: [], total: 0, autoRecovered: 0, status: "ERREUR" };
  }
}
