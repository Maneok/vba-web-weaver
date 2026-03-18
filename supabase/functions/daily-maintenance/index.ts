import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('daily_full_maintenance');

  const result: Record<string, unknown> = { ...(typeof data === 'object' && data !== null ? data : { rpc: data }) };

  // Pre-warm gel-avoirs cache (DGTrésor JSON feed)
  try {
    const gelRes = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-fichier-json",
      { headers: { "User-Agent": "GRIMY-LCB-Compliance/1.0" }, signal: AbortSignal.timeout(45000) }
    );
    if (gelRes.ok) {
      const gelData = await gelRes.json();
      const items = gelData?.Publications?.PublicationDetail ?? [];
      const publicationDate = gelData?.Publications?.DatePublication ?? "";

      await supabase.from("api_cache").upsert({
        siren: "GEL_AVOIRS_GLOBAL",
        api_name: "gel_avoirs",
        cabinet_id: "00000000-0000-0000-0000-000000000000",
        response_data: { items, publicationDate },
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "siren,api_name,cabinet_id" });

      result.gel_avoirs_cache = { refreshed: true, entries: items.length, publicationDate };
      console.log(`[daily-maintenance] Gel-avoirs cache refreshed: ${items.length} entries`);
    } else {
      result.gel_avoirs_cache = { refreshed: false, error: `HTTP ${gelRes.status}` };
    }
  } catch (err) {
    result.gel_avoirs_cache = { refreshed: false, error: (err as Error).message };
    console.error("[daily-maintenance] Gel-avoirs cache refresh failed:", (err as Error).message);
  }

  return new Response(JSON.stringify({ success: !error, result, error: error?.message }), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
});
