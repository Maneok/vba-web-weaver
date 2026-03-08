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
  const { session, profile, loading, hasPermission } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if still loading after 10s, stop waiting
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loading) {
        console.error("[ProtectedRoute] Timeout — forcing load complete");
        setTimedOut(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    // Profile not found — redirect to auth instead of spinning forever
    return <Navigate to="/auth" replace />;
  }

  if (!profile.is_active) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-destructive">Compte desactive</p>
          <p className="text-sm text-muted-foreground">Contactez votre administrateur.</p>
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
