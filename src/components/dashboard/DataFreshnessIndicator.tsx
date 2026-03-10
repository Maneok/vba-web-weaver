import { useMemo } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface DataFreshnessIndicatorProps {
  lastRefresh: Date;
  staleThresholdMinutes?: number;
}

export default function DataFreshnessIndicator({
  lastRefresh,
  staleThresholdMinutes = 5,
}: DataFreshnessIndicatorProps) {
  const { label, isStale } = useMemo(() => {
    const diffMs = Date.now() - lastRefresh.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return { label: "À l'instant", isStale: false };
    if (diffMin === 1) return { label: "Il y a 1 minute", isStale: false };
    if (diffMin < 60) return { label: `Il y a ${diffMin} minutes`, isStale: diffMin >= staleThresholdMinutes };

    const diffH = Math.floor(diffMin / 60);
    if (diffH === 1) return { label: "Il y a 1 heure", isStale: true };
    return { label: `Il y a ${diffH} heures`, isStale: true };
  }, [lastRefresh, staleThresholdMinutes]);

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        isStale ? "text-orange-500" : "text-muted-foreground"
      }`}
      aria-label={`Données mises à jour ${label.toLowerCase()}`}
      title={`Dernière mise à jour : ${lastRefresh.toLocaleTimeString("fr-FR")}`}
    >
      {isStale ? (
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
      ) : (
        <Clock className="w-3 h-3" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
