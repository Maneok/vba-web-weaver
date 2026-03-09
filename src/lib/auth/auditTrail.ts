import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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

    const profileRes = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", user.id)
      .single();

    if (profileRes.error || !profileRes.data) {
      if (profileRes.error) logger.warn("Audit", "profile lookup failed:", profileRes.error.message);
      return;
    }

    await supabase.from("audit_trail").insert({
      cabinet_id: profileRes.data.cabinet_id,
      user_id: user.id,
      user_email: user.email || "",
      action: entry.action,
      table_name: entry.table_name || null,
      record_id: entry.record_id || null,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      ip_address: null, // Set by server-side if needed
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    logger.error("Audit", "trail error:", err);
  }
}
