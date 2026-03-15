import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CreditCard, Users, AlertTriangle, TrendingUp, UserCheck, FolderOpen, Wrench, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  cabinet_id: string;
  cabinet_nom: string;
  plan: string;
  sub_status: string;
  created_at: string;
  admin_email?: string;
  seats_used: number;
  clients_used: number;
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
  return date.toLocaleDateString("fr-FR");
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  trialing: "bg-blue-500/20 text-blue-300",
  past_due: "bg-amber-500/20 text-amber-300",
  suspended: "bg-red-500/20 text-red-300",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  trialing: "Trial",
  past_due: "Impaye",
  suspended: "Suspendu",
  canceled: "Annule",
};

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [signups, setSignups] = useState<DailySignup[]>([]);
  const [recentCabinets, setRecentCabinets] = useState<RecentCabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch all data in parallel from real tables
      const [overviewRes, subsRes, profilesRes, clientsRes, maintenanceRes] = await Promise.all([
        // Recent cabinets from v_admin_overview (has correct field names)
        supabase.from("v_admin_overview").select("*").order("created_at", { ascending: false }).limit(5),
        // All subscriptions for stats
        supabase.from("cabinet_subscriptions").select("cabinet_id, plan, status, monthly_price_cents, trial_end"),
        // Active users count
        supabase.from("profiles").select("id, is_active", { count: "exact", head: true }).eq("is_active", true),
        // Total clients count
        supabase.from("clients").select("id", { count: "exact", head: true }),
        // Last maintenance
        supabase.from("backup_history").select("completed_at").order("completed_at", { ascending: false }).limit(1),
      ]);

      // Compute stats from real data
      const subs = (subsRes.data ?? []) as Array<{ cabinet_id: string; plan: string; status: string; monthly_price_cents: number | null; trial_end: string | null }>;
      const computedStats: AdminStats = {
        total_cabinets: subs.length,
        active_subscriptions: subs.filter((s) => s.status === "active").length,
        trialing: subs.filter((s) => s.status === "trialing").length,
        unpaid: subs.filter((s) => s.status === "past_due").length,
        mrr_cents: subs.filter((s) => s.status === "active").reduce((sum, s) => sum + (s.monthly_price_cents ?? 0), 0),
        active_users: profilesRes.count ?? 0,
        total_clients: clientsRes.count ?? 0,
        last_maintenance: (maintenanceRes.data?.[0] as { completed_at: string } | undefined)?.completed_at ?? null,
      };
      setStats(computedStats);

      // Recent cabinets from v_admin_overview
      if (overviewRes.data) {
        setRecentCabinets(overviewRes.data as unknown as RecentCabinet[]);
      }

      // Build signup chart data from cabinets created_at over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: allCabinets } = await supabase
        .from("cabinets")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (allCabinets) {
        const dayMap: Record<string, number> = {};
        // Init all 30 days
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          dayMap[key] = 0;
        }
        for (const cab of allCabinets) {
          const key = new Date((cab as { created_at: string }).created_at).toISOString().split("T")[0];
          if (dayMap[key] !== undefined) dayMap[key]++;
        }
        setSignups(Object.entries(dayMap).map(([day, count]) => ({ day, count })));
      }

      if (showRefresh) toast.success("Donnees actualisees");
    } catch (err) {
      console.error("[AdminOverview] Load error:", err);
      toast.error("Erreur lors du chargement des donnees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    { label: "Impayes", value: stats?.unpaid ?? 0, icon: AlertTriangle, color: stats?.unpaid ? "text-red-400" : "text-slate-400" },
    { label: "MRR", value: `${((stats?.mrr_cents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} \u20ac`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Utilisateurs actifs", value: stats?.active_users ?? 0, icon: Users, color: "text-violet-400" },
    { label: "Clients total", value: stats?.total_clients ?? 0, icon: FolderOpen, color: "text-amber-400" },
    { label: "Derniere maintenance", value: formatRelative(stats?.last_maintenance ?? null), icon: Wrench, color: "text-slate-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-slate-400">{kpi.label}</span>
              </div>
              <span className={`text-2xl font-bold ${kpi.color}`}>
                {kpi.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Signups Chart */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Inscriptions des 30 derniers jours</h3>
        {signups.length > 0 ? (
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
                labelFormatter={(val) => new Date(val).toLocaleDateString("fr-FR")}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Inscriptions" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">Aucune inscription sur cette periode</p>
        )}
      </div>

      {/* Recent Cabinets */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">5 derniers cabinets inscrits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                <th className="pb-2 pr-4">Nom du cabinet</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Users</th>
                <th className="pb-2 pr-4">Clients</th>
                <th className="pb-2">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {recentCabinets.map((cab) => (
                <tr key={cab.cabinet_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-slate-200 font-medium">{cab.cabinet_nom || "Sans nom"}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan || "-"}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[cab.sub_status] ?? "bg-slate-500/20 text-slate-300"}`}>
                      {statusLabels[cab.sub_status] ?? cab.sub_status ?? "-"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{cab.seats_used ?? 0}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{cab.clients_used ?? 0}</td>
                  <td className="py-2.5 text-slate-500">{formatRelative(cab.created_at)}</td>
                </tr>
              ))}
              {recentCabinets.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Aucun cabinet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
