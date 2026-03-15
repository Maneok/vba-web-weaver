import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// ===== TYPES =====

export interface RefMission {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  score: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefTypeJuridique {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  score: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefPays {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  score: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefActivite {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  score: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefQuestion {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  categorie: string;
  ponderation: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ===== HELPERS =====

const PROTECTED_FIELDS = ["id", "cabinet_id", "created_at", "updated_at", "is_default"] as const;

function stripProtected(updates: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...updates };
  for (const f of PROTECTED_FIELDS) delete safe[f];
  return safe;
}

// Reuse getCabinetId from supabaseService pattern
let _cachedCabinetId: string | null = null;
let _cachedUserId: string | null = null;

async function getCabinetId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { _cachedCabinetId = null; _cachedUserId = null; return null; }
    if (_cachedCabinetId && _cachedUserId === user.id) return _cachedCabinetId;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("cabinet_id")
        .eq("id", user.id)
        .single();
      if (!error && data?.cabinet_id) {
        _cachedCabinetId = data.cabinet_id;
        _cachedUserId = user.id;
        return _cachedCabinetId;
      }
      if (attempt < 2) {
        logger.warn("REF", `getCabinetId attempt ${attempt + 1} failed, retrying...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      }
    }
    _cachedCabinetId = null;
    _cachedUserId = null;
    return null;
  } catch (e) {
    logger.error("REF", "getCabinetId exception:", e);
    _cachedCabinetId = null;
    _cachedUserId = null;
    return null;
  }
}

/**
 * Lazy initialization: if no rows exist for this cabinet_id, copy all
 * is_default=true rows from the template set and assign them to this cabinet.
 */
async function lazyInit(tableName: string, cabinetId: string): Promise<void> {
  // Check if cabinet already has rows
  const { count, error: countError } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq("cabinet_id", cabinetId);

  if (countError) {
    logger.error("REF", `${tableName} lazyInit count error:`, countError);
    return;
  }

  if (count && count > 0) return; // already initialized

  // Fetch default template rows
  const { data: defaults, error: defaultsError } = await supabase
    .from(tableName)
    .select("*")
    .eq("is_default", true);

  if (defaultsError) {
    logger.error("REF", `${tableName} lazyInit fetch defaults error:`, defaultsError);
    return;
  }

  if (!defaults || defaults.length === 0) {
    logger.warn("REF", `${tableName} has no is_default=true rows to copy`);
    return;
  }

  // Copy defaults for this cabinet
  const copies = defaults.map((row: Record<string, unknown>) => {
    const copy = { ...row };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.cabinet_id = cabinetId;
    copy.is_default = false;
    return copy;
  });

  const { error: insertError } = await supabase.from(tableName).insert(copies);
  if (insertError) {
    logger.error("REF", `${tableName} lazyInit insert error:`, insertError);
  } else {
    logger.info("REF", `${tableName}: initialized ${copies.length} rows for cabinet ${cabinetId}`);
  }
}

// ===== GENERIC REFERENTIEL SERVICE FACTORY =====

function createReferentielService<T extends { id: string; code?: string; libelle?: string }>(
  tableName: string,
  label: string,
) {
  return {
    async getAll(): Promise<T[]> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) return [];

      await lazyInit(tableName, cabinetId);

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("cabinet_id", cabinetId)
        .order("code");

      if (error) {
        logger.error("REF", `${label} getAll:`, error);
        return [];
      }
      return (data || []) as T[];
    },

    async create(item: Partial<Omit<T, "id" | "cabinet_id" | "created_at" | "updated_at">>): Promise<T | null> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) {
        logger.error("REF", `${label}.create: no cabinet_id`);
        return null;
      }
      const { data, error } = await supabase
        .from(tableName)
        .insert({ ...item, cabinet_id: cabinetId, is_default: false })
        .select()
        .single();

      if (error) {
        logger.error("REF", `${label} create:`, error);
        return null;
      }
      return data as T;
    },

    async update(id: string, updates: Record<string, unknown>): Promise<T | null> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) return null;

      const { data, error } = await supabase
        .from(tableName)
        .update({ ...stripProtected(updates), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("cabinet_id", cabinetId)
        .select()
        .single();

      if (error) {
        logger.error("REF", `${label} update:`, error);
        return null;
      }
      return data as T;
    },

    async delete(id: string): Promise<boolean> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) return false;

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id)
        .eq("cabinet_id", cabinetId);

      if (error) {
        logger.error("REF", `${label} delete:`, error);
        return false;
      }
      return true;
    },

    search(items: T[], query: string): T[] {
      if (!query.trim()) return items;
      const q = query.toLowerCase().trim();
      return items.filter((item) => {
        const libelle = (item as Record<string, unknown>).libelle;
        const code = (item as Record<string, unknown>).code;
        return (
          (typeof libelle === "string" && libelle.toLowerCase().includes(q)) ||
          (typeof code === "string" && code.toLowerCase().includes(q))
        );
      });
    },
  };
}

// ===== EXPORTED SERVICES =====

export const refMissionsService = createReferentielService<RefMission>("ref_missions", "missions");

export const refTypesJuridiquesService = createReferentielService<RefTypeJuridique>("ref_types_juridiques", "types_juridiques");

export const refPaysService = createReferentielService<RefPays>("ref_pays", "pays");

export const refActivitesService = createReferentielService<RefActivite>("ref_activites", "activites");

export const refQuestionsService = createReferentielService<RefQuestion>("ref_questions", "questions");
