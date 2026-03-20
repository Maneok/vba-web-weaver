import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger } from '@/lib/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  logger.error('Supabase', 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing. Backend features will not work.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Required for OAuth redirect (Google login)
      flowType: 'pkce', // More secure OAuth flow
    },
    // OPT-SUP1: Enable global error handling for better debugging
    global: {
      headers: {
        'x-client-info': 'grimy-web/1.0.0',
      },
    },
    // OPT-SUP2: Realtime disabled by default (we don't use it yet)
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  }
);