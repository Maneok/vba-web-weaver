import type { VigilanceLevel, EtatPilotage } from "@/lib/types";

export function VigilanceBadge({ level }: { level: VigilanceLevel }) {
  const config = {
    SIMPLIFIEE: { cls: "risk-badge-low", label: "Simplifiee" },
    STANDARD: { cls: "risk-badge-medium", label: "Standard" },
    RENFORCEE: { cls: "risk-badge-high", label: "Renforcee" },
  }[level] ?? { cls: "risk-badge-medium", label: level };
  return <span className={config.cls}>{config.label}</span>;
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
  const pct = Math.min(score, 100);
  const color = score <= 25
    ? "bg-emerald-500"
    : score < 60
    ? "bg-amber-500"
    : "bg-red-500";
  const bgColor = score <= 25
    ? "bg-emerald-500/10"
    : score < 60
    ? "bg-amber-500/10"
    : "bg-red-500/10";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-16 h-1.5 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-slate-300">{score}</span>
    </div>
  );
}
