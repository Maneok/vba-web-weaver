import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CreditCard, Users, AlertTriangle, TrendingUp, UserCheck, FolderOpen, Wrench, BarChart3, Percent, UserMinus } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateFr } from "@/lib/dateUtils";

interface AdminStats {
  total_cabinets: number;
  active_subscriptions: number;
  trialing: number;
  unpaid: number;
  mrr_cents: number;
  active_users: number;
  total_clients: number;
  last_maintenance: string | null;
}

interface DailySignup {
  day: string;
  count: number;
}

interface RecentCabinet {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  admin_email: string;
}

interface MrrPoint {
  month: string;
  mrr: number;
}

interface TopCabinet {
  name: string;
  total_clients: number;
}

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "A l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes}min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 30) return `il y a ${diffDays}j`;
  return formatDateFr(dateStr, "short");
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  trialing: "bg-blue-500/20 text-blue-300",
  past_due: "bg-amber-500/20 text-amber-300",
  suspended: "bg-red-500/20 text-red-300",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [signups, setSignups] = useState<DailySignup[]>([]);
  const [recentCabinets, setRecentCabinets] = useState<RecentCabinet[]>([]);
  const [loading, setLoading] = useState(true);

  // New states for features 18-23
  const [mrrHistory, setMrrHistory] = useState<MrrPoint[]>([]);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [churnRate, setChurnRate] = useState<number | null>(null);
  const [topCabinets, setTopCabinets] = useState<TopCabinet[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsRes, signupsRes, cabinetsRes] = await Promise.all([
          supabase.rpc("get_grimy_admin_stats"),
          supabase.rpc("admin_stats_by_period", { p_days: 30 }),
          supabase.from("v_admin_dashboard").select("*").order("created_at", { ascending: false }).limit(5),
        ]);

        if (statsRes.data) setStats(statsRes.data as unknown as AdminStats);
        if (signupsRes.data) setSignups(signupsRes.data as unknown as DailySignup[]);
        if (cabinetsRes.data) setRecentCabinets(cabinetsRes.data as unknown as RecentCabinet[]);

        // 18. MRR Evolution — fetch from RPC or compute
        const mrrRes = await supabase.rpc("admin_mrr_history");
        if (mrrRes.data && Array.isArray(mrrRes.data)) {
          setMrrHistory(
            (mrrRes.data as { month: string; mrr_cents: number }[]).map((r) => ({
              month: new Date(r.month).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
              mrr: r.mrr_cents / 100,
            }))
          );
        }

        // 19. Trial conversion rate
        const convRes = await supabase.rpc("admin_trial_conversion_rate");
        if (convRes.data != null) {
          const val = typeof convRes.data === "number" ? convRes.data : (convRes.data as { rate: number })?.rate;
          if (val != null) setConversionRate(Math.round(val * 100) / 100);
        }

        // 20. Churn rate
        const churnRes = await supabase.rpc("admin_churn_rate");
        if (churnRes.data != null) {
          const val = typeof churnRes.data === "number" ? churnRes.data : (churnRes.data as { rate: number })?.rate;
          if (val != null) setChurnRate(Math.round(val * 100) / 100);
        }

        // 21. Top 5 cabinets by clients
        const topRes = await supabase
          .from("v_admin_dashboard")
          .select("name, total_clients")
          .order("total_clients", { ascending: false })
          .limit(5);
        if (topRes.data) {
          setTopCabinets(topRes.data as unknown as TopCabinet[]);
        }

        // 22. Activity heatmap from login_history (30 days)
        const heatRes = await supabase.rpc("admin_login_heatmap");
        if (heatRes.data && Array.isArray(heatRes.data)) {
          setHeatmapData(heatRes.data as HeatmapCell[]);
        }

        // 23. Dashboard alerts
        const alertsList: string[] = [];
        const s = statsRes.data as unknown as AdminStats | null;
        if (s && s.unpaid > 0) alertsList.push(`${s.unpaid} cabinet(s) en impaye`);

        // Check Edge Functions status
        const healthRes = await supabase
          .from("health_checks")
          .select("service, status")
          .eq("status", "down")
          .order("checked_at", { ascending: false })
          .limit(5);
        if (healthRes.data && healthRes.data.length > 0) {
          const services = [...new Set(healthRes.data.map((h) => String((h as Record<string, unknown>).service)))];
          alertsList.push(`Edge Functions down: ${services.join(", ")}`);
        }

        // Check trials expiring within 48h
        const expiringRes = await supabase
          .from("v_admin_dashboard")
          .select("name, trial_days_remaining")
          .eq("subscription_status", "trialing")
          .lte("trial_days_remaining", 2)
          .gt("trial_days_remaining", 0);
        if (expiringRes.data && expiringRes.data.length > 0) {
          alertsList.push(`${expiringRes.data.length} trial(s) expirant dans 48h`);
        }

        setAlerts(alertsList);
      } catch (err) {
        console.error("[AdminOverview] Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Heatmap max value for color scaling
  const heatmapMax = useMemo(() => Math.max(1, ...heatmapData.map((h) => h.count)), [heatmapData]);

  // Build heatmap grid: 7 days x 24 hours
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const cell of heatmapData) {
      if (cell.day >= 0 && cell.day < 7 && cell.hour >= 0 && cell.hour < 24) {
        grid[cell.day][cell.hour] = cell.count;
      }
    }
    return grid;
  }, [heatmapData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const kpis = [
    { label: "Total cabinets", value: stats?.total_cabinets ?? 0, icon: Building2, color: "text-blue-400" },
    { label: "Abonnements actifs", value: stats?.active_subscriptions ?? 0, icon: CreditCard, color: "text-emerald-400" },
    { label: "En trial", value: stats?.trialing ?? 0, icon: UserCheck, color: "text-sky-400" },
    { label: "Impayes", value: stats?.unpaid ?? 0, icon: AlertTriangle, color: "text-red-400" },
    { label: "MRR", value: `${((stats?.mrr_cents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} \u20ac`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Utilisateurs actifs", value: stats?.active_users ?? 0, icon: Users, color: "text-violet-400" },
    { label: "Clients total", value: stats?.total_clients ?? 0, icon: FolderOpen, color: "text-amber-400" },
    { label: "Derniere maintenance", value: formatRelative(stats?.last_maintenance ?? null), icon: Wrench, color: "text-slate-400 dark:text-slate-500 dark:text-slate-400", isText: true },
  ];

  return (
    <div className="space-y-6">
      {/* 23. Alert banner */}
      {alerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <span key={i} className="text-sm text-red-300 font-medium">
                {a}{i < alerts.length - 1 ? " •" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{kpi.label}</span>
              </div>
              <span className={`text-2xl font-bold ${kpi.color}`}>
                {kpi.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* 19 & 20. Conversion + Churn cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Taux de conversion trial</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">
            {conversionRate != null ? `${conversionRate}%` : "—"}
          </span>
          <span className="text-[10px] text-slate-600">Trials convertis en abonnement payant</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-red-400" />
            <span className="text-xs text-slate-400">Taux de churn mensuel</span>
          </div>
          <span className="text-2xl font-bold text-red-400">
            {churnRate != null ? `${churnRate}%` : "—"}
          </span>
          <span className="text-[10px] text-slate-600">Desabonnements / actifs debut de mois</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-slate-400">MRR actuel</span>
          </div>
          <span className="text-2xl font-bold text-blue-400">
            {((stats?.mrr_cents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
          </span>
          <span className="text-[10px] text-slate-600">Revenu mensuel recurrent</span>
        </div>
      </div>

      {/* 18. MRR Evolution Chart */}
      {mrrHistory.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Evolution MRR (12 mois)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mrrHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" }}
                formatter={(val: number) => [`${val.toLocaleString("fr-FR")} €`, "MRR"]}
              />
              <Line type="monotone" dataKey="mrr" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 3 }} name="MRR" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Signups Chart */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Inscriptions des 30 derniers jours</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={signups}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" }}
              labelFormatter={(val) => formatDateFr(val)}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Inscriptions" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 21. Top 5 cabinets + 22. Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 cabinets by clients */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Top 5 cabinets par clients</h3>
          <div className="space-y-3">
            {topCabinets.map((cab, i) => {
              const maxClients = topCabinets[0]?.total_clients || 1;
              const pct = Math.round((cab.total_clients / maxClients) * 100);
              const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-cyan-500"];
              return (
                <div key={cab.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate max-w-[200px]">{cab.name}</span>
                    <span className="text-slate-400 font-medium">{cab.total_clients}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {topCabinets.length === 0 && (
              <p className="text-sm text-slate-600 text-center py-4">Aucune donnee</p>
            )}
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Activite par jour/heure (30j)</h3>
          {heatmapData.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="inline-block">
                {/* Hour labels */}
                <div className="flex ml-10 mb-1">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <span
                      key={h}
                      className="text-[9px] text-slate-600"
                      style={{ width: `${(24 / 8) * 16}px`, textAlign: "left" }}
                    >
                      {h}h
                    </span>
                  ))}
                </div>
                {/* Grid rows */}
                {heatmapGrid.map((row, dayIdx) => (
                  <div key={dayIdx} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-slate-500 w-8 text-right mr-1">{DAY_LABELS[dayIdx]}</span>
                    {row.map((count, hourIdx) => {
                      const intensity = count / heatmapMax;
                      const bg = count === 0
                        ? "bg-white/[0.03]"
                        : intensity < 0.25 ? "bg-blue-500/20"
                        : intensity < 0.5 ? "bg-blue-500/40"
                        : intensity < 0.75 ? "bg-blue-500/60"
                        : "bg-blue-500/80";
                      return (
                        <div
                          key={hourIdx}
                          className={`w-3 h-3 rounded-sm ${bg} transition-colors`}
                          title={`${DAY_LABELS[dayIdx]} ${hourIdx}h: ${count} connexion(s)`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 text-center py-8">Aucune donnee de connexion</p>
          )}
        </div>
      </div>

      {/* Recent Cabinets */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">5 derniers cabinets inscrits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-white/10">
                <th className="pb-2 pr-4">Nom</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Admin</th>
                <th className="pb-2">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {recentCabinets.map((cab) => (
                <tr key={cab.id} className="border-b border-white/5 hover:bg-white dark:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-slate-800 dark:text-slate-200 font-medium">{cab.name}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[cab.status] ?? "bg-slate-500/20 text-slate-700 dark:text-slate-300"}`}>
                      {cab.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400 dark:text-slate-500 dark:text-slate-400">{cab.admin_email}</td>
                  <td className="py-2.5 text-slate-400 dark:text-slate-500">{formatRelative(cab.created_at)}</td>
                </tr>
              ))}
              {recentCabinets.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">Aucun cabinet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
