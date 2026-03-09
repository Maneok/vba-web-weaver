/**
 * Governance-specific Supabase services for the LCB-FT compliance module.
 *
 * Provides CRUD operations for: formations, manuel_procedures, non_conformites,
 * declarations_soupcon, controles_croec, auto_evaluations, controles_internes.
 *
 * All operations are scoped by cabinet_id for multi-tenant isolation.
 * Falls back to local storage when Supabase tables don't exist yet.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// ─── Helpers ────────────────────────────────────────────────

const PROTECTED_FIELDS = ["id", "cabinet_id", "created_at", "user_id"] as const;

function stripProtected(updates: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...updates };
  for (const f of PROTECTED_FIELDS) delete safe[f];
  return safe;
}

let cachedCabinetId: string | null = null;

async function getCabinetId(): Promise<string | null> {
  if (cachedCabinetId) return cachedCabinetId;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", user.id)
      .single();
    if (error) {
      logger.error("GOV", "getCabinetId error:", error);
      return null;
    }
    cachedCabinetId = data?.cabinet_id || null;
    return cachedCabinetId;
  } catch (e) {
    logger.error("GOV", "getCabinetId exception:", e);
    return null;
  }
}

// Reset cached cabinet ID on auth state change
supabase.auth.onAuthStateChange(() => {
  cachedCabinetId = null;
});

// ─── Local Storage Fallback ─────────────────────────────────
// Used when Supabase tables don't exist yet (dev / migration pending)

function getLocalData<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(`grimy_gov_${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(`grimy_gov_${key}`, JSON.stringify(data));
  } catch (e) {
    logger.error("GOV", `localStorage write failed for ${key}:`, e);
  }
}

// ─── Generic CRUD with fallback ─────────────────────────────

interface CrudOptions {
  tableName: string;
  storageKey: string;
  orderBy?: string;
}

function createCrudService<T extends { id: string }>(opts: CrudOptions) {
  const { tableName, storageKey, orderBy = "created_at" } = opts;

  async function trySupabase<R>(fn: () => Promise<R>): Promise<{ data: R | null; usedFallback: boolean }> {
    try {
      const result = await fn();
      return { data: result, usedFallback: false };
    } catch (e: unknown) {
      // If table doesn't exist, fall back to local storage
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist") || msg.includes("42P01") || msg.includes("relation")) {
        return { data: null, usedFallback: true };
      }
      throw e;
    }
  }

  return {
    async getAll(): Promise<T[]> {
      const cabinetId = await getCabinetId();
      const { data, usedFallback } = await trySupabase(async () => {
        if (!cabinetId) return [];
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .eq("cabinet_id", cabinetId)
          .order(orderBy, { ascending: false });
        if (error) throw error;
        return (data || []) as T[];
      });
      if (usedFallback) {
        return getLocalData<T>(storageKey);
      }
      return data || [];
    },

    async create(record: Omit<T, "id"> & { id?: string }): Promise<T | null> {
      const cabinetId = await getCabinetId();
      const { data, usedFallback } = await trySupabase(async () => {
        if (!cabinetId) return null;
        const toInsert = stripProtected(record as Record<string, unknown>);
        const { data, error } = await supabase
          .from(tableName)
          .insert({ ...toInsert, cabinet_id: cabinetId })
          .select()
          .single();
        if (error) throw error;
        return data as T;
      });
      if (usedFallback) {
        const id = record.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newRecord = { ...record, id } as T;
        const existing = getLocalData<T>(storageKey);
        setLocalData(storageKey, [newRecord, ...existing]);
        return newRecord;
      }
      return data;
    },

    async update(id: string, updates: Partial<T>): Promise<T | null> {
      const cabinetId = await getCabinetId();
      const { data, usedFallback } = await trySupabase(async () => {
        if (!cabinetId) return null;
        const { data, error } = await supabase
          .from(tableName)
          .update(stripProtected(updates as Record<string, unknown>))
          .eq("id", id)
          .eq("cabinet_id", cabinetId)
          .select()
          .single();
        if (error) throw error;
        return data as T;
      });
      if (usedFallback) {
        const existing = getLocalData<T>(storageKey);
        const updated = existing.map(item =>
          item.id === id ? { ...item, ...updates } : item
        );
        setLocalData(storageKey, updated);
        return updated.find(item => item.id === id) || null;
      }
      return data;
    },

    async delete(id: string): Promise<boolean> {
      const cabinetId = await getCabinetId();
      const { usedFallback } = await trySupabase(async () => {
        if (!cabinetId) return false;
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("id", id)
          .eq("cabinet_id", cabinetId);
        if (error) throw error;
        return true;
      });
      if (usedFallback) {
        const existing = getLocalData<T>(storageKey);
        setLocalData(storageKey, existing.filter(item => item.id !== id));
      }
      return true;
    },
  };
}

// ─── Typed interfaces ───────────────────────────────────────

export interface FormationRecord {
  id: string;
  collaborateur: string;
  date: string;
  organisme: string;
  duree_heures: number;
  theme: string;
  attestation_url: string;
  quiz_score: string;
  notes: string;
}

export interface ManuelVersion {
  id: string;
  version: string;
  date: string;
  statut: "VALIDE" | "BROUILLON" | "ARCHIVE";
  resume: string;
  contenu: string;
}

export interface LectureRecord {
  id: string;
  manuel_version_id: string;
  collaborateur: string;
  date_lecture: string | null;
}

export interface NonConformiteRecord {
  id: string;
  date: string;
  source: string;
  client: string;
  description: string;
  gravite: "MINEURE" | "MAJEURE" | "CRITIQUE";
  action_corrective: string;
  responsable: string;
  echeance: string;
  statut: "OUVERTE" | "EN_COURS" | "RESOLUE";
}

export interface ControlePlanifie {
  id: string;
  date: string;
  controleur: string;
  dossiers: string[];
  statut: "PLANIFIE" | "EN_COURS" | "TERMINE";
}

export interface ControleCROECRecord {
  id: string;
  date: string;
  type: string;
  resultat: "CONFORME" | "AVEC_RESERVES" | "NON_CONFORME";
  rapport_url: string;
  notes: string;
}

export interface DeclarationSoupconRecord {
  id: string;
  date_detection: string;
  client: string;
  motif: string;
  decision: "DECLARE" | "CLASSE" | "EN_ANALYSE";
  justification: string;
  ref_tracfin: string;
  statut: "EN_COURS" | "TRANSMISE" | "CLASSEE";
  elements_suspects: string;
}

export interface AutoEvaluationRecord {
  id: string;
  date: string;
  reponses: Record<string, string>;
  score: number;
}

// ─── Service instances ──────────────────────────────────────

export const formationsService = createCrudService<FormationRecord>({
  tableName: "formations",
  storageKey: "formations",
  orderBy: "date",
});

export const manuelService = createCrudService<ManuelVersion>({
  tableName: "manuel_procedures",
  storageKey: "manuel_procedures",
  orderBy: "date",
});

export const lecturesService = createCrudService<LectureRecord>({
  tableName: "lectures_manuel",
  storageKey: "lectures_manuel",
});

export const nonConformitesService = createCrudService<NonConformiteRecord>({
  tableName: "non_conformites",
  storageKey: "non_conformites",
  orderBy: "date",
});

export const controlesPlanifiesService = createCrudService<ControlePlanifie>({
  tableName: "controles_planifies",
  storageKey: "controles_planifies",
  orderBy: "date",
});

export const croecService = createCrudService<ControleCROECRecord>({
  tableName: "controles_croec",
  storageKey: "controles_croec",
  orderBy: "date",
});

export const declarationsService = createCrudService<DeclarationSoupconRecord>({
  tableName: "declarations_soupcon",
  storageKey: "declarations_soupcon",
  orderBy: "date_detection",
});

export const autoEvalService = createCrudService<AutoEvaluationRecord>({
  tableName: "auto_evaluations",
  storageKey: "auto_evaluations",
  orderBy: "date",
});

// ─── Parametres service (key-value store) ───────────────────

export const parametresGovService = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const { data, error } = await supabase
        .from("parametres")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        return (typeof data.value === "string" ? JSON.parse(data.value) : data.value) as T;
      }
    } catch {
      // Try localStorage fallback
      try {
        const raw = localStorage.getItem(`grimy_param_${key}`);
        if (raw) return JSON.parse(raw) as T;
      } catch { /* ignore */ }
    }
    return defaultValue;
  },

  async set(key: string, value: unknown): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("parametres")
        .upsert({ key, value: value as Record<string, unknown> }, { onConflict: "key" });
      if (error) throw error;
      return true;
    } catch {
      // Fallback to localStorage
      try {
        localStorage.setItem(`grimy_param_${key}`, JSON.stringify(value));
      } catch { /* ignore */ }
      return false;
    }
  },
};
