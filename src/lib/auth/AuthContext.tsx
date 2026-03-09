import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile, PermissionAction } from "./types";
import { ROLE_PERMISSIONS } from "./types";
import { useSessionTimeout } from "./useSessionTimeout";
import { logAudit } from "./auditTrail";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile with per-request timeout + retry for new signups
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const maxRetries = 3;
    const REQUEST_TIMEOUT = 5000; // 5s max per attempt

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()
          .abortSignal(controller.signal);

        clearTimeout(timer);

        if (data) return data as UserProfile;

        if (error) {
          logger.warn(`[AuthContext] Profile fetch attempt ${attempt + 1}/${maxRetries}:`, error.code, error.message);
          // PGRST116 = row not found — worth retrying (trigger may not be done)
          if (error.code !== "PGRST116") return null;
        }
      } catch (err) {
        logger.warn(`[AuthContext] Profile fetch attempt ${attempt + 1}/${maxRetries} exception:`, err);
      }

      // Wait before retry (trigger handle_new_user may still be running)
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    logger.error("[AuthContext] Profile not found after", maxRetries, "retries for user:", userId);
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

    // Listen for auth changes FIRST to catch events during init
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return;
        logger.debug("[Auth] State change:", event);

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
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

    // Then get initial session — no Promise.race timeout wrapper
    const initAuth = async () => {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          logger.warn("[Auth] getSession error:", error.message);
          await supabase.auth.signOut();
          return;
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          if (!cancelled) setProfile(p);
        }
      } catch (err) {
        logger.error("[Auth] Init exception:", err);
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

    // Safety net: if loading is STILL true after 10s, force it false
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoading(prev => {
          if (prev) {
            logger.warn("[Auth] Safety timeout — forcing load complete");
            return false;
          }
          return prev;
        });
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
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

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const currentUser = user;
    if (!currentUser) return null;
    const p = await fetchProfile(currentUser.id);
    setProfile(p);
    return p;
  }, [user, fetchProfile]);

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
