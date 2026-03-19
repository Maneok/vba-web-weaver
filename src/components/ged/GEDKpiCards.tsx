import { FileText, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface GEDKpiCardsProps {
  totalDocs: number;
  expiringCount: number;
  expiredCount: number;
  completionRate: number;
}

const cards = [
  {
    key: "total",
    icon: FileText,
    color: "text-blue-500",
    glow: "kpi-glow-blue",
    label: "Total documents",
    field: "totalDocs" as const,
  },
  {
    key: "expiring",
    icon: Clock,
    color: "text-amber-500",
    glow: "kpi-glow-amber",
    label: "Expirent sous 30j",
    field: "expiringCount" as const,
  },
  {
    key: "expired",
    icon: AlertTriangle,
    color: "text-red-500",
    glow: "kpi-glow-red",
    label: "Expirés",
    field: "expiredCount" as const,
    pulseWhenPositive: true,
  },
  {
    key: "completion",
    icon: CheckCircle,
    color: "text-emerald-500",
    glow: "kpi-glow-green",
    label: "Complétude KYC",
    field: "completionRate" as const,
    suffix: "%",
  },
] as const;

export default function GEDKpiCards(props: GEDKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger-in">
      {cards.map((card) => {
        const value = props[card.field];
        const isMuted = value === 0;
        const shouldPulse = "pulseWhenPositive" in card && card.pulseWhenPositive && value > 0;

        return (
          <div
            key={card.key}
            className={`glass-card p-4 ${card.glow} ${isMuted ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${isMuted ? "text-muted-foreground" : card.color}`} />
              <div>
                <p
                  className={`text-2xl font-bold ${shouldPulse ? "animate-pulse-risk" : ""} ${
                    isMuted ? "text-muted-foreground" : ""
                  }`}
                >
                  {value}
                  {"suffix" in card ? card.suffix : ""}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
