// ──────────────────────────────────────────────
// Workflow statuts LM + reconduction tacite + alertes
// ──────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { formatDateFr } from "@/lib/dateUtils";

// ── Types ──

export interface LMAlerte {
  id: string;
  cabinet_id: string;
  instance_id: string | null;
  client_id: string | null;
  type: LMAlerteType;
  message: string;
  severity: "info" | "warning" | "critical";
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  due_date: string | null;
  created_at: string;
  // Joined
  client_name?: string;
  instance_numero?: string;
}

export type LMAlerteType =
  | "reconduction_3mois"
  | "reconduction_1mois"
  | "signature_relance"
  | "revue_annuelle"
  | "risque_eleve"
  | "avenant_necessaire"
  | "expiration_kyc";

export type LMStatus = "brouillon" | "envoyee" | "signee" | "archivee" | "resiliee";

// ── Transitions autorisees ──

export const STATUS_TRANSITIONS: Record<LMStatus, LMStatus[]> = {
  brouillon: ["envoyee", "archivee"],
  envoyee: ["signee", "brouillon", "archivee"],
  signee: ["archivee", "resiliee"],
  archivee: [],
  resiliee: ["archivee"],
};

export const STATUS_LABELS: Record<LMStatus, { label: string; color: string; bgClass: string; description: string; dotClass: string }> = {
  brouillon: { label: "Brouillon", color: "slate", bgClass: "bg-slate-500/10 text-slate-400 border-slate-500/20", description: "En cours de redaction", dotClass: "bg-slate-400" },
  envoyee: { label: "Envoyee", color: "blue", bgClass: "bg-blue-500/10 text-blue-400 border-blue-500/20", description: "Envoyee au client, en attente de signature", dotClass: "bg-blue-400" },
  signee: { label: "Signee", color: "emerald", bgClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", description: "Signee par le client", dotClass: "bg-emerald-400" },
  archivee: { label: "Archivee", color: "purple", bgClass: "bg-purple-500/10 text-purple-400 border-purple-500/20", description: "Archivee — plus modifiable", dotClass: "bg-purple-400" },
  resiliee: { label: "Resiliee", color: "red", bgClass: "bg-red-500/10 text-red-400 border-red-500/20", description: "Resiliee par l'une des parties", dotClass: "bg-red-400" },
};

export const ALERTE_TYPE_LABELS: Record<LMAlerteType, string> = {
  reconduction_3mois: "Reconduction tacite — 3 mois",
  reconduction_1mois: "Reconduction tacite — 1 mois",
  signature_relance: "Relance signature",
  revue_annuelle: "Revue annuelle",
  risque_eleve: "Risque eleve",
  avenant_necessaire: "Avenant necessaire",
  expiration_kyc: "Expiration KYC",
};

// ── Changer le statut d'une LM ──

export async function changeStatus(
  instanceId: string,
  newStatus: LMStatus,
  metadata?: {
    sent_to_email?: string;
    resiliee_motif?: string;
    resiliee_par?: string;
  }
): Promise<void> {
  const { data: instance, error: fetchErr } = await supabase
    .from("lettres_mission")
    .select("id, statut, status, client_ref, raison_sociale")
    .eq("id", instanceId)
    .maybeSingle();

  if (fetchErr || !instance) {
    throw new Error("Lettre de mission introuvable");
  }

  const currentStatus = (instance.statut || instance.status || "brouillon") as LMStatus;
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Transition non autorisee : ${currentStatus} → ${newStatus}. Transitions possibles : ${allowed.join(", ") || "aucune"}`
    );
  }

  const updatePayload: Record<string, unknown> = {
    statut: newStatus,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "envoyee") {
    updatePayload.sent_at = new Date().toISOString();
    if (metadata?.sent_to_email) {
      updatePayload.sent_to_email = metadata.sent_to_email;
    }
  }

  if (newStatus === "signee") {
    updatePayload.signed_at = new Date().toISOString();
    updatePayload.date_signature = new Date().toISOString().slice(0, 10);
  }

  if (newStatus === "resiliee") {
    updatePayload.resiliee_at = new Date().toISOString();
    if (metadata?.resiliee_motif) updatePayload.resiliee_motif = metadata.resiliee_motif;
    if (metadata?.resiliee_par) updatePayload.resiliee_par = metadata.resiliee_par;
  }

  const { error: updateErr } = await supabase
    .from("lettres_mission")
    .update(updatePayload)
    .eq("id", instanceId);

  if (updateErr) throw updateErr;

  logAudit({
    action: "LM_STATUS_CHANGE",
    table_name: "lettres_mission",
    record_id: instanceId,
    old_data: { status: currentStatus },
    new_data: { status: newStatus, ...metadata },
  }).catch((e) => logger.warn("LM_WORKFLOW", "Audit log failed:", e));
}

// ── Alertes CRUD ──

export async function getAlertes(
  cabinetId: string,
  filters?: {
    unresolvedOnly?: boolean;
    type?: LMAlerteType;
    severity?: string;
    instanceId?: string;
    limit?: number;
  }
): Promise<LMAlerte[]> {
  let query = supabase
    .from("lm_alertes")
    .select("*")
    .eq("cabinet_id", cabinetId)
    .order("created_at", { ascending: false });

  if (filters?.unresolvedOnly) {
    query = query.eq("is_resolved", false);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.severity) {
    query = query.eq("severity", filters.severity);
  }
  if (filters?.instanceId) {
    query = query.eq("instance_id", filters.instanceId);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("LM_WORKFLOW", "Failed to fetch alertes:", error);
    throw error;
  }
  return (data || []) as LMAlerte[];
}

export async function resolveAlerte(alerteId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("lm_alertes")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: authData?.user?.id || null,
    })
    .eq("id", alerteId);

  if (error) throw error;

  logAudit({
    action: "LM_ALERTE_RESOLVED",
    table_name: "lm_alertes",
    record_id: alerteId,
  }).catch((e) => logger.warn("LM_WORKFLOW", "Audit log failed:", e));
}

export async function createAlerte(data: {
  cabinet_id: string;
  instance_id?: string;
  client_id?: string;
  type: LMAlerteType;
  message: string;
  severity?: "info" | "warning" | "critical";
  due_date?: string;
}): Promise<void> {
  const { error } = await supabase.from("lm_alertes").insert({
    cabinet_id: data.cabinet_id,
    instance_id: data.instance_id || null,
    client_id: data.client_id || null,
    type: data.type,
    message: data.message,
    severity: data.severity || "warning",
    due_date: data.due_date || null,
  });

  if (error) throw error;
}

// ── Verification reconduction tacite ──

export async function checkReconductions(cabinetId: string): Promise<number> {
  const { data: letters, error } = await supabase
    .from("lettres_mission")
    .select("id, client_ref, raison_sociale, wizard_data, statut, status")
    .eq("cabinet_id", cabinetId);

  if (error || !letters) return 0;

  const now = new Date();
  let created = 0;

  for (const letter of letters) {
    const statut = letter.statut || letter.status;
    if (statut !== "signee") continue;

    const wd = letter.wizard_data as Record<string, unknown> | null;
    if (!wd?.date_debut || !wd?.duree) continue;
    if (!wd?.tacite_reconduction) continue;

    const start = new Date(wd.date_debut as string);
    if (isNaN(start.getTime())) continue;

    const years = parseInt(String(wd.duree), 10) || 1;
    const cloture = new Date(start);
    cloture.setFullYear(cloture.getFullYear() + years);

    const diff3m = new Date(cloture);
    diff3m.setMonth(diff3m.getMonth() - 3);

    const diff1m = new Date(cloture);
    diff1m.setMonth(diff1m.getMonth() - 1);

    const { data: existing } = await supabase
      .from("lm_alertes")
      .select("type")
      .eq("instance_id", letter.id)
      .in("type", ["reconduction_3mois", "reconduction_1mois"]);

    const existingTypes = (existing || []).map((a: { type: string }) => a.type);

    if (now >= diff3m && !existingTypes.includes("reconduction_3mois")) {
      await createAlerte({
        cabinet_id: cabinetId,
        instance_id: letter.id,
        type: "reconduction_3mois",
        message: `La lettre de mission de ${letter.raison_sociale || letter.client_ref} arrive a echeance le ${formatDateFr(cloture)}. Reconduction tacite dans 3 mois.`,
        severity: "info",
        due_date: diff3m.toISOString().slice(0, 10),
      });
      created++;
    }

    if (now >= diff1m && !existingTypes.includes("reconduction_1mois")) {
      await createAlerte({
        cabinet_id: cabinetId,
        instance_id: letter.id,
        type: "reconduction_1mois",
        message: `Dernier rappel : la lettre de mission de ${letter.raison_sociale || letter.client_ref} se reconduit automatiquement le ${formatDateFr(cloture)}.`,
        severity: "critical",
        due_date: diff1m.toISOString().slice(0, 10),
      });
      created++;
    }
  }

  return created;
}

// ── Verification signatures en attente ──

export async function checkPendingSignatures(cabinetId: string): Promise<number> {
  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 14);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  const { data: letters, error } = await supabase
    .from("lettres_mission")
    .select("id, client_ref, raison_sociale, statut, status, updated_at, sent_at")
    .eq("cabinet_id", cabinetId);

  if (error || !letters) return 0;

  let created = 0;

  for (const letter of letters) {
    const statut = letter.statut || letter.status;
    if (statut !== "envoyee") continue;

    const sentDate = new Date((letter as any).sent_at || letter.updated_at);
    if (isNaN(sentDate.getTime())) continue;

    const { data: existing } = await supabase
      .from("lm_alertes")
      .select("id, type, message")
      .eq("instance_id", letter.id)
      .eq("type", "signature_relance")
      .eq("is_resolved", false);

    const existingMessages = (existing || []).map((a: any) => a.message);
    const clientLabel = letter.raison_sociale || letter.client_ref;

    // 30 days — critical
    if (sentDate <= thirtyDaysAgo && !existingMessages.some((m: string) => m.includes("30 jours"))) {
      await createAlerte({
        cabinet_id: cabinetId,
        instance_id: letter.id,
        type: "signature_relance",
        message: `URGENT : La lettre de mission de ${clientLabel} est en attente de signature depuis plus de 30 jours. Action immediate requise.`,
        severity: "critical",
      });
      created++;
    }
    // 14 days — warning
    else if (sentDate <= fourteenDaysAgo && !existingMessages.some((m: string) => m.includes("14 jours"))) {
      await createAlerte({
        cabinet_id: cabinetId,
        instance_id: letter.id,
        type: "signature_relance",
        message: `La lettre de mission de ${clientLabel} est en attente de signature depuis plus de 14 jours. Relance recommandee.`,
        severity: "warning",
      });
      created++;
    }
    // 7 days — info
    else if (sentDate <= sevenDaysAgo && (!existing || existing.length === 0)) {
      await createAlerte({
        cabinet_id: cabinetId,
        instance_id: letter.id,
        type: "signature_relance",
        message: `La lettre de mission de ${clientLabel} est en attente de signature depuis plus de 7 jours.`,
        severity: "info",
      });
      created++;
    }
  }

  return created;
}

// ── Verification revues annuelles ──

export async function checkRevuesAnnuelles(cabinetId: string): Promise<number> {
  const elevenMonthsAgo = new Date();
  elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

  const { data: letters, error } = await supabase
    .from("lettres_mission")
    .select("id, client_ref, raison_sociale, statut, status, wizard_data, updated_at")
    .eq("cabinet_id", cabinetId);

  if (error || !letters) return 0;

  let created = 0;

  for (const letter of letters) {
    const statut = letter.statut || letter.status;
    if (statut !== "signee") continue;

    const wd = letter.wizard_data as Record<string, unknown> | null;
    const signedStr = (wd?.date_signature as string) || letter.updated_at;
    const signedDate = new Date(signedStr);
    if (isNaN(signedDate.getTime()) || signedDate > elevenMonthsAgo) continue;

    const { data: existing } = await supabase
      .from("lm_alertes")
      .select("id")
      .eq("instance_id", letter.id)
      .eq("type", "revue_annuelle")
      .eq("is_resolved", false)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await createAlerte({
      cabinet_id: cabinetId,
      instance_id: letter.id,
      type: "revue_annuelle",
      message: `Revue annuelle a effectuer pour la lettre de mission de ${letter.raison_sociale || letter.client_ref}. Signee il y a plus de 11 mois.`,
      severity: "warning",
    });
    created++;
  }

  return created;
}

// ── Lancer toutes les verifications ──

export async function runAllChecks(cabinetId: string): Promise<{ total: number }> {
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      checkReconductions(cabinetId),
      checkPendingSignatures(cabinetId),
      checkRevuesAnnuelles(cabinetId),
      checkRiskAlertes(cabinetId).then((a) => a.length),
    ]);
    return { total: r1 + r2 + r3 + r4 };
  } catch (e) {
    logger.error("LM_WORKFLOW", "runAllChecks failed:", e);
    return { total: 0 };
  }
}

// ── Verification risques LCB-FT ──

export interface RiskAlerte {
  type: "risque_eleve" | "risque_moyen" | "revue_annuelle_kyc" | "expiration_kyc";
  severity: "critical" | "warning" | "info";
  clientRef: string;
  clientNom: string;
  score: number;
  message: string;
}

export async function checkRiskAlertes(cabinetId: string): Promise<RiskAlerte[]> {
  const alertes: RiskAlerte[] = [];

  try {
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("cabinet_id", cabinetId);
    if (clientsErr || !clients) return alertes;

    // LMs actives
    const { data: lms } = await supabase
      .from("lettres_mission")
      .select("client_ref, statut")
      .eq("cabinet_id", cabinetId)
      .in("statut", ["signee", "en_validation", "envoyee"]);
    const activeClientRefs = new Set((lms || []).map((l: any) => l.client_ref));

    // Alertes existantes non résolues (lm_alertes)
    const { data: existingAlertes } = await supabase
      .from("lm_alertes")
      .select("client_id, type, is_resolved")
      .eq("cabinet_id", cabinetId)
      .eq("is_resolved", false);
    const existingSet = new Set(
      (existingAlertes || []).map((a: any) => `${a.client_id}::${a.type}`)
    );

    const now = new Date();

    for (const c of clients) {
      const ref = c.ref || c.reference || "";
      const clientId = c.id; // uuid réel pour FK lm_alertes.client_id
      const nom = c.raison_sociale || "";
      const score = c.score_global ?? 0;
      const hasActiveLM = activeClientRefs.has(ref);
      const derniereRevue = c.date_derniere_revue;

      // a) Risque élevé (score >= 70)
      if (score >= 70 && !existingSet.has(`${clientId}::risque_eleve`)) {
        const alerte: RiskAlerte = {
          type: "risque_eleve",
          severity: "critical",
          clientRef: ref,
          clientNom: nom,
          score,
          message: `Le client ${nom} presente un risque eleve (score ${score}/100). Une vigilance renforcee et une revue du dossier sont requises.`,
        };
        alertes.push(alerte);
        if (hasActiveLM) {
          await createAlerte({
            cabinet_id: cabinetId,
            client_id: clientId,
            type: "risque_eleve",
            message: alerte.message,
            severity: "critical",
          });
        }
      }

      // b) Risque moyen (50-69) → revue recommandée
      if (score >= 50 && score < 70 && !existingSet.has(`${clientId}::revue_annuelle`)) {
        const alerte: RiskAlerte = {
          type: "risque_moyen",
          severity: "warning",
          clientRef: ref,
          clientNom: nom,
          score,
          message: `Le client ${nom} presente un risque moyen (score ${score}/100). Revue recommandee.`,
        };
        alertes.push(alerte);
        if (hasActiveLM) {
          await createAlerte({
            cabinet_id: cabinetId,
            client_id: clientId,
            type: "revue_annuelle",
            message: alerte.message,
            severity: "warning",
          });
        }
      }

      // c) Expiration KYC
      if (derniereRevue && !existingSet.has(`${clientId}::expiration_kyc`)) {
        const revueDate = new Date(derniereRevue);
        if (!isNaN(revueDate.getTime())) {
          const diffYears = (now.getTime() - revueDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

          let kycAlerte: RiskAlerte | null = null;
          if (score >= 70 && diffYears > 1) {
            kycAlerte = {
              type: "expiration_kyc",
              severity: "critical",
              clientRef: ref,
              clientNom: nom,
              score,
              message: `Le dossier KYC de ${nom} (risque eleve) n'a pas ete revu depuis plus d'un an. Revue immediate requise.`,
            };
          } else if (score >= 50 && score < 70 && diffYears > 2) {
            kycAlerte = {
              type: "expiration_kyc",
              severity: "warning",
              clientRef: ref,
              clientNom: nom,
              score,
              message: `Le dossier KYC de ${nom} (risque moyen) n'a pas ete revu depuis plus de 2 ans. Revue recommandee.`,
            };
          } else if (score < 50 && diffYears > 3) {
            kycAlerte = {
              type: "expiration_kyc",
              severity: "info",
              clientRef: ref,
              clientNom: nom,
              score,
              message: `Le dossier KYC de ${nom} n'a pas ete revu depuis plus de 3 ans. Pensez a programmer une revue.`,
            };
          }

          if (kycAlerte) {
            alertes.push(kycAlerte);
            if (hasActiveLM) {
              await createAlerte({
                cabinet_id: cabinetId,
                client_id: clientId,
                type: "expiration_kyc",
                message: kycAlerte.message,
                severity: kycAlerte.severity,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error("LM_WORKFLOW", "checkRiskAlertes failed:", err);
  }

  return alertes;
}

// ── Helpers utilitaires ──

/** OPT-1: Verifier si une transition est autorisee */
export function canTransition(from: LMStatus, to: LMStatus): boolean {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

/** OPT-7: Statistiques workflow pour le dashboard */
export async function getWorkflowStats(cabinetId: string): Promise<{
  total: number;
  byStatus: Record<LMStatus, number>;
  totalHonoraires: number;
  avgDuration: number;
}> {
  const { data: letters, error } = await supabase
    .from("lettres_mission")
    .select("statut, status, wizard_data")
    .eq("cabinet_id", cabinetId);

  if (error || !letters) {
    return { total: 0, byStatus: { brouillon: 0, envoyee: 0, signee: 0, archivee: 0, resiliee: 0 }, totalHonoraires: 0, avgDuration: 0 };
  }

  const byStatus: Record<LMStatus, number> = { brouillon: 0, envoyee: 0, signee: 0, archivee: 0, resiliee: 0 };
  let totalHonoraires = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const l of letters) {
    const s = (l.statut || l.status || "brouillon") as LMStatus;
    byStatus[s] = (byStatus[s] || 0) + 1;
    const wd = l.wizard_data as Record<string, unknown> | null;
    if (wd?.honoraires_ht) totalHonoraires += Number(wd.honoraires_ht) || 0;
    if (wd?.duration_seconds && Number(wd.duration_seconds) > 0) {
      totalDuration += Number(wd.duration_seconds);
      durationCount++;
    }
  }

  return {
    total: letters.length,
    byStatus,
    totalHonoraires,
    avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
  };
}

/** OPT-8: Activite recente */
export async function getRecentActivity(cabinetId: string, limit = 10): Promise<{
  id: string;
  action: string;
  raison_sociale: string;
  statut: string;
  updated_at: string;
}[]> {
  const { data, error } = await supabase
    .from("lettres_mission")
    .select("id, raison_sociale, statut, status, updated_at")
    .eq("cabinet_id", cabinetId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((l: any) => ({
    id: l.id,
    action: "update",
    raison_sociale: l.raison_sociale || "—",
    statut: l.statut || l.status || "brouillon",
    updated_at: l.updated_at,
  }));
}

/** OPT-9: Changement de statut en masse */
export async function bulkChangeStatus(
  instanceIds: string[],
  newStatus: LMStatus,
  metadata?: { resiliee_motif?: string }
): Promise<{ success: number; errors: string[] }> {
  let success = 0;
  const errors: string[] = [];

  for (const id of instanceIds) {
    try {
      await changeStatus(id, newStatus, metadata);
      success++;
    } catch (e: any) {
      errors.push(`${id}: ${e?.message || "Erreur"}`);
    }
  }

  return { success, errors };
}

/** OPT-16: Nombre d'alertes non resolues */
export async function getUnresolvedAlertesCount(cabinetId: string): Promise<number> {
  const { count, error } = await supabase
    .from("lm_alertes")
    .select("id", { count: "exact", head: true })
    .eq("cabinet_id", cabinetId)
    .eq("is_resolved", false);

  if (error) return 0;
  return count || 0;
}

/** OPT-17: Ignorer une alerte (is_read sans resoudre) */
export async function dismissAlerte(alerteId: string): Promise<void> {
  const { error } = await supabase
    .from("lm_alertes")
    .update({ is_read: true })
    .eq("id", alerteId);

  if (error) throw error;
}

/** OPT-19: Archiver les lettres anciennes (archivees/resiliees > N jours) */
export async function archiveOldLetters(cabinetId: string, olderThanDays = 365): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const { data: letters, error } = await supabase
    .from("lettres_mission")
    .select("id, statut, status, updated_at")
    .eq("cabinet_id", cabinetId)
    .in("statut", ["signee"])
    .lt("updated_at", cutoff.toISOString());

  if (error || !letters) return 0;

  let archived = 0;
  for (const l of letters) {
    try {
      await changeStatus(l.id, "archivee");
      archived++;
    } catch {
      // skip if transition not allowed
    }
  }

  return archived;
}

// ── KPI de revue pour l'espace revue ──

export function computeRevueKPIs(clients: { scoreGlobal?: number; dateDerniereRevue?: string }[]) {
  const now = new Date();
  let vigilanceRenforcee = 0;
  let kycExpires = 0;
  let revuesAFaire = 0;

  for (const c of clients) {
    const score = c.scoreGlobal ?? 0;
    if (score > 60) vigilanceRenforcee++;

    if (c.dateDerniereRevue) {
      const revueDate = new Date(c.dateDerniereRevue);
      if (!isNaN(revueDate.getTime())) {
        const diffYears = (now.getTime() - revueDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (
          (score >= 70 && diffYears > 1) ||
          (score >= 50 && score < 70 && diffYears > 2) ||
          (score < 50 && diffYears > 3)
        ) {
          kycExpires++;
        }
        if (diffYears > 1) revuesAFaire++;
      }
    } else {
      kycExpires++;
      revuesAFaire++;
    }
  }

  return { vigilanceRenforcee, kycExpires, revuesAFaire };
}
