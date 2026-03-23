import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Phone, Mail, Video, Users, Bell, FileText, Plus, Search, Filter,
  ChevronDown, ChevronRight, GripVertical, ExternalLink, Download,
  AlertTriangle, CheckCircle, Clock, DollarSign, TrendingUp,
  ArrowRight, X, Pencil, Trash2, BarChart3, List, Columns3,
  Star, Flame, Snowflake, Zap, Tag, Calendar, RefreshCw,
  Building2, User, ArrowRightLeft, Eye, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Prospect {
  id: string;
  cabinet_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  siren: string | null;
  source: string | null;
  stage: string;
  plan_vise: string | null;
  montant_estime_cents: number;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface CrmActivity {
  id: string;
  prospect_id: string | null;
  cabinet_id: string | null;
  type: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  { id: "lead", label: "Lead", color: "bg-slate-500", text: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/10" },
  { id: "qualifie", label: "Qualifie", color: "bg-blue-500", text: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  { id: "demo_planifiee", label: "Demo planifiee", color: "bg-violet-500", text: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/10" },
  { id: "demo_faite", label: "Demo faite", color: "bg-purple-500", text: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  { id: "proposition", label: "Proposition", color: "bg-orange-500", text: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  { id: "negociation", label: "Negociation", color: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  { id: "gagne", label: "Gagne", color: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  { id: "perdu", label: "Perdu", color: "bg-red-500", text: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10" },
] as const;

const SOURCES = [
  { id: "site_web", label: "Site web" },
  { id: "demo", label: "Demo" },
  { id: "bouche_a_oreille", label: "Bouche a oreille" },
  { id: "salon", label: "Salon" },
  { id: "partenaire", label: "Partenaire" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "autre", label: "Autre" },
];

const PLANS = [
  { id: "solo", label: "Solo", price: "29 EUR/mois" },
  { id: "cabinet", label: "Cabinet", price: "79 EUR/mois" },
  { id: "enterprise", label: "Enterprise", price: "199 EUR/mois" },
];

const ACTIVITY_TYPES = [
  { id: "appel", label: "Appel", icon: Phone },
  { id: "email", label: "Email", icon: Mail },
  { id: "demo", label: "Demo", icon: Video },
  { id: "reunion", label: "Reunion", icon: Users },
  { id: "relance", label: "Relance", icon: Bell },
  { id: "note", label: "Note", icon: FileText },
];

const TAG_OPTIONS = [
  { id: "urgent", label: "Urgent", color: "bg-red-500/20 text-red-400" },
  { id: "vip", label: "VIP", color: "bg-amber-500/20 text-amber-400" },
  { id: "chaud", label: "Chaud", color: "bg-orange-500/20 text-orange-400" },
  { id: "froid", label: "Froid", color: "bg-cyan-500/20 text-cyan-400" },
];

function scoreProspect(p: Prospect): number {
  let score = 0;
  // Source scoring
  if (p.source === "demo") score += 80;
  else if (p.source === "site_web") score += 60;
  else if (p.source === "partenaire") score += 55;
  else if (p.source === "bouche_a_oreille") score += 50;
  else if (p.source === "linkedin") score += 40;
  else if (p.source === "salon") score += 35;
  else score += 20;
  // Plan scoring
  if (p.plan_vise === "enterprise") score += 30;
  else if (p.plan_vise === "cabinet") score += 20;
  else if (p.plan_vise === "solo") score += 10;
  // Freshness bonus
  const daysSinceCreation = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
  if (daysSinceCreation < 7) score += 20;
  else if (daysSinceCreation < 14) score += 10;
  return Math.min(score, 100);
}

function isStale(p: Prospect, activities: CrmActivity[]): boolean {
  if (p.stage === "gagne" || p.stage === "perdu") return false;
  const prospectActivities = activities.filter(a => a.prospect_id === p.id);
  if (prospectActivities.length === 0) {
    return (Date.now() - new Date(p.created_at).getTime()) > 7 * 86400000;
  }
  const latest = prospectActivities.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  return (Date.now() - new Date(latest.created_at).getTime()) > 7 * 86400000;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });
}

function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminCRM() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");

  // Dialogs
  const [showNewProspect, setShowNewProspect] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showFunnel, setShowFunnel] = useState(false);

  // New prospect form
  const [newForm, setNewForm] = useState({
    contact_name: "", contact_email: "", contact_phone: "",
    company_name: "", siren: "", source: "site_web",
    plan_vise: "cabinet", montant_estime_cents: 0, notes: "",
    next_action: "", next_action_date: "",
  });

  // Activity form
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");

  // Drag state
  const dragRef = useRef<{ id: string; stage: string } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Mobile stage selector
  const [mobileStage, setMobileStage] = useState("lead");

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: pData }, { data: aData }] = await Promise.all([
        supabase.from("admin_prospects").select("*").order("updated_at", { ascending: false }),
        supabase.from("admin_crm_activities").select("*").order("created_at", { ascending: false }),
      ]);
      setProspects((pData ?? []).map(p => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [] })));
      setActivities(aData ?? []);
    } catch {
      toast.error("Erreur chargement CRM");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Filtered prospects ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = prospects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.contact_name.toLowerCase().includes(q) ||
        (p.company_name || "").toLowerCase().includes(q) ||
        p.contact_email.toLowerCase().includes(q)
      );
    }
    if (filterStage !== "all") list = list.filter(p => p.stage === filterStage);
    if (filterSource !== "all") list = list.filter(p => p.source === filterSource);
    if (filterPlan !== "all") list = list.filter(p => p.plan_vise === filterPlan);
    return list;
  }, [prospects, searchQuery, filterStage, filterSource, filterPlan]);

  // ─── Metrics ───────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const active = prospects.filter(p => p.stage !== "perdu" && p.stage !== "gagne");
    const pipeline = active.reduce((s, p) => s + (p.montant_estime_cents || 0), 0);
    const won = prospects.filter(p => p.stage === "gagne");
    const total = prospects.filter(p => p.stage === "gagne" || p.stage === "perdu");
    const convRate = total.length > 0 ? Math.round((won.length / total.length) * 100) : 0;
    const avgCycle = won.length > 0
      ? Math.round(won.reduce((s, p) => s + daysBetween(p.created_at, p.updated_at), 0) / won.length)
      : 0;
    return { activeCount: active.length, pipeline, convRate, avgCycle };
  }, [prospects]);

  // ─── Today's actions ───────────────────────────────────────────────────────

  const todayActions = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return prospects.filter(p =>
      p.next_action_date && p.next_action_date <= today &&
      p.stage !== "gagne" && p.stage !== "perdu"
    ).sort((a, b) => (a.next_action_date || "").localeCompare(b.next_action_date || ""));
  }, [prospects]);

  // ─── Funnel data ───────────────────────────────────────────────────────────

  const funnelData = useMemo(() =>
    STAGES.filter(s => s.id !== "perdu").map(s => ({
      name: s.label,
      value: prospects.filter(p => p.stage === s.id).length,
      fill: s.id === "lead" ? "#64748b" : s.id === "qualifie" ? "#3b82f6" : s.id === "demo_planifiee" ? "#8b5cf6"
        : s.id === "demo_faite" ? "#a855f7" : s.id === "proposition" ? "#f97316"
        : s.id === "negociation" ? "#f59e0b" : "#10b981",
    })), [prospects]);

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async function createProspect() {
    if (!newForm.contact_name.trim() || !newForm.contact_email.trim()) {
      toast.error("Nom et email requis");
      return;
    }
    const { error } = await supabase.from("admin_prospects").insert({
      contact_name: newForm.contact_name,
      contact_email: newForm.contact_email,
      contact_phone: newForm.contact_phone || null,
      company_name: newForm.company_name || null,
      siren: newForm.siren || null,
      source: newForm.source,
      plan_vise: newForm.plan_vise,
      montant_estime_cents: newForm.montant_estime_cents,
      notes: newForm.notes || null,
      next_action: newForm.next_action || null,
      next_action_date: newForm.next_action_date || null,
    });
    if (error) { toast.error("Erreur creation"); return; }
    toast.success("Prospect cree");
    setShowNewProspect(false);
    setNewForm({ contact_name: "", contact_email: "", contact_phone: "", company_name: "", siren: "", source: "site_web", plan_vise: "cabinet", montant_estime_cents: 0, notes: "", next_action: "", next_action_date: "" });
    fetchData();
  }

  async function updateStage(id: string, stage: string) {
    const { error } = await supabase.from("admin_prospects").update({
      stage,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erreur mise a jour"); return; }
    setProspects(prev => prev.map(p => p.id === id ? { ...p, stage, updated_at: new Date().toISOString() } : p));
    // Auto-create activity
    await supabase.from("admin_crm_activities").insert({
      prospect_id: id,
      type: "note",
      content: `Stage change vers ${STAGES.find(s => s.id === stage)?.label || stage}`,
      created_by: user?.id,
    });
  }

  async function updateProspectField(id: string, field: string, value: unknown) {
    const { error } = await supabase.from("admin_prospects").update({
      [field]: value,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setProspects(prev => prev.map(p => p.id === id ? { ...p, [field]: value, updated_at: new Date().toISOString() } : p));
    if (selectedProspect?.id === id) {
      setSelectedProspect(prev => prev ? { ...prev, [field]: value, updated_at: new Date().toISOString() } : null);
    }
  }

  async function addActivity(prospectId: string) {
    if (!activityContent.trim()) return;
    const { error } = await supabase.from("admin_crm_activities").insert({
      prospect_id: prospectId,
      type: activityType,
      content: activityContent,
      created_by: user?.id,
    });
    if (error) { toast.error("Erreur"); return; }
    toast.success("Activite ajoutee");
    setActivityContent("");
    fetchData();
  }

  async function deleteProspect(id: string) {
    const { error } = await supabase.from("admin_prospects").delete().eq("id", id);
    if (error) { toast.error("Erreur suppression"); return; }
    toast.success("Prospect supprime");
    setSelectedProspect(null);
    fetchData();
  }

  async function convertToClient(p: Prospect) {
    try {
      const { error } = await supabase.rpc("admin_create_cabinet", {
        p_name: p.company_name || p.contact_name,
        p_siren: p.siren || null,
        p_plan: p.plan_vise || "cabinet",
      });
      if (error) throw error;
      await updateStage(p.id, "gagne");
      await supabase.from("admin_crm_activities").insert({
        prospect_id: p.id,
        type: "note",
        content: "Converti en cabinet client",
        created_by: user?.id,
      });
      toast.success("Cabinet cree et prospect marque comme gagne");
      fetchData();
    } catch {
      toast.error("Erreur lors de la conversion");
    }
  }

  async function sendFollowupEmail(p: Prospect) {
    const { error } = await supabase.from("email_queue").insert({
      to_email: p.contact_email,
      template: "prospect_followup",
      subject: `GRIMY — Suivi de votre demande`,
      body: `Bonjour ${p.contact_name},\n\nNous revenons vers vous concernant votre interet pour GRIMY.\n\n${p.next_action ? `Prochaine etape : ${p.next_action}` : "N'hesitez pas a nous contacter pour toute question."}\n\nCordialement,\nL'equipe GRIMY`,
      status: "pending",
    });
    if (error) { toast.error("Erreur envoi email"); return; }
    await supabase.from("admin_crm_activities").insert({
      prospect_id: p.id,
      type: "relance",
      content: `Email de relance envoye a ${p.contact_email}`,
      created_by: user?.id,
    });
    toast.success("Email programme");
    fetchData();
  }

  function exportCSV() {
    const headers = ["Nom", "Email", "Telephone", "Entreprise", "SIREN", "Source", "Stage", "Plan", "Montant EUR", "Prochaine action", "Date action", "Score", "Tags", "Cree le"];
    const rows = prospects.map(p => [
      p.contact_name, p.contact_email, p.contact_phone || "", p.company_name || "",
      p.siren || "", p.source || "", p.stage, p.plan_vise || "",
      String(p.montant_estime_cents / 100), p.next_action || "", p.next_action_date || "",
      String(scoreProspect(p)), (p.tags || []).join(";"), p.created_at.split("T")[0],
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `crm_prospects_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  }

  // ─── Drag and drop handlers ────────────────────────────────────────────────

  function handleDragStart(id: string, stage: string) {
    dragRef.current = { id, stage };
  }

  function handleDragOver(e: React.DragEvent, stage: string) {
    e.preventDefault();
    setDragOverStage(stage);
  }

  function handleDrop(stage: string) {
    if (dragRef.current && dragRef.current.stage !== stage) {
      updateStage(dragRef.current.id, stage);
    }
    dragRef.current = null;
    setDragOverStage(null);
  }

  // ─── Score badge ───────────────────────────────────────────────────────────

  function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? "bg-emerald-500/20 text-emerald-400" : score >= 50 ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-400";
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}</span>;
  }

  // ─── Prospect card ─────────────────────────────────────────────────────────

  function ProspectCard({ p }: { p: Prospect }) {
    const score = scoreProspect(p);
    const stale = isStale(p, activities);
    const overdue = p.next_action_date && p.next_action_date < new Date().toISOString().split("T")[0];
    return (
      <div
        draggable
        onDragStart={() => handleDragStart(p.id, p.stage)}
        onClick={() => setSelectedProspect(p)}
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group ${
          stale ? "border-orange-500/40 bg-orange-500/5" : "border-white/10 bg-white/[0.03] hover:border-white/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate">{p.contact_name}</p>
            {p.company_name && <p className="text-[11px] text-slate-400 truncate">{p.company_name}</p>}
          </div>
          <ScoreBadge score={score} />
        </div>
        {/* Tags */}
        {p.tags && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {p.tags.map(t => {
              const tag = TAG_OPTIONS.find(o => o.id === t);
              return tag ? <span key={t} className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${tag.color}`}>{tag.label}</span> : null;
            })}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
          {p.plan_vise && <Badge className="text-[9px] border-0 bg-white/5 text-slate-400">{p.plan_vise}</Badge>}
          {p.montant_estime_cents > 0 && <span>{formatCents(p.montant_estime_cents)}</span>}
        </div>
        {p.next_action && (
          <div className={`flex items-center gap-1 mt-2 text-[10px] ${overdue ? "text-red-400" : "text-slate-500"}`}>
            <Clock className="w-3 h-3" />
            <span className="truncate">{p.next_action}</span>
            {overdue && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        )}
        {stale && (
          <div className="flex items-center gap-1 mt-1.5">
            <Badge className="text-[8px] bg-orange-500/20 text-orange-400 border-0">Inactif 7j+</Badge>
            <button
              onClick={e => { e.stopPropagation(); sendFollowupEmail(p); }}
              className="text-[9px] text-orange-400 hover:text-orange-300 underline"
            >Relancer</button>
          </div>
        )}
      </div>
    );
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-6 w-24 rounded bg-white/5 animate-pulse" />
              {[1, 2].map(j => <div key={j} className="h-28 rounded-lg border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1"><Users className="w-4 h-4" /> Prospects actifs</div>
          <p className="text-2xl font-bold text-slate-100">{metrics.activeCount}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1"><DollarSign className="w-4 h-4" /> Valeur pipeline</div>
          <p className="text-2xl font-bold text-slate-100">{formatCents(metrics.pipeline)}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1"><TrendingUp className="w-4 h-4" /> Taux conversion</div>
          <p className="text-2xl font-bold text-slate-100">{metrics.convRate}%</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1"><Clock className="w-4 h-4" /> Cycle moyen</div>
          <p className="text-2xl font-bold text-slate-100">{metrics.avgCycle}j</p>
        </div>
      </div>

      {/* ─── Today's Actions ─── */}
      {todayActions.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400">Actions du jour ({todayActions.length})</h3>
          </div>
          <div className="space-y-2">
            {todayActions.slice(0, 5).map(p => {
              const overdue = p.next_action_date! < new Date().toISOString().split("T")[0];
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]" onClick={() => setSelectedProspect(p)}>
                  <div className="flex items-center gap-3 min-w-0">
                    {overdue && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0 shrink-0">En retard</Badge>}
                    <span className="text-sm text-slate-200 truncate">{p.contact_name}</span>
                    <span className="text-xs text-slate-500 truncate">{p.next_action}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{p.next_action_date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Toolbar ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 w-56 h-9 bg-white/5 border-white/10 text-sm"
            />
          </div>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-36 h-9 bg-white/5 border-white/10 text-sm"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les stages</SelectItem>
              {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-36 h-9 bg-white/5 border-white/10 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sources</SelectItem>
              {SOURCES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPlan} onValueChange={setFilterPlan}>
            <SelectTrigger className="w-32 h-9 bg-white/5 border-white/10 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous plans</SelectItem>
              {PLANS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowFunnel(f => !f)} className="text-xs text-slate-400 h-9">
            <BarChart3 className="w-4 h-4 mr-1" /> Funnel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode(v => v === "kanban" ? "list" : "kanban")} className="text-xs text-slate-400 h-9">
            {viewMode === "kanban" ? <List className="w-4 h-4 mr-1" /> : <Columns3 className="w-4 h-4 mr-1" />}
            {viewMode === "kanban" ? "Liste" : "Kanban"}
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV} className="text-xs text-slate-400 h-9">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={() => setShowNewProspect(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 h-9">
            <Plus className="w-4 h-4" /> Prospect
          </Button>
        </div>
      </div>

      {/* ─── Funnel Chart ─── */}
      {showFunnel && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Entonnoir de conversion</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, idx) => (
                    <rect key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Kanban View ─── */}
      {viewMode === "kanban" && (
        <>
          {/* Mobile: select + list */}
          <div className="sm:hidden space-y-3">
            <Select value={mobileStage} onValueChange={setMobileStage}>
              <SelectTrigger className="w-full bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label} ({filtered.filter(p => p.stage === s.id).length})</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {filtered.filter(p => p.stage === mobileStage).map(p => <ProspectCard key={p.id} p={p} />)}
              {filtered.filter(p => p.stage === mobileStage).length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">Aucun prospect</p>
              )}
            </div>
          </div>

          {/* Desktop: horizontal kanban */}
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
            {STAGES.map(stage => {
              const stageProspects = filtered.filter(p => p.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  className={`flex-shrink-0 w-56 rounded-xl border transition-colors ${
                    dragOverStage === stage.id ? `${stage.border} ${stage.bg}` : "border-white/10 bg-white/[0.02]"
                  }`}
                  onDragOver={e => handleDragOver(e, stage.id)}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                      <span className="text-xs font-semibold text-slate-300">{stage.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                      {stageProspects.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                    {stageProspects.map(p => <ProspectCard key={p.id} p={p} />)}
                    {stageProspects.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-600">
                        <p>Glissez un prospect ici</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─── List View ─── */}
      {viewMode === "list" && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Nom</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Entreprise</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Stage</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Source</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Plan</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Montant</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Score</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const stale_ = isStale(p, activities);
                  const stageDef = STAGES.find(s => s.id === p.stage);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProspect(p)}
                      className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors ${stale_ ? "bg-orange-500/5" : ""}`}
                    >
                      <td className="py-2.5 px-4">
                        <div>
                          <p className="text-slate-200">{p.contact_name}</p>
                          <p className="text-[10px] text-slate-500">{p.contact_email}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{p.company_name || "—"}</td>
                      <td className="py-2.5 px-4">
                        <Badge className={`text-[10px] border-0 ${stageDef?.bg} ${stageDef?.text}`}>{stageDef?.label}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{SOURCES.find(s => s.id === p.source)?.label || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{p.plan_vise || "—"}</td>
                      <td className="py-2.5 px-4 text-right text-slate-300 font-mono text-xs">{p.montant_estime_cents > 0 ? formatCents(p.montant_estime_cents) : "—"}</td>
                      <td className="py-2.5 px-4"><ScoreBadge score={scoreProspect(p)} /></td>
                      <td className="py-2.5 px-4 text-[10px] text-slate-500 max-w-[150px] truncate">{p.next_action || "—"}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1">
                          {(p.tags || []).map(t => {
                            const tag = TAG_OPTIONS.find(o => o.id === t);
                            return tag ? <span key={t} className={`text-[8px] px-1 py-0.5 rounded-full ${tag.color}`}>{tag.label}</span> : null;
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500">Aucun prospect trouve</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── New Prospect Dialog ─── */}
      {showNewProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowNewProspect(false); }}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-100">Nouveau prospect</h3>
              <button onClick={() => setShowNewProspect(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Nom contact *</Label>
                  <Input value={newForm.contact_name} onChange={e => setNewForm(f => ({ ...f, contact_name: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Email *</Label>
                  <Input type="email" value={newForm.contact_email} onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Telephone</Label>
                  <Input value={newForm.contact_phone} onChange={e => setNewForm(f => ({ ...f, contact_phone: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Entreprise</Label>
                  <Input value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">SIREN</Label>
                  <Input value={newForm.siren} onChange={e => setNewForm(f => ({ ...f, siren: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Source</Label>
                  <Select value={newForm.source} onValueChange={v => setNewForm(f => ({ ...f, source: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-2 block">Plan vise</Label>
                <div className="flex gap-2">
                  {PLANS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setNewForm(f => ({ ...f, plan_vise: p.id, montant_estime_cents: p.id === "solo" ? 2900 : p.id === "cabinet" ? 7900 : 19900 }))}
                      className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                        newForm.plan_vise === p.id ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-200">{p.label}</p>
                      <p className="text-[10px] text-slate-500">{p.price}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Montant estime (EUR)</Label>
                  <Input type="number" value={newForm.montant_estime_cents / 100} onChange={e => setNewForm(f => ({ ...f, montant_estime_cents: Math.round(Number(e.target.value) * 100) }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Prochaine action date</Label>
                  <Input type="date" value={newForm.next_action_date} onChange={e => setNewForm(f => ({ ...f, next_action_date: e.target.value }))} className="bg-white/5 border-white/10 mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Prochaine action</Label>
                <Input value={newForm.next_action} onChange={e => setNewForm(f => ({ ...f, next_action: e.target.value }))} placeholder="Ex: Planifier demo, Envoyer proposition..." className="bg-white/5 border-white/10 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Notes</Label>
                <Textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="bg-white/5 border-white/10 mt-1" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowNewProspect(false)}>Annuler</Button>
                <Button onClick={createProspect} className="bg-blue-600 hover:bg-blue-700">Creer le prospect</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Prospect Detail Sheet ─── */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setSelectedProspect(null); }}>
          <div className="w-full max-w-xl bg-slate-900 border-l border-white/10 h-full overflow-y-auto shadow-2xl animate-slide-in-right">
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 p-4 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">{selectedProspect.contact_name}</h3>
                <button onClick={() => setSelectedProspect(null)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
              </div>
              {selectedProspect.company_name && <p className="text-sm text-slate-400 mt-0.5">{selectedProspect.company_name}</p>}
            </div>

            <div className="p-4 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Email</p>
                  <a href={`mailto:${selectedProspect.contact_email}`} className="text-blue-400 hover:underline text-xs">{selectedProspect.contact_email}</a>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Telephone</p>
                  <p className="text-xs text-slate-300">{selectedProspect.contact_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">SIREN</p>
                  <p className="text-xs text-slate-300">{selectedProspect.siren || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Source</p>
                  <p className="text-xs text-slate-300">{SOURCES.find(s => s.id === selectedProspect.source)?.label || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Plan vise</p>
                  <p className="text-xs text-slate-300">{selectedProspect.plan_vise || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Montant estime</p>
                  <p className="text-xs text-slate-300">{selectedProspect.montant_estime_cents > 0 ? formatCents(selectedProspect.montant_estime_cents) : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Score</p>
                  <ScoreBadge score={scoreProspect(selectedProspect)} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Cree le</p>
                  <p className="text-xs text-slate-300">{new Date(selectedProspect.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>

              {/* Stage selector */}
              <div>
                <Label className="text-xs text-slate-500 uppercase mb-2 block">Stage</Label>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => updateStage(selectedProspect.id, s.id)}
                      className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                        selectedProspect.stage === s.id ? `${s.border} ${s.bg} ${s.text}` : "border-white/10 text-slate-500 hover:bg-white/5"
                      }`}
                    >{s.label}</button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label className="text-xs text-slate-500 uppercase mb-2 block">Etiquettes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.map(tag => {
                    const active = (selectedProspect.tags || []).includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          const newTags = active
                            ? (selectedProspect.tags || []).filter(t => t !== tag.id)
                            : [...(selectedProspect.tags || []), tag.id];
                          updateProspectField(selectedProspect.id, "tags", newTags);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all border ${
                          active ? `${tag.color} border-current` : "text-slate-500 border-white/10 hover:bg-white/5"
                        }`}
                      >{tag.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Next action */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500">Prochaine action</Label>
                  <Input
                    value={selectedProspect.next_action || ""}
                    onChange={e => updateProspectField(selectedProspect.id, "next_action", e.target.value)}
                    className="bg-white/5 border-white/10 mt-1 text-sm"
                    placeholder="Ex: Appeler pour proposition"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Date</Label>
                  <Input
                    type="date"
                    value={selectedProspect.next_action_date || ""}
                    onChange={e => updateProspectField(selectedProspect.id, "next_action_date", e.target.value)}
                    className="bg-white/5 border-white/10 mt-1 text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-slate-500">Notes</Label>
                <Textarea
                  value={selectedProspect.notes || ""}
                  onChange={e => updateProspectField(selectedProspect.id, "notes", e.target.value)}
                  rows={3}
                  className="bg-white/5 border-white/10 mt-1 text-sm"
                />
              </div>

              {/* Raison perte */}
              {selectedProspect.stage === "perdu" && (
                <div>
                  <Label className="text-xs text-slate-500">Raison de la perte</Label>
                  <Input
                    value={selectedProspect.lost_reason || ""}
                    onChange={e => updateProspectField(selectedProspect.id, "lost_reason", e.target.value)}
                    className="bg-white/5 border-white/10 mt-1 text-sm"
                    placeholder="Prix, fonctionnalites, concurrent..."
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {selectedProspect.contact_phone && (
                  <a href={`tel:${selectedProspect.contact_phone}`}>
                    <Button variant="outline" size="sm" className="text-xs border-white/10 h-8">
                      <Phone className="w-3.5 h-3.5 mr-1" /> Appeler
                    </Button>
                  </a>
                )}
                <a href={`mailto:${selectedProspect.contact_email}`}>
                  <Button variant="outline" size="sm" className="text-xs border-white/10 h-8">
                    <Mail className="w-3.5 h-3.5 mr-1" /> Email
                  </Button>
                </a>
                <Button variant="outline" size="sm" className="text-xs border-white/10 h-8" onClick={() => sendFollowupEmail(selectedProspect)}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Relance email
                </Button>
                {selectedProspect.stage !== "gagne" && selectedProspect.stage !== "perdu" && (
                  <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => convertToClient(selectedProspect)}>
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Convertir en cabinet
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 ml-auto" onClick={() => deleteProspect(selectedProspect.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                </Button>
              </div>

              {/* Onboarding tracker for won prospects */}
              {selectedProspect.stage === "gagne" && selectedProspect.cabinet_id && (
                <OnboardingTracker cabinetId={selectedProspect.cabinet_id} />
              )}

              {/* Activity timeline */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Historique activites</h4>
                {/* Add activity form */}
                <div className="flex items-center gap-2 mb-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="w-28 h-8 bg-white/5 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={activityContent}
                    onChange={e => setActivityContent(e.target.value)}
                    placeholder="Ajouter une activite..."
                    className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                    onKeyDown={e => { if (e.key === "Enter") addActivity(selectedProspect.id); }}
                  />
                  <Button size="sm" onClick={() => addActivity(selectedProspect.id)} disabled={!activityContent.trim()} className="h-8 px-3 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* Timeline */}
                <div className="space-y-2">
                  {activities.filter(a => a.prospect_id === selectedProspect.id).map(a => {
                    const aType = ACTIVITY_TYPES.find(t => t.id === a.type);
                    const Icon = aType?.icon || FileText;
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className="text-[8px] border-0 bg-white/5 text-slate-400">{aType?.label || a.type}</Badge>
                            <span className="text-[10px] text-slate-600">{new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">{a.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  {activities.filter(a => a.prospect_id === selectedProspect.id).length === 0 && (
                    <p className="text-center text-xs text-slate-600 py-4">Aucune activite</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Tracker ────────────────────────────────────────────────────────

function OnboardingTracker({ cabinetId }: { cabinetId: string }) {
  const [data, setData] = useState<{ clients: number; lettres: number; created: string } | null>(null);

  useEffect(() => {
    async function fetch() {
      const [{ count: clients }, { count: lettres }, { data: cab }] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("cabinet_id", cabinetId),
        supabase.from("lettres_mission").select("*", { count: "exact", head: true }).eq("cabinet_id", cabinetId),
        supabase.from("cabinets").select("created_at").eq("id", cabinetId).single(),
      ]);
      setData({ clients: clients || 0, lettres: lettres || 0, created: cab?.data?.created_at || "" });
    }
    fetch();
  }, [cabinetId]);

  if (!data) return null;

  const checks = [
    { label: "Compte cree", done: true },
    { label: "Premier client ajoute", done: data.clients > 0 },
    { label: "Premiere lettre de mission", done: data.lettres > 0 },
    { label: "Formation faite", done: false },
  ];
  const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

  return (
    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-emerald-400">Onboarding</h4>
        <span className="text-[10px] text-emerald-400 font-bold">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5 mb-3" />
      <div className="space-y-1.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            {c.done
              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              : <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
            }
            <span className={c.done ? "text-emerald-400" : "text-slate-500"}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
