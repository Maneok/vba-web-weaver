// ──────────────────────────────────────────────
// Edge Function: lm-signature
// OPT 31-35: rate limiting, proper error codes, logging, certificate version
// ──────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// OPT-31: Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Cleanup old entries periodically
function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed =
    !origin ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": allowed ? (origin || "*") : "",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(req ? corsHeaders(req) : {}),
    },
  });
}

// OPT-33: Structured logging
function log(level: "info" | "warn" | "error", action: string, details?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, action, ...details };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // OPT-31: Rate limiting
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  cleanupRateLimit();
  if (!checkRateLimit(clientIp)) {
    log("warn", "RATE_LIMIT_EXCEEDED", { ip: clientIp });
    return json({ error: "Trop de requetes. Reessayez dans quelques instants." }, 429, req);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── GET: Verify token and return LM data ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token || token.length < 32) {
        log("warn", "VERIFY_INVALID_TOKEN", { tokenLength: token?.length });
        return json({ error: "Token manquant ou invalide" }, 400, req);
      }

      const { data: tokenRow, error: tokenErr } = await supabase
        .from("lm_signature_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenRow) {
        log("warn", "VERIFY_TOKEN_NOT_FOUND", { token: token.slice(0, 8) + "..." });
        return json({ error: "Token introuvable" }, 404, req);
      }

      // OPT-34: Check cancelled
      if (tokenRow.is_cancelled) {
        log("info", "VERIFY_TOKEN_CANCELLED", { tokenId: tokenRow.id });
        return json({ error: "Ce lien de signature a ete annule", cancelled: true }, 410, req);
      }

      // Check expiration
      if (new Date(tokenRow.expires_at) < new Date()) {
        log("info", "VERIFY_TOKEN_EXPIRED", { tokenId: tokenRow.id, expiresAt: tokenRow.expires_at });
        return json({ error: "Token expire", expired: true }, 410, req);
      }

      // Check already used
      if (tokenRow.is_used) {
        log("info", "VERIFY_ALREADY_SIGNED", { tokenId: tokenRow.id });
        return json({
          error: "Document deja signe",
          already_signed: true,
          signed_at: tokenRow.signed_at,
          signer: tokenRow.client_nom,
        }, 200, req);
      }

      // Load the LM instance
      const { data: instance, error: instErr } = await supabase
        .from("lettres_mission")
        .select("id, numero, raison_sociale, type_mission, statut, wizard_data, created_at")
        .eq("id", tokenRow.instance_id)
        .maybeSingle();

      if (instErr || !instance) {
        log("error", "VERIFY_INSTANCE_NOT_FOUND", { instanceId: tokenRow.instance_id });
        return json({ error: "Lettre de mission introuvable" }, 404, req);
      }

      log("info", "VERIFY_SUCCESS", { tokenId: tokenRow.id, instanceId: instance.id });

      // Return LM data for display (read-only)
      return json({
        valid: true,
        token_id: tokenRow.id,
        client_nom: tokenRow.client_nom,
        client_email: tokenRow.client_email,
        document_hash: tokenRow.document_hash,
        expires_at: tokenRow.expires_at,
        instance: {
          id: instance.id,
          numero: instance.numero,
          raison_sociale: instance.raison_sociale,
          type_mission: instance.type_mission,
          statut: instance.statut,
          created_at: instance.created_at,
          wizard_data: instance.wizard_data,
        },
      }, 200, req);
    }

    // ── POST: Sign the document ──
    if (req.method === "POST") {
      const body = await req.json();
      const { token, accept, signer_nom, signer_qualite } = body;

      if (!token || !accept) {
        log("warn", "SIGN_MISSING_PARAMS", { hasToken: !!token, hasAccept: !!accept });
        return json({ error: "Token et acceptation requis" }, 400, req);
      }

      // OPT-32: Validate signer_nom
      if (!signer_nom || typeof signer_nom !== "string" || signer_nom.trim().length < 2) {
        return json({ error: "Nom du signataire requis (minimum 2 caracteres)" }, 400, req);
      }

      // Load token
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("lm_signature_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenRow) {
        log("warn", "SIGN_TOKEN_NOT_FOUND", { token: token.slice(0, 8) + "..." });
        return json({ error: "Token introuvable" }, 404, req);
      }

      if (tokenRow.is_cancelled) {
        return json({ error: "Ce lien de signature a ete annule" }, 410, req);
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        log("info", "SIGN_TOKEN_EXPIRED", { tokenId: tokenRow.id });
        return json({ error: "Token expire", expired: true }, 410, req);
      }

      if (tokenRow.is_used) {
        log("info", "SIGN_ALREADY_SIGNED", { tokenId: tokenRow.id });
        return json({ error: "Document deja signe", signed_at: tokenRow.signed_at }, 409, req);
      }

      const now = new Date().toISOString();
      const signerIp = clientIp;
      const signerUA = req.headers.get("user-agent") || "unknown";

      // Update token as signed
      const { error: updateTokenErr } = await supabase
        .from("lm_signature_tokens")
        .update({
          is_used: true,
          signed_at: now,
          signer_ip: signerIp,
          signer_user_agent: signerUA,
        })
        .eq("id", tokenRow.id);

      if (updateTokenErr) {
        log("error", "SIGN_UPDATE_TOKEN_FAILED", { tokenId: tokenRow.id, error: updateTokenErr.message });
        return json({ error: "Erreur lors de la signature" }, 500, req);
      }

      // Update LM instance status to 'signee'
      let lmUpdateFailed = false;
      const { error: updateInstErr } = await supabase
        .from("lettres_mission")
        .update({
          statut: "signee",
          status: "signee",
          signed_at: now,
          date_signature: now.slice(0, 10),
          updated_at: now,
        })
        .eq("id", tokenRow.instance_id);

      if (updateInstErr) {
        lmUpdateFailed = true;
        log("error", "SIGN_UPDATE_LM_FAILED", { instanceId: tokenRow.instance_id, error: updateInstErr.message });
      }

      // Load instance for certificate
      const { data: instance, error: loadInstErr } = await supabase
        .from("lettres_mission")
        .select("numero, raison_sociale")
        .eq("id", tokenRow.instance_id)
        .maybeSingle();

      if (loadInstErr) {
        log("error", "SIGN_LOAD_INSTANCE_FAILED", { instanceId: tokenRow.instance_id, error: loadInstErr.message });
      }

      // OPT-35: Generate versioned signature certificate
      const certificateId = `CERT-${tokenRow.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const certificate = {
        version: "1.0",
        certificate_id: certificateId,
        document: instance?.numero || tokenRow.instance_id,
        client: instance?.raison_sociale || tokenRow.client_nom,
        signer: signer_nom || tokenRow.client_nom,
        signer_qualite: signer_qualite || "",
        email: tokenRow.client_email,
        signed_at: now,
        ip: signerIp,
        user_agent: signerUA,
        document_hash: tokenRow.document_hash || "",
        method: "Signature electronique simple par lien unique",
        legal_basis: "Article 1367 du Code civil — Reglement eIDAS",
        token_id: tokenRow.id,
        instance_id: tokenRow.instance_id,
      };

      // Store certificate in Supabase Storage
      let certificate_url = "";
      try {
        const certJson = JSON.stringify(certificate, null, 2);
        const certPath = `certificates/${tokenRow.instance_id}/${tokenRow.id}.json`;

        const { error: uploadErr } = await supabase.storage
          .from("lm-documents")
          .upload(certPath, new Blob([certJson], { type: "application/json" }), {
            contentType: "application/json",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: signedUrl } = await supabase.storage
            .from("lm-documents")
            .createSignedUrl(certPath, 60 * 60 * 24 * 365); // 1 year
          certificate_url = signedUrl?.signedUrl || "";
        } else {
          log("warn", "CERT_UPLOAD_FAILED", { error: uploadErr.message });
        }
      } catch (e) {
        log("error", "CERT_STORAGE_ERROR", { error: String(e) });
        // Non-blocking: signature still valid even if storage fails
      }

      log("info", "SIGN_SUCCESS", {
        tokenId: tokenRow.id,
        instanceId: tokenRow.instance_id,
        signer: signer_nom,
        certificateId,
      });

      return json({
        success: true,
        signed_at: now,
        certificate,
        certificate_url,
        ...(lmUpdateFailed ? { warning: "La signature a été enregistrée mais la mise à jour du statut de la lettre a échoué" } : {}),
      }, 200, req);
    }

    return json({ error: "Method not allowed" }, 405, req);
  } catch (err) {
    log("error", "UNHANDLED_ERROR", { error: String(err) });
    return json({ error: "Erreur interne" }, 500, req);
  }
});
