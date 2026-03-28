import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorise", extracted: null }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, mimeType, mode } = await req.json();

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB base64
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (imageBase64.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: "Image trop volumineuse (max 10 Mo)", extracted: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée", extracted: null }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    // FIX: Require mimeType — don't silently default to JPEG (could be PDF sent as base64)
    if (!mimeType || !ALLOWED_MEDIA.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: `Type MIME requis et valide (${ALLOWED_MEDIA.join(", ")})`, extracted: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const mediaType = mimeType;
    const VALID_MODES = ["cni", "rib", "kbis"];
    if (mode && !VALID_MODES.includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Mode OCR invalide", extracted: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const ocrMode = mode || "cni";

    let systemPrompt: string;
    let userPrompt: string;

    if (ocrMode === "rib") {
      systemPrompt = "Tu es un extracteur OCR spécialisé dans les RIB bancaires français. Extrais les informations demandées au format JSON strict.";
      userPrompt = `Analyse cette image de RIB et extrais les informations suivantes au format JSON:
{
  "iban": "FRXX XXXX XXXX XXXX XXXX XXXX XXX",
  "bic": "XXXXXXXXX",
  "titulaire": "Nom du titulaire",
  "banque": "Nom de la banque",
  "domiciliation": "Agence"
}
Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Si un champ n'est pas lisible, mets null.`;
    } else if (ocrMode === "kbis") {
      systemPrompt = "Tu es un extracteur OCR spécialisé dans les extraits Kbis français. Extrais les informations demandées au format JSON strict.";
      userPrompt = `Analyse cet extrait Kbis et extrais les informations suivantes au format JSON:
{
  "siren": "XXX XXX XXX",
  "siret": "XXX XXX XXX XXXXX",
  "denomination": "Raison sociale",
  "formeJuridique": "SAS, SARL, etc.",
  "capital": 10000,
  "adresse": "Adresse du siège",
  "codePostal": "75001",
  "ville": "PARIS",
  "activite": "Description de l'activité",
  "dateImmatriculation": "YYYY-MM-DD",
  "dirigeant": "Nom du dirigeant principal",
  "rcs": "Ville du RCS"
}
Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Si un champ n'est pas lisible, mets null.`;
    } else {
      // CNI mode (default)
      systemPrompt = "Tu es un extracteur OCR spécialisé dans les cartes d'identité françaises (CNI). Extrais les informations demandées au format JSON strict.";
      userPrompt = `Analyse cette image de carte d'identité (CNI) et extrais les informations suivantes au format JSON:
{
  "nom": "NOM DE FAMILLE",
  "prenom": "Prénom",
  "dateNaissance": "YYYY-MM-DD",
  "lieuNaissance": "Lieu de naissance",
  "dateExpiration": "YYYY-MM-DD",
  "numeroDocument": "Numéro du document",
  "sexe": "M ou F",
  "nationalite": "FRANÇAISE"
}
Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Si un champ n'est pas lisible, mets null.`;
    }

    const anthropicBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2024-10-22",
      },
      body: JSON.stringify(anthropicBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!anthropicRes.ok) {
      // FIX: Don't log raw Anthropic error body (may contain sensitive debug info)
      console.error("Anthropic API error:", anthropicRes.status);
      if (anthropicRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Service OCR temporairement sature, reessayez dans quelques instants", extracted: null }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (anthropicRes.status === 400) {
        return new Response(
          JSON.stringify({ error: "Image non exploitable par le service OCR", extracted: null }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Erreur OCR: service temporairement indisponible", extracted: null }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = anthropicRes.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.error("Anthropic returned non-JSON response:", contentType);
      return new Response(
        JSON.stringify({ error: "Erreur OCR: reponse invalide", extracted: null }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const anthropicData = await anthropicRes.json();
    const textContent = anthropicData.content?.[0]?.text ?? "";

    // Parse JSON from response (handle potential markdown wrapping)
    let extracted = null;
    // FIX: Strip markdown code fences before parsing
    let cleanText = textContent.trim();
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
      extracted = JSON.parse(cleanText);
    } catch {
      // FIX: Find the outermost balanced JSON object (not greedy [\s\S]*)
      const startIdx = cleanText.indexOf("{");
      const endIdx = cleanText.lastIndexOf("}");
      if (startIdx !== -1 && endIdx > startIdx) {
        try { extracted = JSON.parse(cleanText.slice(startIdx, endIdx + 1)); } catch { /* fallback below */ }
      }
    }
    if (!extracted) {
      console.error("Failed to parse OCR JSON:", textContent);
      return new Response(
        JSON.stringify({ error: "Impossible d'extraire les donnees du document", extracted: null, mode: ocrMode }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For RIB mode, also apply regex fallback on raw text
    if (ocrMode === "rib" && extracted) {
      if (!extracted.iban) {
        // FIX: Accept IBAN with or without spaces, any spacing pattern
        const ibanMatch = cleanText.match(/FR\s?\d{2}[\s.]?\d{4}[\s.]?\d{4}[\s.]?\d{4}[\s.]?\d{4}[\s.]?\d{4}[\s.]?\d{3}/);
        if (ibanMatch) extracted.iban = ibanMatch[0].replace(/[\s.]/g, "").replace(/(.{4})/g, "$1 ").trim();
      }
      if (!extracted.bic) {
        // FIX: BIC must be exactly 8 or 11 chars (SWIFT format)
        const bicMatch = cleanText.match(/\b[A-Z]{4}FR[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/);
        if (bicMatch && (bicMatch[0].length === 8 || bicMatch[0].length === 11)) {
          extracted.bic = bicMatch[0];
        }
      }
    }

    return new Response(
      JSON.stringify({ extracted, mode: ocrMode }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = (error as Error).message || "";
    const isTimeout = (error as Error).name === "AbortError" || msg.includes("abort") || msg.includes("timeout");
    console.error("OCR error:", isTimeout ? "timeout" : msg);
    return new Response(
      JSON.stringify({
        error: isTimeout ? "Delai OCR depasse (30s) — reessayez avec une image plus legere" : "Erreur interne OCR",
        extracted: null,
      }),
      { status: isTimeout ? 408 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
