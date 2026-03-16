import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── GET: Verify token and return LM data ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token || token.length < 32) {
        return json({ error: "Token manquant ou invalide" }, 400, req);
      }

      const { data: tokenRow, error: tokenErr } = await supabase
        .from("lm_signature_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenRow) {
        return json({ error: "Token introuvable" }, 404, req);
      }

      // Check expiration
      if (new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: "Token expire", expired: true }, 410, req);
      }

      // Check already used
      if (tokenRow.is_used) {
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
        return json({ error: "Lettre de mission introuvable" }, 404, req);
      }

      // Return LM data for display (read-only)
      return json({
        valid: true,
        token_id: tokenRow.id,
        client_nom: tokenRow.client_nom,
        client_email: tokenRow.client_email,
        document_hash: tokenRow.document_hash,
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
        return json({ error: "Token et acceptation requis" }, 400, req);
      }

      // Load token
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("lm_signature_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenRow) {
        return json({ error: "Token introuvable" }, 404, req);
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: "Token expire" }, 410, req);
      }

      if (tokenRow.is_used) {
        return json({ error: "Document deja signe", signed_at: tokenRow.signed_at }, 409, req);
      }

      const now = new Date().toISOString();
      const signerIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
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
        return json({ error: "Erreur lors de la signature" }, 500, req);
      }

      // Update LM instance status to 'signee'
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
        console.error("Failed to update LM status:", updateInstErr);
      }

      // Load instance for certificate
      const { data: instance } = await supabase
        .from("lettres_mission")
        .select("numero, raison_sociale")
        .eq("id", tokenRow.instance_id)
        .maybeSingle();

      // Generate signature certificate
      const certificate = {
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
        token_id: tokenRow.id,
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
        }
      } catch (e) {
        console.error("Certificate storage failed:", e);
        // Non-blocking: signature still valid even if storage fails
      }

      return json({
        success: true,
        signed_at: now,
        certificate,
        certificate_url,
      }, 200, req);
    }

    return json({ error: "Method not allowed" }, 405, req);
  } catch (err) {
    console.error("lm-signature error:", err);
    return json({ error: "Erreur interne" }, 500, req);
  }
});
