const SITE_URL = Deno.env.get("SITE_URL") || "";
const EXTRA_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);

// Build allowlist: explicit env vars + common deployment origins
const ALLOWED_ORIGINS = new Set([
  ...EXTRA_ORIGINS,
  ...(SITE_URL ? [SITE_URL] : []),
  // Vercel deployments
  "https://projet-lcb.vercel.app",
  "https://grimy.vercel.app",
  // Local dev (cover common port ranges in case of auto-increment)
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4173",
]);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  // Allow if origin is in allowlist, or if no origin (server-to-server / same-origin)
  const isAllowed = !origin || ALLOWED_ORIGINS.has(origin)
    || origin.endsWith("vba-web-weaver.vercel.app")
    || origin.endsWith("projet-lcb.vercel.app")
    || origin.endsWith("grimy.vercel.app");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin || "*";
  }
  return headers;
}

export function handleCorsOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
