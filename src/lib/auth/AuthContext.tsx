import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile, PermissionAction } from "./types";
import { ROLE_PERMISSIONS } from "./types";
import { useSessionTimeout } from "./useSessionTimeout";
import { logAudit } from "./auditTrail";
import { toast } from "sonner";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log("[Auth] fetchProfile called for userId:", userId);

      const { data, error, status } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      console.log("[Auth] fetchProfile result — status:", status, "error:", error?.message, "data:", data ? "found" : "null");

      if (error) {
        console.error("[Auth] fetchProfile error:", error.message, "code:", error.code, "details:", error.details);
        return null;
      }

      if (!data) {
        console.warn("[Auth] No profile found, waiting 2s and retrying...");
        await new Promise(r => setTimeout(r, 2000));
        const { data: retry, error: retryErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        console.log("[Auth] Retry result:", retry ? "found" : "null", retryErr?.message);
        return retry as UserProfile | null;
      }

      return data as UserProfile;
    } catch (e) {
      console.error("[Auth] fetchProfile exception:", e);
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

  // Session timeout after 30 minutes of inactivity
  useSessionTimeout(
    useCallback(() => {
      toast.warning("Session expiree apres 30 minutes d'inactivite");
      handleSignOut();
    }, [handleSignOut]),
    !!session
  );

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        console.log("[Auth] onAuthStateChange:", event, s?.user?.email);

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          if (mounted) {
            setProfile(p);
            console.log("[Auth] Profile set:", p ? p.full_name : "null");
          }
        } else {
          if (mounted) setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    // Récupérer la session initiale
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      console.log("[Auth] Initial session:", s?.user?.email || "none");

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (mounted) {
          setProfile(p);
          console.log("[Auth] Initial profile:", p ? p.full_name : "null");
        }
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
    if (error) throw error;
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
