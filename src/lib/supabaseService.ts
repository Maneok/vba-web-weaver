import { supabase } from "@/integrations/supabase/client";

// Whitelist of allowed fields per table to prevent mass assignment
const CLIENT_FIELDS = [
  "ref", "siren", "siret", "raison_sociale", "forme_juridique", "adresse",
  "code_postal", "ville", "pays", "activite", "code_naf", "date_creation",
  "capital", "chiffre_affaires", "effectif", "dirigeant", "email", "telephone",
  "site_web", "iban_encrypted", "bic_encrypted", "cni_encrypted",
  "niveau_risque", "score_risque", "risque_global", "justification_risque",
  "statut", "type_client", "date_entree_relation", "date_fin_relation",
  "responsable", "notes", "beneficiaires", "screening_data", "documents_data",
  "questions_vigilance", "decision", "motif_refus", "gel_avoirs_data",
  "sanctions_data", "pep_data", "adverse_media_data",
] as const;

const COLLAB_FIELDS = [
  "nom", "email", "role", "telephone", "derniereFormation",
  "dateFormation", "statut",
] as const;

function sanitizeFields(data: Record<string, unknown>, allowedFields: readonly string[]): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in data) clean[key] = data[key];
  }
  return clean;
}

// FIX 27: Cache cabinet_id for session lifetime to avoid repeated queries
let _cachedCabinetId: string | null = null;
let _cachedForUserId: string | null = null;

async function getCabinetId(): Promise<string | null> {
  try {
    // FIX 25: Use getSession() instead of getUser() (avoids extra network call)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      _cachedCabinetId = null;
      _cachedForUserId = null;
      return null;
    }

    // Return cached value if same user
    if (_cachedForUserId === session.user.id && _cachedCabinetId) {
      return _cachedCabinetId;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] getCabinetId error:", error);
      return null;
    }
    _cachedCabinetId = data?.cabinet_id || null;
    _cachedForUserId = session.user.id;
    return _cachedCabinetId;
  } catch (e) {
    if (import.meta.env.DEV) console.error("[DB] getCabinetId exception:", e);
    return null;
  }
}

// Clear cache on sign-out (called from AuthContext)
export function clearCabinetCache(): void {
  _cachedCabinetId = null;
  _cachedForUserId = null;
}

// ===== CLIENTS =====
export const clientsService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients getAll:", error);
      return [];
    }
    return data || [];
  },

  async create(client: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...sanitizeFields(client, CLIENT_FIELDS), cabinet_id: cabinetId })
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .update({ ...sanitizeFields(updates, CLIENT_FIELDS), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients update:", error);
      return null;
    }
    return data;
  },

  async updateByRef(ref: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .update({ ...sanitizeFields(updates, CLIENT_FIELDS), updated_at: new Date().toISOString() })
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients updateByRef:", error);
      return null;
    }
    return data;
  },

  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return false;
    const { error } = await supabase.from("clients").delete().eq("id", id).eq("cabinet_id", cabinetId);
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients delete:", error);
      return false;
    }
    return true;
  },

  async deleteByRef(ref: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return false;
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref);
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] clients deleteByRef:", error);
      return false;
    }
    return true;
  },

  async getByRef(ref: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .maybeSingle();
    return data;
  },

  async getBySiren(siren: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const clean = siren.replace(/\s/g, "");
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .eq("siren", clean)
      .maybeSingle();
    return data;
  },
};

// ===== COLLABORATEURS =====
export const collaborateursService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    const { data } = await supabase
      .from("collaborateurs")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .order("nom")
      .limit(200);
    return data || [];
  },

  async create(collab: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("collaborateurs")
      .insert({ ...sanitizeFields(collab, COLLAB_FIELDS), cabinet_id: cabinetId })
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] collab create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("collaborateurs")
      .update(sanitizeFields(updates, COLLAB_FIELDS))
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .maybeSingle();
    if (error) if (import.meta.env.DEV) console.error("[DB] collab update:", error);
    return data;
  },

  async delete(id: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return false;
    const { error } = await supabase.from("collaborateurs").delete().eq("id", id).eq("cabinet_id", cabinetId);
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] collab delete:", error);
      return false;
    }
    return true;
  },
};

// ===== REGISTRE (ALERTES) =====
export const registreService = {
  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    const { data } = await supabase
      .from("alertes_registre")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .order("created_at", { ascending: false })
      .limit(500);
    return data || [];
  },

  async create(alerte: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("alertes_registre")
      .insert({ ...alerte, cabinet_id: cabinetId })
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] alerte create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("alertes_registre")
      .update(updates)
      .eq("id", id)
      .eq("cabinet_id", cabinetId)
      .select()
      .maybeSingle();
    if (error) if (import.meta.env.DEV) console.error("[DB] alerte update:", error);
    return data;
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
      if (error) if (import.meta.env.DEV) console.error("[DB] audit insert error:", error);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DB] logsService.add exception:", err);
    }
  },

  async getAll() {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return [];
    const { data } = await supabase
      .from("audit_trail")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data || [];
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
      .order("created_at", { ascending: false })
      .limit(200);
    return data || [];
  },

  async create(controle: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("controles_qualite")
      .insert({ ...controle, cabinet_id: cabinetId })
      .select()
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error("[DB] controle create:", error);
      return null;
    }
    return data;
  },
};

// ===== BROUILLONS =====
export const brouillonsService = {
  async getBySiren(siren: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("brouillons")
      .select("*")
      .eq("user_id", user.id)
      .eq("siren", siren.replace(/\s/g, ""))
      .maybeSingle();
    return data;
  },

  async save(siren: string, formData: unknown, step: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const clean = siren.replace(/\s/g, "");
      const existing = await this.getBySiren(clean);
      if (existing) {
        const { error } = await supabase
          .from("brouillons")
          .update({ data: formData, step, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) if (import.meta.env.DEV) console.error("[DB] brouillon update:", error);
      } else {
        const { error } = await supabase
          .from("brouillons")
          .insert({ user_id: user.id, siren: clean, data: formData, step });
        if (error) if (import.meta.env.DEV) console.error("[DB] brouillon insert:", error);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DB] brouillon save exception:", err);
    }
  },

  async delete(siren: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("brouillons")
        .delete()
        .eq("user_id", user.id)
        .eq("siren", siren.replace(/\s/g, ""));
      if (error) if (import.meta.env.DEV) console.error("[DB] brouillon delete:", error);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DB] brouillon delete exception:", err);
    }
  },
};
