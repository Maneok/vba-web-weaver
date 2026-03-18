import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, PauseCircle, PlayCircle } from "lucide-react";
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

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return `il y a ${diffDays}j`;
}

export default function AdminUnpaid() {
  const [unpaid, setUnpaid] = useState<UnpaidCabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspendDialog, setSuspendDialog] = useState<string | null>(null);

  useEffect(() => {
    loadUnpaid();
  }, []);

  async function loadUnpaid() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_unpaid");
      if (error) throw error;
      setUnpaid((data ?? []) as unknown as UnpaidCabinet[]);
    } catch (err) {
      console.error("[AdminUnpaid] Load error:", err);
      toast.error("Erreur lors du chargement des impayes");
    } finally {
      setLoading(false);
    }
  }

  function sendRelance(cab: UnpaidCabinet) {
    const subject = encodeURIComponent(`[GRIMY] Relance paiement - ${cab.cabinet_name}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nNous constatons que le paiement de votre abonnement GRIMY (plan ${cab.plan}) est en retard de ${cab.days_overdue} jour(s).\n\nMontant du : ${(cab.monthly_amount / 100).toFixed(2)} \u20ac\n\nMerci de regulariser votre situation dans les plus brefs delais.\n\nCordialement,\nL'equipe GRIMY`
    );
    window.open(`mailto:${cab.admin_email}?subject=${subject}&body=${body}`, "_blank");
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
                {unpaid.map((cab) => (
                  <tr key={cab.cabinet_id} className="border-b border-white/5 hover:bg-white dark:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{cab.cabinet_name}</td>
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
                      <span className={`font-medium ${cab.days_overdue > 7 ? "text-red-400" : "text-amber-400"}`}>
                        {cab.days_overdue}j
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{(cab.monthly_amount / 100).toFixed(2)} &euro;/mois</td>
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
                ))}
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
