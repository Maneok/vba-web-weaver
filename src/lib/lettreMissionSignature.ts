// ──────────────────────────────────────────────
// Signature electronique simple pour Lettres de Mission
// Token unique + page publique + certificat horodaté
// OPT 1-15: status, resend, cancel, certificate, history, hash sections, expiry
// ──────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";

const SITE_URL = "https://vba-web-weaver.vercel.app";
const FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lm-signature`
  : "";

// OPT-2: Statut enrichi
export type SignatureStatus =
  | "non_envoyee"
  | "en_attente"
  | "signee"
  | "expiree"
  | "annulee"
  | "erreur";

export interface SignatureToken {
  id: string;
  instance_id: string;
  avenant_id: string | null;
  token: string;
  client_email: string;
  client_nom: string;
  is_used: boolean;
  is_cancelled: boolean;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  document_hash: string | null;
  expires_at: string;
  created_at: string;
}

export interface SignatureCertificate {
  version: string;
  document: string;
  client: string;
  signer: string;
  signer_qualite: string;
  email: string;
  signed_at: string;
  ip: string;
  user_agent: string;
  document_hash: string;
  method: string;
  token_id: string;
  certificate_id: string;
  legal_basis: string;
}

// OPT-10: Historique entry
export interface SignatureHistoryEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

// OPT-14: Configurable expiry durations
export const SIGNATURE_EXPIRY_OPTIONS = [
  { label: "24 heures", hours: 24 },
  { label: "48 heures", hours: 48 },
  { label: "72 heures", hours: 72 },
  { label: "7 jours", hours: 168 },
  { label: "14 jours", hours: 336 },
  { label: "30 jours", hours: 720 },
] as const;

export const DEFAULT_EXPIRY_HOURS = 168; // 7 jours

// ── Calculer SHA-256 d'un blob/arraybuffer ──

async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// OPT-11: Hash du document depuis sections JSON
export async function computeDocumentHash(sectionsJson: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(sectionsJson);
  return "sha256:" + (await sha256(buffer.buffer));
}

// OPT-1: getSignatureStatus — statut synthétique pour une instance
export async function getSignatureStatus(instanceId: string): Promise<{
  status: SignatureStatus;
  lastToken?: SignatureToken;
  signedAt?: string;
  signerNom?: string;
}> {
  const tokens = await getSignatureTokens(instanceId);

  if (tokens.length === 0) {
    return { status: "non_envoyee" };
  }

  // Dernier token en premier (ordered desc)
  const latest = tokens[0];

  if (latest.is_used && latest.signed_at) {
    return {
      status: "signee",
      lastToken: latest,
      signedAt: latest.signed_at,
      signerNom: latest.client_nom,
    };
  }

  if (latest.is_cancelled) {
    return { status: "annulee", lastToken: latest };
  }

  if (new Date(latest.expires_at) < new Date()) {
    return { status: "expiree", lastToken: latest };
  }

  return { status: "en_attente", lastToken: latest };
}

// OPT-13: Single active token enforcement — cancel previous before sending new
async function cancelPreviousTokens(instanceId: string): Promise<void> {
  const { error } = await supabase
    .from("lm_signature_tokens")
    .update({ is_cancelled: true })
    .eq("instance_id", instanceId)
    .eq("is_used", false)
    .is("signed_at", null);

  if (error) {
    logger.warn("LM_SIGNATURE", "cancelPreviousTokens failed:", error);
  }
}

// ── Envoyer une LM pour signature ──

export async function sendForSignature(
  instanceId: string,
  clientEmail: string,
  clientNom: string,
  pdfBlob?: Blob,
  options?: {
    expiryHours?: number;
    sectionsJson?: string;
    avenantId?: string;
  }
): Promise<{ token: string; signatureUrl: string }> {
  // OPT-13: Cancel previous active tokens
  await cancelPreviousTokens(instanceId);

  // OPT-11: Hash from sections JSON if provided, else from PDF
  let documentHash = "";
  if (options?.sectionsJson) {
    documentHash = await computeDocumentHash(options.sectionsJson);
  } else if (pdfBlob) {
    const buffer = await pdfBlob.arrayBuffer();
    documentHash = "sha256:" + (await sha256(buffer));
  }

  // Upload PDF if provided
  if (pdfBlob) {
    try {
      const pdfPath = `lettres/${instanceId}/lm-${Date.now()}.pdf`;
      await supabase.storage
        .from("lm-documents")
        .upload(pdfPath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
    } catch (e) {
      logger.warn("LM_SIGNATURE", "PDF upload failed (non-blocking):", e);
    }
  }

  // OPT-14: Configurable expiry
  const expiryHours = options?.expiryHours || DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Create signature token
  const insertPayload: Record<string, unknown> = {
    instance_id: instanceId,
    client_email: clientEmail,
    client_nom: clientNom,
    document_hash: documentHash || null,
    expires_at: expiresAt,
  };
  if (options?.avenantId) {
    insertPayload.avenant_id = options.avenantId;
  }

  const { data: tokenRow, error } = await supabase
    .from("lm_signature_tokens")
    .insert(insertPayload)
    .select("token")
    .single();

  if (error || !tokenRow) {
    throw new Error("Impossible de creer le lien de signature : " + (error?.message || "erreur inconnue"));
  }

  const signatureUrl = `${SITE_URL}/signer?token=${tokenRow.token}`;

  // Audit
  logAudit({
    action: "LM_SIGNATURE_SENT",
    table_name: "lm_signature_tokens",
    record_id: instanceId,
    new_data: { client_email: clientEmail, client_nom: clientNom, expiry_hours: expiryHours },
  }).catch((e) => logger.warn("LM_SIGNATURE", "Audit log failed:", e));

  return { token: tokenRow.token, signatureUrl };
}

// OPT-3: Renvoyer un lien (cancel ancien + nouveau token)
export async function resendSignature(
  instanceId: string,
  clientEmail: string,
  clientNom: string,
  options?: { expiryHours?: number; sectionsJson?: string }
): Promise<{ token: string; signatureUrl: string }> {
  // Reuses sendForSignature which already cancels previous tokens
  const result = await sendForSignature(instanceId, clientEmail, clientNom, undefined, options);

  logAudit({
    action: "LM_SIGNATURE_RESENT",
    table_name: "lm_signature_tokens",
    record_id: instanceId,
    new_data: { client_email: clientEmail },
  }).catch((e) => logger.warn("LM_SIGNATURE", "Audit log failed:", e));

  return result;
}

// OPT-4: Annuler une signature en attente
export async function cancelSignature(instanceId: string): Promise<void> {
  await cancelPreviousTokens(instanceId);

  // Update LM status back to brouillon if it was en_attente
  const { error } = await supabase
    .from("lettres_mission")
    .update({ statut: "brouillon", updated_at: new Date().toISOString() })
    .eq("id", instanceId)
    .in("statut", ["en_attente_signature"]);

  if (error) {
    logger.warn("LM_SIGNATURE", "cancelSignature LM status update failed:", error);
  }

  logAudit({
    action: "LM_SIGNATURE_CANCELLED",
    table_name: "lm_signature_tokens",
    record_id: instanceId,
    new_data: {},
  }).catch((e) => logger.warn("LM_SIGNATURE", "Audit log failed:", e));
}

// ── Vérifier un token côté client (via Edge Function) ──

export async function verifyToken(token: string): Promise<{
  valid: boolean;
  instance?: {
    id: string;
    numero: string;
    raison_sociale: string;
    type_mission: string;
    statut: string;
    created_at: string;
    wizard_data: Record<string, unknown>;
  };
  client_nom?: string;
  client_email?: string;
  document_hash?: string;
  expired?: boolean;
  already_signed?: boolean;
  signed_at?: string;
  signer?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${FUNCTION_URL}?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!res.ok && !data.already_signed) {
      return {
        valid: false,
        expired: data.expired || false,
        error: data.error || "Token invalide",
      };
    }

    if (data.already_signed) {
      return {
        valid: false,
        already_signed: true,
        signed_at: data.signed_at,
        signer: data.signer,
      };
    }

    return {
      valid: true,
      instance: data.instance,
      client_nom: data.client_nom,
      client_email: data.client_email,
      document_hash: data.document_hash,
    };
  } catch (e) {
    logger.error("LM_SIGNATURE", "verifyToken failed:", e);
    return { valid: false, error: "Erreur de connexion" };
  }
}

// ── Signer le document (via Edge Function) ──

export async function signDocument(
  token: string,
  signerNom: string,
  signerQualite: string
): Promise<{
  success: boolean;
  signed_at?: string;
  certificate?: SignatureCertificate;
  certificate_url?: string;
  error?: string;
}> {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        accept: true,
        signer_nom: signerNom,
        signer_qualite: signerQualite,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || "Erreur lors de la signature" };
    }

    return {
      success: true,
      signed_at: data.signed_at,
      certificate: data.certificate,
      certificate_url: data.certificate_url,
    };
  } catch (e) {
    logger.error("LM_SIGNATURE", "signDocument failed:", e);
    return { success: false, error: "Erreur de connexion" };
  }
}

// ── Récupérer les tokens d'une instance (côté cabinet) ──

export async function getSignatureTokens(instanceId: string): Promise<SignatureToken[]> {
  const { data, error } = await supabase
    .from("lm_signature_tokens")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("LM_SIGNATURE", "getSignatureTokens failed:", error);
    return [];
  }

  return (data || []) as SignatureToken[];
}

// OPT-7: Générer un certificat structuré côté client (pour preview)
export function generateCertificatePreview(
  token: SignatureToken,
  instanceNumero: string,
  raisonSociale: string
): SignatureCertificate {
  return {
    version: "1.0",
    document: instanceNumero,
    client: raisonSociale,
    signer: token.client_nom,
    signer_qualite: "",
    email: token.client_email,
    signed_at: token.signed_at || "",
    ip: token.signer_ip || "",
    user_agent: token.signer_user_agent || "",
    document_hash: token.document_hash || "",
    method: "Signature electronique simple par lien unique",
    token_id: token.id,
    certificate_id: `CERT-${token.id.slice(0, 8).toUpperCase()}`,
    legal_basis: "Article 1367 du Code civil",
  };
}

// OPT-8: Vérifier l'intégrité d'un certificat
export async function verifyCertificate(
  instanceId: string,
  tokenId: string
): Promise<{ valid: boolean; certificate?: SignatureCertificate; error?: string }> {
  try {
    const certPath = `certificates/${instanceId}/${tokenId}.json`;
    const { data: blob, error } = await supabase.storage
      .from("lm-documents")
      .download(certPath);

    if (error || !blob) {
      return { valid: false, error: "Certificat introuvable" };
    }

    const text = await blob.text();
    const cert = JSON.parse(text) as SignatureCertificate;

    // Verify token exists and is signed
    const { data: tokenRow } = await supabase
      .from("lm_signature_tokens")
      .select("is_used, signed_at, document_hash")
      .eq("id", tokenId)
      .maybeSingle();

    if (!tokenRow || !tokenRow.is_used) {
      return { valid: false, error: "Token non signe", certificate: cert };
    }

    // Verify hash matches
    if (tokenRow.document_hash && cert.document_hash && tokenRow.document_hash !== cert.document_hash) {
      return { valid: false, error: "Empreinte du document non conforme", certificate: cert };
    }

    return { valid: true, certificate: cert };
  } catch (e) {
    logger.error("LM_SIGNATURE", "verifyCertificate failed:", e);
    return { valid: false, error: "Erreur de verification" };
  }
}

// OPT-10: Historique de signature pour une instance
export async function getSignatureHistory(instanceId: string): Promise<SignatureHistoryEntry[]> {
  const tokens = await getSignatureTokens(instanceId);
  const history: SignatureHistoryEntry[] = [];

  for (const t of tokens) {
    history.push({
      id: `${t.id}-created`,
      action: "Lien de signature envoye",
      actor: t.client_email,
      timestamp: t.created_at,
      details: `Envoye a ${t.client_nom} (${t.client_email})`,
    });

    if (t.is_cancelled) {
      history.push({
        id: `${t.id}-cancelled`,
        action: "Signature annulee",
        actor: "Cabinet",
        timestamp: t.created_at, // approximate
        details: "Le lien de signature a ete annule par le cabinet",
      });
    }

    if (t.is_used && t.signed_at) {
      history.push({
        id: `${t.id}-signed`,
        action: "Document signe",
        actor: t.client_nom,
        timestamp: t.signed_at,
        details: `Signe depuis ${t.signer_ip || "IP inconnue"}`,
      });
    }

    if (!t.is_used && !t.is_cancelled && new Date(t.expires_at) < new Date()) {
      history.push({
        id: `${t.id}-expired`,
        action: "Lien expire",
        actor: "Systeme",
        timestamp: t.expires_at,
        details: "Le lien de signature a expire sans etre utilise",
      });
    }
  }

  // Sort by timestamp desc
  history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return history;
}

// OPT-15: Utilitaire pour formater le statut en label FR
export function getSignatureStatusLabel(status: SignatureStatus): string {
  const labels: Record<SignatureStatus, string> = {
    non_envoyee: "Non envoyee",
    en_attente: "En attente de signature",
    signee: "Signee",
    expiree: "Lien expire",
    annulee: "Annulee",
    erreur: "Erreur",
  };
  return labels[status] || status;
}

export function getSignatureStatusColor(status: SignatureStatus): string {
  const colors: Record<SignatureStatus, string> = {
    non_envoyee: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    en_attente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    signee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    expiree: "bg-red-500/10 text-red-400 border-red-500/20",
    annulee: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    erreur: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return colors[status] || "";
}
