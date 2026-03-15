import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface UnpaidCabinet {
  cabinet_id: string;
  cabinet_nom: string;
  admin_email: string;
  plan: string;
  status: string;
  days_overdue: number;
  monthly_price_cents: number;
  stripe_customer_id: string | null;
}

export default function AdminUnpaid() {
  const [unpaid, setUnpaid] = useState<UnpaidCabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState<string | null>(null);

  const loadUnpaid = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Query cabinet_subscriptions with status past_due, join with cabinets and profiles
      const { data: subs, error } = await supabase
        .from("cabinet_subscriptions")
        .select("cabinet_id, plan, status, monthly_price_cents, stripe_customer_id, current_period_end")
        .in("status", ["past_due", "suspended"]);
      if (error) throw error;

      const results: UnpaidCabinet[] = [];
      for (const sub of subs ?? []) {
        // Get cabinet name
        const { data: cab } = await supabase.from("cabinets").select("nom").eq("id", sub.cabinet_id).single();
        // Get admin email
        const { data: admin } = await supabase.from("profiles").select("email").eq("cabinet_id", sub.cabinet_id).eq("role", "ADMIN").limit(1).single();

        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
        const daysOverdue = Math.max(0, Math.ceil((Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)));

        results.push({
          cabinet_id: sub.cabinet_id,
          cabinet_nom: cab?.nom ?? "Sans nom",
          admin_email: admin?.email ?? "-",
          plan: sub.plan ?? "-",
          status: sub.status ?? "past_due",
          days_overdue: daysOverdue,
          monthly_price_cents: sub.monthly_price_cents ?? 0,
          stripe_customer_id: sub.stripe_customer_id ?? null,
        });
      }
      setUnpaid(results);
      if (showRefresh) toast.success("Liste actualisee");
    } catch (err) {
      console.error("[AdminUnpaid] Load error:", err);
      toast.error("Erreur lors du chargement des impayes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUnpaid();
  }, [loadUnpaid]);

  function sendRelance(cab: UnpaidCabinet) {
    const subject = encodeURIComponent(`[GRIMY] Relance paiement - ${cab.cabinet_nom}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nNous constatons que le paiement de votre abonnement GRIMY (plan ${cab.plan}) est en retard de ${cab.days_overdue} jour(s).\n\nMontant du : ${(cab.monthly_price_cents / 100).toFixed(2)} \u20ac\n\nMerci de regulariser votre situation dans les plus brefs delais afin d'eviter une suspension de votre compte.\n\nCordialement,\nL'equipe GRIMY`
    );
    window.open(`mailto:${cab.admin_email}?subject=${subject}&body=${body}`, "_blank");
  }

  async function handleSuspend(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("suspend_cabinet", { p_cabinet_id: cabinetId, p_reason: "Impaye - suspension manuelle" });
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
      const { error } = await supabase.rpc("reactivate_cabinet", { p_cabinet_id: cabinetId, p_plan: "essentiel", p_stripe_sub_id: null });
      if (error) throw error;
      toast.success("Cabinet reactive");
      loadUnpaid();
    } catch (err) {
      toast.error("Erreur lors de la reactivation");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => loadUnpaid(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {unpaid.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Aucun impaye en cours</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3">Nom du cabinet</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Jours de retard</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((cab) => (
                  <tr key={cab.cabinet_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-200 font-medium">{cab.cabinet_nom}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${cab.admin_email}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {cab.admin_email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${cab.status === "suspended" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {cab.status === "past_due" ? "Impaye" : cab.status === "suspended" ? "Suspendu" : cab.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${cab.days_overdue > 7 ? "text-red-400" : "text-amber-400"}`}>
                        {cab.days_overdue}j
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{(cab.monthly_price_cents / 100).toFixed(2)} &euro;/mois</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => sendRelance(cab)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                          title="Envoyer une relance par email"
                        >
                          <Mail className="h-3 w-3" /> Relancer
                        </button>
                        <button
                          onClick={() => setSuspendDialog(cab.cabinet_id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          <PauseCircle className="h-3 w-3" /> Suspendre
                        </button>
                        <button
                          onClick={() => handleReactivate(cab.cabinet_id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors"
                        >
                          <PlayCircle className="h-3 w-3" /> Reactiver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
