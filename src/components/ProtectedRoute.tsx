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
  // FIX 23: Guard setTimeout for deactivated accounts
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX 21: Safety timeout — 12s (must exceed fetchProfile retry total ~10s)
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  // FIX 22: Auto-retry profile fetch once on timeout (before showing error)
  useEffect(() => {
    if (timedOut && session && !profile && retryCount === 0) {
      setRetryCount(1);
      setRetrying(true);
      refreshProfile()
        .catch(() => {})
        .finally(() => setRetrying(false));
    }
  }, [timedOut, session, profile, retryCount, refreshProfile]);

  // FIX 23: Cleanup signout timer on unmount
  useEffect(() => {
    return () => {
      if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current);
    };
  }, []);

  // FIX 22: Manual retry handler
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
        {retrying && (
          <p className="text-sm text-muted-foreground">Nouvelle tentative de chargement...</p>
        )}
      </div>
    );
  }

  // No session at all -> go to login
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
    // FIX 23: Use ref to prevent multiple setTimeout calls on re-render
    if (!signOutTimerRef.current) {
      signOutTimerRef.current = setTimeout(() => signOut(), 3000);
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">Compte désactivé</p>
          <p className="text-sm text-muted-foreground">Contactez votre administrateur. Déconnexion automatique...</p>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-destructive">Accès refusé</p>
          <p className="text-sm text-muted-foreground">
            Vous n'avez pas les droits nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
