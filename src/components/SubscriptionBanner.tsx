import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CreditCard, Clock, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface AccessCheckResult {
  allowed: boolean;
  readonly: boolean;
  sub_status: string;
  days_remaining: number;
  message: string;
}

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [accessData, setAccessData] = useState<AccessCheckResult | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .rpc("check_user_access", { p_user_id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          logger.warn("[SubscriptionBanner] RPC error:", error.message);
          return;
        }
        if (data) {
          setAccessData(data as unknown as AccessCheckResult);
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  // Reset dismissed state on navigation (re-mount)
  useEffect(() => {
    setDismissed(false);
  }, []);

  if (!accessData || dismissed) return null;

  const { sub_status, days_remaining, readonly, allowed } = accessData;

  // Suspended + not allowed → redirect
  if (sub_status === "suspended" && !allowed) {
    navigate("/suspended", { replace: true });
    return null;
  }

  // Active → no banner
  if (sub_status === "active") return null;

  let bannerClass = "";
  let icon: React.ReactNode = null;
  let message = "";

  if (sub_status === "trialing" && days_remaining <= 3) {
    bannerClass = "bg-yellow-500/15 border-yellow-500/30 text-yellow-200";
    icon = <Clock className="h-4 w-4 text-yellow-400 shrink-0" />;
    message = `Votre essai se termine dans ${days_remaining} jour${days_remaining > 1 ? "s" : ""}. Passez a un plan payant.`;
  } else if (sub_status === "trialing") {
    bannerClass = "bg-blue-500/10 border-blue-500/20 text-blue-300";
    icon = <Clock className="h-4 w-4 text-blue-400 shrink-0" />;
    message = `Essai gratuit — ${days_remaining} jour${days_remaining > 1 ? "s" : ""} restant${days_remaining > 1 ? "s" : ""}`;
  } else if (sub_status === "past_due") {
    bannerClass = "bg-orange-500/15 border-orange-500/30 text-orange-200";
    icon = <CreditCard className="h-4 w-4 text-orange-400 shrink-0" />;
    message = "Paiement echoue. Mettez a jour votre moyen de paiement sous 7 jours.";
  } else if (sub_status === "suspended" && readonly) {
    bannerClass = "bg-red-500/15 border-red-500/30 text-red-200";
    icon = <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />;
    message = "Compte suspendu — mode lecture seule. Reactivez votre abonnement.";
  } else {
    return null;
  }

  return (
    <Alert className={`rounded-none border-x-0 border-t-0 ${bannerClass}`}>
      <AlertDescription className="flex items-center gap-3 px-6 py-1">
        {icon}
        <span className="text-sm flex-1">{message}</span>
        <button
          onClick={() => navigate("/parametres#abonnement")}
          className="text-xs font-medium px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap"
        >
          Gerer mon abonnement
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Fermer le bandeau"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDescription>
    </Alert>
  );
}
