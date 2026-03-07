import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface DocumentInfo {
  type: string;
  label: string;
  url: string;
  source: "pappers" | "inpi" | "auto";
  available: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { siren, raison_sociale } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis" }), { status: 400, headers: CORS });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");
    const documents: DocumentInfo[] = [];

    // 1. INPI direct links (always available)
    documents.push({
      type: "KBIS",
      label: "Extrait INPI (RNE)",
      url: `https://data.inpi.fr/entreprises/${cleanSiren}`,
      source: "inpi",
      available: true,
    });

    // 2. Pappers links (if API key available)
    const pappersKey = Deno.env.get("PAPPERS_API_KEY");
    if (pappersKey) {
      try {
        const res = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}&extrait_rne=true`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (res.ok) {
          const data = await res.json();

          // Available documents from Pappers
          const pappersDocs = data.documents ?? [];
          for (const doc of pappersDocs.slice(0, 10)) {
            documents.push({
              type: doc.type ?? "Document",
              label: `${doc.type ?? "Document"} — ${doc.date_depot ?? ""}`,
              url: doc.url ?? doc.token ? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${doc.token}` : "",
              source: "pappers",
              available: !!doc.url || !!doc.token,
            });
          }

          // Statuts
          if (data.statuts) {
            documents.push({
              type: "Statuts",
              label: `Statuts — ${data.statuts.date_depot ?? ""}`,
              url: data.statuts.token ? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${data.statuts.token}` : "",
              source: "pappers",
              available: !!data.statuts.token,
            });
          }

          // Comptes annuels
          if (data.comptes?.length > 0) {
            for (const compte of data.comptes.slice(0, 3)) {
              documents.push({
                type: "Comptes annuels",
                label: `Comptes ${compte.annee ?? ""} — ${compte.date_depot ?? ""}`,
                url: compte.token ? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${compte.token}` : "",
                source: "pappers",
                available: !!compte.token,
              });
            }
          }

          // Beneficiaires effectifs declaration
          if (data.beneficiaires_effectifs?.length > 0) {
            documents.push({
              type: "Declaration BE",
              label: "Declaration des beneficiaires effectifs",
              url: `https://data.inpi.fr/entreprises/${cleanSiren}#beneficiaires`,
              source: "inpi",
              available: true,
            });
          }
        }
      } catch {
        // Pappers unavailable — continue with free sources
      }
    }

    // 3. Auto-generated links
    documents.push({
      type: "Annuaire",
      label: "Fiche Annuaire Entreprises",
      url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${cleanSiren}`,
      source: "auto",
      available: true,
    });

    documents.push({
      type: "Pappers.fr",
      label: "Fiche Pappers (consultation gratuite)",
      url: `https://www.pappers.fr/entreprise/${cleanSiren}`,
      source: "auto",
      available: true,
    });

    documents.push({
      type: "Societe.com",
      label: "Fiche Societe.com",
      url: `https://www.societe.com/societe/${cleanSiren}.html`,
      source: "auto",
      available: true,
    });

    return new Response(JSON.stringify({
      documents,
      total: documents.length,
      autoRecovered: documents.filter(d => d.source === "pappers" || d.source === "inpi").length,
      status: "OK",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err),
      documents: [],
      status: "ERREUR",
    }), { status: 500, headers: CORS });
  }
});
