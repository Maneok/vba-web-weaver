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
  finances?: Array<{ annee: string; ca: number | null; resultat: number | null; effectif: number | null }>;
  representants?: Array<{
    nom: string; prenom: string; qualite: string; date_prise_de_poste: string;
    entreprises_dirigees: Array<{
      siren: string; denomination: string; qualite: string;
      date_prise_de_poste: string; statut_rcs: string; date_creation: string;
    }>;
  }>;
  sources?: string[];
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
  dateNomination?: string;
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

// FIX 10: Normalize source type — accept mixed casing from APIs
export interface DocumentInfo {
  type: string;
  label: string;
  url: string | null;
  // FIX P4-9: Normalized source type — always lowercase from edge functions
  source: "pappers" | "inpi" | "auto" | string | null;
  available: boolean;
  status?: "auto" | "lien" | "lien_direct" | "manquant";
  storedInSupabase?: boolean;
  downloadable?: boolean;
  storageUrl?: string | null;
  dateDepot?: string;
  dateCloture?: string;
  needsAuth?: boolean;
  inpiSiren?: string;
}

export interface DocumentsResult {
  documents: DocumentInfo[];
  beneficiaires_effectifs?: BeneficiaireEffectif[];
  total: number;
  autoRecovered: number;
  missing?: string[];
  sources?: string[];
  status: string;
}

export interface InpiFinancials {
  dateCloture: string;
  chiffreAffaires: number | null;
  resultat: number | null;
  capital: number | null;
  totalBilan: number | null;
  effectif: number | null;
  dettes: number | null;
  capitauxPropres: number | null;
}

export interface InpiHistoryEvent {
  date: string;
  type: string;
  description: string;
  detail: string;
}

export interface InpiCompanyData {
  typePersonne: "morale" | "physique" | "exploitation" | "unknown";
  denomination: string;
  sigle: string;
  formeJuridique: string;
  formeJuridiqueLabel: string;
  capital: number;
  deviseCapital: string;
  capitalVariable: boolean;
  objetSocial: string;
  duree: string;
  dateClotureExercice: string;
  dateImmatriculation: string;
  dateDebutActivite: string;
  ess: boolean;
  societeMission: boolean;
  associeUnique: boolean;
  natureGerance: string;
  activitePrincipale: string;
  adresse: {
    numVoie: string;
    typeVoie: string;
    voie: string;
    codePostal: string;
    commune: string;
    codeInsee: string;
    pays: string;
    complement: string;
  };
  domiciliataire: string | null;
  diffusionCommerciale: boolean;
  nonDiffusible: boolean;
  dirigeants: Array<{ nom: string; prenom: string; qualite: string; dateNaissance: string; nationalite: string; lieuNaissance: string }>;
  beneficiaires: Array<{ nom: string; prenom: string; dateNaissance: string; nationalite: string; pourcentageParts: number; pourcentageVotes: number; modalitesControle: string }>;
  etablissements: Array<{ siret: string; adresse: string; codePostal: string; commune: string; estSiege: boolean; activite: string; enseigne: string }>;
  historique: InpiHistoryEvent[];
  eirl: boolean;
}

export interface InpiResult {
  documents: DocumentInfo[];
  companyData: InpiCompanyData | null;
  financials: InpiFinancials[];
  totalDocuments: number;
  storedCount: number;
  status: string;
  error?: string;
}

// ====== CORRECTION 3: Data Provenance ======

export type DataSource = "INPI" | "Pappers" | "AnnuaireEntreprises" | "BODACC" | "Manuel";
export type DataConfidence = "verified" | "single_source" | "divergent";

export interface DataProvenance {
  field: string;
  value: unknown;
  source: DataSource;
  retrievedAt: string;
  confidence: DataConfidence;
}

// ====== CORRECTION 5: Source Priority per field ======

export const SOURCE_PRIORITY: Record<string, DataSource[]> = {
  denomination: ["INPI", "Pappers", "AnnuaireEntreprises"],
  formeJuridique: ["INPI", "Pappers", "AnnuaireEntreprises"],
  capital: ["INPI", "Pappers", "AnnuaireEntreprises"],
  objetSocial: ["INPI"],
  duree: ["INPI"],
  dirigeants: ["INPI", "Pappers", "AnnuaireEntreprises"],
  beneficiairesEffectifs: ["Pappers", "INPI"],
  adresse: ["INPI", "AnnuaireEntreprises", "Pappers"],
  codeAPE: ["INPI", "AnnuaireEntreprises"],
  effectif: ["INPI", "AnnuaireEntreprises"],
  procedures: ["BODACC", "AnnuaireEntreprises"],
  telephone: ["Pappers"],
  email: ["Pappers"],
  siteWeb: ["Pappers"],
  statuts: ["INPI", "Pappers"],
  comptes: ["INPI", "Pappers"],
  actes: ["INPI"],
};

