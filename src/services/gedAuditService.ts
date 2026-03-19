import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  id: string;
  document_id: string | null;
  siren: string;
  action: string;
  actor_name: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  upload: 'a importé',
  download: 'a téléchargé',
  preview: 'a consulté',
  validate: 'a validé',
  reject: 'a rejeté',
  delete: 'a supprimé',
  rename: 'a renommé',
  replace: 'a remplacé',
  category_change: 'a recatégorisé',
  tag_change: 'a modifié les tags de',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export async function logAudit(params: {
  documentId: string | null;
  cabinetId: string;
  siren: string;
  action: string;
  actorId: string;
  actorName: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.from('document_audit_log').insert({
      document_id: params.documentId,
      cabinet_id: params.cabinetId,
      siren: params.siren,
      action: params.action,
      actor_id: params.actorId,
      actor_name: params.actorName,
      details: params.details || {},
    });
    if (error) logger.error('GED Audit', 'logAudit insert error', error);
  } catch (err) {
    // Ne jamais bloquer l'action principale
    logger.error('GED Audit', 'logAudit exception', err);
  }
}

export async function fetchAuditLog(params: {
  siren?: string;
  documentId?: string;
  cabinetId: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  try {
    let query = supabase
      .from('document_audit_log')
      .select('*')
      .eq('cabinet_id', params.cabinetId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 50);

    if (params.siren) query = query.eq('siren', params.siren);
    if (params.documentId) query = query.eq('document_id', params.documentId);

    const { data, error } = await query;
    if (error) {
      logger.error('GED Audit', 'fetchAuditLog', error);
      throw error;
    }
    return (data as AuditEntry[]) || [];
  } catch (err) {
    logger.error('GED Audit', 'fetchAuditLog exception', err);
    throw err;
  }
}

export async function fetchCabinetActivityFeed(
  cabinetId: string,
  limit = 20,
): Promise<AuditEntry[]> {
  try {
    const { data, error } = await supabase
      .from('document_audit_log')
      .select('*')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      logger.error('GED Audit', 'fetchCabinetActivityFeed', error);
      throw error;
    }
    return (data as AuditEntry[]) || [];
  } catch (err) {
    logger.error('GED Audit', 'fetchCabinetActivityFeed exception', err);
    throw err;
  }
}
