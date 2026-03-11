import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Server-side: try non-prefixed first, fallback to VITE_ for shared env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://szjcmepjuxlvnkqbxqqr.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseKey) {
    return res.status(500).json({ error: "Missing SUPABASE key" });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/daily-maintenance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const body = await response.text();
    return res.status(response.status).json({ status: response.status, body });
  } catch (error) {
    return res.status(500).json({ error: "Failed to call daily-maintenance", details: String(error) });
  }
}
