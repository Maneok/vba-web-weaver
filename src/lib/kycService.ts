import { supabase } from "@/integrations/supabase/client";

// ====== FORME JURIDIQUE MAPPING (Probleme 5) ======

export const FORMES_JURIDIQUES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5410": "SARL", "5411": "SARL", "5422": "SARL", "5426": "SARL",
  "5499": "EURL", "5498": "EURL",
  "5510": "SA", "5520": "SA", "5530": "SA", "5540": "SA", "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SCI", "6541": "SCI", "6542": "SCI",
  "6560": "SCP",
  "6599": "Societe civile",
  "5191": "SELARL", "5192": "SELAS", "5470": "SELARL",
  "9210": "Association loi 1901",
  "9220": "Syndicat",
  "5610": "SNC",
  "5800": "EARL",
};

export function getFormeJuridiqueLabel(code: string): string {
  return FORMES_JURIDIQUES[code] || code;
}

// ====== TYPES ======

export interface Dirigeant {
  nom: string;
  prenom: string;
  qualite: string;
  date_naissance?: string;
  nationalite?: string;
}

export interface BeneficiaireEffectif {
  nom: string;
  prenom: string;
  date_naissance: string;
  nationalite: string;
  pourcentage_parts: number;
  pourcentage_votes: number;
}

export interface EnterpriseResult {
  siren: string;
  siret: string;
  raison_sociale: string;
  forme_juridique: string;
  forme_juridique_code?: string;
  forme_juridique_raw: string;
  adresse: string;
  code_postal: string;
  ville: string;
  ape: string;
  libelle_ape: string;
  capital: number;
  capital_source?: string;
  date_creation: string;
  effectif: string;
  dirigeant: string;
  dirigeants: Dirigeant[];
  telephone?: string;
  email?: string;
  site_web?: string;
  beneficiaires_effectifs?: BeneficiaireEffectif[];
  nombre_etablissements: number;
  etat_administratif: string;
  complements?: Record<string, unknown>;
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
  status: string;
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
  status: string;
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
  streetViewUrl?: string | null;
  status: string;
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
  status: string;
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
  status: string;
}

export interface DocumentInfo {
  type: string;
  label: string;
  url: string;
  source: "pappers" | "inpi" | "auto";
  available: boolean;
  status?: "auto" | "lien" | "manquant";
  storedInSupabase?: boolean;
}

export interface DocumentsResult {
  documents: DocumentInfo[];
  beneficiaires_effectifs?: BeneficiaireEffectif[];
  total: number;
  autoRecovered: number;
  missing?: string[];
  status: string;
}

export interface InpiFinancials {
  dateCloture: string;
  chiffreAffaires: number | null;
  resultat: number | null;
  capital: number | null;
  totalBilan: number | null;
  effectif: number | null;
}

export interface InpiCompanyData {
  denomination: string;
  formeJuridique: string;
  capital: number;
  objetSocial: string;
  duree: string;
  dateClotureExercice: string;
  adresse: {
    numVoie: string;
    typeVoie: string;
    voie: string;
    codePostal: string;
    commune: string;
  };
  dirigeants: Array<{ nom: string; prenom: string; qualite: string; dateNaissance: string }>;
  beneficiaires: Array<{ nom: string; prenom: string; dateNaissance: string; nationalite: string; pourcentageParts: number }>;
  historique: unknown[];
}

export interface InpiResult {
  documents: DocumentInfo[];
  companyData: InpiCompanyData | null;
  financials: InpiFinancials | null;
  totalDocuments: number;
  storedCount: number;
  status: string;
}

export interface ScreeningState {
  enterprise: { loading: boolean; data: EnterpriseResult[] | null; error: string | null };
  sanctions: { loading: boolean; data: SanctionsResult | null; error: string | null };
  bodacc: { loading: boolean; data: BodaccResult | null; error: string | null };
  google: { loading: boolean; data: GooglePlacesResult | null; error: string | null };
  news: { loading: boolean; data: NewsResult | null; error: string | null };
  network: { loading: boolean; data: NetworkResult | null; error: string | null };
  documents: { loading: boolean; data: DocumentsResult | null; error: string | null };
  inpi: { loading: boolean; data: InpiResult | null; error: string | null };
}

export const INITIAL_SCREENING: ScreeningState = {
  enterprise: { loading: false, data: null, error: null },
  sanctions: { loading: false, data: null, error: null },
  bodacc: { loading: false, data: null, error: null },
  google: { loading: false, data: null, error: null },
  news: { loading: false, data: null, error: null },
  network: { loading: false, data: null, error: null },
  documents: { loading: false, data: null, error: null },
  inpi: { loading: false, data: null, error: null },
};

// ====== API CALLS ======

async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && (data as Record<string, unknown>).status === "unavailable") {
    throw new Error("Service indisponible");
  }
  return data as T;
}

