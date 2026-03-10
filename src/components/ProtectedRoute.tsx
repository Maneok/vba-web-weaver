import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import type { PermissionAction } from "@/lib/auth/types";
import { Loader2, RefreshCw, LogOut, WifiOff } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionAction;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { session, profile, loading, hasPermission, signOut, refreshProfile } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety timeout — 10s max spinner (AuthContext safety is 8s, this is a fallback)
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Reset retry counter when session changes (new login)
  useEffect(() => {
    setRetryCount(0);
  }, [session?.access_token]);

  // Auto-retry profile fetch once on timeout (before showing error)
  useEffect(() => {
    if (timedOut && session && !profile && retryCount === 0) {
      let cancelled = false;
      setRetryCount(1);
      setRetrying(true);
      refreshProfile()
        .catch(() => {})
        .finally(() => { if (!cancelled) setRetrying(false); });
      return () => { cancelled = true; };
    }
  }, [timedOut, session, profile, retryCount, refreshProfile]);

  // Cleanup signout timer on unmount
  useEffect(() => {
    return () => {
      if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current);
    };
  }, []);

  // Manual retry handler
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setRetryCount((c) => c + 1);
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        {retryCount > 1 && (
          <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
            Si le probleme persiste, essayez de vous deconnecter puis de vous reconnecter.
          </p>
        )}
      </div>
    );
  }

  if (!profile.is_active) {
    if (!signOutTimerRef.current) {
      signOutTimerRef.current = setTimeout(() => signOut(), 3000);
    }
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

  return <>{children}</>;
}
