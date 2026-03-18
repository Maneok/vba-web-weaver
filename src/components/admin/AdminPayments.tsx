import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Payment {
  id: string;
  created_at: string;
  cabinet_name: string;
  cabinet_id: string;
  amount: number;
  status: string;
  description: string;
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

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cabinetFilter, setCabinetFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("admin_list_payments", { p_limit: 100 });
        if (error) throw error;
        setPayments((data ?? []) as unknown as Payment[]);
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

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (cabinetFilter !== "all" && p.cabinet_name !== cabinetFilter) return false;
      return true;
    });
  }, [payments, statusFilter, cabinetFilter]);

  const total = useMemo(() => {
    return filtered
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-4">
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
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
                    {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
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
