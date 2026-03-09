import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const ALERT_KEYWORDS = [
  "fraude", "blanchiment", "mise en examen", "escroquerie",
  "liquidation", "redressement", "saisie", "garde a vue",
  "condamnation", "arnaque", "detournement", "corruption",
  "tracfin", "sanctions", "embargo", "terrorisme",
];

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  // P6-55: Auth check for consistency with other edge functions
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non autorise", articles: [], alertes: [], hasNegativeNews: false, status: "error" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { raison_sociale, dirigeant } = await req.json();
    if (!raison_sociale) {
      return new Response(JSON.stringify({ error: "raison_sociale requis", articles: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Google Custom Search API (NewsAPI free tier doesn't work server-side)
    const googleKey = Deno.env.get("GOOGLE_API_KEY");
    const cseId = Deno.env.get("GOOGLE_CSE_ID");

    if (!googleKey || !cseId) {
      return new Response(JSON.stringify({
        articles: [],
        alertes: [],
        hasNegativeNews: false,
        status: "unavailable",
        error: "Cle API Google ou CSE ID non configure",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queries = [raison_sociale];
    if (dirigeant && dirigeant.length > 3) queries.push(dirigeant);

    const allArticles: any[] = [];
    const alertes: string[] = [];

    for (const q of queries) {
      try {
        const searchQuery = `${q} actualites fraude blanchiment`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${cseId}&q=${encodeURIComponent(searchQuery)}&num=5&dateRestrict=y1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

        if (!res.ok) continue;

        // P6-35: Guard against non-JSON response
        let data: any;
        try { data = await res.json(); } catch { data = {}; }
        const items = data.items ?? [];

        for (const item of items) {
          const text = `${item.title ?? ""} ${item.snippet ?? ""}`.toLowerCase();
          const matchedKeywords = ALERT_KEYWORDS.filter(kw => text.includes(kw));
          const hasAlert = matchedKeywords.length > 0;

          const parsed = {
            title: item.title ?? "",
            description: (item.snippet ?? "").slice(0, 200),
            source: item.displayLink ?? "",
            url: item.link ?? "",
            publishedAt: item.pagemap?.metatags?.[0]?.["article:published_time"] ?? "",
            hasAlertKeyword: hasAlert,
            matchedKeywords,
          };

          allArticles.push(parsed);

          if (hasAlert) {
            alertes.push(
              `ARTICLE NEGATIF DETECTE : "${parsed.title}" — ${parsed.source} [${matchedKeywords.join(", ")}]`
            );
          }
        }
      } catch {
        // Non-blocking per query
      }
    }

    // Deduplicate by title
    const seen = new Set<string>();
    const unique = allArticles.filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    return new Response(JSON.stringify({
      articles: unique.slice(0, 10),
      alertes,
      hasNegativeNews: alertes.length > 0,
      status: alertes.length > 0 ? "ALERTE" : unique.length > 0 ? "ok" : "AUCUN_ARTICLE",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Erreur interne du service de veille presse",
      articles: [],
      alertes: [],
      hasNegativeNews: false,
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
