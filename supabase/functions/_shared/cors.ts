const SITE_URL = Deno.env.get("SITE_URL") || "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || SITE_URL || "").split(",").map(s => s.trim()).filter(Boolean);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin);
  // P5-1: When origin not allowed, do NOT send any origin back — prevents reflecting first origin to unmatched requests
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function handleCorsOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