export function resolveSourceValue<T>(
  fieldName: string,
  sources: Array<{ source: DataSource; value: T | null | undefined }>,
): { value: T | null; source: DataSource | null; confidence: DataConfidence; divergences: Array<{ source: DataSource; value: T }> } {
  const priority = SOURCE_PRIORITY[fieldName] ?? [];
  const available = sources.filter(s => s.value != null && s.value !== "" && s.value !== 0);
  if (available.length === 0) return { value: null, source: null, confidence: "single_source", divergences: [] };

  // Check for divergences
  const uniqueValues = new Set(available.map(s => JSON.stringify(s.value)));
  const isDivergent = uniqueValues.size > 1;

  // Pick by priority
  for (const prioritySource of priority) {
    const match = available.find(s => s.source === prioritySource);
    if (match) {
      return {
        value: match.value as T,
        source: match.source,
        confidence: isDivergent ? "divergent" : available.length >= 2 ? "verified" : "single_source",
        divergences: isDivergent ? available.map(s => ({ source: s.source, value: s.value as T })) : [],
      };
    }
  }

  // Fallback to first available
  return {
    value: available[0].value as T,
    source: available[0].source,
    confidence: available.length >= 2 && !isDivergent ? "verified" : "single_source",
    divergences: isDivergent ? available.map(s => ({ source: s.source, value: s.value as T })) : [],
  };
}

// ====== CORRECTION 7: AML Structural Signals ======

export interface AmlSignal {
  type: string;
  message: string;
  severity: "red" | "orange" | "info";
  malus: number;
}

export function detectAmlSignals(
  inpiData: InpiCompanyData | null,
  enterpriseData: EnterpriseResult | null,
  financials: InpiFinancials[] | null,
): AmlSignal[] {
  const signals: AmlSignal[] = [];
  if (!inpiData && !enterpriseData) return signals;

  const capital = inpiData?.capital ?? enterpriseData?.capital ?? 0;
  const forme = (inpiData?.formeJuridique ?? enterpriseData?.forme_juridique ?? "").toUpperCase();
  const effectif = enterpriseData?.effectif ?? "";
  const dateCreation = inpiData?.dateImmatriculation ?? inpiData?.dateDebutActivite ?? enterpriseData?.date_creation ?? "";

  // Domiciliataire = auto malus DOMICILIATION (80)
  if (inpiData?.domiciliataire) {
    signals.push({
      type: "domiciliataire",
      message: `Domiciliataire detecte (${inpiData.domiciliataire}) — risque equivalent mission DOMICILIATION`,
      severity: "orange",
      malus: 80,
    });
  }

  // Capital < 1000 EUR for SAS/SARL
  if (capital > 0 && capital < 1000 && (forme.includes("SAS") || forme.includes("SARL") || forme.includes("EURL"))) {
    signals.push({
      type: "capital_faible",
      message: `Capital anormalement faible (${capital} EUR) pour une ${forme}`,
      severity: "orange",
      malus: 15,
    });
  }

  // Effectif = 0 and CA > 500k
  const latestCA = financials?.[0]?.chiffreAffaires;
  // P5-22: More robust zero-employee detection (matching riskEngine fix)
  const hasZeroEmployees = /^0\b|^0 |AUCUN|NEANT/i.test(effectif.trim()) || effectif.trim() === "0";
  if (hasZeroEmployees && latestCA && latestCA > 500000) {
    signals.push({
      type: "ca_sans_salaries",
      message: `CA eleve (${latestCA.toLocaleString()} EUR) sans salaries — risque societe de facturation`,
      severity: "orange",
      malus: 20,
    });
  }

  // Creation < 12 months
  if (dateCreation) {
    const created = new Date(dateCreation);
    const now = new Date();
    const diffMonths = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (diffMonths < 12 && diffMonths >= 0) {
      signals.push({
        type: "societe_recente",
        message: `Societe creee il y a ${diffMonths} mois (< 1 an) — maturite tres faible`,
        severity: "orange",
        malus: 10,
      });
    }
  }

  // Associe unique + capital variable
  if (inpiData?.associeUnique && inpiData?.capitalVariable) {
    signals.push({
      type: "opacite_structure",
      message: "Associe unique + capital variable — structure a risque d'opacite",
      severity: "orange",
      malus: 15,
    });
  }

  // CORRECTION 6: Non diffusible INSEE
  if (inpiData?.nonDiffusible) {
    signals.push({
      type: "non_diffusible",
      message: "Entreprise non diffusible INSEE — donnees limitees, signal de risque potentiel",
      severity: "orange",
      malus: 15,
    });
  }

  return signals;
}

