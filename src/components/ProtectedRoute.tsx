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

  // Safety timeout: if still loading after 10s, stop waiting
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 10000);
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
    return <Navigate to="/auth" replace />;
  }

  // Session exists but profile not loaded yet — wait a bit
  // (fetchProfile in AuthContext retries 3 times with 1s delays)
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement du profil...</p>
        {timedOut && (
          <div className="text-center space-y-3 mt-4">
            <p className="text-sm text-destructive">
              Impossible de charger votre profil. Veuillez vous reconnecter.
            </p>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Se deconnecter
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">Compte desactive</p>
          <p className="text-sm text-muted-foreground">Contactez votre administrateur.</p>
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
        <div className="text-center space-y-2">
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
