import { supabase } from "@/integrations/supabase/client";

export interface RevueMaintien {
  id: string;
  cabinet_id: string;
  client_id: string;
  type: 'annuelle' | 'risque_eleve' | 'kyc_expiration' | 'changement_situation' | 'controle_qualite';
  status: 'a_faire' | 'en_cours' | 'completee' | 'reportee';
  score_risque_avant: number | null;
  score_risque_apres: number | null;
  vigilance_avant: string | null;
  vigilance_apres: string | null;
  kyc_verifie: boolean;
  be_verifie: boolean;
  documents_a_jour: boolean;
  maintien_confirme: boolean;
  observations: string | null;
  decision: 'maintien' | 'vigilance_renforcee' | 'fin_relation' | null;
  decision_motif: string | null;
  assigne_a: string | null;
  complete_par: string | null;
  valide_par: string | null;
  date_echeance: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from clients table
  client_nom?: string;
  client_ref?: string;
  client_score?: number;
  client_vigilance?: string;
}

export type RevueStatus = 'a_faire' | 'en_cours' | 'completee' | 'reportee';

export type RevueType = 'annuelle' | 'risque_eleve' | 'kyc_expiration' | 'changement_situation' | 'controle_qualite';

export const REVUE_TYPE_LABELS: Record<RevueType, { label: string; color: string; description: string }> = {
  annuelle: { label: 'Revue annuelle', color: 'blue', description: 'Maintien de mission' },
  risque_eleve: { label: 'Risque élevé', color: 'red', description: 'Vigilance renforcée requise' },
  kyc_expiration: { label: 'KYC expiré', color: 'orange', description: "Documents d'identification à renouveler" },
  changement_situation: { label: 'Changement situation', color: 'purple', description: 'Événement nécessitant réévaluation' },
  controle_qualite: { label: 'Contrôle qualité', color: 'slate', description: 'Préparation contrôle CROEC' },
};

export interface RevueFilters {
  status?: string;
  type?: string;
  clientId?: string;
  search?: string;
  riskLevel?: string;
}

export interface RevueStats {
  total_a_faire: number;
  risque_eleve: number;
  kyc_expires: number;
  en_retard: number;
  completees_ce_mois: number;
}

// ─── CRUD ────────────────────────────────────────────────────────────

export async function getRevues(cabinetId: string, filters?: RevueFilters): Promise<RevueMaintien[]> {
  // clients columns: raison_sociale, ref, score_global, niv_vigilance
  let query = supabase
    .from('revue_maintien')
    .select('*, clients(raison_sociale, ref, score_global, niv_vigilance)')
    .eq('cabinet_id', cabinetId)
    .order('date_echeance', { ascending: true });

  if (filters?.status && filters.status !== 'tous') {
    query = query.eq('status', filters.status);
  }
  if (filters?.type && filters.type !== 'tous') {
    query = query.eq('type', filters.type);
  }
  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    client_nom: row.clients?.raison_sociale,
    client_ref: row.clients?.ref,
    client_score: row.clients?.score_global != null ? Number(row.clients.score_global) : null,
    client_vigilance: row.clients?.niv_vigilance,
    clients: undefined,
  })).filter((r: RevueMaintien) => {
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      if (!r.client_nom?.toLowerCase().includes(s) && !r.client_ref?.toLowerCase().includes(s)) return false;
    }
    if (filters?.riskLevel && filters.riskLevel !== 'tous') {
      const score = r.score_risque_avant ?? r.client_score ?? 0;
      if (filters.riskLevel === 'eleve' && score < 70) return false;
      if (filters.riskLevel === 'moyen' && (score < 50 || score >= 70)) return false;
      if (filters.riskLevel === 'faible' && score >= 50) return false;
    }
    return true;
  });
}

export async function getRevueById(id: string): Promise<RevueMaintien> {
  const { data, error } = await supabase
    .from('revue_maintien')
    .select('*, clients(raison_sociale, ref, score_global, niv_vigilance)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    ...data,
    client_nom: (data as any).clients?.raison_sociale,
    client_ref: (data as any).clients?.ref,
    client_score: (data as any).clients?.score_global != null ? Number((data as any).clients.score_global) : null,
    client_vigilance: (data as any).clients?.niv_vigilance,
  } as RevueMaintien;
}