interface ScreeningSlot<T> { loading: boolean; data: T | null; error: string | null; timeMs?: number }
export interface ScreeningState {
  enterprise: ScreeningSlot<EnterpriseResult[]>;
  sanctions: ScreeningSlot<SanctionsResult>;
  bodacc: ScreeningSlot<BodaccResult>;
  google: ScreeningSlot<GooglePlacesResult>;
  news: ScreeningSlot<NewsResult>;
  network: ScreeningSlot<NetworkResult>;
  documents: ScreeningSlot<DocumentsResult>;
  inpi: ScreeningSlot<InpiResult>;
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

// ====== CORRECTION 4: API Cache ======

const CACHE_TTL: Record<string, number> = {
  inpi: 24 * 60 * 60 * 1000,        // 24h
  pappers: 24 * 60 * 60 * 1000,     // 24h
  annuaire: 24 * 60 * 60 * 1000,    // 24h
  opensanctions: 7 * 24 * 60 * 60 * 1000, // 7d
  bodacc: 24 * 60 * 60 * 1000,      // 24h
  google: 7 * 24 * 60 * 60 * 1000,  // 7d
  documents: 7 * 24 * 60 * 60 * 1000, // 7d
};

async function getUserCabinetId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", user.id)
      .maybeSingle();
    return data?.cabinet_id || null;
  } catch {
    return null;
  }
}

async function getCachedResponse<T>(siren: string, apiName: string): Promise<T | null> {
  try {
    const { data } = await supabase
      .from("api_cache")
      .select("response_data, expires_at")
      .eq("siren", siren.replace(/\s/g, ""))
      .eq("api_name", apiName)
      .maybeSingle();
    if (data && new Date(data.expires_at) > new Date()) {
      return data.response_data as T;
    }
    return null;
  } catch {
    return null;
  }
}

async function setCachedResponse(siren: string, apiName: string, responseData: unknown): Promise<void> {
  const ttl = CACHE_TTL[apiName] ?? 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  try {
    const cabinetId = await getUserCabinetId();
    if (!cabinetId) return;
    await supabase.from("api_cache").upsert({
      siren: siren.replace(/\s/g, ""),
      api_name: apiName,
      cabinet_id: cabinetId,
      response_data: responseData,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: "siren,api_name,cabinet_id" });
  } catch {
    // Cache write failure is non-critical
  }
}

// ====== API CALLS ======

// FIX P4-7: Per-function timeout — INPI/documents need more time due to PDF downloads
const EDGE_FUNCTION_TIMEOUTS: Record<string, number> = {
  "inpi-documents": 90000,
  "documents-fetch": 60000,
};

