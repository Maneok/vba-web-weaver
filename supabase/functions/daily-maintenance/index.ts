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

  return new Response(JSON.stringify({ success: !error, result: data, error: error?.message }), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
});
