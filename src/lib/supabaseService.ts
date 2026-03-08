import { supabase } from "@/integrations/supabase/client";

// Helper: get current user's cabinet_id from profile
async function getCabinetId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("cabinet_id")
    .eq("id", user.id)
    .single();
  return data?.cabinet_id || null;
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
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[DB] clients getAll:", error);
      return [];
    }
    return data || [];
  },

  async create(client: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, cabinet_id: cabinetId })
      .select()
      .single();
    if (error) {
      console.error("[DB] clients create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("[DB] clients update:", error);
      return null;
    }
    return data;
  },

  async updateByRef(ref: string, updates: Record<string, unknown>) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data, error } = await supabase
      .from("clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .select()
      .single();
    if (error) {
      console.error("[DB] clients updateByRef:", error);
      return null;
    }
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) console.error("[DB] clients delete:", error);
  },

  async getByRef(ref: string) {
    const cabinetId = await getCabinetId();
    if (!cabinetId) return null;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId)
      .eq("ref", ref)
      .single();
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
      .order("nom");
    return data || [];
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
      console.error("[DB] collab create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const { data } = await supabase
      .from("collaborateurs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return data;
  },

  async delete(id: string) {
    await supabase.from("collaborateurs").delete().eq("id", id);
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
      .order("created_at", { ascending: false });
    return data || [];
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
      console.error("[DB] alerte create:", error);
      return null;
    }
    return data;
  },

  async update(id: string, updates: Record<string, unknown>) {
    const { data } = await supabase
      .from("alertes_registre")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return data;
  },
};

// ===== AUDIT TRAIL (LOGS) =====
export const logsService = {
  async add(action: string, details: string, recordId?: string, tableName?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cabinetId = await getCabinetId();
    if (!cabinetId) return;
    await supabase.from("audit_trail").insert({
      cabinet_id: cabinetId,
      user_id: user.id,
      user_email: user.email || "",
      action,
      table_name: tableName || "",
      record_id: recordId || "",
      new_data: { details },
    });
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
      console.error("[DB] controle create:", error);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const clean = siren.replace(/\s/g, "");
    const existing = await this.getBySiren(clean);
    if (existing) {
      await supabase
        .from("brouillons")
        .update({ data: formData, step, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("brouillons")
        .insert({ user_id: user.id, siren: clean, data: formData, step });
    }
  },

  async delete(siren: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("brouillons")
      .delete()
      .eq("user_id", user.id)
      .eq("siren", siren.replace(/\s/g, ""));
  },
};
