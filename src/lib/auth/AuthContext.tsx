import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile, PermissionAction } from "./types";
import { ROLE_PERMISSIONS } from "./types";
import { useSessionTimeout } from "./useSessionTimeout";
import { logAudit } from "./auditTrail";
import { toast } from "sonner";

const isDev = import.meta.env.DEV;

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!url || !key) {
        if (isDev) console.error("[Auth] Missing SUPABASE env vars");
        return null;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        if (isDev) console.error("[Auth] No access token available");
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `${url}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        if (isDev) console.error("[Auth] fetch error:", res.status);
        return null;
      }

      const data = await res.json();
      return data as UserProfile;
    } catch (e: unknown) {
      if (isDev) console.error("[Auth] fetchProfile exception:", e);
      return null;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (user) {
      await logAudit({ action: "DECONNEXION" }).catch(() => {});
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [user]);

  // Session timeout after 15 minutes of inactivity (conformité LCB-FT)
  useSessionTimeout(
    useCallback(() => {
      toast.warning("Session expiree apres 15 minutes d'inactivite");
      handleSignOut();
    }, [handleSignOut]),
    !!session
  );

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          // Log login events
          if (event === "SIGNED_IN") {
            logAudit({
              action: "CONNEXION",
              new_data: { email: s.user.email, provider: s.user.app_metadata?.provider || "email" },
            }).catch(() => {});
          }

          const p = await fetchProfile(s.user.id);
          if (mounted) setProfile(p);
        } else {
          if (mounted) setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    // Récupérer la session initiale
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (mounted) setProfile(p);
      }

      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Log failed login attempt
      logAudit({
        action: "CONNEXION_ECHOUEE",
        new_data: { email, error: error.message },
      }).catch(() => {});
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
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
