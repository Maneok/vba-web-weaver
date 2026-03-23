import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDateFr } from "@/lib/dateUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Payment {
  id: string;
  created_at: string;
  cabinet_name: string;
  cabinet_id: string;
  amount: number;
  status: string;
  description: string;
  plan?: string;
}

interface MonthlyRevenue {
  month: string;
  solo: number;
  cabinet: number;
  enterprise: number;
}

const statusColors: Record<string, string> = {
  succeeded: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
  refunded: "bg-amber-500/20 text-amber-300",
  pending: "bg-blue-500/20 text-blue-300",
};

const statusLabels: Record<string, string> = {
  succeeded: "Reussi",
  failed: "Echoue",
  refunded: "Rembourse",
  pending: "En attente",
};

// 33. Period filter options
const PERIOD_OPTIONS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "12 mois" },
  { value: "all", label: "Tout" },
] as const;

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cabinetFilter, setCabinetFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30");
  const [planFilter, setPlanFilter] = useState("all");
  const [revenueChart, setRevenueChart] = useState<MonthlyRevenue[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [paymentsRes, revenueRes] = await Promise.all([
          supabase.rpc("admin_list_payments", { p_limit: 500 }),
          supabase.rpc("admin_revenue_by_month"),
        ]);
        if (paymentsRes.error) throw paymentsRes.error;
        setPayments((paymentsRes.data ?? []) as unknown as Payment[]);

        // 32. Revenue chart data
        if (revenueRes.data && Array.isArray(revenueRes.data)) {
          setRevenueChart(
            (revenueRes.data as { month: string; solo: number; cabinet: number; enterprise: number }[]).map((r) => ({
              month: new Date(r.month).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
              solo: (r.solo || 0) / 100,
              cabinet: (r.cabinet || 0) / 100,
              enterprise: (r.enterprise || 0) / 100,
            }))
          );
        }
      } catch (err) {
        console.error("[AdminPayments] Load error:", err);
        toast.error("Erreur lors du chargement des paiements");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cabinets = useMemo(() => {
    const names = new Set(payments.map((p) => p.cabinet_name).filter(Boolean));
    return Array.from(names).sort();
  }, [payments]);

  // 33. Filter by period, status, cabinet, plan
  const filtered = useMemo(() => {
    const now = Date.now();
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (cabinetFilter !== "all" && p.cabinet_name !== cabinetFilter) return false;
      if (planFilter !== "all" && p.plan !== planFilter) return false;
      if (periodFilter !== "all") {
        const days = parseInt(periodFilter);
        const diff = (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (diff > days) return false;
      }
      return true;
    });
  }, [payments, statusFilter, cabinetFilter, periodFilter, planFilter]);

  const total = useMemo(() => {
    return filtered
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 32. Revenue chart */}
      {revenueChart.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Revenus mensuels par plan (12 mois)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" }}
                formatter={(val: number) => [`${val.toLocaleString("fr-FR")} €`]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span className="text-slate-400 capitalize">{value}</span>}
              />
              <Bar dataKey="solo" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} name="Solo" />
              <Bar dataKey="cabinet" stackId="a" fill="#a78bfa" radius={[0, 0, 0, 0]} name="Cabinet" />
              <Bar dataKey="enterprise" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} name="Enterprise" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 33. Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "Tous" },
            { value: "succeeded", label: "Reussi" },
            { value: "failed", label: "Echoue" },
            { value: "refunded", label: "Rembourse" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-white/5 text-slate-400 dark:text-slate-500 dark:text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Plan filter */}
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
        >
          <option value="all">Tous les plans</option>
          <option value="solo">Solo</option>
          <option value="cabinet">Cabinet</option>
          <option value="enterprise">Enterprise</option>
        </select>

        {/* Cabinet filter */}
        <select
          value={cabinetFilter}
          onChange={(e) => setCabinetFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
        >
          <option value="all">Tous les cabinets</option>
          {cabinets.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-white/10">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cabinet</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white dark:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {formatDateFr(p.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{p.cabinet_name}</td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                    {(p.amount / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} &euro;
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[p.status] ?? "bg-slate-500/20 text-slate-700 dark:text-slate-300"}`}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 dark:text-slate-400 truncate max-w-[250px]">{p.description || "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Aucun paiement trouve</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="border-t border-white/10 px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{filtered.length} paiement(s)</span>
          <span className="text-sm font-semibold text-emerald-400">
            Total : {(total / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} &euro;
          </span>
        </div>
      </div>
    </div>
  );
}
