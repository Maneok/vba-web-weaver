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
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4 lg:gap-5 mb-8 animate-stagger-in print:grid-cols-3 print:gap-2"
      role="region"
      aria-label="Indicateurs clés de performance"
    >
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
        ariaLabel={`Clients actifs : ${stats.totalClients}. Cliquez pour voir la base clients.`}
      />
      <KPICard
        icon={BarChart3}
        title="Score moyen"
        value={stats.avgScore}
        color={scoreColor}
        sparklineData={sparklines.avgScore}
        onClick={() => navigate("/diagnostic")}
        loading={isLoading}
        ariaLabel={`Score de risque moyen : ${stats.avgScore} sur 120. Cliquez pour le diagnostic.`}
      />
      <KPICard
        icon={ShieldCheck}
        title="Taux conformité"
        value={`${stats.tauxConformite}%`}
        color={conformiteColor}
        sparklineData={sparklines.tauxConformite}
        onClick={() => navigate("/controle-qualite")}
        loading={isLoading}
        ariaLabel={`Taux de conformité : ${stats.tauxConformite}%. Cliquez pour le contrôle qualité.`}
      />
      <KPICard
        icon={AlertTriangle}
        title="Alertes en cours"
        value={stats.alertesEnCours}
        color="#f59e0b"
        onClick={() => navigate("/registre")}
        sparklineData={sparklines.alertesEnCours}
        loading={isLoading}
        ariaLabel={`${stats.alertesEnCours} alerte${stats.alertesEnCours > 1 ? "s" : ""} en cours. Cliquez pour le registre.`}
      />
      <KPICard
        icon={Clock}
        title="Revues échues"
        value={stats.revuesEchues}
        color={stats.revuesEchues > 0 ? "#ef4444" : "#22c55e"}
        onClick={() => navigate("/bdd?filter=echues")}
        sparklineData={sparklines.revuesEchues}
        loading={isLoading}
        ariaLabel={`${stats.revuesEchues} revue${stats.revuesEchues > 1 ? "s" : ""} échue${stats.revuesEchues > 1 ? "s" : ""}. Cliquez pour filtrer.`}
      />
      <KPICard
        icon={Euro}
        title="CA prévisionnel"
        value={`${(stats.caPrevisionnel / 1000).toFixed(0)}k\u20AC`}
        color="#3b82f6"
        sparklineData={sparklines.caPrevisionnel}
        loading={isLoading}
        ariaLabel={`Chiffre d'affaires prévisionnel : ${(stats.caPrevisionnel / 1000).toFixed(0)}k euros.`}
      />
    </div>
  );
}
