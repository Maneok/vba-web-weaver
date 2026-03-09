import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile, PermissionAction } from "./types";
import { ROLE_PERMISSIONS } from "./types";
import { useSessionTimeout } from "./useSessionTimeout";
import { logAudit, clearAuditCache } from "./auditTrail";
import { clearCabinetCache } from "@/lib/supabaseService";
import { toast } from "sonner";

const isDev = import.meta.env.DEV;

const AuthContext = createContext<AuthState | null>(null);

// FIX 11: Retry helper with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    // FIX 17: Increase timeout to 10s
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // FIX 12: Retry on 5xx or 406 (PostgREST error for empty result with object header)
      if (res.status >= 500 || res.status === 406) {
        if (attempt < retries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          if (isDev) console.log(`[Auth] Retry ${attempt + 1}/${retries} after ${delay}ms (status ${res.status})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      return res;
    } catch (e: any) {
      clearTimeout(timeout);
      if (attempt < retries - 1 && (e.name === "AbortError" || e.name === "TypeError")) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (isDev) console.log(`[Auth] Retry ${attempt + 1}/${retries} after ${delay}ms (${e.name})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("fetchWithRetry exhausted");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // FIX 13: Deduplication lock — prevent parallel fetches overwriting each other
  const fetchingRef = useRef(false);
  // FIX 20: Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // FIX 16: Track last successful fetch to avoid redundant calls
  const lastFetchedUserRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, accessToken: string): Promise<UserProfile | null> => {
    // FIX 13: Skip if already fetching
    if (fetchingRef.current) {
      if (isDev) console.log("[Auth] fetchProfile skipped — already in progress");
      return profile;
    }

    fetchingRef.current = true;

    try {
      if (isDev) console.log("[Auth] fetchProfile for:", userId);
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // FIX 15: Better error messages for missing config
      if (!url || !key) {
        console.error("[Auth] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not set");
        return null;
      }

      // FIX 11: Use array response (NOT vnd.pgrst.object+json) to avoid 406 on empty result
      const res = await fetchWithRetry(
        url + "/rest/v1/profiles?id=eq." + userId + "&select=*",
        {
          headers: {
            "apikey": key,
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (isDev) console.error("[Auth] fetch error:", res.status);
        return null;
      }

      const data = await res.json();

      // FIX 11: Response is now an array — take first element
      const profileData = Array.isArray(data) ? data[0] ?? null : data;

      if (!profileData) {
        if (isDev) console.warn("[Auth] Profile not found for user:", userId);
        return null;
      }

      if (isDev) console.log("[Auth] Profile loaded:", profileData.full_name || "no name");
      // FIX 16: Track last successfully fetched user
      lastFetchedUserRef.current = userId;
      return profileData as UserProfile;
    } catch (e: any) {
      if (isDev) console.error("[Auth] fetchProfile error:", e.name, e.message);
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    // FIX 14: Non-blocking audit log
    if (user) {
      logAudit({ action: "DECONNEXION" }).catch(() => {});
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    lastFetchedUserRef.current = null;
    clearAuditCache();
    clearCabinetCache();
  }, [user]);

  // FIX 18: Expose refreshProfile for manual retry from ProtectedRoute
  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.user || !s.access_token) return null;

    // Reset dedup lock and last-fetched to force a fresh fetch
    fetchingRef.current = false;
    lastFetchedUserRef.current = null;

    const p = await fetchProfile(s.user.id, s.access_token);
    if (mountedRef.current) {
      setProfile(p);
      setSession(s);
      setUser(s.user);
    }
    return p;
  }, [fetchProfile]);

  // Session timeout after 15 minutes of inactivity (conformite LCB-FT)
  useSessionTimeout(
    useCallback(() => {
      toast.warning("Session expiree apres 15 minutes d'inactivite");
      handleSignOut();
    }, [handleSignOut]),
    !!session
  );

  useEffect(() => {
    mountedRef.current = true;

    // FIX 19: Handle all auth events properly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mountedRef.current) return;

        if (isDev) console.log("[Auth] Event:", event);

        // FIX 19: Explicit SIGNED_OUT handling
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          lastFetchedUserRef.current = null;
          setLoading(false);
          return;
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user && s.access_token) {
          // FIX 14: Move audit log out of critical path — fire and forget
          if (event === "SIGNED_IN") {
            setTimeout(() => {
              logAudit({
                action: "CONNEXION",
                new_data: { email: s.user.email, provider: s.user.app_metadata?.provider || "email" },
              }).catch(() => {});
            }, 0);
          }

          // FIX 16: Skip fetch if we already have this user's profile
          if (lastFetchedUserRef.current !== s.user.id) {
            const p = await fetchProfile(s.user.id, s.access_token);
            if (mountedRef.current) setProfile(p);
          }
        } else {
          if (mountedRef.current) setProfile(null);
        }

        if (mountedRef.current) setLoading(false);
      }
    );

    // FIX 13: Initial session — only fetch if onAuthStateChange hasn't already done it
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mountedRef.current) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user && s.access_token) {
        // FIX 16: Skip if already fetched by onAuthStateChange
        if (lastFetchedUserRef.current !== s.user.id) {
          const p = await fetchProfile(s.user.id, s.access_token);
          if (mountedRef.current) setProfile(p);
        }
      }

      if (mountedRef.current) setLoading(false);
    });

    // FIX 30: On tab re-focus, check if session is still valid and refresh profile if needed
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!mountedRef.current) return;
          if (!s) {
            // Session expired while tab was hidden
            setSession(null);
            setUser(null);
            setProfile(null);
            lastFetchedUserRef.current = null;
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    // FIX 24: Reset fetch state before new sign-in
    lastFetchedUserRef.current = null;
    fetchingRef.current = false;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // FIX 14: Non-blocking audit, masked email
      setTimeout(() => {
        logAudit({
          action: "CONNEXION_ECHOUEE",
          new_data: { email_prefix: email.split("@")[0]?.slice(0, 3) + "***", error: "invalid_credentials" },
        }).catch(() => {});
      }, 0);
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // FIX 24: Reset fetch state before new sign-in
    lastFetchedUserRef.current = null;
    fetchingRef.current = false;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    lastFetchedUserRef.current = null;
    fetchingRef.current = false;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  const hasPermission = useCallback(
    (action: PermissionAction): boolean => {
      if (!profile) return false;
      return ROLE_PERMISSIONS[profile.role]?.includes(action) ?? false;
    },
    [profile]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithEmail,
        signInWithGoogle,
        signUp,
        signOut: handleSignOut,
        hasPermission,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
