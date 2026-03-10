import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile, PermissionAction } from "./types";
import { ROLE_PERMISSIONS } from "./types";
import { useSessionTimeout } from "./useSessionTimeout";
import { logAudit } from "./auditTrail";
import { clearCabinetCache } from "@/lib/supabaseService";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track previous user to detect login vs refresh
  const userRef = useRef<User | null>(null);
  const signedInRef = useRef(false);

  // Fetch profile with per-request timeout + retry for new signups
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const maxRetries = 2;
    const REQUEST_TIMEOUT = 4000;

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
          logger.warn(`[Auth] Profile fetch attempt ${attempt + 1}/${maxRetries}:`, error.code, error.message);
          // PGRST116 = row not found — worth retrying (trigger may not be done)
          if (error.code !== "PGRST116") return null;
        }
      } catch (err: unknown) {
        logger.warn(`[Auth] Profile fetch attempt ${attempt + 1}/${maxRetries} exception:`, err);
      }

      // Wait before retry (trigger handle_new_user may still be running)
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    logger.error("[Auth] Profile not found after", maxRetries, "retries for user:", userId);
    return null;
  }, []);

  const handleSignOut = useCallback(async () => {
    if (userRef.current) {
      await logAudit({ action: "DECONNEXION" }).catch(() => {});
    }
    await supabase.auth.signOut();
    clearCabinetCache();
    setUser(null);
    setSession(null);
    setProfile(null);
    userRef.current = null;
  }, []);

  // Session timeout after 15 minutes of inactivity (conformité LCB-FT)
  useSessionTimeout(
    useCallback(() => {
      toast.warning("Session expirée après 15 minutes d'inactivité");
      handleSignOut();
    }, [handleSignOut]),
    !!session
  );

  // ─── STEP 1: Auth listener — lightweight, NO async profile fetch ───
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (cancelled) return;
        logger.debug("[Auth] State change:", event);

        const newUser = s?.user ?? null;
        const hadUser = userRef.current !== null;
        const hasUser = newUser !== null;

        setSession(s);
        setUser(newUser);
        userRef.current = newUser;

        if (event === "SIGNED_IN") {
          signedInRef.current = true;
        }

        if (!hasUser) {
          // No user → clear profile, done loading
          setProfile(null);
          setLoading(false);
        } else if (!hadUser) {
          // User just appeared (login or page refresh) — ensure loading while profile fetches
          setLoading(true);
        }
        // TOKEN_REFRESHED / USER_UPDATED with same user → no loading change
      }
    );

    // Safety net: if loading is STILL true after 8s, force it false
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
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // ─── STEP 2: Fetch profile when user changes — single source of truth ───
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetchProfile(user.id)
      .then(p => {
        if (cancelled) return;
        setProfile(p);
        setLoading(false);

        // Only log audit + login history on actual sign-in (not page refresh)
        if (p && signedInRef.current) {
          logAudit({ action: "CONNEXION" }).catch((err) => logger.debug("Auth", "audit log failed:", err));
          supabase.from("login_history").insert({
            user_id: user.id,
            cabinet_id: p.cabinet_id,
            email: user.email,
            user_agent: navigator.userAgent,
            login_method: user.app_metadata?.provider || "email",
          }).then(({ error }) => {
            if (error) logger.warn("[Auth] login_history insert failed:", error.message);
          });
          signedInRef.current = false;
        }
      })
      .catch((err) => {
        logger.warn("Auth", "profile fetch failed:", err);
        if (cancelled) return;
        setProfile(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id, fetchProfile]);

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

  const signUp = useCallback(async (email: string, password: string, fullName: string, cabinetName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, ...(cabinetName ? { cabinet_name: cabinetName } : {}) } },
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

  const contextValue = useMemo(() => ({
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
  }), [user, session, profile, loading, signInWithEmail, signInWithGoogle, signUp, handleSignOut, hasPermission, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
