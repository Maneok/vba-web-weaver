import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  Users, Euro, TrendingUp, AlertTriangle, Plus, Search, Phone, Mail, Video,
  Bell, FileText, CheckCircle, Rocket, GripVertical, LayoutGrid, List,
  X, Trash2, UserCheck, Calendar, Tag, Copy,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";

/* ─── Types ─── */

interface Prospect {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  siren: string | null;
  source: string;
  stage: string;
  plan_vise: string | null;
  montant_estime_cents: number;
  notes: string | null;
  tags: string[];
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  converted_cabinet_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CrmActivity {
  id: string;
  prospect_id: string;
  type: string;
  content: string;
  created_at: string;
}

interface PipelineStats {
  total_prospects: number;
  total_value_cents: number;
  won_count: number;
  lost_count: number;
  conversion_rate: number;
  avg_cycle_days: number;
  overdue_actions: number;
  stages: Record<string, number>;
  sources: Record<string, number>;
  monthly_conversions: { month: string; conversions: number }[];
}

interface OnboardingCab {
  cabinet_id: string;
  cabinet_nom: string;
  created_at: string;
  plan: string | null;
  total_users: number;
  total_clients: number;
  total_lm: number;
  total_docs: number;
  last_login: string | null;
  prospect_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  source: string | null;
}

/* ─── Constants ─── */

const STAGES_ORDER = ["lead", "qualifie", "demo_planifiee", "demo_faite", "proposition", "negociation"] as const;
const FINAL_STAGES = ["gagne", "perdu"] as const;
const ALL_STAGES = [...STAGES_ORDER, ...FINAL_STAGES];

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualifie: "Qualifie", demo_planifiee: "Demo planifiee", demo_faite: "Demo faite",
  proposition: "Proposition", negociation: "Negociation", gagne: "Gagne", perdu: "Perdu",
};
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  qualifie: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  demo_planifiee: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  demo_faite: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  proposition: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  negociation: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  gagne: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  perdu: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STAGE_CHART_COLORS: Record<string, string> = {
  lead: "#64748b", qualifie: "#60a5fa", demo_planifiee: "#8b5cf6", demo_faite: "#a855f7",
  proposition: "#f59e0b", negociation: "#eab308", gagne: "#34d399", perdu: "#f87171",
};

const SOURCE_LABELS: Record<string, string> = {
  site_web: "Site web", demo: "Demo", bouche_a_oreille: "Bouche a oreille", salon: "Salon",
  partenaire: "Partenaire", linkedin: "LinkedIn", croec: "CROEC", autre: "Autre",
};
const SOURCE_COLORS: Record<string, string> = {
  site_web: "bg-blue-500/20 text-blue-300", demo: "bg-violet-500/20 text-violet-300",
  bouche_a_oreille: "bg-emerald-500/20 text-emerald-300", salon: "bg-amber-500/20 text-amber-300",
  partenaire: "bg-cyan-500/20 text-cyan-300", linkedin: "bg-sky-500/20 text-sky-300",
  croec: "bg-indigo-500/20 text-indigo-300", autre: "bg-slate-500/20 text-slate-300",
};
const PIE_COLORS = ["#60a5fa", "#8b5cf6", "#34d399", "#f59e0b", "#22d3ee", "#0ea5e9", "#6366f1", "#94a3b8"];

const TAG_OPTIONS = ["Urgent", "VIP", "Chaud", "Froid", "CROEC", "Grand cabinet"];
const TAG_COLORS: Record<string, string> = {
  Urgent: "bg-red-500/20 text-red-300", VIP: "bg-amber-500/20 text-amber-300",
  Chaud: "bg-orange-500/20 text-orange-300", Froid: "bg-blue-500/20 text-blue-300",
  CROEC: "bg-indigo-500/20 text-indigo-300", "Grand cabinet": "bg-purple-500/20 text-purple-300",
};

const PLAN_PRICES: Record<string, number> = { solo: 2900, cabinet: 7900, enterprise: 19900 };
const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  appel: Phone, email: Mail, demo: Video, reunion: Users, relance: Bell,
  note: FileText, conversion: CheckCircle, onboarding: Rocket,
};

function formatRelative(d: string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "A l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Hier";
  return `il y a ${days}j`;
}

function isOverdue(d: string | null): boolean {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toISOString().split("T")[0]);
}

