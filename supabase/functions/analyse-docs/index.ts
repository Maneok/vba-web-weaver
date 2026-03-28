import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * analyse-docs — Analyse documentaire IA via Claude
 *
 * Reçoit une liste de documents (avec storagePath dans kyc-documents),
 * télécharge chaque fichier, envoie à Claude pour extraction structurée,
 * et retourne un résultat d'analyse complet.
 *
 * POST body: {
 *   siren: string,
 *   raison_sociale: string,
 *   documents: Array<{ type, label, source, storagePath, doc_id? }>
 * }
 */

const MAX_DOCS = 20;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB per file
const ANTHROPIC_TIMEOUT = 60_000; // 60s for multi-doc analysis

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const cors = getCorsHeaders(req);

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Utilisateur non authentifié" }), { status: 401, headers: jsonHeaders });
    }

    // 2. Parse request body
    const { siren, raison_sociale, documents } = await req.json();
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun document fourni" }), { status: 400, headers: jsonHeaders });
    }
    if (documents.length > MAX_DOCS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_DOCS} documents par analyse` }), { status: 400, headers: jsonHeaders });
    }

    // 3. Anthropic API key
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), { status: 503, headers: jsonHeaders });
    }

    // 4. Download each document and build content for Claude
    const docDescriptions: string[] = [];
    const docContents: Array<{ role: string; content: any[] }> = [];
    const skipped: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const path = doc.storagePath || "";
      const label = doc.label || doc.type || `Document ${i + 1}`;
      const type = doc.type || "AUTRE";

      if (!path) {
        skipped.push(`${label}: chemin manquant`);
        continue;
      }

      try {
        let fileData: ArrayBuffer | null = null;
        let mimeType = "application/pdf";

        // Try downloading from Supabase storage
        if (!path.startsWith("http")) {
          const { data: fileBlob, error: dlErr } = await supabase.storage
            .from("kyc-documents")
            .download(path);
          if (dlErr || !fileBlob) {
            skipped.push(`${label}: téléchargement échoué`);
            continue;
          }
          fileData = await fileBlob.arrayBuffer();
          mimeType = fileBlob.type || "application/pdf";
        } else {
          // External URL — try to fetch it
          try {
            const extRes = await fetch(path, {
              signal: AbortSignal.timeout(10_000),
              redirect: "follow",
            });
            if (!extRes.ok) {
              skipped.push(`${label}: URL inaccessible (${extRes.status})`);
              continue;
            }
            fileData = await extRes.arrayBuffer();
            mimeType = extRes.headers.get("content-type") || "application/pdf";
          } catch {
            skipped.push(`${label}: timeout URL`);
            continue;
          }
        }

        if (!fileData || fileData.byteLength < 50) {
          skipped.push(`${label}: fichier vide ou trop petit`);
          continue;
        }
        if (fileData.byteLength > MAX_FILE_SIZE) {
          skipped.push(`${label}: fichier trop volumineux (${Math.round(fileData.byteLength / 1024 / 1024)}Mo)`);
          continue;
        }

        // Detect if it's a PDF or an image
        const header = String.fromCharCode(...new Uint8Array(fileData.slice(0, 5)));
        const isPDF = header.startsWith("%PDF");
        const isImage = mimeType.startsWith("image/");

        if (isPDF) {
          // Send PDF as document to Claude (supported since Claude 3.5)
          const base64 = btoa(
            new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          docContents.push({
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: `[Document ${i + 1}] Type déclaré: "${type}" — Label: "${label}"` },
            ],
          });
        } else if (isImage) {
          // Send image
          const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"];
          const imageMime = allowedImage.includes(mimeType) ? mimeType : "image/jpeg";
          const base64 = btoa(
            new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          docContents.push({
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: imageMime, data: base64 },
              },
              { type: "text", text: `[Document ${i + 1}] Type déclaré: "${type}" — Label: "${label}"` },
            ],
          });
        } else {
          skipped.push(`${label}: format non supporté (${mimeType})`);
          continue;
        }

        docDescriptions.push(`- Document ${i + 1}: ${label} (${type})`);
      } catch (err) {
        skipped.push(`${label}: erreur de traitement`);
        console.error(`[analyse-docs] Error processing doc ${i}:`, (err as Error).message);
      }
    }

    if (docContents.length === 0) {
      return new Response(JSON.stringify({
        analysis: {
          documents_analyses: [],
          incoherences: [],
          informations_manquantes: ["Aucun document n'a pu être analysé"],
          resume: "Analyse impossible — aucun document exploitable",
          resume_documentaire: "",
        },
        skipped,
      }), { status: 200, headers: jsonHeaders });
    }

    // 5. Build Claude prompt
    const systemPrompt = `Tu es un expert-comptable français spécialisé en conformité LCB-FT (lutte contre le blanchiment de capitaux et le financement du terrorisme).

