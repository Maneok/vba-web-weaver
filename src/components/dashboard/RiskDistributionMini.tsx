import { useMemo } from "react";

interface RiskDistributionMiniProps {
  simplifiee: number;
  standard: number;
  renforcee: number;
}

export default function RiskDistributionMini({
  simplifiee,
  standard,
  renforcee,
}: RiskDistributionMiniProps) {
  const total = simplifiee + standard + renforcee;
  const segments = useMemo(() => {
    if (total === 0) return [];
    return [
      { label: "Simplifiée", count: simplifiee, pct: Math.round((simplifiee / total) * 100), color: "bg-emerald-500" },
      { label: "Standard", count: standard, pct: Math.round((standard / total) * 100), color: "bg-amber-500" },
      { label: "Renforcée", count: renforcee, pct: Math.round((renforcee / total) * 100), color: "bg-red-500" },
    ];
  }, [simplifiee, standard, renforcee, total]);

  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground" aria-label="Aucun client pour la répartition de vigilance">
        Aucun client
      </div>
    );
  }

  return (
    <div className="space-y-1.5" aria-label="Répartition rapide des niveaux de vigilance">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted" role="img" aria-label={`${simplifiee} simplifiée, ${standard} standard, ${renforcee} renforcée`}>
        {segments.map((seg) =>
          seg.count > 0 ? (
            <div
              key={seg.label}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
            />
          ) : null
        )}
      </div>
      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${seg.color}`} aria-hidden="true" />
            {seg.count}
          </span>
        ))}
      </div>
    </div>
  );
}
