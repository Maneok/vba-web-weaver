import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/types";

interface ScreeningAlertProps {
  client: Client;
}

/**
 * Check screening completeness and freshness for a client.
 * Returns a banner if screening is missing or outdated (> 12 months).
 */
export function ScreeningAlert({ client }: ScreeningAlertProps) {
  const navigate = useNavigate();

  // Check if screening was ever done: we consider screening done if
  // the client has a dateDerniereRevue and essential KYC fields (siren, dirigeant)
  const hasScreening = !!(client.siren && client.dirigeant && client.dateDerniereRevue);

  // Check if screening is recent (< 12 months)
  const isRecent = (() => {
    if (!client.dateDerniereRevue) return false;
    try {
      const lastReview = new Date(client.dateDerniereRevue);
      const now = new Date();
      const diffMonths = (now.getFullYear() - lastReview.getFullYear()) * 12 + (now.getMonth() - lastReview.getMonth());
      return diffMonths < 12;
    } catch {
      return false;
    }
  })();

  // No screening at all — blocking
  if (!hasScreening) {
    return (
      <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-400">
            Ce client n'a pas de dossier LCB-FT
          </p>
          <p className="text-xs text-red-400/80 mt-1">
            Completez le parcours client (identification, screening, scoring) avant de generer la lettre de mission.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => navigate(`/client/${client.ref}`)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Completer la fiche client
          </Button>
        </div>
      </div>
    );
  }

  // Screening exists but is outdated (> 12 months)
  if (!isRecent) {
    const lastDate = (() => {
      try {
        return new Date(client.dateDerniereRevue).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      } catch {
        return client.dateDerniereRevue;
      }
    })();

    return (
      <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-400">
            Dossier LCB-FT perime
          </p>
          <p className="text-xs text-orange-400/80 mt-1">
            Le dernier screening de ce client date du {lastDate} (plus de 12 mois).
            Mettez-le a jour avant de generer la lettre.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 text-xs gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={() => navigate(`/client/${client.ref}`)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mettre a jour le dossier
          </Button>
        </div>
      </div>
    );
  }

  // Screening OK — no alert needed
  return null;
}
