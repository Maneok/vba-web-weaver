import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, PauseCircle, PlayCircle, DollarSign, Clock, MessageSquare } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface UnpaidCabinet {
  cabinet_id: string;
  cabinet_name: string;
  admin_email: string;
  plan: string;
  subscription_status: string;
  days_overdue: number;
  monthly_amount: number;
}

interface Relance {
  cabinet_id: string;
  note: string;
  created_at: string;
}

export default function AdminUnpaid() {
  const [unpaid, setUnpaid] = useState<UnpaidCabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspendDialog, setSuspendDialog] = useState<string | null>(null);
  const [relances, setRelances] = useState<Record<string, Relance[]>>({});
  const [expandedRelance, setExpandedRelance] = useState<string | null>(null);

  useEffect(() => {
    loadUnpaid();
  }, []);

  async function loadUnpaid() {
    setLoading(true);
    try {
      const [unpaidRes, relancesRes] = await Promise.all([
        supabase.rpc("admin_list_unpaid"),
        supabase
          .from("admin_notes")
          .select("cabinet_id, note, created_at")
          .eq("type", "relance")
          .order("created_at", { ascending: false }),
      ]);
      if (unpaidRes.error) throw unpaidRes.error;
      setUnpaid((unpaidRes.data ?? []) as unknown as UnpaidCabinet[]);

      // Group relances by cabinet_id
      if (relancesRes.data) {
        const map: Record<string, Relance[]> = {};
        for (const r of relancesRes.data as unknown as Relance[]) {
          if (!map[r.cabinet_id]) map[r.cabinet_id] = [];
          map[r.cabinet_id].push(r);
        }
        setRelances(map);
      }
    } catch (err) {
      console.error("[AdminUnpaid] Load error:", err);
      toast.error("Erreur lors du chargement des impayes");
    } finally {
      setLoading(false);
    }
  }

  // 30. Check if relance sent today
  function wasRelancedToday(cabinetId: string): boolean {
    const list = relances[cabinetId];
    if (!list?.length) return false;
    const today = new Date().toISOString().split("T")[0];
    return list.some((r) => r.created_at?.startsWith(today));
  }

  async function sendRelance(cab: UnpaidCabinet) {
    if (wasRelancedToday(cab.cabinet_id)) {
      toast.warning("Une relance a deja ete envoyee aujourd'hui pour ce cabinet");
      return;
    }

    // Log the relance
    try {
      await supabase.rpc("admin_add_note", {
        p_cabinet_id: cab.cabinet_id,
        p_note: `Relance paiement envoyee - ${cab.days_overdue}j de retard - ${(cab.monthly_amount / 100).toFixed(2)}€`,
        p_type: "relance",
      });
    } catch {
      // Non-blocking — the RPC may not support p_type, fallback silently
    }

    const subject = encodeURIComponent(`[GRIMY] Relance paiement - ${cab.cabinet_name}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nNous constatons que le paiement de votre abonnement GRIMY (plan ${cab.plan}) est en retard de ${cab.days_overdue} jour(s).\n\nMontant du : ${(cab.monthly_amount / 100).toFixed(2)} \u20ac\n\nMerci de regulariser votre situation dans les plus brefs delais.\n\nCordialement,\nL'equipe GRIMY`
    );
    window.open(`mailto:${cab.admin_email}?subject=${subject}&body=${body}`, "_blank");
    toast.success("Relance ouverte dans le client mail");
    loadUnpaid();
  }

  async function handleSuspend(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("admin_suspend", { p_cabinet_id: cabinetId });
      if (error) throw error;
      toast.success("Cabinet suspendu");
      setSuspendDialog(null);
      loadUnpaid();
    } catch (err) {
      toast.error("Erreur lors de la suspension");
    }
  }

  async function handleReactivate(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("admin_reactivate", { p_cabinet_id: cabinetId, p_plan: "solo" });
      if (error) throw error;
      toast.success("Cabinet reactive");
      loadUnpaid();
    } catch (err) {
      toast.error("Erreur lors de la reactivation");
    }
  }

  // 31. Total amount unpaid
  const totalUnpaid = useMemo(() => {
    return unpaid.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
  }, [unpaid]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  // 29. Delay bar color helper
  function getDelayBar(days: number) {
    const maxDays = 30;
    const pct = Math.min(100, (days / maxDays) * 100);
    let colorClass = "bg-amber-500";
    let animate = "";
    if (days > 15) {
      colorClass = "bg-red-500";
      animate = "animate-pulse";
    } else if (days > 7) {
      colorClass = "bg-red-500";
    }
    return { pct, colorClass, animate };
  }

  return (
    <div className="space-y-4">
      {/* 31. Total unpaid card */}
      {unpaid.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 bg-red-500/20 rounded-lg">
            <DollarSign className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Montant total impaye</p>
            <p className="text-2xl font-bold text-red-400">
              {(totalUnpaid / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-red-400">{unpaid.length}</p>
            <p className="text-sm text-slate-500">cabinet(s)</p>
          </div>
        </div>
      )}

      {unpaid.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">Aucun impaye en cours</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3">Cabinet</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Jours de retard</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((cab) => {
                  const delay = getDelayBar(cab.days_overdue);
                  const cabRelances = relances[cab.cabinet_id] || [];
                  const relancedToday = wasRelancedToday(cab.cabinet_id);
                  return (
                    <tr key={cab.cabinet_id} className="border-b border-white/5 hover:bg-white dark:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{cab.cabinet_name}</span>
                        {/* 30. Relance history toggle */}
                        {cabRelances.length > 0 && (
                          <button
                            onClick={() => setExpandedRelance(expandedRelance === cab.cabinet_id ? null : cab.cabinet_id)}
                            className="ml-2 text-[10px] text-blue-400 hover:text-blue-300"
                            title="Voir les relances"
                          >
                            <MessageSquare className="h-3 w-3 inline" /> {cabRelances.length}
                          </button>
                        )}
                        {expandedRelance === cab.cabinet_id && cabRelances.length > 0 && (
                          <div className="mt-2 space-y-1 pl-2 border-l-2 border-blue-500/30">
                            {cabRelances.slice(0, 5).map((r, i) => (
                              <div key={i} className="text-[11px] text-slate-500">
                                <Clock className="h-2.5 w-2.5 inline mr-1" />
                                {new Date(r.created_at).toLocaleDateString("fr-FR")} — {r.note?.slice(0, 60)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${cab.admin_email}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                          {cab.admin_email}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300">
                          {cab.subscription_status === "past_due" ? "Impaye" : cab.subscription_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/* 29. Visual delay bar */}
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${cab.days_overdue > 7 ? "text-red-400" : "text-amber-400"}`}>
                            {cab.days_overdue}j
                          </span>
                          <div className="w-20 h-2 rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full ${delay.colorClass} ${delay.animate} transition-all duration-300`}
                              style={{ width: `${delay.pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{(cab.monthly_amount / 100).toFixed(2)} &euro;/mois</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => sendRelance(cab)}
                            disabled={relancedToday}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                              relancedToday
                                ? "bg-slate-500/20 text-slate-500 cursor-not-allowed"
                                : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                            }`}
                            title={relancedToday ? "Deja relance aujourd'hui" : "Envoyer une relance par email"}
                          >
                            <Mail className="h-3 w-3" /> Relancer
                          </button>
                          <button
                            onClick={() => setSuspendDialog(cab.cabinet_id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                            title="Suspendre le cabinet"
                          >
                            <PauseCircle className="h-3 w-3" /> Suspendre
                          </button>
                          <button
                            onClick={() => handleReactivate(cab.cabinet_id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors"
                            title="Reactiver le cabinet"
                          >
                            <PlayCircle className="h-3 w-3" /> Reactiver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspend Confirmation */}
      <AlertDialog open={!!suspendDialog} onOpenChange={() => setSuspendDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suspension</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir suspendre ce cabinet ? Les utilisateurs ne pourront plus acceder a l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => suspendDialog && handleSuspend(suspendDialog)} className="bg-red-600 hover:bg-red-700">
              Suspendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
