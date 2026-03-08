import { supabase } from "@/integrations/supabase/client";

export const clientsService = {
  async getAll() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("clients getAll:", error);
      return [];
    }
    return data || [];
  },
  async create(client: any) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, user_id: user.id })
      .select()
      .single();
    if (error) {
      console.error("clients create:", error);
      return null;
    }
    return data;
  },
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from("clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("clients update:", error);
      return null;
    }
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) console.error("clients delete:", error);
  },
};

export const logsService = {
  async add(entry: {
    utilisateur?: string;
    ref_client?: string;
    type_action: string;
    details: string;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_trail").insert({ ...entry, user_id: user.id });
  },
  async getAll() {
    const { data } = await supabase
      .from("audit_trail")
      .select("*")
      .order("horodatage", { ascending: false });
    return data || [];
  },
};
