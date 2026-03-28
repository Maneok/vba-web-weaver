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

    // ★ AUTO-RENAME : DATE_SOCIETE_TYPE.ext
    try {
      const { data: clientData } = await supabase.from('clients')
        .select('raison_sociale').eq('ref', clientRef).single();
      const societe = sanitizeSociete(clientData?.raison_sociale || siren || clientRef);
      const typeLabel = CATEGORY_LABELS_SHORT[category] || 'DOCUMENT';
      const dateStr = new Date().toISOString().split('T')[0];
      const ext = file.name.split('.').pop() || 'pdf';

      // Vérifier les doublons de même jour/société/type
      const { data: existing } = await supabase.from('documents')
        .select('name')
        .eq('client_ref', clientRef)
        .eq('cabinet_id', cabinetId)
        .eq('category', category)
        .like('name', `${dateStr}_${societe}_${typeLabel}%`);
      const versionSuffix = existing && existing.length > 0
        ? `_V${existing.length + 1}` : '';

      const normalizedName = `${dateStr}_${societe}_${typeLabel}${versionSuffix}.${ext}`;
      await supabase.from('documents').update({ name: normalizedName }).eq('id', doc.id);
      doc.name = normalizedName;
    } catch (renameErr) {
      // Non-blocking — keep the original name if rename fails
      logger.warn('GED', 'Auto-rename failed (non-bloquant)', renameErr);
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

export const CATEGORY_LABELS_SHORT: Record<string, string> = {
  kbis: 'KBIS',
  extrait_kbis: 'EXTRAIT_KBIS',
  cni_dirigeant: 'CNI_DIRIGEANT',
  cni: 'CNI',
  justificatif_domicile: 'JUSTIF_DOMICILE',
  rib: 'RIB',
  statuts: 'STATUTS',
  attestation_vigilance: 'ATTESTATION',
  attestation: 'ATTESTATION',
  liste_beneficiaires_effectifs: 'LISTE_BE',
  declaration_source_fonds: 'SOURCE_FONDS',
  justificatif_patrimoine: 'PATRIMOINE',
  contrat: 'CONTRAT',
  pv_assemblee: 'PV_ASSEMBLEE',
  bilan: 'BILAN',
  facture: 'FACTURE',
  autre: 'DOCUMENT',
};

/** Sanitize a company name into an uppercase slug for filenames */
function sanitizeSociete(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);
}

/**
 * Build a normalized filename: DATE_SOCIETE_TYPE.ext
 * If a doc with the same base name already exists, append _V2, _V3, etc.
 */
export function buildNormalizedName(
  date: string,
  societe: string,
  category: string,
  ext: string,
  existingNames?: string[],
): string {
  const type = CATEGORY_LABELS_SHORT[category] || 'AUTRE';
  const base = `${date}_${societe}_${type}`;
  const extension = ext.startsWith('.') ? ext : `.${ext}`;
  let candidate = `${base}${extension}`;
  if (existingNames && existingNames.length > 0) {
    let v = 1;
    while (existingNames.includes(candidate)) {
      v++;
      candidate = `${base}_V${v}${extension}`;
    }
  }
  return candidate;
}

export async function renameAllToNorm(
  clientRef: string,
  cabinetId: string,
  siren: string,
): Promise<number> {
  // Fetch client name for the normalized format
  const { data: client } = await supabase.from('clients')
    .select('raison_sociale').eq('ref', clientRef).single();
  const societe = sanitizeSociete(client?.raison_sociale || siren);

  const docs = await fetchDocumentsByClientRef(clientRef, cabinetId);
  // Group by date+type to detect duplicates for versioning
  const groups = new Map<string, number>();
  let count = 0;

  for (const doc of docs) {
    const ext = doc.name.split('.').pop() || 'pdf';
    const typeLabel = CATEGORY_LABELS_SHORT[doc.category] || 'DOCUMENT';
    // Extraire la date du nom existant ou utiliser created_at
    const dateMatch = doc.name.match(/(\d{4}-\d{2}-\d{2})/);
    const dateStr = dateMatch ? dateMatch[1] : (doc.created_at || '').split('T')[0];

    const groupKey = `${dateStr}_${societe}_${typeLabel}.${ext}`;
    const groupCount = (groups.get(groupKey) || 0) + 1;
    groups.set(groupKey, groupCount);

    const versionSuffix = groupCount > 1 ? `_V${groupCount}` : '';
    const normalized = `${dateStr}_${societe}_${typeLabel}${versionSuffix}.${ext}`;

    if (normalized !== doc.name) {
      // Ne PAS renommer dans Storage (file_path reste le même)
      // Seul le champ name (affiché dans l'UI) change
      await supabase.from('documents').update({ name: normalized }).eq('id', doc.id);
      count++;
    }
  }
  return count;
}

// ── URL signée ─────────────────────────────────────────────────────

export async function getSignedUrl(filePath: string): Promise<string> {
  // External URLs (from INPI/Pappers) don't need a signed URL
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // Try bucket "documents" first
  const { data, error } = await supabase.storage
    .from('documents').createSignedUrl(filePath, 3600);
  if (!error && data?.signedUrl) return data.signedUrl;
  // Fallback bucket "kyc-documents"
  const { data: d2, error: e2 } = await supabase.storage
    .from('kyc-documents').createSignedUrl(filePath, 3600);
  if (!e2 && d2?.signedUrl) return d2.signedUrl;
  logger.error('GED', 'getSignedUrl failed both buckets', { filePath, error, e2 });
  throw new Error(error?.message || e2?.message || 'URL signée impossible');
}

// ── OCR auto-classification ──────────────────────────────────────────

const OCR_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function processOcr(
  blob: Blob,
): Promise<{ category: string; name: string; ocrData: Record<string, unknown> } | null> {
  if (!OCR_SUPPORTED_TYPES.includes(blob.type)) return null;

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://szjcmepjuxlvnkqbxqqr.supabase.co';
  const res = await fetch(`${supabaseUrl}/functions/v1/ocr-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ imageBase64: base64, mimeType: blob.type, mode: 'auto' }),
  });
  if (!res.ok) return null;
  const result = await res.json();
  if (!result.category_ged) return null;
  return {
    category: result.category_ged,
    name: result.suggested_name || '',
    ocrData: result.extracted || {},
  };
}

export async function ocrClassifyDocument(
  filePath: string,
  bucket: string = 'documents',
): Promise<{ category: string; name: string; ocrData: Record<string, unknown> } | null> {
  try {
    const { data: blob, error } = await supabase.storage.from(bucket).download(filePath);
    if (!error && blob) return await processOcr(blob);
    // Fallback to the other bucket
    const otherBucket = bucket === 'documents' ? 'kyc-documents' : 'documents';
    const { data: blob2, error: e2 } = await supabase.storage.from(otherBucket).download(filePath);
    if (!e2 && blob2) return await processOcr(blob2);
    return null;
  } catch (err) {
    logger.error('GED', 'ocrClassifyDocument', err);
    return null;
  }
}
