import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// ===== TYPES =====
// #6  - Add all DB fields to interfaces (type_mission, description, niveau_risque, parametres_pilotes)
// #7  - Add type_client to RefTypeJuridique
// #8  - Add GAFI flags to RefPays
// #9  - Add categories/ordre/reponse_risquee to RefQuestion

export interface RefMission {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  type_mission: string;
  description: string;
  niveau_risque: string;
  score: number;          // mapped from DB score_risque
  parametres_pilotes: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefTypeJuridique {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  type_client: string;
  description: string;
  niveau_risque: string;
  score: number;          // mapped from DB score_risque
  parametres_pilotes: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefPays {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  libelle_nationalite: string;
  description: string;
  niveau_risque: string;
  score: number;          // mapped from DB score_risque
  gafi_noir: boolean;
  gafi_gris: boolean;
  offshore: boolean;
  sanctionne: boolean;
  non_cooperatif: boolean;
  parametres_pilotes: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefActivite {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  description: string;
  niveau_risque: string;
  score: number;          // mapped from DB score_risque
  parametres_pilotes: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefQuestion {
  id: string;
  cabinet_id: string;
  code: string;
  libelle: string;
  categories: string[];
  categorie: string;      // comma-joined categories for display
  description: string;
  reponse_risquee: string;
  ponderation: number;
  ordre: number;
  parametres_pilotes: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ===== FIELD MAPPING =====
// #10 - Fix score ↔ score_risque field name mismatch (ROOT BUG)
// #11 - Map est_gafi_noir → gafi_noir for consistency
// #12 - Auto-compute niveau_risque from score

/** Map DB column names → frontend field names */
function mapFromDb(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...row };
  // score_risque → score
  if ("score_risque" in mapped) {
    mapped.score = mapped.score_risque;
    delete mapped.score_risque;
  }
  // est_gafi_noir → gafi_noir (etc.)
  if ("est_gafi_noir" in mapped) {
    mapped.gafi_noir = mapped.est_gafi_noir;
    delete mapped.est_gafi_noir;
  }
  if ("est_gafi_gris" in mapped) {
    mapped.gafi_gris = mapped.est_gafi_gris;
    delete mapped.est_gafi_gris;
  }
  if ("est_offshore" in mapped) {
    mapped.offshore = mapped.est_offshore;
    delete mapped.est_offshore;
  }
  if ("est_sanctionne" in mapped) {
    mapped.sanctionne = mapped.est_sanctionne;
    delete mapped.est_sanctionne;
  }
  if ("est_non_cooperatif" in mapped) {
    mapped.non_cooperatif = mapped.est_non_cooperatif;
    delete mapped.est_non_cooperatif;
  }
  // categories array → comma string for display
  if (Array.isArray(mapped.categories)) {
    mapped.categorie = (mapped.categories as string[]).join(", ");
  }
  return mapped;
}

/** Map frontend field names → DB column names + auto-compute niveau_risque */
function mapToDb(updates: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...updates };
  // score → score_risque
  if ("score" in mapped) {
    mapped.score_risque = mapped.score;
    delete mapped.score;
  }
  // #12 - Auto-compute niveau_risque when score changes
  if (typeof mapped.score_risque === "number") {
    const s = mapped.score_risque as number;
    mapped.niveau_risque = s <= 25 ? "Faible" : s <= 60 ? "Moyen" : "\u00c9lev\u00e9";
  }
  // gafi_noir → est_gafi_noir (etc.)
  if ("gafi_noir" in mapped) {
    mapped.est_gafi_noir = mapped.gafi_noir;
    delete mapped.gafi_noir;
  }
  if ("gafi_gris" in mapped) {
    mapped.est_gafi_gris = mapped.gafi_gris;
    delete mapped.gafi_gris;
  }
  if ("offshore" in mapped) {
    mapped.est_offshore = mapped.offshore;
    delete mapped.offshore;
  }
  if ("sanctionne" in mapped) {
    mapped.est_sanctionne = mapped.sanctionne;
    delete mapped.sanctionne;
  }
  if ("non_cooperatif" in mapped) {
    mapped.est_non_cooperatif = mapped.non_cooperatif;
    delete mapped.non_cooperatif;
  }
  // categorie comma string → categories array
  if (typeof mapped.categorie === "string" && !Array.isArray(mapped.categories)) {
    mapped.categories = (mapped.categorie as string).split(",").map(s => s.trim()).filter(Boolean);
    delete mapped.categorie;
  }
  return mapped;
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

// ===== DATA CHANGE EVENT =====
// #13 - Event bus for cross-component cache invalidation

type DataChangeListener = (tableName: string) => void;
const _listeners: DataChangeListener[] = [];

/** Register a callback for when any referential data changes */
export function onReferentielChange(listener: DataChangeListener): () => void {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function notifyChange(tableName: string) {
  for (const listener of _listeners) {
    try { listener(tableName); } catch (e) { logger.warn("REF", "listener error:", e); }
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
      // #10 - Map DB fields to frontend fields
      return (data || []).map(row => mapFromDb(row as Record<string, unknown>) as T);
    },

    async create(item: Partial<Omit<T, "id" | "cabinet_id" | "created_at" | "updated_at">>): Promise<T | null> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) {
        logger.error("REF", `${label}.create: no cabinet_id`);
        return null;
      }
      // #10 - Map frontend fields to DB fields before insert
      const dbItem = mapToDb(item as Record<string, unknown>);
      const { data, error } = await supabase
        .from(tableName)
        .insert({ ...dbItem, cabinet_id: cabinetId, is_default: false })
        .select()
        .single();

      if (error) {
        logger.error("REF", `${label} create:`, error);
        return null;
      }
      // #13 - Notify listeners of data change
      notifyChange(tableName);
      return mapFromDb(data as Record<string, unknown>) as T;
    },

    async update(id: string, updates: Record<string, unknown>): Promise<T | null> {
      const cabinetId = await getCabinetId();
      if (!cabinetId) return null;

      // #10 - Map frontend fields to DB fields before update
      // #12 - Auto-compute niveau_risque from score
      const dbUpdates = mapToDb(stripProtected(updates));
      const { data, error } = await supabase
        .from(tableName)
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("cabinet_id", cabinetId)
        .select()
        .single();

      if (error) {
        logger.error("REF", `${label} update:`, error);
        return null;
      }
      // #13 - Notify listeners of data change
      notifyChange(tableName);
      return mapFromDb(data as Record<string, unknown>) as T;
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
      // #13 - Notify listeners of data change
      notifyChange(tableName);
      return true;
    },

    search(items: T[], query: string): T[] {
      if (!query.trim()) return items;
      const q = query.toLowerCase().trim();
      return items.filter((item) => {
        const rec = item as Record<string, unknown>;
        const libelle = rec.libelle;
        const code = rec.code;
        const description = rec.description;
        return (
          (typeof libelle === "string" && libelle.toLowerCase().includes(q)) ||
          (typeof code === "string" && code.toLowerCase().includes(q)) ||
          (typeof description === "string" && description.toLowerCase().includes(q))
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
