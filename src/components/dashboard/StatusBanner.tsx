import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface StatusBannerProps {
  criticalCount: number;
  warningCount: number;
  isLoading?: boolean;
}

export default function StatusBanner({
  criticalCount,
  warningCount,
  isLoading = false,
}: StatusBannerProps) {
  if (isLoading) {
    return <div className="h-16 bg-card rounded-2xl border border-border animate-pulse" />;
  }

  const total = criticalCount + warningCount;
  const status = criticalCount > 0 ? "red" : warningCount > 0 ? "amber" : "green";

  const config = {
    green: {
      bg: "bg-emerald-500/[0.08] border-emerald-500/20",
      Icon: CheckCircle2,
      iconColor: "text-emerald-500",
      title: "Tout est en ordre",
      subtitle: "Aucune action requise — votre cabinet est conforme",
      badge: "Conforme",
      badgeClass: "bg-emerald-500/15 text-emerald-500",
    },
    amber: {
      bg: "bg-amber-500/[0.08] border-amber-500/20",
      Icon: AlertTriangle,
      iconColor: "text-amber-500",
      title: `${total} point${total > 1 ? "s" : ""} d'attention`,
      subtitle: "Des actions sont recommandées pour maintenir votre conformité",
      badge: "Attention",
      badgeClass: "bg-amber-500/15 text-amber-500",
    },
    red: {
      bg: "bg-red-500/[0.08] border-red-500/20",
      Icon: XCircle,
      iconColor: "text-red-500",
      title: `${criticalCount} action${criticalCount > 1 ? "s" : ""} urgente${criticalCount > 1 ? "s" : ""}`,
      subtitle: "Des dossiers nécessitent votre attention immédiate",
      badge: "Non conforme",
      badgeClass: "bg-red-500/15 text-red-500",
    },
  };

  const c = config[status];

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${c.bg} transition-all duration-500`}
      role="status"
      aria-label={`Statut du cabinet : ${c.title}`}
    >
      <c.Icon className={`w-7 h-7 ${c.iconColor} shrink-0`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">{c.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{c.subtitle}</p>
      </div>
      <span
        className={`text-[11px] font-semibold px-3 py-1 rounded-full shrink-0 hidden sm:inline-block ${c.badgeClass}`}
      >
        {c.badge}
      </span>
    </div>
  );
}
