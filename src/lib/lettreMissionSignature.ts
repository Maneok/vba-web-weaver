// ──────────────────────────────────────────────
// Signature electronique simple pour Lettres de Mission
// Token unique + page publique + certificat horodaté
// ──────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";

const SITE_URL = "https://vba-web-weaver.vercel.app";
const FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lm-signature`
  : "";

export interface SignatureToken {
  id: string;
  instance_id: string;
  avenant_id: string | null;
  token: string;
  client_email: string;
  client_nom: string;
  is_used: boolean;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  document_hash: string | null;
  expires_at: string;
  created_at: string;
}

export interface SignatureCertificate {
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
}

// ── Calculer SHA-256 d'un blob/arraybuffer ──

async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Envoyer une LM pour signature ──

export async function sendForSignature(
  instanceId: string,
  clientEmail: string,
  clientNom: string,
  pdfBlob?: Blob
): Promise<{ token: string; signatureUrl: string }> {
  // 1. Calculer le hash du document si un PDF est fourni
  let documentHash = "";
  if (pdfBlob) {
    const buffer = await pdfBlob.arrayBuffer();
    documentHash = "sha256:" + (await sha256(buffer));

    // 2. Upload le PDF dans Supabase Storage
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

  // 3. Créer le token de signature
  const { data: tokenRow, error } = await supabase
    .from("lm_signature_tokens")
    .insert({
      instance_id: instanceId,
      client_email: clientEmail,
      client_nom: clientNom,
      document_hash: documentHash || null,
    })
    .select("token")
    .single();

  if (error || !tokenRow) {
    throw new Error("Impossible de creer le lien de signature : " + (error?.message || "erreur inconnue"));
  }

  const signatureUrl = `${SITE_URL}/signer?token=${tokenRow.token}`;

  // 4. Audit
  logAudit({
    action: "LM_SIGNATURE_SENT",
    table_name: "lm_signature_tokens",
    record_id: instanceId,
    new_data: { client_email: clientEmail, client_nom: clientNom },
  }).catch((e) => logger.warn("LM_SIGNATURE", "Audit log failed:", e));

  return { token: tokenRow.token, signatureUrl };
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
