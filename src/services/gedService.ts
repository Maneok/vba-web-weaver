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
  created_at: string;
  updated_at: string;
  user_id: string;
  cabinet_id: string | null;
  /** Resolved from client_ref join — may be null if no client match */
  client_name?: string;
  /** Resolved from client_ref join — may be null */
  siren?: string;
}

export interface SirenFolder {
  siren: string;
  client_name: string;
  client_ref: string;
  documents: GEDDocument[];
  total_docs: number;
  required_docs: number; // 9 docs KYC standard
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

const REQUIRED_DOCS = 9; // nombre de documents KYC standard

// ── Fetch folders groupés par client_ref ───────────────────────────

export async function fetchSirenFolders(cabinetId: string): Promise<SirenFolder[]> {
  try {
    // Fetch all documents for this cabinet
    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .eq('cabinet_id', cabinetId)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('GED', 'fetchSirenFolders — documents query', error);
      throw new Error(error.message);
    }

    if (!docs || docs.length === 0) return [];

    // Fetch clients to resolve names and SIRENs
    const { data: clients } = await supabase
      .from('clients')
      .select('ref, raison_sociale, siren')
      .eq('cabinet_id', cabinetId);

    const clientMap = new Map<string, { name: string; siren: string }>();
    if (clients) {
      for (const c of clients) {
        if (c.ref) {
          clientMap.set(c.ref, {
            name: (c as Record<string, unknown>).raison_sociale as string ?? c.ref,
            siren: (c as Record<string, unknown>).siren as string ?? '',
          });
        }
      }
    }

    // Group documents by client_ref
    const groups = new Map<string, GEDDocument[]>();
    for (const doc of docs) {
      const ref = doc.client_ref ?? '__sans_client__';
      const arr = groups.get(ref) ?? [];
      const client = clientMap.get(ref);
      arr.push({
        ...doc,
        client_name: client?.name ?? ref,
        siren: client?.siren ?? '',
      } as GEDDocument);
      groups.set(ref, arr);
    }

    // Build folder objects
    const folders: SirenFolder[] = [];
    for (const [ref, groupDocs] of groups) {
      const client = clientMap.get(ref);
      const siren = client?.siren ?? ref;
      const clientName = client?.name ?? ref;
      const lastUpdate = groupDocs[0]?.updated_at ?? groupDocs[0]?.created_at ?? '';

      folders.push({
        siren,
        client_name: clientName,
        client_ref: ref,
        documents: groupDocs,
        total_docs: groupDocs.length,
        required_docs: REQUIRED_DOCS,
        last_update: lastUpdate,
        has_expired: groupDocs.some(d => isExpired(d.expiration_date)),
        completion_rate: Math.min(100, Math.round((groupDocs.length / REQUIRED_DOCS) * 100)),
      });
    }

    // Trier par dernier ajout (le plus récent en premier)
    folders.sort((a, b) => new Date(b.last_update).getTime() - new Date(a.last_update).getTime());

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
  allegee: ['kbis', 'cni_dirigeant'],
  normale: [
    'kbis', 'cni_dirigeant', 'justificatif_domicile', 'rib',
    'statuts', 'attestation_vigilance', 'liste_beneficiaires_effectifs',
  ],
  renforcee: [
    'kbis', 'cni_dirigeant', 'justificatif_domicile', 'rib',
    'statuts', 'attestation_vigilance', 'liste_beneficiaires_effectifs',
    'declaration_source_fonds', 'justificatif_patrimoine',
  ],
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