Tu analyses des documents KYC fournis pour le client suivant :
- SIREN : ${siren || "Non fourni"}
- Raison sociale : ${raison_sociale || "Non fournie"}

Documents soumis :
${docDescriptions.join("\n")}

Pour CHAQUE document, tu dois :
1. Identifier le type réel du document (Kbis, CNI, RIB, Statuts, Bilan, etc.)
2. Évaluer la qualité : "complet" (lisible et exploitable), "partiel" (partiellement lisible), "illisible"
3. Extraire TOUTES les données structurées pertinentes (SIREN, dirigeant, capital, adresse, IBAN, dates, etc.)
4. Suggérer un nom de fichier normalisé au format DATE_SOCIETE_TYPE.ext

Réponds UNIQUEMENT en JSON strict avec cette structure :
{
  "documents_analyses": [
    {
      "label": "nom original du document",
      "label_suggere": "2026-03-28_SOCIETE_TYPE.pdf",
      "type_detecte": "kbis|cni|rib|statuts|bilan|pv_assemblee|attestation|autre",
      "type_original": "type déclaré à l'upload",
      "qualite": "complet|partiel|illisible",
      "donnees_extraites": {
        "clé": "valeur extraite"
      },
      "commentaire": "remarque éventuelle sur le document"
    }
  ],
  "incoherences": [
    {
      "niveau": "critique|attention|info",
      "message": "description de l'incohérence"
    }
  ],
  "informations_manquantes": [
    "Document ou information manquante selon Art. L561-5 CMF"
  ],
  "resume_documentaire": "Synthèse de l'analyse documentaire en 2-3 phrases"
}

Règles :
- Vérifie la cohérence du SIREN entre les documents
- Signale toute date d'expiration dépassée (CNI, Kbis > 3 mois)
- Signale si le dirigeant diffère entre documents
- Les documents obligatoires selon Art. L561-5 CMF sont : Kbis/extrait RNE, pièce d'identité du dirigeant, justificatif de domicile, RIB
- Réponds UNIQUEMENT avec le JSON, sans markdown, sans commentaire hors JSON`;

    const messages = [
      ...docContents,
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse maintenant l'ensemble de ces documents et fournis ton analyse JSON complète." },
        ],
      },
    ];

    // 6. Call Claude API
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2024-10-22",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT),
    });

    if (!anthropicRes.ok) {
      const status = anthropicRes.status;
      console.error(`[analyse-docs] Anthropic API error: ${status}`);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Service IA temporairement saturé, réessayez dans quelques instants" }),
          { status: 429, headers: jsonHeaders }
        );
      }
      return new Response(
        JSON.stringify({ error: `Erreur du service IA (${status})` }),
        { status: 502, headers: jsonHeaders }
      );
    }

    const anthropicData = await anthropicRes.json();
    const textContent = anthropicData.content?.[0]?.text ?? "";

    // 7. Parse JSON response
    let analysis: any = null;
    try {
      analysis = JSON.parse(textContent);
    } catch {
      // Try to extract JSON from possible markdown wrapping
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]); } catch { /* fallback below */ }
      }
    }

    if (!analysis) {
      console.error("[analyse-docs] Failed to parse Claude response:", textContent.slice(0, 500));
      return new Response(JSON.stringify({
        error: "Impossible de parser la réponse IA",
        analysis: {
          documents_analyses: [],
          incoherences: [],
          informations_manquantes: [],
          resume: textContent.slice(0, 500),
          resume_documentaire: "",
        },
        skipped,
      }), { status: 200, headers: jsonHeaders });
    }

    // 8. Normalize response shape
    const result = {
      analysis: {
        documents_analyses: analysis.documents_analyses || analysis.documents || [],
        incoherences: analysis.incoherences || [],
        informations_manquantes: analysis.informations_manquantes || [],
        resume: analysis.resume || analysis.resume_documentaire || "",
        resume_documentaire: analysis.resume_documentaire || analysis.resume || "",
      },
      skipped,
      tokens: {
        input: anthropicData.usage?.input_tokens || 0,
        output: anthropicData.usage?.output_tokens || 0,
      },
    };

    return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders });

  } catch (err) {
    const msg = (err as Error).message || "Erreur interne";
    const isAbort = msg.includes("abort") || msg.includes("timeout");
    console.error("[analyse-docs] Error:", msg);
    return new Response(
      JSON.stringify({ error: isAbort ? "Délai d'analyse dépassé (60s)" : `Erreur interne: ${msg}` }),
      { status: isAbort ? 408 : 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
