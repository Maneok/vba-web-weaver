const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_API_KEY manquant");

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) throw new Error("imageBase64 requis");

    const visionUrl =
      "https://vision.googleapis.com/v1/images:annotate?key=" + apiKey;
    const body = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [
            { type: "TEXT_DETECTION", maxResults: 1 },
            { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
          ],
        },
      ],
    };

    const res = await fetch(visionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const fullText =
      data.responses?.[0]?.fullTextAnnotation?.text || "";

    // Extraire les données d'une CNI française
    const extracted: Record<string, string> = { rawText: fullText };

    // Nom
    const nomMatch = fullText.match(
      /Nom\s*[:/]?\s*([A-ZÉÈÊËÀÂÄÙÛÜÔÖÏÎÇ\s-]+)/i,
    );
    if (nomMatch) extracted.nom = nomMatch[1].trim();

    // Prénom
    const prenomMatch = fullText.match(
      /Pr[ée]nom\(?s?\)?\s*[:/]?\s*([A-Za-zéèêëàâäùûüôöïîç\s,-]+)/i,
    );
    if (prenomMatch) extracted.prenom = prenomMatch[1].trim();

    // Date de naissance
    const dateMatch = fullText.match(/(\d{2})[./](\d{2})[./](\d{4})/);
    if (dateMatch) extracted.dateNaissance = dateMatch[0];

    // Date d'expiration (dernière date du document)
    const allDates = [...fullText.matchAll(/(\d{2})[./](\d{2})[./](\d{4})/g)];
    if (allDates.length > 1) {
      extracted.dateExpiration = allDates[allDates.length - 1][0];
    }

    // Numéro de document (12 chiffres pour CNI)
    const numMatch = fullText.match(/\b(\d{12})\b/);
    if (numMatch) extracted.numeroDocument = numMatch[1];

    // Lieu de naissance
    const lieuMatch = fullText.match(
      /[àa]\s*([A-Za-zÉÈÊËÀÂÄÙÛÜÔÖÏÎÇéèêëàâäùûüôöïîç\s-]+)\s*\(\d{2,3}\)/i,
    );
    if (lieuMatch) extracted.lieuNaissance = lieuMatch[1].trim();

    // Sexe
    const sexeMatch = fullText.match(/Sexe\s*[:/]?\s*([MF])/i);
    if (sexeMatch) extracted.sexe = sexeMatch[1].toUpperCase();

    return new Response(
      JSON.stringify({
        success: true,
        extracted,
        rawText: fullText,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[OCR] Error:", (e as Error).message);
    return new Response(
      JSON.stringify({
        success: false,
        error: (e as Error).message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
