import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { PermissionAction } from "@/lib/auth/types";
import { Loader2, RefreshCw, LogOut, WifiOff } from "lucide-react";
import { logger } from "@/lib/logger";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionAction;
  /** If true, skip onboarding check (used for /onboarding route itself) */
  skipOnboardingCheck?: boolean;
}

export default function ProtectedRoute({ children, requiredPermission, skipOnboardingCheck }: ProtectedRouteProps) {
  const { session, profile, loading, hasPermission, signOut, refreshProfile } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retriedRef = useRef(false);
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // Onboarding check: has the user completed onboarding?
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (skipOnboardingCheck || !profile) {
      setOnboardingChecked(true);
      return;
    }

    // Check localStorage first (instant, works even if DB save failed)
    const localFlag = localStorage.getItem("grimy_onboarding_completed");
    if (localFlag === profile.id) {
      setNeedsOnboarding(false);
      setOnboardingChecked(true);
      return;
    }

    let cancelled = false;

    supabase
      .from("parametres")
      .select("valeur")
      .eq("user_id", profile.id)
      .eq("cle", "onboarding_completed")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const completed = data?.valeur === "true" || data?.valeur === '"true"';
        if (completed) {
          // Sync localStorage for future fast checks
          localStorage.setItem("grimy_onboarding_completed", profile.id);
        }
        setNeedsOnboarding(!completed);
        setOnboardingChecked(true);
      })
      // OPT-13: Log onboarding check errors instead of silently swallowing
      .catch((err) => {
        logger.warn("ProtectedRoute", "Onboarding check failed:", err);
        if (!cancelled) {
          setOnboardingChecked(true); // fail open — don't block
        }
      });

    return () => { cancelled = true; };
  }, [profile?.id, skipOnboardingCheck]);

  // Safety timeout — 10s max spinner (AuthContext safety is 8s, this is a fallback)
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Reset retry flag when session changes (new login)
  useEffect(() => {
    retriedRef.current = false;
    retryCountRef.current = 0;
  }, [session?.access_token]);

  // Auto-retry profile fetch once on timeout (before showing error)
  useEffect(() => {
    if (timedOut && session && !profile && !retriedRef.current) {
      retriedRef.current = true;
      retryCountRef.current = 1;
      setRetrying(true);
      refreshProfile()
        .catch((err) => logger.warn("ProtectedRoute", "Profile refresh failed:", err))
        .finally(() => setRetrying(false));
    }
  }, [timedOut, session, profile, refreshProfile]);

  // Cleanup signout timer on unmount
  useEffect(() => {
    return () => {
      if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current);
    };
  }, []);

  // Auto sign-out for deactivated accounts
  useEffect(() => {
    if (!profile) return;
    if (profile.is_active) {
      if (signOutTimerRef.current) { clearTimeout(signOutTimerRef.current); signOutTimerRef.current = null; }
      return;
    }
    if (!signOutTimerRef.current) {
      signOutTimerRef.current = setTimeout(() => signOut(), 3000);
    }
    return () => { if (signOutTimerRef.current) { clearTimeout(signOutTimerRef.current); signOutTimerRef.current = null; } };
  }, [profile, profile?.is_active, signOut]);

  // Manual retry handler
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    retryCountRef.current += 1;
    try {
      await refreshProfile();
    } catch {
      // handled by state
    } finally {
      setRetrying(false);
    }
  }, [refreshProfile]);

  // Auth is still initializing (or retrying)
  if ((loading && !timedOut) || retrying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Chargement en cours" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Chargement de votre espace...
        </p>
      </div>
    );
  }

  // No session at all -> go to landing
  if (!session) {
    return <Navigate to="/landing" replace />;
  }

  // Session exists but profile not loaded
  if (!profile) {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        {isOffline ? (
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        ) : null}
        <p className="text-muted-foreground">
          {isOffline
            ? "Pas de connexion internet."
            : "Impossible de charger le profil."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
            Reessayer
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-muted/80"
          >
            <LogOut className="w-4 h-4" />
            Se deconnecter
          </button>
        </div>
        {retryCountRef.current > 1 && (
          <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
            Si le probleme persiste, essayez de vous deconnecter puis de vous reconnecter.
          </p>
        )}
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3" role="alert">
          <p className="text-lg font-semibold text-destructive">Compte desactive</p>
          <p className="text-sm text-muted-foreground">Contactez votre administrateur. Deconnexion automatique...</p>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2" role="alert">
          <p className="text-lg font-semibold text-destructive">Acces refuse</p>
          <p className="text-sm text-muted-foreground">
            Vous n'avez pas les droits necessaires pour acceder a cette page.
          </p>
        </div>
      </div>
    );
  }

  // Onboarding redirect: if not completed, redirect to /onboarding
  if (!skipOnboardingCheck && !onboardingChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Chargement de votre espace...
        </p>
      </div>
    );
  }

  if (!skipOnboardingCheck && needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
