import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  action: string;
  table_name?: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
}

// FIX 25: Use getSession() instead of getUser() to avoid extra network call
// FIX 26: Cache cabinet_id to avoid querying profiles on every audit log
let cachedCabinetId: string | null = null;
let cachedUserId: string | null = null;

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const user = session.user;

    // Use cached cabinet_id if same user
    if (cachedUserId !== user.id || !cachedCabinetId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("cabinet_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileData?.cabinet_id) {
        if (import.meta.env.DEV) console.warn("[Audit] No cabinet_id found, skipping audit log");
        return;
      }
      cachedCabinetId = profileData.cabinet_id;
      cachedUserId = user.id;
    }

    await supabase.from("audit_trail").insert({
      cabinet_id: cachedCabinetId,
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
    if (import.meta.env.DEV) console.error("[Audit] Error (non-blocking):", err);
    // NE JAMAIS throw ici — l'audit ne doit jamais bloquer l'app
  }
}

// FIX 26: Clear cache on sign-out
export function clearAuditCache(): void {
  cachedCabinetId = null;
  cachedUserId = null;
}
