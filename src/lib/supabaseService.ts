import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { MAX_RETRIES, RETRY_DELAY_MS, AUDIT_TRAIL_FETCH_LIMIT } from "@/lib/constants";

// OPT-DB1: Exponential backoff for retries (1s, 2s, 4s...)
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn("DB", `${label} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  throw new Error(`${label} failed after ${MAX_RETRIES + 1} attempts`);
}

// OPT-DB2: Request deduplication — prevents duplicate concurrent requests
const _inflight = new Map<string, Promise<unknown>>();
async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}

// OPT-8: Strip fields that should never be overwritten by client code
// OPT: Use Set for O(1) lookup + Object.fromEntries for clean filtering
const PROTECTED_FIELDS = new Set(["id", "cabinet_id", "created_at", "user_id", "updated_at"]);
function stripProtected(updates: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(updates).filter(([k]) => !PROTECTED_FIELDS.has(k)));
}

// Helper: get current user's cabinet_id from profile (cached)
let _cachedCabinetId: string | null = null;
let _cachedUserId: string | null = null;

export function clearCabinetCache() {
  _cachedCabinetId = null;
  _cachedUserId = null;
}

async function getCabinetId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { _cachedCabinetId = null; _cachedUserId = null; return null; }
    // Return cache if same user
    if (_cachedCabinetId && _cachedUserId === user.id) return _cachedCabinetId;

    // Try up to 3 times with increasing delay (profile may not be created yet on first login)
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
        logger.warn("DB", `getCabinetId attempt ${attempt + 1} failed, retrying in ${(attempt + 1) * 500}ms...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      } else {
        logger.error("DB", "getCabinetId failed after 3 attempts:", error?.message ?? "cabinet_id is null");
      }
    }
    _cachedCabinetId = null;
    _cachedUserId = null;
    return null;
  } catch (e) {
    logger.error("DB", "getCabinetId exception:", e);
    _cachedCabinetId = null;
    _cachedUserId = null;
    return null;
  }
}

// ===== CLIENTS =====
export const clientsService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    // OPT-DB3: Dedupe concurrent getAll calls (e.g. from multiple components)
    return dedupe(`clients.getAll.${cabinetId}`, () => withRetry("clients.getAll", async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("cabinet_id", cabinetId)
        .order("created_at", { ascending: false });
      if (error) {
        logger.error("DB", "clients getAll:", error);
        throw error;
      }
      return data || [];
    }).catch((err) => {
      logger.error("DB", "clients.getAll failed after retries:", err);
      return [] as Record<string, unknown>[];
    }));
  },

  async create(client: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) {
      logger.error("DB", "clients.create: no cabinet_id — user profile may not be initialized");
      return null;
    }
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, cabinet_id: cabinetId })
      .select()
      .single();
    if (error) {
      logger.error("DB", "clients create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .update({ ...stripProtected(updates), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .single();
    if (error) {
      logger.error("DB", "clients update:", error);
      return null;
    }
    return data;
  },

  async updateByRef(ref: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .update({ ...stripProtected(updates), updated_at: new Date().toISOString() })
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .select()
      .single();
    if (error) {
      logger.error("DB", "clients updateByRef:", error);
      return null;
    }
    return data;
  },

  // OPT-37: Throw on delete failure for consistency with deleteByRef
  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    const { error } = await supabase.from("clients").delete().eq("id", id).eq("cabinet_id", cabinetId);
    if (error) {
      logger.error("DB", "clients delete:", error);
      throw error;
    }
  },

  async deleteByRef(ref: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("ref", ref)
      .eq("cabinet_id", cabinetId);
    if (error) {
      logger.error("DB", "clients deleteByRef:", error);
      throw error;
    }
  },

  async getByRef(ref: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .single();
    if (error) logger.error("DB", "clients getByRef:", error);
    return data;
  },

  async getBySiren(siren: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const clean = siren.replace(/\s/g, "");
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .eq("siren", clean)
      .maybeSingle();
    if (error) logger.error("DB", "clients getBySiren:", error);
    return data;
  },
};

