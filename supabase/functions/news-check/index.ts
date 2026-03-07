import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const ALERT_KEYWORDS = [
  "fraude", "blanchiment", "mise en examen", "escroquerie",
  "liquidation", "redressement", "saisie", "garde à vue", "garde a vue",
  "condamnation", "arnaque", "detournement", "corruption",
  "tracfin", "sanctions", "embargo", "terrorisme",
];

interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  hasAlertKeyword: boolean;
  matchedKeywords: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { raison_sociale, dirigeant } = await req.json();
    if (!raison_sociale) {
      return new Response(JSON.stringify({ error: "raison_sociale requis" }), { status: 400, headers: CORS });
    }

    const apiKey = Deno.env.get("NEWS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({
        articles: [],
        alertes: [],
        status: "INDISPONIBLE",
        error: "Cle API NewsAPI non configuree",
      }), { headers: CORS });
    }

    // Search by company name
    const queries = [raison_sociale];
    if (dirigeant && dirigeant.length > 3) queries.push(dirigeant);

    const allArticles: NewsArticle[] = [];
    const alertes: string[] = [];

    for (const q of queries) {
      try {
        const url = `https://newsapi.org/v2/everything?q="${encodeURIComponent(q)}"&language=fr&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

        if (!res.ok) continue;

        const data = await res.json();
        const articles = data.articles ?? [];

        for (const article of articles) {
          const text = `${article.title ?? ""} ${article.description ?? ""}`.toLowerCase();
          const matchedKeywords = ALERT_KEYWORDS.filter(kw => text.includes(kw));
          const hasAlert = matchedKeywords.length > 0;

          const parsed: NewsArticle = {
            title: article.title ?? "",
            description: (article.description ?? "").slice(0, 200),
            source: article.source?.name ?? "",
            url: article.url ?? "",
            publishedAt: article.publishedAt ?? "",
            hasAlertKeyword: hasAlert,
            matchedKeywords,
          };

          allArticles.push(parsed);

          if (hasAlert) {
            alertes.push(
              `ARTICLE NEGATIF DETECTE : "${parsed.title}" — ${parsed.source} — ${parsed.publishedAt?.split("T")[0] ?? ""} [${matchedKeywords.join(", ")}]`
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
      status: alertes.length > 0 ? "ALERTE" : unique.length > 0 ? "OK" : "AUCUN_ARTICLE",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err),
      articles: [],
      alertes: [],
      status: "ERREUR",
    }), { status: 500, headers: CORS });
  }
});
