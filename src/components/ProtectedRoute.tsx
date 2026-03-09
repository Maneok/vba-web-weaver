import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import type { PermissionAction } from "@/lib/auth/types";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionAction;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { session, profile, loading, hasPermission, signOut } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if still loading after 6s, stop waiting
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Auth is still initializing
  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No session at all → go to login
  if (!session) {
    return <Navigate to="/landing" replace />;
  }

  // Session exists but profile not loaded — loading finished without profile
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <p className="text-muted-foreground">Impossible de charger le profil.</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Réessayer
          </button>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    // Auto sign-out deactivated accounts after showing message
    setTimeout(() => signOut(), 3000);
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
