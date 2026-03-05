import type { VigilanceLevel, EtatPilotage } from "@/lib/types";

export function VigilanceBadge({ level }: { level: VigilanceLevel }) {
  const cls = {
    SIMPLIFIEE: "risk-badge-low",
    STANDARD: "risk-badge-medium",
    RENFORCEE: "risk-badge-high",
  }[level];
  const label = {
    SIMPLIFIEE: "Simplifiée",
    STANDARD: "Standard",
    RENFORCEE: "Renforcée",
  }[level];
  return <span className={cls}>{label}</span>;
}

export function PilotageBadge({ status }: { status: EtatPilotage | string }) {
  const dotCls = {
    "A JOUR": "status-dot-valid",
    "RETARD": "status-dot-late",
    "BIENTÔT": "status-dot-soon",
  }[status] ?? "status-dot-pending";

  return (
    <span className="flex items-center text-xs font-medium">
      <span className={`status-dot ${dotCls}`} />
      {status}
    </span>
  );
}

export function ScoreGauge({ score }: { score: number }) {
  const color = score <= 25 ? "bg-risk-low" : score < 60 ? "bg-risk-medium" : "bg-risk-high";
  const pct = Math.min(score, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold">{score}</span>
    </div>
  );
}