export async function createRevue(revue: Partial<RevueMaintien>): Promise<RevueMaintien> {
  const { data, error } = await supabase
    .from('revue_maintien')
    .insert(revue as any)
    .select()
    .single();
  if (error) throw error;
  return data as RevueMaintien;
}

export async function updateRevue(id: string, updates: Partial<RevueMaintien>): Promise<RevueMaintien> {
  const { data, error } = await supabase
    .from('revue_maintien')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RevueMaintien;
}

export async function completeRevue(
  id: string,
  payload: {
    score_apres: number;
    vigilance_apres: string;
    maintien: boolean;
    observations: string;
    decision: string;
    decision_motif?: string;
    kyc_verifie: boolean;
    be_verifie: boolean;
    documents_a_jour: boolean;
    needs_validation?: boolean;
  }
): Promise<RevueMaintien> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const revue = await updateRevue(id, {
      score_risque_apres: payload.score_apres,
      vigilance_apres: payload.vigilance_apres,
      maintien_confirme: payload.maintien,
      observations: payload.observations,
      decision: payload.decision as RevueMaintien['decision'],
      decision_motif: payload.decision_motif || null,
      kyc_verifie: payload.kyc_verifie,
      be_verifie: payload.be_verifie,
      documents_a_jour: payload.documents_a_jour,
      status: payload.needs_validation ? 'en_cours' : 'completee',
      complete_par: userId || null,
      completed_at: payload.needs_validation ? null : new Date().toISOString(),
    });

    // Fetch full revue to get client_id and before-values
    const full = await getRevueById(id);

    // Update client score/vigilance if changed
    const clientUpdates: Record<string, any> = {};
    if (full.score_risque_avant != null && payload.score_apres !== full.score_risque_avant) {
      clientUpdates.score_global = payload.score_apres;
    }
    if (full.vigilance_avant && payload.vigilance_apres !== full.vigilance_avant) {
      clientUpdates.niv_vigilance = payload.vigilance_apres;
    }
    if (Object.keys(clientUpdates).length > 0) {
      await supabase
        .from('clients')
        .update(clientUpdates)
        .eq('id', full.client_id);
    }

    // Resolve related pending alertes for this client
    await supabase
      .from('lm_alertes')
      .update({ is_resolved: true, updated_at: new Date().toISOString() })
      .eq('client_id', full.client_id)
      .eq('is_resolved', false)
      .in('type', ['revue_annuelle', 'risque_eleve', 'expiration_kyc']);

    return revue;
  } catch (error) {
    throw error;
  }
}

// ─── Génération automatique ──────────────────────────────────────────

