const SITE_URL = Deno.env.get("SITE_URL") || "";
const EXTRA_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);

// Build allowlist: explicit env vars + common deployment origins
const ALLOWED_ORIGINS = new Set([
  ...EXTRA_ORIGINS,
  ...(SITE_URL ? [SITE_URL] : []),
  // Vercel deployments
  "https://projet-lcb.vercel.app",
  "https://grimy.vercel.app",
  // Local dev
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
]);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  // Allow if origin is in allowlist, or if no origin (server-to-server / same-origin)
  const isAllowed = !origin || ALLOWED_ORIGINS.has(origin)
    || origin.endsWith("vba-web-weaver.vercel.app")
    || origin.endsWith("projet-lcb.vercel.app")
    || origin.endsWith("grimy.vercel.app");
  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "",
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
