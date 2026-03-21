// Service GED — requêtes Supabase pour la page Documents
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface GEDDocument {
  id: string;
  name: string;
  category: string;
  file_size: number;
  current_version: number;
  expiration_date: string | null;
  file_path: string;
  mime_type: string | null;
  client_ref: string | null;
  client_id?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  cabinet_id: string | null;
  label?: string | null;
  description?: string | null;
  validation_status?: string;
  tags?: string[];
  notes?: string;
  /** Resolved from client_ref join — may be null if no client match */
  client_name?: string;
  /** Resolved from client_ref join — may be null */
  siren?: string;
  niv_vigilance?: string;
}

export interface SirenFolder {
  siren: string;
  client_name: string;
  client_ref: string;
  client_id?: string;
  niv_vigilance?: string;
  documents: GEDDocument[];
  total_docs: number;
  required_docs: number; // 4 docs KYC obligatoires
  last_update: string;
  has_expired: boolean;
  completion_rate: number;
}

export interface GEDStats {
  total_documents: number;
  expiring_soon: number;   // < 30 jours
  expired: number;
  avg_completion: number;  // pourcentage moyen
}

// ── Helpers ────────────────────────────────────────────────────────

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr: string | null, days = 30): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const limit = new Date(now.getTime() + days * 86_400_000);
  return d >= now && d <= limit;
}

const REQUIRED_DOCS = 4; // 4 docs KYC obligatoires (kbis, extrait_kbis, cni_dirigeant, rib)

// ── Fetch folders groupés par client_ref ───────────────────────────

export async function fetchSirenFolders(cabinetId: string): Promise<SirenFolder[]> {
  try {
    // 1. Charger TOUS les clients du cabinet
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, ref, raison_sociale, siren, niv_vigilance')
      .eq('cabinet_id', cabinetId)
      .order('raison_sociale', { ascending: true });

    if (clientsError) throw new Error(clientsError.message);
    if (!clients || clients.length === 0) return [];

    // 2. Charger tous les documents du cabinet
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('cabinet_id', cabinetId)
      .order('updated_at', { ascending: false });

    // Grouper les docs par client_ref
    const docsByRef = new Map<string, GEDDocument[]>();
    if (docs) {
      for (const doc of docs) {
        const ref = doc.client_ref ?? '';
        const arr = docsByRef.get(ref) ?? [];
        arr.push(doc as GEDDocument);
        docsByRef.set(ref, arr);
      }
    }

    // 3. Construire un folder par client
    const folders: SirenFolder[] = clients.map(c => {
      const clientDocs = docsByRef.get(c.ref) ?? [];
      const lastUpdate = clientDocs[0]?.updated_at ?? clientDocs[0]?.created_at ?? '';
      return {
        siren: c.siren ?? '',
        client_name: c.raison_sociale ?? c.ref,
        client_ref: c.ref,
        client_id: c.id,
        niv_vigilance: c.niv_vigilance ?? 'STANDARD',
        documents: clientDocs,
        total_docs: clientDocs.length,
        required_docs: REQUIRED_DOCS,
        last_update: lastUpdate,
        has_expired: clientDocs.some(d => isExpired(d.expiration_date)),
        completion_rate: clientDocs.length > 0
          ? Math.min(100, Math.round((clientDocs.length / REQUIRED_DOCS) * 100))
          : 0,
      };
    });

    // Trier : clients avec docs en premier, puis par nom
    folders.sort((a, b) => {
      if (a.total_docs > 0 && b.total_docs === 0) return -1;
      if (a.total_docs === 0 && b.total_docs > 0) return 1;
      return a.client_name.localeCompare(b.client_name);
    });

    return folders;
  } catch (err) {
    logger.error('GED', 'fetchSirenFolders exception', err);
    throw err;
  }
}

// ── Fetch documents pour un client_ref ─────────────────────────────

export async function fetchDocumentsByClientRef(clientRef: string, cabinetId: string): Promise<GEDDocument[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('client_ref', clientRef)
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('GED', 'fetchDocumentsByClientRef', error);
      throw new Error(error.message);
    }

    return (data as GEDDocument[]) ?? [];
  } catch (err) {
    logger.error('GED', 'fetchDocumentsByClientRef exception', err);
    throw err;
  }
}

// ── Fetch documents pour un client_id ───────────────────────────

export async function fetchDocumentsByClientId(clientId: string, cabinetId: string): Promise<GEDDocument[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('GED', 'fetchDocumentsByClientId', error);
      throw new Error(error.message);
    }

    return (data as GEDDocument[]) ?? [];
  } catch (err) {
    logger.error('GED', 'fetchDocumentsByClientId exception', err);
    throw err;
  }
}