export async function generatePendingRevues(cabinetId: string): Promise<number> {
  // clients columns: id (uuid), score_global (numeric), niv_vigilance (text), date_exp_cni (text)
  const { data: clients, error: cErr } = await supabase
    .from('clients')
    .select('id, score_global, niv_vigilance, date_exp_cni')
    .eq('cabinet_id', cabinetId);
  if (cErr) throw cErr;

  // Fetch existing pending revues
  const { data: existing, error: eErr } = await supabase
    .from('revue_maintien')
    .select('client_id, type, status')
    .eq('cabinet_id', cabinetId)
    .in('status', ['a_faire', 'en_cours']);
  if (eErr) throw eErr;

  // Fetch last completed revue per client
  const { data: completed, error: coErr } = await supabase
    .from('revue_maintien')
    .select('client_id, completed_at')
    .eq('cabinet_id', cabinetId)
    .eq('status', 'completee')
    .order('completed_at', { ascending: false });
  if (coErr) throw coErr;

  const pendingSet = new Set((existing || []).map(e => `${e.client_id}:${e.type}`));
  const lastCompleted: Record<string, string> = {};
  for (const c of completed || []) {
    if (!lastCompleted[c.client_id] && c.completed_at) {
      lastCompleted[c.client_id] = c.completed_at;
    }
  }

  const now = new Date();
  const revuesToCreate: Partial<RevueMaintien>[] = [];

  for (const client of clients || []) {
    const score = Number(client.score_global) || 0;
    const vigilance = client.niv_vigilance || null;

    // 1. Risque élevé sans revue pending
    if (score >= 70 && !pendingSet.has(`${client.id}:risque_eleve`)) {
      const echeance = new Date(now);
      echeance.setDate(echeance.getDate() + 30);
      revuesToCreate.push({
        cabinet_id: cabinetId,
        client_id: client.id,
        type: 'risque_eleve',
        status: 'a_faire',
        score_risque_avant: score,
        vigilance_avant: vigilance,
        date_echeance: echeance.toISOString().split('T')[0],
      });
    }

    // 2. Revue périodique
    const lastDate = lastCompleted[client.id];
    const monthsSinceLast = lastDate
      ? (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
      : Infinity;

    const threshold = score >= 70 ? 12 : score >= 50 ? 24 : 36;
    if (monthsSinceLast >= threshold && !pendingSet.has(`${client.id}:annuelle`)) {
      const echeance = new Date(now);
      echeance.setDate(echeance.getDate() + 30);
      revuesToCreate.push({
        cabinet_id: cabinetId,
        client_id: client.id,
        type: 'annuelle',
        status: 'a_faire',
        score_risque_avant: score,
        vigilance_avant: vigilance,
        date_echeance: echeance.toISOString().split('T')[0],
      });
    }

    // 3. KYC expiré (date_exp_cni is text format)
    if (client.date_exp_cni) {
      const kycDate = new Date(client.date_exp_cni);
      if (!isNaN(kycDate.getTime()) && kycDate <= now && !pendingSet.has(`${client.id}:kyc_expiration`)) {
        const echeance = new Date(now);
        echeance.setDate(echeance.getDate() + 15);
        revuesToCreate.push({
          cabinet_id: cabinetId,
          client_id: client.id,
          type: 'kyc_expiration',
          status: 'a_faire',
          score_risque_avant: score,
          vigilance_avant: vigilance,
          date_echeance: echeance.toISOString().split('T')[0],
        });
      }
    }
  }

  if (revuesToCreate.length > 0) {
    const { error } = await supabase
      .from('revue_maintien')
      .insert(revuesToCreate as any[]);
    if (error) throw error;
  }

  return revuesToCreate.length;
}

// ─── Stats ───────────────────────────────────────────────────────────

export async function getRevueStats(cabinetId: string): Promise<RevueStats> {
  const { data, error } = await supabase
    .from('revue_maintien')
    .select('status, type, date_echeance, completed_at')
    .eq('cabinet_id', cabinetId);
  if (error) throw error;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const rows = data || [];
  return {
    total_a_faire: rows.filter(r => r.status === 'a_faire').length,
    risque_eleve: rows.filter(r => r.type === 'risque_eleve' && (r.status === 'a_faire' || r.status === 'en_cours')).length,
    kyc_expires: rows.filter(r => r.type === 'kyc_expiration' && (r.status === 'a_faire' || r.status === 'en_cours')).length,
    en_retard: rows.filter(r => r.status === 'a_faire' && r.date_echeance < now.toISOString().split('T')[0]).length,
    completees_ce_mois: rows.filter(r => r.status === 'completee' && r.completed_at && r.completed_at >= startOfMonth).length,
  };
}

// ─── Par client ─────────────────────────────────────────────────────

export async function getRevuesByClient(clientId: string): Promise<RevueMaintien[]> {
  try {
    const { data, error } = await supabase
      .from('revue_maintien')
      .select('*, clients(raison_sociale, ref, score_global, niv_vigilance)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      client_nom: row.clients?.raison_sociale,
      client_ref: row.clients?.ref,
      client_score: row.clients?.score_global != null ? Number(row.clients.score_global) : null,
      client_vigilance: row.clients?.niv_vigilance,
      clients: undefined,
    }));
  } catch (error) {
    throw error;
  }
}

// ─── Transitions de statut ──────────────────────────────────────────

export async function markRevueEnCours(revueId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('revue_maintien')
      .update({ status: 'en_cours', updated_at: new Date().toISOString() })
      .eq('id', revueId)
      .eq('status', 'a_faire');
    if (error) throw error;
  } catch (error) {
    throw error;
  }
}

export async function reporterRevue(revueId: string, newDate: string, motif: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('revue_maintien')
      .update({
        status: 'reportee',
        date_echeance: newDate,
        observations: `[Report] ${motif}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', revueId);
    if (error) throw error;
  } catch (error) {
    throw error;
  }
}
