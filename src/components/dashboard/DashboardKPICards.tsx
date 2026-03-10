import { useNavigate } from "react-router-dom";
import { Users, BarChart3, ShieldCheck, AlertTriangle, Clock, Euro } from "lucide-react";
import { KPICard } from "./KPICard";

interface DashboardKPICardsProps {
  stats: {
    totalClients: number;
    avgScore: number;
    tauxConformite: number;
    alertesEnCours: number;
    revuesEchues: number;
    caPrevisionnel: number;
  };
  sparklines: Record<string, { v: number }[]>;
  isLoading: boolean;
}

export function DashboardKPICards({ stats, sparklines, isLoading }: DashboardKPICardsProps) {
  const navigate = useNavigate();

  const scoreColor = stats.avgScore <= 30 ? "#22c55e" : stats.avgScore <= 55 ? "#f59e0b" : "#ef4444";
  const conformiteColor = stats.tauxConformite >= 80 ? "#22c55e" : stats.tauxConformite >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 lg:gap-5 mb-8 animate-stagger-in" role="region" aria-label="Indicateurs cles de performance">
      <KPICard
        icon={Users}
        title="Clients actifs"
        value={stats.totalClients}
        color="#3b82f6"
        trendPercent={12}
        trendUp
        sparklineData={sparklines.totalClients}
        onClick={() => navigate("/bdd")}
        loading={isLoading}
      />
      <KPICard
        icon={BarChart3}
        title="Score moyen"
        value={stats.avgScore}
        color={scoreColor}
        sparklineData={sparklines.avgScore}
        onClick={() => navigate("/diagnostic")}
        loading={isLoading}
      />
      <KPICard
        icon={ShieldCheck}
        title="Taux conformite"
        value={`${stats.tauxConformite}%`}
        color={conformiteColor}
        sparklineData={sparklines.tauxConformite}
        onClick={() => navigate("/controle-qualite")}
        loading={isLoading}
      />
      <KPICard
        icon={AlertTriangle}
        title="Alertes en cours"
        value={stats.alertesEnCours}
        color="#f59e0b"
        onClick={() => navigate("/registre")}
        sparklineData={sparklines.alertesEnCours}
        loading={isLoading}
      />
      <KPICard
        icon={Clock}
        title="Revues echues"
        value={stats.revuesEchues}
        color={stats.revuesEchues > 0 ? "#ef4444" : "#22c55e"}
        onClick={() => navigate("/bdd?filter=echues")}
        sparklineData={sparklines.revuesEchues}
        loading={isLoading}
      />
      <KPICard
        icon={Euro}
        title="CA previsionnel"
        value={`${(stats.caPrevisionnel / 1000).toFixed(0)}k\u20AC`}
        color="#3b82f6"
        sparklineData={sparklines.caPrevisionnel}
        loading={isLoading}
      />
    </div>
  );
}