// ── Stats calculées côté client ────────────────────────────────────

export function getGEDStats(folders: SirenFolder[]): GEDStats {
  let total = 0;
  let expiringSoon = 0;
  let expired = 0;
  let completionSum = 0;

  for (const folder of folders) {
    total += folder.total_docs;
    completionSum += folder.completion_rate;

    for (const doc of folder.documents) {
      if (isExpired(doc.expiration_date)) expired++;
      else if (isExpiringSoon(doc.expiration_date)) expiringSoon++;
    }
  }

  return {
    total_documents: total,
    expiring_soon: expiringSoon,
    expired,
    avg_completion: folders.length > 0 ? Math.round(completionSum / folders.length) : 0,
  };
}

// ── Upload ─────────────────────────────────────────────────────────

export async function uploadDocument(
  file: File,
  clientRef: string,
  category: string,
  cabinetId: string,
  clientId?: string,
  siren?: string,
): Promise<GEDDocument> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    const storagePath = `${cabinetId}/${clientRef}/${category}/${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      logger.error('GED', 'uploadDocument — storage', uploadError);
      throw new Error(uploadError.message);
    }

    // Check if a doc with same category already exists for this client_ref
    const { data: existing } = await supabase
      .from('documents')
      .select('id, current_version')
      .eq('client_ref', clientRef)
      .eq('category', category)
      .eq('cabinet_id', cabinetId)
      .order('current_version', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0
      ? (existing[0].current_version ?? 1) + 1
      : 1;

    // Insert document record
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        cabinet_id: cabinetId,
        client_ref: clientRef,
        client_id: clientId || null,
        siren: siren || null,
        name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        category,
        current_version: nextVersion,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('GED', 'uploadDocument — insert', insertError);
      throw new Error(insertError.message);
    }

    return doc as GEDDocument;
  } catch (err) {
    logger.error('GED', 'uploadDocument exception', err);
    throw err;
  }
}

// ── Delete ─────────────────────────────────────────────────────────

export async function deleteDocument(docId: string): Promise<void> {
  try {
    // Get the file_path first
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', docId)
      .single();

    if (fetchError) {
      logger.error('GED', 'deleteDocument — fetch', fetchError);
      throw new Error(fetchError.message);
    }

    // Delete from storage
    if (doc?.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) {
        logger.error('GED', 'deleteDocument — storage', storageError);
        // Continue with DB deletion even if storage fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      logger.error('GED', 'deleteDocument — db', deleteError);
      throw new Error(deleteError.message);
    }
  } catch (err) {
    logger.error('GED', 'deleteDocument exception', err);
    throw err;
  }
}

// ── Validation workflow ──────────────────────────────────────────────

export async function validateDocument(docId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({
      validation_status: 'validated',
      validated_by: userId,
      validated_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', docId);
  if (error) {
    logger.error('GED', 'validateDocument', error);
    throw new Error(error.message);
  }
}

export async function rejectDocument(docId: string, userId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({
      validation_status: 'rejected',
      validated_by: userId,
      validated_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', docId);
  if (error) {
    logger.error('GED', 'rejectDocument', error);
    throw new Error(error.message);
  }
}

// ── Checklist KYC ───────────────────────────────────────────────────

const KYC_REQUIRED_DOCS: Record<string, string[]> = {
  allegee: ['kbis', 'extrait_kbis', 'cni_dirigeant', 'rib'],
  normale: ['kbis', 'extrait_kbis', 'cni_dirigeant', 'rib'],
  renforcee: ['kbis', 'extrait_kbis', 'cni_dirigeant', 'rib'],
};

// Map DB vigilance values to checklist levels
const VIGILANCE_MAP: Record<string, string> = {
  SIMPLIFIEE: 'allegee',
  STANDARD: 'normale',
  RENFORCEE: 'renforcee',
};

export function mapVigilanceLevel(dbValue: string | null): 'allegee' | 'normale' | 'renforcee' {
  if (!dbValue) return 'normale';
  return (VIGILANCE_MAP[dbValue.toUpperCase()] ?? 'normale') as 'allegee' | 'normale' | 'renforcee';
}

export function getRequiredDocs(vigilanceLevel: 'allegee' | 'normale' | 'renforcee'): string[] {
  return KYC_REQUIRED_DOCS[vigilanceLevel] ?? KYC_REQUIRED_DOCS.normale;
}

export function getKycCompletionStatus(existingCategories: string[], vigilanceLevel: string) {
  const level = VIGILANCE_MAP[vigilanceLevel.toUpperCase()] ?? vigilanceLevel;
  const required = getRequiredDocs(level as 'allegee' | 'normale' | 'renforcee');
  const existingLower = existingCategories.map(c => c.toLowerCase());
  const present = required.filter(cat => existingLower.includes(cat));
  return {
    total: required.length,
    completed: present.length,
    missing: required.filter(cat => !existingLower.includes(cat)),
    rate: required.length > 0 ? Math.round((present.length / required.length) * 100) : 0,
  };
}

// ── Rename document (#101) — DB + Storage copy ─────────────────────

export async function renameDocument(
  docId: string,
  newName: string,
  oldName: string,
): Promise<void> {
  // 1. Fetch current file_path from DB
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', docId)
    .single();

  if (fetchErr || !doc) {
    logger.error('GED', 'renameDocument:fetch', fetchErr);
    throw new Error(fetchErr?.message ?? 'Document introuvable');
  }

  const oldPath = doc.file_path;
  // Build new path: keep directory, replace filename
  const dir = oldPath.substring(0, oldPath.lastIndexOf('/') + 1);
  const newPath = dir + newName;

  // 2. Copy file in Storage (Supabase has no rename — copy then remove)
  if (oldPath !== newPath) {
    const { error: copyErr } = await supabase.storage
      .from('documents')
      .copy(oldPath, newPath);

    if (copyErr) {
      // If copy fails, still update the DB name (non-blocking)
      logger.error('GED', 'renameDocument:storageCopy', copyErr);
    } else {
      // Remove old file (best-effort)
      await supabase.storage.from('documents').remove([oldPath]);
    }
  }

  // 3. Update DB record
  const updatePayload: Record<string, unknown> = { name: newName };
  if (oldPath !== newPath) updatePayload.file_path = newPath;

  const { error } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', docId);

  if (error) {
    logger.error('GED', 'renameDocument:db', error);
    throw new Error(error.message);
  }
}

// ── Update document fields (#102, #103, #109, #110) ─────────────────

export async function updateDocumentField(
  docId: string,
  field: string,
  value: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ [field]: value })
    .eq('id', docId);
  if (error) {
    logger.error('GED', `updateDocumentField(${field})`, error);
    throw new Error(error.message);
  }
}

export async function updateDocumentFields(
  docId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update(fields)
    .eq('id', docId);
  if (error) {
    logger.error('GED', 'updateDocumentFields', error);
    throw new Error(error.message);
  }
}

// ── Bulk update category (#106) ─────────────────────────────────────

export async function bulkUpdateCategory(
  docIds: string[],
  newCategory: string,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ category: newCategory })
    .in('id', docIds);
  if (error) {
    logger.error('GED', 'bulkUpdateCategory', error);
    throw new Error(error.message);
  }
}

// ── Rename all docs to norm (#104) ──────────────────────────────────

export async function renameAllToNorm(
  clientRef: string,
  cabinetId: string,
  siren: string,
): Promise<number> {
  const docs = await fetchDocumentsByClientRef(clientRef, cabinetId);
  let count = 0;
  for (const doc of docs) {
    const ext = doc.name.split('.').pop() || 'pdf';
    const label = CATEGORY_LABELS_SHORT[doc.category] || 'DOC';
    const date = doc.created_at.split('T')[0];
    const normalized = `${siren}_${label}_${date}_v${doc.current_version}.${ext}`;
    if (normalized !== doc.name) {
      await renameDocument(doc.id, normalized, doc.name);
      count++;
    }
  }
  return count;
}

const CATEGORY_LABELS_SHORT: Record<string, string> = {
  kbis: 'KBIS',
  extrait_kbis: 'EXTRAIT_KBIS',
  cni_dirigeant: 'CNI',
  justificatif_domicile: 'JUSTIF_DOMICILE',
  rib: 'RIB',
  statuts: 'STATUTS',
  attestation_vigilance: 'ATTESTATION',
  liste_beneficiaires_effectifs: 'BE',
  declaration_source_fonds: 'SOURCE_FONDS',
  justificatif_patrimoine: 'PATRIMOINE',
  contrat: 'CONTRAT',
  pv_assemblee: 'PV',
  bilan: 'BILAN',
  autre: 'DOC',
};

// ── URL signée ─────────────────────────────────────────────────────

export async function getSignedUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // 1h

    if (error) {
      logger.error('GED', 'getSignedUrl', error);
      throw new Error(error.message);
    }

    return data.signedUrl;
  } catch (err) {
    logger.error('GED', 'getSignedUrl exception', err);
    throw err;
  }
}
