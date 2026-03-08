import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  action: string;
  table_name?: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileData?.cabinet_id) {
      console.warn("[Audit] No cabinet_id found, skipping audit log");
      return;
    }

    await supabase.from("audit_trail").insert({
      cabinet_id: profileData.cabinet_id,
      user_id: user.id,
      user_email: user.email || "",
      action: entry.action,
      table_name: entry.table_name || null,
      record_id: entry.record_id || null,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    });
  } catch (err) {
    console.error("[Audit] Error (non-blocking):", err);
    // NE JAMAIS throw ici — l'audit ne doit jamais bloquer l'app
  }
}
