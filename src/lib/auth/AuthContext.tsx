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

  // Fetch profile with retry — the handle_new_user trigger might not
  // have finished creating the profile row yet on first signup
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (data) return data as UserProfile;

        if (error && error.code !== "PGRST116") {
          // PGRST116 = "not found" — retry. Other errors = stop.
          console.error("[AuthContext] Profile fetch error:", error.message);
          return null;
        }
      } catch (err) {
        console.error("[AuthContext] Profile fetch exception:", err);
        return null;
      }

      // Wait before retry (profile might be getting created by DB trigger)
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    console.warn("[AuthContext] Profile not found after retries for user:", userId);
    return null;
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
    let cancelled = false;

    // Get initial session with timeout to prevent infinite spinner
    const initAuth = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 8000)
        );
        const sessionPromise = supabase.auth.getSession();
        const { data: { session: s } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (cancelled) return;

        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          if (!cancelled) setProfile(p);
        }
      } catch (err) {
        console.error("[AuthContext] Init error:", err);
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initAuth();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return;

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          // Fetch profile — with retries for SIGNED_IN (trigger may need time)
          const p = await fetchProfile(s.user.id);
          if (!cancelled) {
            setProfile(p);

            if (event === "SIGNED_IN" && p) {
              logAudit({ action: "CONNEXION" }).catch(() => {});
            }
          }
        } else {
          setProfile(null);
        }

        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
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
