import React from "react";
import { Shield, CheckCircle2, AlertTriangle, X, Loader2, WifiOff } from "lucide-react";
import type { VigilanceLevel, EtatPilotage } from "@/lib/types";

export const VigilanceBadge = React.memo(function VigilanceBadge({ level }: { level: VigilanceLevel }) {
  const config = {
    SIMPLIFIEE: { cls: "risk-badge-low", label: "Simplifiee", borderCls: "border border-emerald-500/30" },
    STANDARD: { cls: "risk-badge-medium", label: "Standard", borderCls: "border border-amber-500/30" },
    RENFORCEE: { cls: "risk-badge-high", label: "Renforcee", borderCls: "border border-red-500/30" },
  }[level] ?? { cls: "risk-badge-medium", label: level, borderCls: "border border-amber-500/30" };
  return (
    <span className={`${config.cls} ${config.borderCls} inline-flex items-center gap-1.5 h-6`} aria-label={`Niveau de vigilance : ${config.label}`}>
      <Shield className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
});

export const PilotageBadge = React.memo(function PilotageBadge({ status }: { status: EtatPilotage | string }) {
  const dotCls = {
    "A JOUR": "status-dot-valid",
    "RETARD": "status-dot-late",
    "BIENTÔT": "status-dot-soon",
  }[status] ?? "status-dot-pending";

  return (
    <span className="flex items-center text-xs font-medium" aria-label={`Etat de pilotage : ${status}`}>
      <span className={`status-dot ${dotCls}`} />
      {status}
    </span>
  );
});

export const ScoreGauge = React.memo(function ScoreGauge({ score, showLabel }: { score: number; showLabel?: boolean }) {
  const pct = Math.min(score, 100);
  const vigilance = score <= 25 ? "SIMPLIFIEE" : score < 60 ? "STANDARD" : "RENFORCEE";

  // B1: Color config
  const colorConfig = score <= 25
    ? { fill: "#10b981", track: "rgba(16,185,129,0.15)", text: "text-emerald-400", stroke: "#10b981" }
    : score < 60
    ? { fill: "#f59e0b", track: "rgba(245,158,11,0.15)", text: "text-amber-400", stroke: "#f59e0b" }
    : { fill: "#ef4444", track: "rgba(239,68,68,0.15)", text: "text-red-400", stroke: "#ef4444" };

  // B1: SVG circle gauge
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1" aria-label={`Score de risque : ${score} sur 100`}>
      <div className="relative w-[72px] h-[72px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          {/* Track */}
          <circle cx="36" cy="36" r={radius} fill="none" stroke={colorConfig.track} strokeWidth="5" />
          {/* Progress */}
          <circle
            cx="36" cy="36" r={radius} fill="none"
            stroke={colorConfig.stroke}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold font-mono tabular-nums ${colorConfig.text}`}>{score}</span>
        </div>
      </div>
      {showLabel && (
        <span className={`text-[10px] font-medium ${colorConfig.text} uppercase tracking-wider`}>
          Vigilance {vigilance === "SIMPLIFIEE" ? "simplifiee" : vigilance === "STANDARD" ? "standard" : "renforcee"}
        </span>
      )}
    </div>
  );
});

// B3: ScreeningBadge component
export const ScreeningBadge = React.memo(function ScreeningBadge({ status }: { status: "clean" | "alert" | "loading" | "error" | "unavailable" }) {
  const config = {
    clean: { icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", label: "OK" },
    alert: { icon: AlertTriangle, color: "bg-red-500/15 text-red-400 border-red-500/20 animate-pulse", label: "Alerte" },
    loading: { icon: Loader2, color: "bg-blue-500/15 text-blue-400 border-blue-500/20", label: "..." },
    error: { icon: X, color: "bg-red-500/15 text-red-400 border-red-500/20", label: "Erreur" },
    unavailable: { icon: WifiOff, color: "bg-slate-500/15 text-slate-400 border-slate-500/20", label: "N/A" },
  }[status];

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${config.color}`}>
      <Icon className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
});

// B4: MalusDetail component
export const MalusDetail = React.memo(function MalusDetail({ items }: { items: Array<{ label: string; value: number; source: string }> }) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 text-xs">
          <span className="text-slate-300 w-24 shrink-0 truncate">{item.label}</span>
          <span className="text-red-400 font-mono tabular-nums w-10 text-right shrink-0">+{item.value}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500/60 transition-all duration-500 ease-out"
              style={{ width: `${(item.value / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-slate-600 text-[10px] w-24 shrink-0 truncate text-right">{item.source}</span>
        </div>
      ))}
    </div>
  );
});
