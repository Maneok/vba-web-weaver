import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreHorizontal, Download, Trash2, PauseCircle, PlayCircle, ArrowRightLeft, Clock, Tag, StickyNote, RefreshCw, ExternalLink, FileSpreadsheet } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Matches v_admin_overview columns exactly
interface Cabinet {
  cabinet_id: string;
  cabinet_nom: string;
  plan: string;
  sub_status: string;
  trial_end: string | null;
  max_seats: number;
  max_clients: number;
  seats_used: number;
  clients_used: number;
  audit_entries: number;
  created_at: string;
}

// Extended detail fetched from multiple tables
interface CabinetDetail {
  cabinet: { id: string; nom: string; siren: string | null; created_at: string } | null;
  subscription: Record<string, unknown> | null;
  users: Array<{ id: string; email: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null }>;
  recentAudits: Array<{ action: string; created_at: string; user_email: string | null }>;
  payments: Array<{ amount_cents: number; status: string; created_at: string; description: string | null }>;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  trialing: "bg-blue-500/20 text-blue-300",
  past_due: "bg-amber-500/20 text-amber-300",
  suspended: "bg-red-500/20 text-red-300",
  canceled: "bg-slate-500/20 text-slate-300",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  trialing: "Trial",
  past_due: "Impaye",
  suspended: "Suspendu",
  canceled: "Annule",
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

function trialDaysRemaining(trialEnd: string | null): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

export default function AdminCabinets() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadCabinets = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.from("v_admin_overview").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setCabinets((data ?? []) as unknown as Cabinet[]);
      if (showRefresh) toast.success("Liste actualisee");
    } catch (err) {
      console.error("[AdminCabinets] Load error:", err);
      toast.error("Erreur lors du chargement des cabinets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCabinets();
  }, [loadCabinets]);

  async function openCabinetDetail(cab: Cabinet) {
    setSelectedCabinet(cab);
    setSheetOpen(true);
    setDetailLoading(true);
    try {
      // Fetch detail from multiple real tables in parallel
      const [cabinetRes, subRes, usersRes, auditsRes, paymentsRes] = await Promise.all([
        supabase.from("cabinets").select("id, nom, siren, created_at").eq("id", cab.cabinet_id).single(),
        supabase.from("cabinet_subscriptions").select("*").eq("cabinet_id", cab.cabinet_id).single(),
        supabase.from("profiles").select("id, email, full_name, role, is_active, last_login_at").eq("cabinet_id", cab.cabinet_id),
        supabase.from("audit_trail").select("action, created_at, user_email").eq("cabinet_id", cab.cabinet_id).order("created_at", { ascending: false }).limit(10),
        supabase.from("payment_history").select("amount_cents, status, created_at, description").eq("cabinet_id", cab.cabinet_id).order("created_at", { ascending: false }).limit(10),
      ]);

      setCabinetDetail({
        cabinet: cabinetRes.data as CabinetDetail["cabinet"],
        subscription: subRes.data as Record<string, unknown> | null,
        users: (usersRes.data ?? []) as CabinetDetail["users"],
        recentAudits: (auditsRes.data ?? []) as CabinetDetail["recentAudits"],
        payments: (paymentsRes.data ?? []) as CabinetDetail["payments"],
      });
    } catch (err) {
      console.error("[AdminCabinets] Detail error:", err);
      toast.error("Erreur lors du chargement du detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSuspend(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("suspend_cabinet", { p_cabinet_id: cabinetId, p_reason: "Suspension manuelle par super-admin" });
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
      const { error } = await supabase.rpc("reactivate_cabinet", { p_cabinet_id: cabinetId, p_plan: plan, p_stripe_sub_id: null });
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
      const { error } = await supabase.rpc("change_plan", { p_cabinet_id: cabinetId, p_new_plan: plan, p_stripe_sub_id: null });
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
      // Extend trial by updating trial_end in cabinet_subscriptions
      const { data: sub } = await supabase.from("cabinet_subscriptions").select("trial_end").eq("cabinet_id", cabinetId).single();
      const currentEnd = sub?.trial_end ? new Date(sub.trial_end as string) : new Date();
      currentEnd.setDate(currentEnd.getDate() + days);
      const { error } = await supabase
        .from("cabinet_subscriptions")
        .update({ trial_end: currentEnd.toISOString(), status: "trialing" })
        .eq("cabinet_id", cabinetId);
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
      const { error } = await supabase.rpc("apply_coupon", {
        p_cabinet_id: cabinetId,
        p_code: couponCode,
        p_percent: couponPercent,
        p_months: couponDuration,
      });
      if (error) throw error;
      toast.success("Coupon applique avec succes");
      setCouponDialog(null);
      setCouponCode("");
    } catch (err) {
      toast.error("Erreur lors de l'application du coupon");
    }
  }

  async function handleExport(cabinetId: string, cabinetNom: string) {
    try {
      const { data, error } = await supabase.rpc("export_cabinet_data", { p_cabinet_id: cabinetId });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cabinetNom.replace(/\s+/g, "_")}_export_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export de "${cabinetNom}" telecharge`);
    } catch (err) {
      toast.error("Erreur lors de l'export");
    }
  }

  async function handlePurge(cabinetId: string) {
    try {
      const { error } = await supabase.rpc("purge_cabinet", { p_cabinet_id: cabinetId });
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

  function exportCSV() {
    const header = "Nom,Plan,Statut,Users,Clients,Inscription\n";
    const rows = filtered.map((c) =>
      `"${c.cabinet_nom}","${c.plan}","${statusLabels[c.sub_status] ?? c.sub_status}",${c.seats_used}/${c.max_seats},${c.clients_used}/${c.max_clients},"${new Date(c.created_at).toLocaleDateString("fr-FR")}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cabinets_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  }

  const filtered = useMemo(() => {
    return cabinets.filter((c) => {
      const matchSearch = !search || c.cabinet_nom?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.sub_status === statusFilter;
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
      {/* Search, Filters, Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom de cabinet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            title="Exporter en CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() => loadCabinets(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500">{filtered.length} cabinet(s) sur {cabinets.length}</p>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                <th className="px-4 py-3">Nom du cabinet</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Inscription</th>
                <th className="px-4 py-3">Trial</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cab) => {
                const daysLeft = trialDaysRemaining(cab.trial_end);
                return (
                  <tr
                    key={cab.cabinet_id}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => openCabinetDetail(cab)}
                  >
                    <td className="px-4 py-3 text-slate-200 font-medium">{cab.cabinet_nom || "Sans nom"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{cab.plan || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[cab.sub_status] ?? "bg-slate-500/20 text-slate-300"}`}>
                        {statusLabels[cab.sub_status] ?? cab.sub_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{cab.seats_used}/{cab.max_seats}</td>
                    <td className="px-4 py-3 text-slate-400">{cab.clients_used}/{cab.max_clients}</td>
                    <td className="px-4 py-3 text-slate-500">{formatRelative(cab.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {daysLeft != null ? (
                        <span className={daysLeft <= 3 ? "text-amber-400 font-medium" : ""}>{daysLeft}j</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-white/10 transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSuspendDialog(cab.cabinet_id)}>
                            <PauseCircle className="mr-2 h-4 w-4" /> Suspendre
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setReactivateDialog({ id: cab.cabinet_id }); setReactivatePlan("solo"); }}>
                            <PlayCircle className="mr-2 h-4 w-4" /> Reactiver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setChangePlanDialog({ id: cab.cabinet_id }); setNewPlan(cab.plan || "solo"); }}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Changer plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setExtendTrialDialog({ id: cab.cabinet_id }); setTrialDays(14); }}>
                            <Clock className="mr-2 h-4 w-4" /> Prolonger trial
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setCouponDialog({ id: cab.cabinet_id }); setCouponCode(""); setCouponPercent(10); setCouponDuration(1); }}>
                            <Tag className="mr-2 h-4 w-4" /> Appliquer coupon
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(cab.cabinet_id, cab.cabinet_nom)}>
                            <Download className="mr-2 h-4 w-4" /> Exporter donnees
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setPurgeDialog(cab.cabinet_id); setPurgeConfirm(""); }} className="text-red-400">
                            <Trash2 className="mr-2 h-4 w-4" /> Purger
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucun cabinet trouve</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cabinet Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-200">{selectedCabinet?.cabinet_nom || "Cabinet"}</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : cabinetDetail ? (
            <div className="space-y-6 mt-6">
              {/* Cabinet Info */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Informations du cabinet</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Nom</span>
                  <span className="text-slate-200 font-medium">{cabinetDetail.cabinet?.nom || "Sans nom"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">SIREN</span>
                  <span className="text-slate-200">{cabinetDetail.cabinet?.siren || "Non renseigne"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ID</span>
                  <span className="text-slate-300 text-xs font-mono">{cabinetDetail.cabinet?.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Inscription</span>
                  <span className="text-slate-200">{cabinetDetail.cabinet?.created_at ? new Date(cabinetDetail.cabinet.created_at).toLocaleDateString("fr-FR") : "-"}</span>
                </div>
              </div>

              {/* Subscription */}
              {cabinetDetail.subscription && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Abonnement</h4>
                  {(["plan", "status", "billing_cycle", "monthly_price_cents", "stripe_customer_id", "stripe_subscription_id", "trial_end", "max_seats", "max_clients"] as const).map((key) => {
                    const val = cabinetDetail.subscription?.[key];
                    if (val === null || val === undefined) return null;
                    let displayVal = String(val);
                    if (key === "monthly_price_cents") displayVal = `${(Number(val) / 100).toFixed(2)} \u20ac`;
                    if (key === "trial_end" && val) displayVal = new Date(String(val)).toLocaleDateString("fr-FR");
                    if (key === "stripe_customer_id" || key === "stripe_subscription_id") {
                      return (
                        <div key={key} className="flex justify-between text-sm items-center">
                          <span className="text-slate-400">{key}</span>
                          <span className="text-blue-400 text-xs font-mono truncate max-w-[200px]">{displayVal}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-slate-400">{key}</span>
                        <span className="text-slate-200">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Users */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Utilisateurs ({cabinetDetail.users.length})</h4>
                {cabinetDetail.users.map((u) => (
                  <div key={u.id} className="flex justify-between text-sm border-b border-white/5 pb-1">
                    <div>
                      <span className="text-slate-200">{u.full_name || u.email}</span>
                      {u.full_name && <span className="text-slate-500 text-xs ml-2">{u.email}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${u.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                        {u.is_active ? "Actif" : "Inactif"}
                      </span>
                      <span className="text-slate-400 text-xs">{u.role}</span>
                    </div>
                  </div>
                ))}
                {cabinetDetail.users.length === 0 && <p className="text-sm text-slate-500">Aucun utilisateur</p>}
              </div>

              {/* Recent Audits */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Derniers audits</h4>
                {cabinetDetail.recentAudits.slice(0, 5).map((a, i) => (
                  <div key={i} className="text-sm text-slate-300 flex justify-between">
                    <span>{a.action} {a.user_email ? `(${a.user_email})` : ""}</span>
                    <span className="text-slate-500 text-xs">{formatRelative(a.created_at)}</span>
                  </div>
                ))}
                {cabinetDetail.recentAudits.length === 0 && <p className="text-sm text-slate-500">Aucun audit</p>}
              </div>

              {/* Payment History */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Historique paiements</h4>
                {cabinetDetail.payments.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <span className="text-slate-300">{(p.amount_cents / 100).toFixed(2)} &euro;</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${p.status === "succeeded" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{p.status}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{formatRelative(p.created_at)}</span>
                  </div>
                ))}
                {cabinetDetail.payments.length === 0 && <p className="text-sm text-slate-500">Aucun paiement</p>}
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
          <DialogHeader><DialogTitle>Reactiver le cabinet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-300">Choisir le plan :</label>
            <select value={reactivatePlan} onChange={(e) => setReactivatePlan(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200">
              <option value="essentiel">Essentiel</option>
              <option value="pro">Pro</option>
              <option value="cabinet">Cabinet</option>
            </select>
          </div>
          <DialogFooter>
            <button onClick={() => setReactivateDialog(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button onClick={() => reactivateDialog && handleReactivate(reactivateDialog.id, reactivatePlan)} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Reactiver</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanDialog} onOpenChange={() => setChangePlanDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Changer le plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-300">Nouveau plan :</label>
            <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200">
              <option value="essentiel">Essentiel</option>
              <option value="pro">Pro</option>
              <option value="cabinet">Cabinet</option>
            </select>
          </div>
          <DialogFooter>
            <button onClick={() => setChangePlanDialog(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button onClick={() => changePlanDialog && handleChangePlan(changePlanDialog.id, newPlan)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Appliquer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={!!extendTrialDialog} onOpenChange={() => setExtendTrialDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prolonger le trial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-slate-300">Nombre de jours :</label>
            <input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(parseInt(e.target.value) || 14)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200" />
          </div>
          <DialogFooter>
            <button onClick={() => setExtendTrialDialog(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button onClick={() => extendTrialDialog && handleExtendTrial(extendTrialDialog.id, trialDays)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Prolonger</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={!!couponDialog} onOpenChange={() => setCouponDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Appliquer un coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-300">Code coupon :</label>
              <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" placeholder="PROMO2026" />
            </div>
            <div>
              <label className="text-sm text-slate-300">Pourcentage de reduction :</label>
              <input type="number" min={1} max={100} value={couponPercent} onChange={(e) => setCouponPercent(parseInt(e.target.value) || 10)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" />
            </div>
            <div>
              <label className="text-sm text-slate-300">Duree (mois) :</label>
              <input type="number" min={1} max={24} value={couponDuration} onChange={(e) => setCouponDuration(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCouponDialog(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button onClick={() => couponDialog && handleApplyCoupon(couponDialog.id)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Appliquer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Dialog (double confirmation) */}
      <AlertDialog open={!!purgeDialog} onOpenChange={() => { setPurgeDialog(null); setPurgeConfirm(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">Purger le cabinet</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est IRREVERSIBLE. Toutes les donnees du cabinet seront definitivement supprimees. Tapez "PURGER" pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input type="text" value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder='Tapez "PURGER"' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPurgeConfirm("")}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => purgeDialog && handlePurge(purgeDialog)} disabled={purgeConfirm !== "PURGER"} className="bg-red-600 hover:bg-red-700 disabled:opacity-50">Purger definitivement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
