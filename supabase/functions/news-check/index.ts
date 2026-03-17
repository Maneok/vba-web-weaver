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

  try {
    const { raison_sociale, dirigeant } = await req.json();
    if (!raison_sociale) {
      return new Response(JSON.stringify({ error: "raison_sociale requis", articles: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newsApiKey = Deno.env.get("NEWS_API_KEY");
    if (!newsApiKey) {
      return new Response(JSON.stringify({
        articles: [],
        alertes: [],
        hasNegativeNews: false,
        status: "unavailable",
        error: "NEWS_API_KEY non configurée",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NewsAPI free plan allows up to ~1 month back
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const fromDate = oneMonthAgo.toISOString().slice(0, 10);

    const queries = [raison_sociale];
    if (dirigeant && dirigeant.length > 3) queries.push(dirigeant);

    const allArticles: any[] = [];
    const alertes: string[] = [];

    for (const q of queries) {
      try {
        const params = new URLSearchParams({
          q,
          language: "fr",
          sortBy: "relevancy",
          pageSize: "10",
          from: fromDate,
        });
        const url = `https://newsapi.org/v2/everything?${params}`;
        const res = await fetch(url, {
          headers: { "X-Api-Key": newsApiKey },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        let data: any;
        try { data = await res.json(); } catch { data = {}; }
        const items = data.articles ?? [];

        for (const item of items) {
          const text = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
          const matchedKeywords = ALERT_KEYWORDS.filter(kw => text.includes(kw));
          const hasAlert = matchedKeywords.length > 0;

          const parsed = {
            title: item.title ?? "",
            description: (item.description ?? "").slice(0, 200),
            source: item.source?.name ?? "",
            url: item.url ?? "",
            publishedAt: item.publishedAt ?? "",
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
      } catch (err) {
        console.warn(`[news-check] Query failed:`, (err as Error).message);
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
