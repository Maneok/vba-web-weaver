import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreHorizontal, Download, Trash2, PauseCircle, PlayCircle, ArrowRightLeft, Clock, Tag, StickyNote } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Cabinet {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  active_users: number;
  max_users: number;
  total_clients: number;
  max_clients: number;
  admin_email: string;
  last_login: string | null;
  trial_days_remaining: number | null;
  created_at: string;
}

interface CabinetDetail {
  cabinet: Record<string, unknown>;
  subscription: Record<string, unknown>;
  users: Array<Record<string, unknown>>;
  recent_audits: Array<Record<string, unknown>>;
  payment_history: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
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
};

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "A l'instant";
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 30) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR");
}

export default function AdminCabinets() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [cabinetDetail, setCabinetDetail] = useState<CabinetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Dialog states
  const [suspendDialog, setSuspendDialog] = useState<string | null>(null);
  const [reactivateDialog, setReactivateDialog] = useState<{ id: string } | null>(null);
  const [reactivatePlan, setReactivatePlan] = useState("solo");
  const [changePlanDialog, setChangePlanDialog] = useState<{ id: string } | null>(null);
  const [newPlan, setNewPlan] = useState("solo");
  const [extendTrialDialog, setExtendTrialDialog] = useState<{ id: string } | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [couponDialog, setCouponDialog] = useState<{ id: string } | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(10);
  const [couponDuration, setCouponDuration] = useState(1);
  const [purgeDialog, setPurgeDialog] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteDialog, setNoteDialog] = useState(false);

  useEffect(() => {
    loadCabinets();
  }, []);

  async function loadCabinets() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("v_admin_dashboard").select("*");
      if (error) throw error;
      setCabinets((data ?? []) as unknown as Cabinet[]);
    } catch (err) {
      console.error("[AdminCabinets] Load error:", err);
      toast.error("Erreur lors du chargement des cabinets");
    } finally {
      setLoading(false);
    }
  }

  async function openCabinetDetail(cab: Cabinet) {
    setSelectedCabinet(cab);
    setSheetOpen(true);
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_cabinet_detail", { p_cabinet_id: cab.id });
      if (error) throw error;
      setCabinetDetail(data as unknown as CabinetDetail);
    } catch (err) {
      console.error("[AdminCabinets] Detail error:", err);
      toast.error("Erreur lors du chargement du detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSuspend(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("admin_suspend", { p_cabinet_id: cabinetId });
      if (error) throw error;
      toast.success("Cabinet suspendu avec succes");
      setSuspendDialog(null);
      loadCabinets();
    } catch (err) {
      toast.error("Erreur lors de la suspension");
    }
  }

  async function handleReactivate(cabinetId: string, plan: string) {
    try {
      const { error } = await supabase.rpc("admin_reactivate", { p_cabinet_id: cabinetId, p_plan: plan });
      if (error) throw error;
      toast.success("Cabinet reactive avec succes");
      setReactivateDialog(null);
      loadCabinets();
    } catch (err) {
      toast.error("Erreur lors de la reactivation");
    }
  }

  async function handleChangePlan(cabinetId: string, plan: string) {
    try {
      const { error } = await supabase.rpc("admin_change_plan", { p_cabinet_id: cabinetId, p_plan: plan });
      if (error) throw error;
      toast.success("Plan modifie avec succes");
      setChangePlanDialog(null);
      loadCabinets();
    } catch (err) {
      toast.error("Erreur lors du changement de plan");
    }
  }

  async function handleExtendTrial(cabinetId: string, days: number) {
    try {
      const { error } = await supabase.rpc("admin_extend_trial", { p_cabinet_id: cabinetId, p_days: days });
      if (error) throw error;
      toast.success(`Trial prolonge de ${days} jours`);
      setExtendTrialDialog(null);
      loadCabinets();
    } catch (err) {
      toast.error("Erreur lors de la prolongation du trial");
    }
  }

  async function handleApplyCoupon(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("admin_apply_coupon", {
        p_cabinet_id: cabinetId,
        p_code: couponCode,
        p_percent: couponPercent,
        p_duration_months: couponDuration,
      });
      if (error) throw error;
      toast.success("Coupon applique avec succes");
      setCouponDialog(null);
      setCouponCode("");
    } catch (err) {
      toast.error("Erreur lors de l'application du coupon");
    }
  }

  async function handleExport(cabinetId: string) {
    try {
      const { data, error } = await supabase.rpc("admin_export_data", { p_cabinet_id: cabinetId });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cabinet_${cabinetId}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export telecharge");
    } catch (err) {
      toast.error("Erreur lors de l'export");
    }
  }

  async function handlePurge(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("admin_purge_cabinet", { p_cabinet_id: cabinetId });
      if (error) throw error;
      toast.success("Cabinet purge avec succes");
      setPurgeDialog(null);
      setPurgeConfirm("");
      setSheetOpen(false);
      loadCabinets();
    } catch (err) {
      toast.error("Erreur lors de la purge");
    }
  }

  async function handleAddNote(cabinetId: string) {
    if (!noteText.trim()) return;
    try {
      const { error } = await supabase.rpc("admin_add_note", { p_cabinet_id: cabinetId, p_note: noteText });
      if (error) throw error;
      toast.success("Note ajoutee");
      setNoteText("");
      setNoteDialog(false);
      // Refresh detail
      if (selectedCabinet) openCabinetDetail(selectedCabinet);
    } catch (err) {
      toast.error("Erreur lors de l'ajout de la note");
    }
  }

  const filtered = useMemo(() => {
    return cabinets.filter((c) => {
      const matchSearch = !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.admin_email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.subscription_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cabinets, search, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Tous" },
            { value: "active", label: "Actif" },
            { value: "trialing", label: "Trial" },
            { value: "suspended", label: "Suspendu" },
            { value: "past_due", label: "Impaye" },
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
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-white/10">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Derniere connexion</th>
                <th className="px-4 py-3">Trial</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cab) => (
                <tr
                  key={cab.id}
                  className="border-b border-white/5 hover:bg-white dark:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => openCabinetDetail(cab)}
                >
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{cab.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[cab.subscription_status] ?? "bg-slate-500/20 text-slate-700 dark:text-slate-300"}`}>
                      {statusLabels[cab.subscription_status] ?? cab.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">{cab.active_users}/{cab.max_users}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">{cab.total_clients}/{cab.max_clients}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{cab.admin_email}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500">{formatRelative(cab.last_login)}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500">
                    {cab.trial_days_remaining != null && cab.trial_days_remaining > 0
                      ? `${cab.trial_days_remaining}j`
                      : "-"}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-white/10 transition-colors">
                          <MoreHorizontal className="h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSuspendDialog(cab.id)}>
                          <PauseCircle className="mr-2 h-4 w-4" /> Suspendre
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setReactivateDialog({ id: cab.id }); setReactivatePlan("solo"); }}>
                          <PlayCircle className="mr-2 h-4 w-4" /> Reactiver
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setChangePlanDialog({ id: cab.id }); setNewPlan(cab.plan); }}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" /> Changer plan
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setExtendTrialDialog({ id: cab.id }); setTrialDays(14); }}>
                          <Clock className="mr-2 h-4 w-4" /> Prolonger trial
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setCouponDialog({ id: cab.id }); setCouponCode(""); setCouponPercent(10); setCouponDuration(1); }}>
                          <Tag className="mr-2 h-4 w-4" /> Appliquer coupon
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(cab.id)}>
                          <Download className="mr-2 h-4 w-4" /> Exporter donnees
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setPurgeDialog(cab.id); setPurgeConfirm(""); }} className="text-red-400">
                          <Trash2 className="mr-2 h-4 w-4" /> Purger
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Aucun cabinet trouve</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cabinet Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-800 dark:text-slate-200">{selectedCabinet?.name}</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : cabinetDetail ? (
            <div className="space-y-6 mt-6">
              {/* Cabinet Info */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Informations</h4>
                {Object.entries(cabinetDetail.cabinet ?? {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">{key}</span>
                    <span className="text-slate-800 dark:text-slate-200">{String(val ?? "-")}</span>
                  </div>
                ))}
              </div>

              {/* Subscription */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Abonnement</h4>
                {Object.entries(cabinetDetail.subscription ?? {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">{key}</span>
                    <span className="text-slate-800 dark:text-slate-200">{String(val ?? "-")}</span>
                  </div>
                ))}
              </div>

              {/* Users */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Utilisateurs</h4>
                {(cabinetDetail.users ?? []).map((u, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-1">
                    <span className="text-slate-800 dark:text-slate-200">{String(u.full_name ?? u.email)}</span>
                    <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">{String(u.role ?? "")}</span>
                  </div>
                ))}
                {(cabinetDetail.users ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucun utilisateur</p>}
              </div>

              {/* Recent Audits */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Derniers audits</h4>
                {(cabinetDetail.recent_audits ?? []).slice(0, 5).map((a, i) => (
                  <div key={i} className="text-sm text-slate-700 dark:text-slate-300">
                    {String(a.action)} — <span className="text-slate-400 dark:text-slate-500">{formatRelative(String(a.created_at ?? ""))}</span>
                  </div>
                ))}
                {(cabinetDetail.recent_audits ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucun audit</p>}
              </div>

              {/* Payment History */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Historique paiements</h4>
                {(cabinetDetail.payment_history ?? []).slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{((Number(p.amount) || 0) / 100).toFixed(2)} &euro;</span>
                    <span className="text-slate-400 dark:text-slate-500">{formatRelative(String(p.created_at ?? ""))}</span>
                  </div>
                ))}
                {(cabinetDetail.payment_history ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucun paiement</p>}
              </div>

              {/* Notes */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Notes internes</h4>
                  <button
                    onClick={() => setNoteDialog(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <StickyNote className="h-3 w-3" /> Ajouter
                  </button>
                </div>
                {(cabinetDetail.notes ?? []).map((n, i) => (
                  <div key={i} className="text-sm border-b border-white/5 pb-2">
                    <p className="text-slate-700 dark:text-slate-300">{String(n.note)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatRelative(String(n.created_at ?? ""))}</p>
                  </div>
                ))}
                {(cabinetDetail.notes ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucune note</p>}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

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

      {/* Reactivate Dialog */}
      <Dialog open={!!reactivateDialog} onOpenChange={() => setReactivateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactiver le cabinet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-700 dark:text-slate-300">Choisir le plan :</label>
            <select
              value={reactivatePlan}
              onChange={(e) => setReactivatePlan(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="solo">Solo</option>
              <option value="cabinet">Cabinet</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <DialogFooter>
            <button onClick={() => setReactivateDialog(null)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button onClick={() => reactivateDialog && handleReactivate(reactivateDialog.id, reactivatePlan)} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white rounded-lg">
              Reactiver
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanDialog} onOpenChange={() => setChangePlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-700 dark:text-slate-300">Nouveau plan :</label>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="solo">Solo</option>
              <option value="cabinet">Cabinet</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <DialogFooter>
            <button onClick={() => setChangePlanDialog(null)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button onClick={() => changePlanDialog && handleChangePlan(changePlanDialog.id, newPlan)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg">
              Appliquer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={!!extendTrialDialog} onOpenChange={() => setExtendTrialDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prolonger le trial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-700 dark:text-slate-300">Nombre de jours :</label>
            <input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(parseInt(e.target.value) || 14)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setExtendTrialDialog(null)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button onClick={() => extendTrialDialog && handleExtendTrial(extendTrialDialog.id, trialDays)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg">
              Prolonger
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={!!couponDialog} onOpenChange={() => setCouponDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer un coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">Code coupon :</label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
                placeholder="PROMO2026"
              />
            </div>
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">Pourcentage de reduction :</label>
              <input
                type="number"
                min={1}
                max={100}
                value={couponPercent}
                onChange={(e) => setCouponPercent(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">Duree (mois) :</label>
              <input
                type="number"
                min={1}
                max={24}
                value={couponDuration}
                onChange={(e) => setCouponDuration(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCouponDialog(null)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button onClick={() => couponDialog && handleApplyCoupon(couponDialog.id)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg">
              Appliquer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Dialog (double confirmation) */}
      <AlertDialog open={!!purgeDialog} onOpenChange={() => { setPurgeDialog(null); setPurgeConfirm(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">Purger le cabinet</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est IRREVERSIBLE. Toutes les donnees du cabinet seront definitivement supprimees.
              Tapez "PURGER" pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder='Tapez "PURGER"'
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPurgeConfirm("")}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purgeDialog && handlePurge(purgeDialog)}
              disabled={purgeConfirm !== "PURGER"}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-45"
            >
              Purger definitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note</DialogTitle>
          </DialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Votre note..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 resize-none"
          />
          <DialogFooter>
            <button onClick={() => setNoteDialog(false)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button
              onClick={() => selectedCabinet && handleAddNote(selectedCabinet.id)}
              disabled={!noteText.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg disabled:opacity-45"
            >
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