async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const timeoutMs = EDGE_FUNCTION_TIMEOUTS[name] ?? 30000;
  // P5-15: Use AbortController to cancel the underlying request on timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      signal: controller.signal as AbortSignal,
    });
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && (data as Record<string, unknown>).status === "unavailable") {
      throw new Error("Service indisponible");
    }
    return data as T;
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Edge function "${name}" timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
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
      // P5-25: Guard against short SIREN (less than 9 chars)
      siren: r.siren && (r.siren as string).length >= 9 ? `${(r.siren as string).slice(0, 3)} ${(r.siren as string).slice(3, 6)} ${(r.siren as string).slice(6, 9)}` : (r.siren as string) ?? "",
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
  // CORRECTION 4: Cache for SIREN lookups
  const clean = query.replace(/\s/g, "");
  if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
    const cached = await getCachedResponse<{ results: EnterpriseResult[] }>(clean.slice(0, 9), "annuaire");
    if (cached && cached.results?.length > 0) return cached;
  }
  try {
    const data = await callEdgeFunction<{ results: EnterpriseResult[] }>("enterprise-lookup", { mode, query });
    if (mode === "siren" && /^\d{9,14}$/.test(clean) && data.results?.length > 0) {
      await setCachedResponse(clean.slice(0, 9), "annuaire", data);
    }
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
  if (siren) {
    const cached = await getCachedResponse<SanctionsResult>(siren.replace(/\s/g, ""), "opensanctions");
    if (cached) return cached;
  }
  try {
    const result = await callEdgeFunction<SanctionsResult>("sanctions-check", { persons, siren });
    if (siren && result.status !== "unavailable") await setCachedResponse(siren.replace(/\s/g, ""), "opensanctions", result);
    return result;
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

// FIX P4-48: Add forceRefresh parameter to bypass cache
export async function fetchInpiDocuments(siren: string, forceRefresh = false): Promise<InpiResult> {
  const cleanSiren = siren.replace(/\s/g, "");
  // CORRECTION 4: Check cache first (unless forceRefresh)
  if (!forceRefresh) {
    const cached = await getCachedResponse<InpiResult>(cleanSiren, "inpi");
    if (cached && cached.status === "ok") return cached;
  }
  try {
    const result = await callEdgeFunction<InpiResult>("inpi-documents", { siren });
    if (result.status === "ok") await setCachedResponse(cleanSiren, "inpi", result);
    return result;
  } catch {
    return { documents: [], companyData: null, financials: [], totalDocuments: 0, storedCount: 0, status: "partial" };
  }
}

// ====== GEL D'AVOIRS DG TRÉSOR (idée 11) ======

export interface GelAvoirsMatch {
  matchedName: string;
  sanctionType: string;
  dateDesignation: string;
  nature: string;
  score: "exact" | "partial";
}

export interface GelAvoirsResult {
  matches: GelAvoirsMatch[];
  checked: boolean;
  totalSanctionsInList: number;
  hasMatch: boolean;
  hasExactMatch: boolean;
  publicationDate: string | null;
  status: string;
  message: string;
}

export async function checkGelAvoirs(
  nom: string,
  prenom?: string,
  denominationEntreprise?: string,
): Promise<GelAvoirsResult> {
  try {
    return await callEdgeFunction<GelAvoirsResult>("gel-avoirs-check", { nom, prenom, denominationEntreprise });
  } catch {
    return {
      matches: [],
      checked: true,
      totalSanctionsInList: 0,
      hasMatch: false,
      hasExactMatch: false,
      publicationDate: null,
      status: "unavailable",
      message: "Service DG Trésor indisponible",
    };
  }
}

// ====== #20: Dirigeant principal by role priority ======

const ROLE_PRIORITY = ["président", "president", "gérant", "gerant", "directeur général", "directeur general", "associé", "associe", "administrateur", "dirigeant"];

export function pickPrincipalDirigeant(dirigeants: Dirigeant[]): string {
  if (!dirigeants || dirigeants.length === 0) return "";
  // Sort by role priority
  const sorted = [...dirigeants].sort((a, b) => {
    const aIdx = ROLE_PRIORITY.findIndex(r => (a.qualite || "").toLowerCase().includes(r));
    const bIdx = ROLE_PRIORITY.findIndex(r => (b.qualite || "").toLowerCase().includes(r));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
  const best = sorted[0];
  return `${(best.nom || "").toUpperCase()} ${best.prenom || ""}`.trim();
}

// ====== #19: Date formatting helper ======

export function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ====== KYC COMPLETENESS (Probleme 10) ======

// FIX 11: Case-insensitive type matching (inpi-documents uses "kbis", documents-fetch uses "KBIS")
// FIX 12: Accept both INPI and documents-fetch docs, plus manual uploads
export function computeKycCompleteness(
  enterprise: EnterpriseResult | null,
  docs: DocumentsResult | null,
  inpiDocs?: DocumentInfo[],
  uploadedDocs?: Array<{ type: string }>,
): { percent: number; missing: string[] } {
  // Merge all document sources for checking
  const allDocs = [
    ...(docs?.documents ?? []),
    ...(inpiDocs ?? []),
  ];
  // FIX P4-8: Accept all stored/available statuses, not just "auto"
  const hasDocType = (typePattern: string) =>
    allDocs.some(d => d.type.toUpperCase().includes(typePattern.toUpperCase()) && (d.status === "auto" || d.status === "lien_direct" || d.storedInSupabase || d.downloadable)) ||
    (uploadedDocs ?? []).some(d => d.type.toUpperCase().includes(typePattern.toUpperCase()));

  const fields: Array<{ label: string; ok: boolean }> = [
    { label: "SIREN", ok: !!enterprise?.siren },
    { label: "Raison sociale", ok: !!enterprise?.raison_sociale },
    { label: "Adresse", ok: !!enterprise?.adresse },
    { label: "Forme juridique", ok: !!enterprise?.forme_juridique },
    { label: "Capital", ok: (enterprise?.capital ?? 0) > 0 },
    { label: "Dirigeant", ok: !!enterprise?.dirigeant },
    { label: "KBIS", ok: hasDocType("KBIS") },
    { label: "Statuts", ok: hasDocType("STATUT") },
    { label: "CNI", ok: hasDocType("CNI") },
    { label: "RIB", ok: hasDocType("RIB") },
  ];
  const ok = fields.filter(f => f.ok).length;
  const missing = fields.filter(f => !f.ok).map(f => f.label);
  return { percent: Math.round((ok / fields.length) * 100), missing };
}