// Direct client-side fallback for enterprise-lookup
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

    const codeFormeJuridique = String(r.nature_juridique ?? "");
    const formeLabel = getFormeJuridiqueLabel(codeFormeJuridique);

    // Build address from components
    const addrParts: string[] = [];
    if (siege.numero_voie) addrParts.push(String(siege.numero_voie));
    if (siege.type_voie) addrParts.push(String(siege.type_voie));
    if (siege.libelle_voie) addrParts.push(String(siege.libelle_voie));
    let adresse = addrParts.join(" ").trim();
    if (!adresse) adresse = String(siege.geo_adresse ?? siege.adresse ?? "");

    return {
      siren: r.siren ? `${(r.siren as string).slice(0, 3)} ${(r.siren as string).slice(3, 6)} ${(r.siren as string).slice(6, 9)}` : "",
      siret: (siege.siret as string) ?? "",
      raison_sociale: ((r.nom_complet as string) ?? "").toUpperCase(),
      forme_juridique: formeLabel,
      forme_juridique_code: codeFormeJuridique,
      forme_juridique_raw: (r.libelle_nature_juridique as string) ?? formeLabel,
      adresse: adresse.toUpperCase(),
      code_postal: (siege.code_postal as string) ?? "",
      ville: ((siege.libelle_commune as string) ?? "").toUpperCase(),
      ape: (siege.activite_principale as string) ?? (r.activite_principale as string) ?? "",
      libelle_ape: (siege.libelle_activite_principale as string) ?? "",
      capital: (r.capital as number) ?? 0,
      capital_source: (r.capital as number) > 0 ? "data.gouv" : "",
      date_creation: (r.date_creation as string) ?? "",
      effectif: (r.tranche_effectif_salarie as string) ?? "0 SALARIE",
      dirigeant: dirigeants.length > 0 ? `${dirigeants[0].nom} ${dirigeants[0].prenom}`.trim().toUpperCase() : "",
      dirigeants,
      nombre_etablissements: (r.nombre_etablissements as number) ?? 1,
      etat_administratif: (r.etat_administratif as string) ?? "A",
      complements: (r.complements as Record<string, unknown>) ?? {},
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
    return { matches: [], checked: 0, hasCriticalMatch: false, hasPPE: false, status: "unavailable" };
  }
}

export async function checkBodacc(siren: string, raison_sociale?: string, complements?: Record<string, unknown>): Promise<BodaccResult> {
  try {
    return await callEdgeFunction<BodaccResult>("bodacc-check", { siren, raison_sociale, complements });
  } catch {
    return { annonces: [], hasProcedureCollective: false, alertes: [], malus: 0, status: "unavailable" };
  }
}

export async function verifyGooglePlaces(raison_sociale: string, ville?: string): Promise<GooglePlacesResult> {
  try {
    return await callEdgeFunction<GooglePlacesResult>("google-places-verify", { raison_sociale, ville });
  } catch {
    return { found: false, place: null, alertes: [], mapsUrl: "", mapsEmbedUrl: null, streetViewUrl: null, status: "unavailable" };
  }
}

export async function checkNews(raison_sociale: string, dirigeant?: string): Promise<NewsResult> {
  try {
    return await callEdgeFunction<NewsResult>("news-check", { raison_sociale, dirigeant });
  } catch {
    return { articles: [], alertes: [], hasNegativeNews: false, status: "unavailable" };
  }
}

export async function analyzeNetwork(
  siren: string,
  dirigeants: Dirigeant[]
): Promise<NetworkResult> {
  try {
    return await callEdgeFunction<NetworkResult>("dirigeants-network", { siren, dirigeants });
  } catch {
    return { nodes: [], edges: [], alertes: [], totalCompanies: 0, totalPersons: 0, status: "unavailable" };
  }
}

export async function fetchDocuments(siren: string, raison_sociale?: string): Promise<DocumentsResult> {
  try {
    return await callEdgeFunction<DocumentsResult>("documents-fetch", { siren, raison_sociale });
  } catch {
    return { documents: [], total: 0, autoRecovered: 0, missing: ["KBIS", "Statuts", "CNI", "RIB"], status: "unavailable" };
  }
}

export async function fetchInpiDocuments(siren: string): Promise<InpiResult> {
  try {
    return await callEdgeFunction<InpiResult>("inpi-documents", { siren });
  } catch {
    return { documents: [], companyData: null, financials: null, totalDocuments: 0, storedCount: 0, status: "unavailable" };
  }
}

// ====== KYC COMPLETENESS (Probleme 10) ======

export function computeKycCompleteness(
  enterprise: EnterpriseResult | null,
  docs: DocumentsResult | null,
): { percent: number; missing: string[] } {
  const fields: Array<{ label: string; ok: boolean }> = [
    { label: "SIREN", ok: !!enterprise?.siren },
    { label: "Raison sociale", ok: !!enterprise?.raison_sociale },
    { label: "Adresse", ok: !!enterprise?.adresse },
    { label: "Forme juridique", ok: !!enterprise?.forme_juridique },
    { label: "Capital", ok: (enterprise?.capital ?? 0) > 0 },
    { label: "Dirigeant", ok: !!enterprise?.dirigeant },
    { label: "KBIS", ok: docs?.documents?.some(d => d.type === "KBIS" && d.status === "auto") ?? false },
    { label: "Statuts", ok: docs?.documents?.some(d => d.type === "Statuts" && d.status === "auto") ?? false },
    { label: "CNI", ok: false },
    { label: "RIB", ok: false },
  ];
  const ok = fields.filter(f => f.ok).length;
  const missing = fields.filter(f => !f.ok).map(f => f.label);
  return { percent: Math.round((ok / fields.length) * 100), missing };
}