// ===== COLLABORATEURS =====
export const collaborateursService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    return withRetry("collab.getAll", async () => {
      const { data, error } = await supabase
        .from("collaborateurs")
        .select("*, profiles:profile_id(id, email, role, is_active, last_login_at, avatar_url)")
        .eq("cabinet_id", cabinetId)
        .order("nom");
      if (error) {
        logger.error("DB", "collab getAll:", error);
        throw error;
      }
      return data || [];
    }).catch((err) => {
      logger.error("DB", "collab.getAll failed after retries:", err);
      return [];
    });
  },

  async create(collab: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("collaborateurs")
      .insert({ ...collab, cabinet_id: cabinetId })
      .select()
      .single();
    if (error) {
      logger.error("DB", "collab create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("collaborateurs")
      .update({ ...stripProtected(updates), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .single();
    if (error) {
      logger.error("DB", "collab update:", error);
      return null;
    }
    return data;
  },

  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    const { error } = await supabase.from("collaborateurs").delete().eq("id", id).eq("cabinet_id", cabinetId);
    if (error) logger.error("DB", "collab delete:", error);
  },
};

// ===== REGISTRE (ALERTES) =====
export const registreService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    return withRetry("registre.getAll", async () => {
      const { data, error } = await supabase
        .from("alertes_registre")
        .select("*")
        .eq("cabinet_id", cabinetId)
        .order("created_at", { ascending: false });
      if (error) {
        logger.error("DB", "registre getAll:", error);
        throw error;
      }
      return data || [];
    }).catch((err) => {
      logger.error("DB", "registre.getAll failed after retries:", err);
      return [];
    });
  },

  async create(alerte: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("alertes_registre")
      .insert({ ...alerte, cabinet_id: cabinetId })
      .select()
      .single();
    if (error) {
      logger.error("DB", "alerte create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("alertes_registre")
      .update({ ...stripProtected(updates), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .single();
    if (error) {
      logger.error("DB", "registre update:", error);
      return null;
    }
    return data;
  },

  // OPT-39: Add delete method to registreService (was using raw supabase in AppContext)
  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return false;
    const { error } = await supabase
      .from("alertes_registre")
      .delete()
      .eq("id", id)
      .eq("cabinet_id", cabinetId);
    if (error) {
      logger.error("DB", "registre delete:", error);
      return false;
    }
    return true;
  },
};

// ===== AUDIT TRAIL (LOGS) =====
export const logsService = {
  async add(action: string, details: string, recordId?: string, tableName?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cabinetId = await getCabinetId();
      if (!cabinetId) return;
      const { error } = await supabase.from("audit_trail").insert({
        cabinet_id: cabinetId,
        user_id: user.id,
        user_email: user.email || "",
        action,
        table_name: tableName || "",
        record_id: recordId || "",
        new_data: { details },
      });
      if (error) {
        logger.error("AuditTrail", "Failed to write audit log:", error.message);
      }
    } catch (err) {
      logger.error("AuditTrail", "Exception writing audit log:", err);
    }
  },

  // OPT-40: Use centralized AUDIT_TRAIL_FETCH_LIMIT constant instead of hardcoded 200
  async getAll(limit = AUDIT_TRAIL_FETCH_LIMIT, offset = 0) {
    try {
      const cabinetId = await getCabinetId();
      if (!cabinetId) return [];
      const { data, error } = await supabase
        .from("audit_trail")
        .select("created_at, user_email, record_id, action, new_data")
        .eq("cabinet_id", cabinetId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        logger.error("AuditTrail", "getAll error:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      logger.error("AuditTrail", "getAll exception:", err);
      return [];
    }
  },
};

// ===== CONTROLES QUALITE =====
export const controlesService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    const { data } = await supabase
      .from("controles_qualite")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .order("created_at", { ascending: false });
    return data || [];
  },

  async create(controle: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("controles_qualite")
      .insert({ ...controle, cabinet_id: cabinetId })
      .select()
      .single();
    if (error) {
      logger.error("DB", "controle create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, controle: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("controles_qualite")
      .update({ ...stripProtected(controle), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .single();
    if (error) {
      logger.error("DB", "controle update:", error);
      return null;
    }
    return data;
  },

  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return false;
    const { error } = await supabase
      .from("controles_qualite")
      .delete()
      .eq("id", id)
      .eq("cabinet_id", cabinetId);
    if (error) {
      logger.error("DB", "controle delete:", error);
      return false;
    }
    return true;
  },
};

// ===== BROUILLONS =====
export const brouillonsService = {
  async getBySiren(siren: string) {
    if (!siren || !siren.trim()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data } = await supabase
      .from("brouillons")
      .select("*")
      .eq("user_id", user.id)
      .eq("cabinet_id", cabinetId)
      .eq("siren", siren.replace(/\s/g, ""))
      .maybeSingle();
    return data;
  },

  // OPT-10: Use atomic upsert instead of check-then-act to prevent race conditions
  async save(siren: string, formData: unknown, step: number) {
    if (!siren || !siren.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    const clean = siren.replace(/\s/g, "");
    const { error } = await supabase
      .from("brouillons")
      .upsert(
        { user_id: user.id, cabinet_id: cabinetId, siren: clean, data: formData, step, updated_at: new Date().toISOString() },
        { onConflict: "user_id,cabinet_id,siren" }
      );
    if (error) logger.error("DB", "brouillon upsert:", error);
  },

  async delete(siren: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    const { error } = await supabase
      .from("brouillons")
      .delete()
      .eq("user_id", user.id)
      .eq("cabinet_id", cabinetId)
      .eq("siren", siren.replace(/\s/g, ""));
    if (error) logger.error("DB", "brouillon delete:", error);
  },
};
