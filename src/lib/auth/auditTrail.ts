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
  const context = {
    action: entry.action,
    table: entry.table_name ?? "N/A",
    record: entry.record_id ?? "N/A",
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn("Audit", "Audit ignoré : aucun utilisateur authentifié", context);
      return;
    }

    const profileRes = await supabase
      .from("profiles")
      .select("cabinet_id")
      .eq("id", user.id)
      .single();

    if (profileRes.error || !profileRes.data) {
      logger.warn("Audit", "Profil introuvable pour l'utilisateur", {
        ...context,
        userId: user.id,
        error: profileRes.error?.message ?? "profil vide",
      });
      return;
    }

    const { error: insertError } = await supabase.from("audit_trail").insert({
      cabinet_id: profileRes.data.cabinet_id,
      user_id: user.id,
      user_email: user.email || "",
      action: entry.action,
      table_name: entry.table_name || null,
      record_id: entry.record_id || null,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      ip_address: null, // IP captured server-side via edge function headers
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : "",
    });

    if (insertError) {
      logger.error("Audit", "Échec d'insertion dans audit_trail", {
        ...context,
        userId: user.id,
        cabinetId: profileRes.data.cabinet_id,
        error: insertError.message,
        code: insertError.code,
      });
    }
  } catch (err: unknown) {
    logger.error("Audit", "Erreur inattendue lors de l'écriture audit_trail", {
      ...context,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
