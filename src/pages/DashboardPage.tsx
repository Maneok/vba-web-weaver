import { useAppState } from "@/lib/AppContext";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, AreaChart, Area,
} from "recharts";
import { Shield, AlertTriangle, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const COLORS_VIG: Record<string, string> = {
  SIMPLIFIEE: "#22c55e",
  STANDARD: "#f59e0b",
  RENFORCEE: "#ef4444",
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(217, 33%, 17%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
};

export default function DashboardPage() {
  const { clients, collaborateurs, alertes } = useAppState();

  const totalClients = clients.length;
  const safeTotal = totalClients || 1;

  const vigCounts = clients.reduce((acc, c) => {
    acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const vigData = Object.entries(vigCounts).map(([name, value]) => ({ name, value }));

  const avgScores = [
    { subject: "Activite", score: Math.round(clients.reduce((s, c) => s + c.scoreActivite, 0) / safeTotal), fullMark: 100 },
    { subject: "Pays", score: Math.round(clients.reduce((s, c) => s + c.scorePays, 0) / safeTotal), fullMark: 100 },
    { subject: "Mission", score: Math.round(clients.reduce((s, c) => s + c.scoreMission, 0) / safeTotal), fullMark: 100 },
    { subject: "Maturite", score: Math.round(clients.reduce((s, c) => s + c.scoreMaturite, 0) / safeTotal), fullMark: 100 },
    { subject: "Structure", score: Math.round(clients.reduce((s, c) => s + c.scoreStructure, 0) / safeTotal), fullMark: 100 },
  ];

  const scoreGlobalMoyen = Math.round(clients.reduce((s, c) => s + c.scoreGlobal, 0) / safeTotal);

  const comptableData = Object.entries(
    clients.reduce((acc, c) => {
      acc[c.comptable] = (acc[c.comptable] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, clients]) => ({ name, clients }));

  const retardCount = clients.filter(c => c.etatPilotage === "RETARD").length;
  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS").length;
  const formationOk = collaborateurs.filter(c => c.statutFormation.includes("A JOUR")).length;
  const tauxConformite = Math.round((formationOk / (collaborateurs.length || 1)) * 100);

  // Score distribution for area chart
  const scoreRanges = [
    { range: "0-20", count: clients.filter(c => c.scoreGlobal <= 20).length },
    { range: "21-40", count: clients.filter(c => c.scoreGlobal > 20 && c.scoreGlobal <= 40).length },
    { range: "41-60", count: clients.filter(c => c.scoreGlobal > 40 && c.scoreGlobal <= 60).length },
    { range: "61-80", count: clients.filter(c => c.scoreGlobal > 60 && c.scoreGlobal <= 80).length },
    { range: "81-100", count: clients.filter(c => c.scoreGlobal > 80).length },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Clients actifs"
          value={totalClients}
          icon={Users}
          trend={`${vigCounts["SIMPLIFIEE"] || 0} simplifiees`}
          trendUp={true}
          glowClass="kpi-glow-blue"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
          delay={0}
        />
        <KpiCard
          label="Score cabinet moyen"
          value={scoreGlobalMoyen}
          suffix="/100"
          icon={TrendingUp}
          trend={`${tauxConformite}% conformite`}
          trendUp={tauxConformite > 50}
          glowClass="kpi-glow-amber"
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
          delay={1}
        />
        <KpiCard
          label="Dossiers en retard"
          value={retardCount}
          icon={AlertTriangle}
          trend={`sur ${totalClients} dossiers`}
          trendUp={false}
          glowClass="kpi-glow-red"
          iconBg="bg-red-500/10"
          iconColor="text-red-400"
          delay={2}
        />
        <KpiCard
          label="Alertes en cours"
          value={alertesEnCours}
          icon={Shield}
          trend={`${alertes.length} total`}
          trendUp={alertesEnCours === 0}
          glowClass="kpi-glow-green"
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
          delay={3}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vigilance donut */}
        <div className="glass-card p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Repartition par Vigilance</h3>
          <p className="text-[11px] text-slate-500 mb-4">{totalClients} dossiers analyses</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={vigData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {vigData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS_VIG[entry.name] || "#64748b"} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {vigData.map(entry => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_VIG[entry.name] || "#64748b" }} />
                <span className="text-[11px] text-slate-400">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Radar chart */}
        <div className="glass-card p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Profil de Risque Moyen</h3>
          <p className="text-[11px] text-slate-500 mb-4">Score moyen par critere d'evaluation</p>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={avgScores} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution area chart */}
        <div className="glass-card p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Distribution des Scores</h3>
          <p className="text-[11px] text-slate-500 mb-4">Repartition des clients par tranche</p>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={scoreRanges}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                fill="url(#colorScore)"
                strokeWidth={2}
                name="Clients"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comptable bar chart */}
        <div className="glass-card p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Charge par Comptable</h3>
          <p className="text-[11px] text-slate-500 mb-4">Nombre de dossiers par collaborateur</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comptableData} barSize={32}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar
                dataKey="clients"
                name="Dossiers"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick stats */}
        <div className="glass-card p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Indicateurs cles</h3>
          <p className="text-[11px] text-slate-500 mb-5">Vue synthetique du dispositif</p>
          <div className="space-y-4">
            <StatBar label="Dossiers a jour" value={clients.filter(c => c.etatPilotage === "A JOUR").length} max={totalClients} color="bg-emerald-500" />
            <StatBar label="Vigilance renforcee" value={vigCounts["RENFORCEE"] || 0} max={totalClients} color="bg-red-500" />
            <StatBar label="Formations a jour" value={formationOk} max={collaborateurs.length} color="bg-blue-500" />
            <StatBar label="Alertes traitees" value={alertes.filter(a => a.statut === "CLÔTURÉ").length} max={alertes.length} color="bg-amber-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, suffix, icon: Icon, trend, trendUp, glowClass, iconBg, iconColor, delay,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: string;
  trendUp: boolean;
  glowClass: string;
  iconBg: string;
  iconColor: string;
  delay: number;
}) {
  const delayClass = `animate-fade-in-up-delay-${delay + 1}`;
  return (
    <div className={`glass-card p-5 ${glowClass} ${delayClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-medium ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-3xl font-bold text-white animate-count-up">
        {value}
        {suffix && <span className="text-base font-normal text-slate-500 ml-1">{suffix}</span>}
      </p>
      <p className="text-[12px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-slate-400">{label}</span>
        <span className="text-[12px] font-mono font-semibold text-slate-300">{value}/{max} <span className="text-slate-500">({pct}%)</span></span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