/* ─── Component ─── */

export default function AdminCRM() {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState<"pipeline" | "onboarding" | "analytics">("pipeline");
  const [loading, setLoading] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Detail sheet
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");

  // New prospect dialog
  const [newDialog, setNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({
    contact_name: "", contact_email: "", contact_phone: "",
    company_name: "", siren: "", source: "autre", plan_vise: "solo",
    montant_estime_cents: 2900, notes: "", next_action: "", next_action_date: "",
    tags: [] as string[],
  });

  // Lost / convert / delete dialogs
  const [lostDialog, setLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [convertDialog, setConvertDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Next action editing
  const [editAction, setEditAction] = useState("");
  const [editActionDate, setEditActionDate] = useState("");

  // Kanban drag
  const [dragId, setDragId] = useState<string | null>(null);

  // Table filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Kanban search
  const [kanbanSearch, setKanbanSearch] = useState("");

  // Onboarding
  const [onboarding, setOnboarding] = useState<OnboardingCab[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        supabase.from("admin_prospects").select("*").order("created_at", { ascending: false }),
        supabase.rpc("admin_get_pipeline_stats"),
      ]);
      if (pRes.data) setProspects(pRes.data as unknown as Prospect[]);
      if (sRes.data) setStats(sRes.data as unknown as PipelineStats);
    } catch (err) {
      console.error("[CRM] load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOnboarding = useCallback(async () => {
    try {
      const { data } = await supabase.from("v_admin_onboarding").select("*");
      if (data) setOnboarding(data as unknown as OnboardingCab[]);
    } catch (err) {
      console.error("[CRM] onboarding error:", err);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (subTab === "onboarding") fetchOnboarding(); }, [subTab, fetchOnboarding]);

  async function openDetail(p: Prospect) {
    setSelectedProspect(p);
    setEditAction(p.next_action || "");
    setEditActionDate(p.next_action_date || "");
    setSheetOpen(true);
    try {
      const { data } = await supabase
        .from("admin_crm_activities").select("*")
        .eq("prospect_id", p.id).order("created_at", { ascending: false });
      if (data) setActivities(data as unknown as CrmActivity[]);
    } catch (err) { logger.warn("[CRM]", "load activities:", err); toast.error("Erreur chargement activites"); }
  }

  async function handleCreate() {
    if (!newForm.contact_name.trim() || !newForm.contact_email.trim()) { toast.error("Nom et email requis"); return; }
    try {
      const { data, error } = await supabase.from("admin_prospects").insert({
        contact_name: newForm.contact_name, contact_email: newForm.contact_email,
        contact_phone: newForm.contact_phone || null, company_name: newForm.company_name || null,
        siren: newForm.siren || null, source: newForm.source, plan_vise: newForm.plan_vise,
        montant_estime_cents: newForm.montant_estime_cents, notes: newForm.notes || null,
        next_action: newForm.next_action || null, next_action_date: newForm.next_action_date || null,
        tags: newForm.tags, created_by: profile?.id,
      }).select().single();
      if (error) throw error;
      if (data) {
        await supabase.from("admin_crm_activities").insert({
          prospect_id: (data as Record<string, unknown>).id, type: "note", content: "Prospect cree", created_by: profile?.id,
        }).catch((e) => { logger.warn("[CRM]", "activity error:", e); });
      }
      toast.success("Prospect cree");
      setNewDialog(false);
      setNewForm({ contact_name: "", contact_email: "", contact_phone: "", company_name: "", siren: "", source: "autre", plan_vise: "solo", montant_estime_cents: 2900, notes: "", next_action: "", next_action_date: "", tags: [] });
      fetchAll();
    } catch { toast.error("Erreur lors de la creation"); }
  }

  async function updateStage(prospectId: string, newStage: string) {
    try {
      const { error } = await supabase.from("admin_prospects").update({ stage: newStage }).eq("id", prospectId);
      if (error) throw error;
      setProspects((prev) => prev.map((p) => p.id === prospectId ? { ...p, stage: newStage } : p));
      if (selectedProspect?.id === prospectId) setSelectedProspect((p) => p ? { ...p, stage: newStage } : p);
      toast.success(`Deplace vers ${STAGE_LABELS[newStage]}`);
    } catch { toast.error("Erreur"); }
  }

  async function handleAddActivity() {
    if (!activityContent.trim() || !selectedProspect) return;
    try {
      const { error } = await supabase.from("admin_crm_activities").insert({
        prospect_id: selectedProspect.id, type: activityType, content: activityContent, created_by: profile?.id,
      });
      if (error) throw error;
      toast.success("Activite ajoutee");
      setActivityContent("");
      const { data } = await supabase.from("admin_crm_activities").select("*").eq("prospect_id", selectedProspect.id).order("created_at", { ascending: false });
      if (data) setActivities(data as unknown as CrmActivity[]);
    } catch { toast.error("Erreur"); }
  }

  async function handleMarkLost() {
    if (!lostReason.trim() || !selectedProspect) return;
    try {
      await supabase.from("admin_prospects").update({ stage: "perdu", lost_reason: lostReason }).eq("id", selectedProspect.id);
      await supabase.from("admin_crm_activities").insert({ prospect_id: selectedProspect.id, type: "note", content: `Marque perdu: ${lostReason}`, created_by: profile?.id }).catch((e) => { logger.warn("[CRM]", "activity error:", e); });
      toast.success("Prospect marque perdu");
      setLostDialog(false); setLostReason(""); setSheetOpen(false); fetchAll();
    } catch { toast.error("Erreur"); }
  }

  async function handleConvert() {
    if (!selectedProspect) return;
    try {
      const { error } = await supabase.rpc("admin_convert_prospect", { p_prospect_id: selectedProspect.id, p_plan: selectedProspect.plan_vise || "solo" });
      if (error) throw error;
      toast.success("Prospect converti en cabinet !");
      setConvertDialog(false); setSheetOpen(false); fetchAll();
    } catch { toast.error("Erreur lors de la conversion"); }
  }

  async function handleDelete() {
    if (!selectedProspect) return;
    try {
      await supabase.from("admin_prospects").delete().eq("id", selectedProspect.id);
      toast.success("Prospect supprime");
      setDeleteDialog(false); setSheetOpen(false); fetchAll();
    } catch { toast.error("Erreur"); }
  }

  async function updateNextAction(action: string, date: string) {
    if (!selectedProspect) return;
    try {
      await supabase.from("admin_prospects").update({ next_action: action || null, next_action_date: date || null }).eq("id", selectedProspect.id);
      setSelectedProspect((p) => p ? { ...p, next_action: action, next_action_date: date } : p);
      toast.success("Action mise a jour");
    } catch { toast.error("Erreur"); }
  }

  async function handlePlanDemo() {
    if (!selectedProspect) return;
    await updateStage(selectedProspect.id, "demo_planifiee");
    await updateNextAction("Demo", "");
  }

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.contact_name.toLowerCase().includes(q) && !p.company_name?.toLowerCase().includes(q) && !p.contact_email.toLowerCase().includes(q)) return false;
      }
      if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
      return true;
    });
  }, [prospects, search, sourceFilter]);

  const kanbanGroups = useMemo(() => {
    const map: Record<string, Prospect[]> = {};
    for (const s of ALL_STAGES) map[s] = [];
    const q = kanbanSearch.toLowerCase();
    for (const p of prospects) {
      if (q && !p.contact_name.toLowerCase().includes(q) && !(p.company_name ?? "").toLowerCase().includes(q)) continue;
      if (map[p.stage]) map[p.stage].push(p);
    }
    return map;
  }, [prospects, kanbanSearch]);

  function getOnboardingPct(c: OnboardingCab): number {
    let steps = 1;
    if (c.total_clients > 0) steps++;
    if (c.total_lm > 0) steps++;
    if (c.total_docs > 0) steps++;
    return steps * 25;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {(["pipeline", "onboarding", "analytics"] as const).map((t) => (
            <button key={t} onClick={() => setSubTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === t ? "bg-blue-500/20 text-blue-300" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}>
              {t === "pipeline" ? "Pipeline" : t === "onboarding" ? "Onboarding" : "Analytics"}
            </button>
          ))}
        </div>
        {subTab === "pipeline" && (
          <>
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 ml-2">
              <button onClick={() => setViewMode("kanban")} className={`p-1.5 rounded ${viewMode === "kanban" ? "bg-blue-500/20 text-blue-300" : "text-slate-500"}`}><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode("table")} className={`p-1.5 rounded ${viewMode === "table" ? "bg-blue-500/20 text-blue-300" : "text-slate-500"}`}><List className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setNewDialog(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="h-4 w-4" /> Nouveau prospect
            </button>
          </>
        )}
      </div>

      {/* ═══ PIPELINE ═══ */}
      {subTab === "pipeline" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Prospects actifs", value: stats?.total_prospects ?? 0, icon: Users, color: "text-blue-400" },
              { label: "Valeur pipeline", value: `${((stats?.total_value_cents ?? 0) / 100).toLocaleString("fr-FR")} €`, icon: Euro, color: "text-emerald-400" },
              { label: "Taux conversion", value: `${stats?.conversion_rate ?? 0}%`, icon: TrendingUp, color: "text-violet-400" },
              { label: "Actions en retard", value: stats?.overdue_actions ?? 0, icon: AlertTriangle, color: "text-red-400", alert: (stats?.overdue_actions ?? 0) > 0 },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                    <span className="text-xs text-slate-400">{kpi.label}</span>
                    {"alert" in kpi && kpi.alert && <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  </div>
                  <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
                </div>
              );
            })}
          </div>

          {viewMode === "kanban" ? (
            <>
              {/* Mobile: select + list */}
              <div className="md:hidden space-y-3">
                {prospects.filter((p) => !["gagne", "perdu"].includes(p.stage)).map((p) => (
                  <div key={p.id} onClick={() => openDetail(p)} className="bg-white/5 border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200">{p.contact_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${STAGE_COLORS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
                    </div>
                    {p.company_name && <p className="text-xs text-slate-500 mt-0.5">{p.company_name}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop kanban */}
              <div className="hidden md:block">
                <div className="relative mb-3 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="text" placeholder="Rechercher dans le kanban..." value={kanbanSearch} onChange={(e) => setKanbanSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200" />
                </div>
              </div>
              <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
                {STAGES_ORDER.map((stage) => {
                  const items = kanbanGroups[stage] || [];
                  const totalVal = items.reduce((s, p) => s + p.montant_estime_cents, 0);
                  return (
                    <div key={stage} className="flex-shrink-0 w-[220px] bg-white/[0.03] border border-white/[0.06] rounded-xl flex flex-col"
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-1", "ring-blue-500/40"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove("ring-1", "ring-blue-500/40"); }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-1", "ring-blue-500/40"); if (dragId) { updateStage(dragId, stage); setDragId(null); } }}>
                      <div className="px-3 py-2.5 border-b border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">{STAGE_LABELS[stage]}</span>
                          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">{items.length}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5">{(totalVal / 100).toLocaleString("fr-FR")} €</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[500px]">
                        {items.map((p) => (
                          <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onClick={() => openDetail(p)}
                            className="bg-white/5 border border-white/10 rounded-lg p-2.5 cursor-grab hover:bg-white/10 transition-all active:cursor-grabbing">
                            <div className="flex items-start gap-1.5">
                              <GripVertical className="h-3 w-3 text-slate-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-200 truncate">{p.contact_name}</p>
                                {p.company_name && <p className="text-[10px] text-slate-500 truncate">{p.company_name}</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.plan_vise && <span className="px-1 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300">{p.plan_vise}</span>}
                              <span className={`px-1 py-0.5 rounded text-[9px] ${SOURCE_COLORS[p.source] || "bg-slate-500/20 text-slate-300"}`}>{SOURCE_LABELS[p.source] || p.source}</span>
                            </div>
                            {p.montant_estime_cents > 0 && <p className="text-[10px] text-emerald-400 mt-1">{(p.montant_estime_cents / 100).toLocaleString("fr-FR")} €/mois</p>}
                            {p.next_action_date && <p className={`text-[10px] mt-1 flex items-center gap-1 ${isOverdue(p.next_action_date) ? "text-red-400" : "text-slate-500"}`}><Calendar className="h-2.5 w-2.5" /> {p.next_action_date}</p>}
                            <p className="text-[9px] text-slate-600 mt-0.5">il y a {Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)}j</p>
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">Aucun prospect</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Final stages */}
              <div className="flex gap-3">
                {FINAL_STAGES.map((stage) => {
                  const items = kanbanGroups[stage] || [];
                  return (
                    <div key={stage} className={`flex-1 rounded-lg p-3 border ${stage === "gagne" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-500/5 border-slate-500/20"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${stage === "gagne" ? "text-emerald-400" : "text-slate-400"}`}>{STAGE_LABELS[stage]}</span>
                        <span className="text-[10px] text-slate-500">{items.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Table View */
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ALL_STAGES.map((s) => {
                  const count = kanbanGroups[s]?.length ?? 0;
                  return (
                    <span key={s} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STAGE_COLORS[s]}`}>
                      {STAGE_LABELS[s]} ({count})
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200" />
                </div>
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200">
                  <option value="all">Toutes sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                        <th className="px-4 py-3">Contact</th><th className="px-4 py-3">Entreprise</th><th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Source</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Montant</th>
                        <th className="px-4 py-3">Action</th><th className="px-4 py-3">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProspects.map((p) => (
                        <tr key={p.id} onClick={() => openDetail(p)} className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer">
                          <td className="px-4 py-3"><p className="text-slate-200 font-medium">{p.contact_name}</p><p className="text-[11px] text-slate-500">{p.contact_email}</p></td>
                          <td className="px-4 py-3 text-slate-400">{p.company_name || "—"}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STAGE_COLORS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span></td>
                          <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${SOURCE_COLORS[p.source]}`}>{SOURCE_LABELS[p.source]}</span></td>
                          <td className="px-4 py-3 text-slate-400 capitalize">{p.plan_vise || "—"}</td>
                          <td className="px-4 py-3 text-emerald-400">{p.montant_estime_cents > 0 ? `${(p.montant_estime_cents / 100).toLocaleString("fr-FR")} €` : "—"}</td>
                          <td className="px-4 py-3">{p.next_action_date ? <span className={`text-xs ${isOverdue(p.next_action_date) ? "text-red-400" : "text-slate-500"}`}>{p.next_action_date}</span> : "—"}</td>
                          <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{(Array.isArray(p.tags) ? p.tags : []).map((t: string) => <span key={t} className={`px-1 py-0.5 rounded text-[9px] ${TAG_COLORS[t] || "bg-slate-500/20 text-slate-300"}`}>{t}</span>)}</div></td>
                        </tr>
                      ))}
                      {filteredProspects.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          <Users className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                          Aucun prospect. <button onClick={() => setNewDialog(true)} className="text-blue-400 hover:underline">Creer le premier</button>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ ONBOARDING ═══ */}
      {subTab === "onboarding" && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <Rocket className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-slate-200">{onboarding.length} cabinet(s) en cours d'onboarding</p>
              <p className="text-xs text-slate-500">Cabinets crees dans les 90 derniers jours</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                    <th className="px-4 py-3">Cabinet</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Progression</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {onboarding.map((c) => {
                    const pct = getOnboardingPct(c);
                    const daysSince = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
                    const needsRelance = pct === 25 && daysSince > 7;
                    const steps = [
                      { label: "Compte", ok: true }, { label: "1er client", ok: c.total_clients > 0 },
                      { label: "1ere LM", ok: c.total_lm > 0 }, { label: "Documents", ok: c.total_docs > 0 },
                    ];
                    return (
                      <tr key={c.cabinet_id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-slate-200 font-medium">{c.cabinet_nom}</td>
                        <td className="px-4 py-3 text-slate-400">{c.contact_name || c.contact_email || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{formatRelative(c.created_at)}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 capitalize">{c.plan || "—"}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-white/5"><div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} /></div>
                            <span className="text-xs text-slate-500">{pct}%</span>
                          </div>
                          <div className="flex gap-1 mt-1">
                            {steps.map((s) => <span key={s.label} className={`text-[9px] px-1 py-0.5 rounded ${s.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/10 text-slate-600"}`}>{s.label}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {pct === 100 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">Complet</span>}
                          {needsRelance && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 animate-pulse">A relancer</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.contact_email && (
                            <button onClick={() => {
                              const missing = [c.total_clients === 0 ? "ajouter votre premier client" : null, c.total_lm === 0 ? "creer votre premiere lettre de mission" : null, c.total_docs === 0 ? "uploader vos documents" : null].filter(Boolean).join(", ");
                              const body = encodeURIComponent(`Bonjour ${c.contact_name || ""},\n\nNous esperons que votre experience avec GRIMY se passe bien.\n\nPour tirer le meilleur parti de la plateforme, il vous reste a : ${missing || "finaliser votre configuration"}.\n\nN hesitez pas a nous contacter si vous avez besoin d aide.\n\nCordialement,\nL equipe GRIMY`);
                              window.open(`mailto:${c.contact_email}?subject=${encodeURIComponent("GRIMY — Besoin d'aide pour demarrer ?")}&body=${body}`, "_blank");
                              if (c.prospect_id) { supabase.from("admin_crm_activities").insert({ prospect_id: c.prospect_id, type: "relance", content: `Relance onboarding - ${pct}% complete`, created_by: profile?.id }).catch((e) => { logger.warn("[CRM]", "activity error:", e); }); }
                            }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Mail className="h-3 w-3" /> Relancer</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {onboarding.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500"><Rocket className="h-8 w-8 mx-auto mb-2 text-slate-600" />Aucun cabinet recent</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS ═══ */}
      {subTab === "analytics" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Funnel Pipeline</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ALL_STAGES.map((s) => ({ stage: STAGE_LABELS[s], count: stats.stages?.[s] || 0 }))} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: "#94a3b8", fontSize: 11 }} width={90} />
                  <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {ALL_STAGES.map((s) => <Cell key={s} fill={STAGE_CHART_COLORS[s]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sources Pie */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Repartition par source</h3>
              {stats.sources && Object.keys(stats.sources).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={Object.entries(stats.sources).map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {Object.keys(stats.sources).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-600 text-center py-10">Aucune donnee</p>}
            </div>

            {/* Monthly conversions */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Conversions mensuelles</h3>
              {stats.monthly_conversions?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats.monthly_conversions.map((m) => ({ month: new Date(m.month).toLocaleDateString("fr-FR", { month: "short" }), conversions: m.conversions }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                    <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="conversions" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-600 text-center py-10">Aucune conversion</p>}
            </div>

            {/* Value by plan */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Valeur pipeline par plan</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={["solo", "cabinet", "enterprise"].map((plan) => ({
                  plan: plan.charAt(0).toUpperCase() + plan.slice(1),
                  value: prospects.filter((p) => p.plan_vise === plan && !["gagne", "perdu"].includes(p.stage)).reduce((s, p) => s + p.montant_estime_cents, 0) / 100,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="plan" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                  <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(v: number) => [`${v.toLocaleString("fr-FR")} €`]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                    <Cell fill="#60a5fa" /><Cell fill="#a78bfa" /><Cell fill="#34d399" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overdue actions */}
          {(stats.overdue_actions ?? 0) > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> Actions en retard</h3>
              <div className="space-y-2">
                {prospects.filter((p) => isOverdue(p.next_action_date) && !["gagne", "perdu"].includes(p.stage)).sort((a, b) => new Date(a.next_action_date!).getTime() - new Date(b.next_action_date!).getTime()).slice(0, 10).map((p) => (
                  <div key={p.id} onClick={() => openDetail(p)} className="flex items-center justify-between py-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] px-2 rounded">
                    <div><span className="text-sm text-slate-200">{p.contact_name}</span>{p.next_action && <span className="text-xs text-slate-500 ml-2">— {p.next_action}</span>}</div>
                    <span className="text-xs text-red-400">{p.next_action_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PROSPECT DETAIL SHEET ═══ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
          {selectedProspect && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-slate-200">
                  {selectedProspect.contact_name}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STAGE_COLORS[selectedProspect.stage]}`}>{STAGE_LABELS[selectedProspect.stage]}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                {/* Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Email</span><a href={`mailto:${selectedProspect.contact_email}`} className="text-blue-400 hover:underline">{selectedProspect.contact_email}</a></div>
                  {selectedProspect.contact_phone && <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Telephone</span><a href={`tel:${selectedProspect.contact_phone}`} className="text-blue-400 hover:underline">{selectedProspect.contact_phone}</a></div>}
                  {selectedProspect.company_name && <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Entreprise</span><span className="text-slate-300">{selectedProspect.company_name}</span></div>}
                  {selectedProspect.siren && <div className="flex items-center justify-between text-sm"><span className="text-slate-500">SIREN</span><span className="text-slate-300 font-mono">{selectedProspect.siren}</span></div>}
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Source</span><span className={`px-1.5 py-0.5 rounded text-[10px] ${SOURCE_COLORS[selectedProspect.source]}`}>{SOURCE_LABELS[selectedProspect.source]}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Plan vise</span><span className="text-slate-300 capitalize">{selectedProspect.plan_vise || "—"}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Montant</span><span className="text-emerald-400">{(selectedProspect.montant_estime_cents / 100).toLocaleString("fr-FR")} €/mois</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Cree</span><span className="text-slate-400">{formatRelative(selectedProspect.created_at)}</span></div>
                  <div className="flex flex-wrap gap-1 pt-1">{(Array.isArray(selectedProspect.tags) ? selectedProspect.tags : []).map((t: string) => <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] ${TAG_COLORS[t] || "bg-slate-500/20 text-slate-300"}`}>{t}</span>)}</div>
                </div>

                {/* Next action */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Prochaine action</h4>
                  <div className="flex gap-2">
                    <input type="text" value={editAction} onChange={(e) => setEditAction(e.target.value)} placeholder="Action..." className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-slate-200" onBlur={(e) => updateNextAction(e.target.value, editActionDate)} />
                    <input type="date" value={editActionDate} onChange={(e) => setEditActionDate(e.target.value)} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-slate-200" onBlur={(e) => updateNextAction(editAction, e.target.value)} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { window.open(`mailto:${selectedProspect.contact_email}?subject=${encodeURIComponent("GRIMY — Suite a notre echange")}&body=${encodeURIComponent(`Bonjour ${selectedProspect.contact_name},\n\n`)}`, "_blank"); }} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"><Mail className="h-3 w-3" /> Email</button>
                  <button disabled={!selectedProspect.contact_phone} onClick={() => window.open(`tel:${selectedProspect.contact_phone}`, "_blank")} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"><Phone className="h-3 w-3" /> Appeler</button>
                  <button onClick={handlePlanDemo} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-colors"><Video className="h-3 w-3" /> Planifier demo</button>
                  <button onClick={() => setLostDialog(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"><X className="h-3 w-3" /> Perdu</button>
                  {["proposition", "negociation"].includes(selectedProspect.stage) && (
                    <button onClick={() => setConvertDialog(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"><UserCheck className="h-3 w-3" /> Convertir</button>
                  )}
                  <button onClick={() => {
                    setNewForm({
                      contact_name: selectedProspect.contact_name,
                      contact_email: selectedProspect.contact_email,
                      contact_phone: selectedProspect.contact_phone || "",
                      company_name: selectedProspect.company_name || "",
                      siren: selectedProspect.siren || "",
                      source: selectedProspect.source,
                      plan_vise: selectedProspect.plan_vise || "solo",
                      montant_estime_cents: selectedProspect.montant_estime_cents,
                      notes: selectedProspect.notes || "",
                      next_action: selectedProspect.next_action || "",
                      next_action_date: selectedProspect.next_action_date || "",
                      tags: Array.isArray(selectedProspect.tags) ? [...selectedProspect.tags] : [],
                    });
                    setSheetOpen(false);
                    setNewDialog(true);
                  }} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-500/20 text-slate-300 rounded-lg hover:bg-slate-500/30 transition-colors"><Copy className="h-3 w-3" /> Dupliquer</button>
                </div>

                {/* Stage change */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Changer l'etape</h4>
                  <div className="flex flex-wrap gap-1">
                    {ALL_STAGES.map((s) => (
                      <button key={s} onClick={() => updateStage(selectedProspect.id, s)} disabled={s === selectedProspect.stage} className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors disabled:opacity-40 ${s === selectedProspect.stage ? STAGE_COLORS[s] : "border-white/10 text-slate-500 hover:bg-white/5"}`}>{STAGE_LABELS[s]}</button>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Activites</h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {activities.map((a) => {
                      const Icon = ACTIVITY_ICONS[a.type] || FileText;
                      return (
                        <div key={a.id} className="flex gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center mt-0.5"><Icon className="h-3 w-3 text-slate-500" /></div>
                          <div><p className="text-sm text-slate-300">{a.content}</p><p className="text-[10px] text-slate-600">{formatRelative(a.created_at)} — <span className="capitalize">{a.type}</span></p></div>
                        </div>
                      );
                    })}
                    {activities.length === 0 && <p className="text-sm text-slate-600 text-center py-4">Aucune activite</p>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2">
                    <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-slate-200 w-28">
                      {["note", "appel", "email", "demo", "reunion", "relance"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="text" value={activityContent} onChange={(e) => setActivityContent(e.target.value)} placeholder="Contenu..." className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-slate-200" onKeyDown={(e) => e.key === "Enter" && handleAddActivity()} />
                    <button onClick={handleAddActivity} disabled={!activityContent.trim()} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40 transition-colors">Ajouter</button>
                  </div>
                </div>

                <button onClick={() => setDeleteDialog(true)} className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Supprimer ce prospect</button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ DIALOGS ═══ */}

      {/* New Prospect */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau prospect</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400">Nom du contact *</label><input type="text" value={newForm.contact_name} onChange={(e) => setNewForm({ ...newForm, contact_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
              <div><label className="text-xs text-slate-400">Email *</label><input type="email" value={newForm.contact_email} onChange={(e) => setNewForm({ ...newForm, contact_email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400">Telephone</label><input type="tel" value={newForm.contact_phone} onChange={(e) => setNewForm({ ...newForm, contact_phone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
              <div><label className="text-xs text-slate-400">Entreprise</label><input type="text" value={newForm.company_name} onChange={(e) => setNewForm({ ...newForm, company_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400">SIREN</label><input type="text" value={newForm.siren} onChange={(e) => setNewForm({ ...newForm, siren: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
              <div><label className="text-xs text-slate-400">Source</label><select value={newForm.source} onChange={(e) => setNewForm({ ...newForm, source: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Plan vise</label>
              <div className="flex gap-2 mt-1">
                {(["solo", "cabinet", "enterprise"] as const).map((p) => (
                  <button key={p} onClick={() => setNewForm({ ...newForm, plan_vise: p, montant_estime_cents: PLAN_PRICES[p] })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newForm.plan_vise === p ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-white/5 text-slate-400 border-white/10"}`}>
                    <span className="capitalize">{p}</span><span className="block text-[10px] mt-0.5 text-slate-500">{PLAN_PRICES[p] / 100} €/mois</span>
                  </button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-slate-400">Montant estime (€/mois)</label><input type="number" value={newForm.montant_estime_cents / 100} onChange={(e) => setNewForm({ ...newForm, montant_estime_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
            <div><label className="text-xs text-slate-400">Notes</label><textarea value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1 resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400">Prochaine action</label><input type="text" value={newForm.next_action} onChange={(e) => setNewForm({ ...newForm, next_action: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
              <div><label className="text-xs text-slate-400">Date action</label><input type="date" value={newForm.next_action_date} onChange={(e) => setNewForm({ ...newForm, next_action_date: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1" /></div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Tags</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TAG_OPTIONS.map((t) => <button key={t} onClick={() => setNewForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))} className={`px-2 py-1 rounded text-xs transition-colors ${newForm.tags.includes(t) ? TAG_COLORS[t] || "bg-blue-500/20 text-blue-300" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}>{t}</button>)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setNewDialog(false)} className="px-4 py-2 text-sm text-slate-400">Annuler</button>
            <button onClick={handleCreate} disabled={!newForm.contact_name.trim() || !newForm.contact_email.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">Creer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost */}
      <Dialog open={lostDialog} onOpenChange={setLostDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme perdu</DialogTitle></DialogHeader>
          <div><label className="text-sm text-slate-300">Raison de la perte *</label><textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={3} placeholder="Ex: budget insuffisant, concurrent choisi..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1 resize-none" /></div>
          <DialogFooter>
            <button onClick={() => setLostDialog(false)} className="px-4 py-2 text-sm text-slate-400">Annuler</button>
            <button onClick={handleMarkLost} disabled={!lostReason.trim()} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors">Confirmer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert */}
      <AlertDialog open={convertDialog} onOpenChange={setConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir en cabinet</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProspect && <div className="space-y-1 mt-2"><p><strong>Nom :</strong> {selectedProspect.company_name || selectedProspect.contact_name}</p>{selectedProspect.siren && <p><strong>SIREN :</strong> {selectedProspect.siren}</p>}<p><strong>Plan :</strong> {selectedProspect.plan_vise || "solo"}</p></div>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConvert} className="bg-emerald-600 hover:bg-emerald-700">Convertir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer le prospect</AlertDialogTitle><AlertDialogDescription>Cette action est irreversible. Toutes les activites associees seront supprimees.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
