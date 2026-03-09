import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Users, AlertTriangle, TrendingUp, CalendarClock,
  GraduationCap, Shield, Settings2, X,
  Plus, Eye, EyeOff, LayoutDashboard,
  PieChart as PieChartIcon, BarChart3, Clock,
  RotateCcw, Zap, GripVertical,
  UserPlus, ClipboardCheck, Activity, Download,
  FileText, ChevronRight, RefreshCw,
} from "lucide-react";

// ── Widget Registry ──────────────────────────────────────────
type WidgetId =
  | "kpi_clients" | "kpi_alertes" | "kpi_score" | "kpi_revues"
  | "kpi_formation" | "kpi_controle"
  | "chart_vigilance" | "chart_risque" | "chart_timeline"
  | "gauge_score"
  | "list_alertes" | "list_activity"
  | "actions";

interface WidgetDef {
  id: WidgetId;
  label: string;
  icon: React.ReactNode;
  category: "KPI" | "Graphique" | "Liste" | "Actions";
  defaultOn: boolean; // shown by default
  cols: 1 | 2; // grid columns span (in the 2-col grid)
}

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi_clients", label: "Clients actifs", icon: <Users className="w-4 h-4" />, category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_alertes", label: "Alertes en cours", icon: <AlertTriangle className="w-4 h-4" />, category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_score", label: "Score moyen", icon: <TrendingUp className="w-4 h-4" />, category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_revues", label: "Revues echues", icon: <CalendarClock className="w-4 h-4" />, category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_formation", label: "Derniere formation", icon: <GraduationCap className="w-4 h-4" />, category: "KPI", defaultOn: false, cols: 1 },
  { id: "kpi_controle", label: "Prochain controle", icon: <Shield className="w-4 h-4" />, category: "KPI", defaultOn: false, cols: 1 },
  { id: "gauge_score", label: "Jauge de risque", icon: <TrendingUp className="w-4 h-4" />, category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_vigilance", label: "Repartition vigilance", icon: <PieChartIcon className="w-4 h-4" />, category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_risque", label: "Distribution des scores", icon: <BarChart3 className="w-4 h-4" />, category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_timeline", label: "Activite (7j)", icon: <Activity className="w-4 h-4" />, category: "Graphique", defaultOn: true, cols: 2 },
  { id: "list_alertes", label: "Dernieres alertes", icon: <AlertTriangle className="w-4 h-4" />, category: "Liste", defaultOn: false, cols: 1 },
  { id: "list_activity", label: "Journal d'activite", icon: <Clock className="w-4 h-4" />, category: "Liste", defaultOn: false, cols: 1 },
  { id: "actions", label: "Actions rapides", icon: <Zap className="w-4 h-4" />, category: "Actions", defaultOn: false, cols: 2 },
];

const VALID_WIDGET_IDS = new Set<WidgetId>(WIDGET_REGISTRY.map(w => w.id));
const getDef = (id: WidgetId) => WIDGET_REGISTRY.find(w => w.id === id);

const DEFAULT_LAYOUT: WidgetId[] = WIDGET_REGISTRY.filter(w => w.defaultOn).map(w => w.id);

// ── Chart styles ─────────────────────────────────────────────
const COLORS_VIG: Record<string, string> = {
  SIMPLIFIEE: "#22c55e", STANDARD: "#f59e0b", RENFORCEE: "#ef4444",
};
const VIG_LABELS: Record<string, string> = {
  SIMPLIFIEE: "Simplifiee", STANDARD: "Standard", RENFORCEE: "Renforcee",
};
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(217, 33%, 17%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", fontSize: "12px", color: "#e2e8f0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
};

// ── CSV safety ───────────────────────────────────────────────
function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (s.includes(";") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ── Custom pie label ─────────────────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Sortable Widget Wrapper ──────────────────────────────────
function SortableWidget({ id, editMode, children }: {
  id: string; editMode: boolean; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Glisser pour deplacer"
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
        </div>
      )}
      {children}
    </div>
  );
}

// ── Tooltip formatters ───────────────────────────────────────
function vigTooltipFormatter(value: number, name: string) {
  return [value, VIG_LABELS[name] || name];
}
function scoreTooltipFormatter(value: number) {
  return [`${value} client${value > 1 ? "s" : ""}`, "Nombre"];
}

// ═════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { clients, alertes, logs, isLoading: dataLoading } = useAppState();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [layout, setLayout] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [lastRefresh] = useState<Date>(new Date());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DnD sensors — require 8px drag distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Load dashboard config ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("dashboard_configs")
          .select("layout")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          const validLayout = (data.layout as string[]).filter(id => VALID_WIDGET_IDS.has(id as WidgetId)) as WidgetId[];
          if (validLayout.length > 0) setLayout(validLayout);
        }
      } catch { /* use default */ }
      if (!cancelled) setConfigLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Load parametres ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("cle", "lcbft_config")
          .maybeSingle();
        if (!cancelled && data?.valeur) {
          const valeur = data.valeur as Record<string, unknown>;
          if (valeur.date_derniere_formation) setDerniereFormation(valeur.date_derniere_formation as string);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Debounced save ──
  const saveLayout = useCallback((newLayout: WidgetId[]) => {
    setLayout(newLayout);
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await supabase.from("dashboard_configs").upsert(
          { user_id: user.id, layout: newLayout },
          { onConflict: "user_id" }
        );
      } catch { /* silent */ }
    }, 800);
  }, [user]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // ── DnD handler ──
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.indexOf(active.id as WidgetId);
    const newIndex = layout.indexOf(over.id as WidgetId);
    if (oldIndex === -1 || newIndex === -1) return;
    saveLayout(arrayMove(layout, oldIndex, newIndex));
  }, [layout, saveLayout]);

  // ── KPI calculations ──
  const clientsActifs = useMemo(() => clients.filter(c => c.statut === "ACTIF").length, [clients]);
  const alertesEnCours = useMemo(() => alertes.filter(a => a.statut === "EN COURS").length, [alertes]);
  const scoreMoyen = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF");
    if (actifs.length === 0) return 0;
    return Math.round(actifs.reduce((s, c) => s + c.scoreGlobal, 0) / actifs.length);
  }, [clients]);
  const revuesEchues = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return clients.filter(c => c.dateButoir && c.dateButoir < today && c.statut === "ACTIF").length;
  }, [clients]);
  const prochainControle = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // ── Chart data ──
  const vigData = useMemo(() => {
    const counts = clients.reduce((acc, c) => { acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1; return acc; }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value, label: VIG_LABELS[name] || name }));
  }, [clients]);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-20", label: "Faible", min: 0, max: 20, count: 0, fill: "#22c55e" },
      { range: "21-40", label: "Modere", min: 21, max: 40, count: 0, fill: "#84cc16" },
      { range: "41-60", label: "Moyen", min: 41, max: 60, count: 0, fill: "#f59e0b" },
      { range: "61-80", label: "Eleve", min: 61, max: 80, count: 0, fill: "#f97316" },
      { range: "81-100", label: "Critique", min: 81, max: 100, count: 0, fill: "#ef4444" },
    ];
    clients.forEach(c => { const b = buckets.find(b => c.scoreGlobal >= b.min && c.scoreGlobal <= b.max); if (b) b.count++; });
    return buckets;
  }, [clients]);

  const activityTimeline = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    logs.forEach(l => {
      if (l.horodatage) {
        const d = l.horodatage.split(/[T ]/)[0];
        if (d in days) days[d]++;
      }
    });
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      actions: count,
    }));
  }, [logs]);

  // Gauge data for radial bar
  const gaugeData = useMemo(() => [{
    name: "Score",
    value: scoreMoyen,
    fill: scoreMoyen <= 30 ? "#22c55e" : scoreMoyen <= 55 ? "#f59e0b" : "#ef4444",
  }], [scoreMoyen]);

  const latestAlertes = useMemo(() => [...alertes].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5), [alertes]);
  const latestLogs = useMemo(() => [...logs].sort((a, b) => (b.horodatage || "").localeCompare(a.horodatage || "")).slice(0, 6), [logs]);

  // ── Helpers ──
  function formatDate(d: string | null | undefined): string {
    if (!d) return "\u2014";
    try {
      return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return d; }
  }
  function scoreColor(score: number): string {
    if (score <= 30) return "text-emerald-400"; if (score <= 55) return "text-amber-400"; return "text-red-400";
  }

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (clients.length === 0) { toast.error("Aucun client a exporter"); return; }
    const headers = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable", "Date Butoir"];
    const rows = clients.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable, c.dateButoir].map(csvSafe));
    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `export_lcb_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${clients.length} clients exportes`);
  }, [clients]);

  // ── Greeting ──
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon apres-midi";
    return "Bonsoir";
  }, []);
  const displayName = profile?.full_name?.split(" ")[0] || "";

  // ── Widget toggle ──
  const toggleWidget = useCallback((id: WidgetId) => {
    const newLayout = layout.includes(id) ? layout.filter(w => w !== id) : [...layout, id];
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const resetLayout = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
    toast.success("Disposition reinitialise");
  }, [saveLayout]);

  // ── Remove widget (edit mode) ──
  const RemoveBtn = useCallback(({ id }: { id: WidgetId }) => {
    if (!editMode) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleWidget(id); }}
        className="absolute top-2 right-2 z-20 w-6 h-6 rounded-md bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Retirer le widget"
      >
        <X className="w-3 h-3 text-red-400" />
      </button>
    );
  }, [editMode, toggleWidget]);

  // ── Widget renderers ──
  const renderWidget = useCallback((id: WidgetId) => {
    switch (id) {
      // ────── KPI: Clients ──────
      case "kpi_clients":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer kpi-glow-blue h-full"
            onClick={() => navigate("/bdd")}
            role="button" tabIndex={0}
            aria-label={`${clientsActifs} clients actifs`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs text-slate-500">{clients.length} total</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{clientsActifs}</p>
            <p className="text-xs text-slate-500 mt-1">Clients actifs</p>
            <div className="mt-3 w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${clients.length > 0 ? (clientsActifs / clients.length) * 100 : 0}%` }} />
            </div>
          </div>
        );

      // ────── KPI: Alertes ──────
      case "kpi_alertes":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full ${alertesEnCours > 0 ? "ring-1 ring-red-500/20 kpi-glow-red" : "kpi-glow-green"}`}
            onClick={() => navigate("/registre")}
            role="button" tabIndex={0}
            aria-label={`${alertesEnCours} alertes en cours`}
            onKeyDown={e => e.key === "Enter" && navigate("/registre")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${alertesEnCours > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <AlertTriangle className={`w-5 h-5 ${alertesEnCours > 0 ? "text-red-400 animate-pulse" : "text-emerald-400"}`} />
              </div>
              <span className="text-xs text-slate-500">{alertes.length} au total</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${alertesEnCours > 0 ? "text-red-400" : "text-emerald-400"}`}>{alertesEnCours}</p>
            <p className="text-xs text-slate-500 mt-1">Alertes en cours</p>
          </div>
        );

      // ────── KPI: Score ──────
      case "kpi_score":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full ${scoreMoyen <= 30 ? "kpi-glow-green" : scoreMoyen <= 55 ? "kpi-glow-amber" : "kpi-glow-red"}`}
            onClick={() => navigate("/bdd")}
            role="button" tabIndex={0}
            aria-label={`Score moyen: ${scoreMoyen}/100`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${scoreMoyen <= 30 ? "bg-emerald-500/10" : scoreMoyen <= 55 ? "bg-amber-500/10" : "bg-red-500/10"} flex items-center justify-center`}>
                <TrendingUp className={`w-5 h-5 ${scoreColor(scoreMoyen)}`} />
              </div>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
            <p className="text-xs text-slate-500 mt-1">Score moyen</p>
            <div className="mt-3 w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${scoreMoyen <= 30 ? "bg-emerald-500" : scoreMoyen <= 55 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${scoreMoyen}%` }} />
            </div>
          </div>
        );

      // ────── KPI: Revues ──────
      case "kpi_revues":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full ${revuesEchues > 0 ? "ring-1 ring-red-500/20 kpi-glow-red" : "kpi-glow-green"}`}
            onClick={() => navigate("/bdd")}
            role="button" tabIndex={0}
            aria-label={`${revuesEchues} revues echues`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${revuesEchues > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <CalendarClock className={`w-5 h-5 ${revuesEchues > 0 ? "text-red-400" : "text-emerald-400"}`} />
              </div>
              <span className="text-xs text-slate-500">{revuesEchues > 0 ? "a traiter" : "tout ok"}</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${revuesEchues > 0 ? "text-red-400" : "text-emerald-400"}`}>{revuesEchues}</p>
            <p className="text-xs text-slate-500 mt-1">Revues echues</p>
          </div>
        );

      // ────── KPI: Formation ──────
      case "kpi_formation":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full"
            onClick={() => navigate("/gouvernance")}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === "Enter" && navigate("/gouvernance")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs text-slate-500">LCB-FT</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{formatDate(derniereFormation)}</p>
            <p className="text-xs text-slate-500 mt-1">Derniere formation</p>
          </div>
        );

      // ────── KPI: Controle ──────
      case "kpi_controle":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full"
            onClick={() => navigate("/controle")}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === "Enter" && navigate("/controle")}
          >
            <RemoveBtn id={id} />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-xs text-slate-500">planifie</span>
            </div>
            <p className="text-lg font-bold text-white">{formatDate(prochainControle)}</p>
            <p className="text-xs text-slate-500 mt-1">Prochain controle</p>
          </div>
        );

      // ────── Gauge: Score radial ──────
      case "gauge_score":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Niveau de risque global</h3>
            <p className="text-[11px] text-slate-500 mb-2">Score moyen des dossiers actifs</p>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius="70%" outerRadius="90%"
                  startAngle={180} endAngle={0}
                  data={gaugeData}
                  barSize={12}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: "rgba(255,255,255,0.04)" }}
                    animationDuration={800}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-16 relative z-10">
              <p className={`text-4xl font-bold tabular-nums ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {scoreMoyen <= 30 ? "Risque faible" : scoreMoyen <= 55 ? "Risque modere" : "Risque eleve"}
              </p>
            </div>
          </div>
        );

      // ────── Chart: Vigilance donut ──────
      case "chart_vigilance":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Vigilance</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {clients.length} dossiers
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Niveau applique par dossier</p>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <PieChartIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Aucun dossier</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={vigData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={vigData.length > 1 ? 4 : 0}
                      dataKey="value"
                      stroke="none"
                      label={renderPieLabel}
                      labelLine={false}
                      animationDuration={800}
                    >
                      {vigData.map((entry) => <Cell key={entry.name} fill={COLORS_VIG[entry.name] || "#64748b"} />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={vigTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-5 mt-2">
                  {vigData.map(entry => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_VIG[entry.name] || "#64748b" }} />
                      <span className="text-[11px] text-slate-400">{VIG_LABELS[entry.name]}</span>
                      <span className="text-[11px] font-semibold text-slate-300">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      // ────── Chart: Score distribution ──────
      case "chart_risque":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Scores de risque</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {clients.length} clients
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Distribution par tranche</p>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Aucun client</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreDistribution} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={scoreTooltipFormatter} />
                  <Bar dataKey="count" name="Clients" radius={[6, 6, 0, 0]} animationDuration={800}>
                    {scoreDistribution.map((entry) => <Cell key={entry.range} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );

      // ────── Chart: Activity timeline ──────
      case "chart_timeline":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Activite des 7 derniers jours</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {activityTimeline.reduce((s, d) => s + d.actions, 0)} actions
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Volume d'actions journalier</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityTimeline}>
                <defs>
                  <linearGradient id="gradientActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v} action${v > 1 ? "s" : ""}`, "Activite"]} />
                <Area
                  type="monotone"
                  dataKey="actions"
                  stroke="#3b82f6"
                  fill="url(#gradientActivity)"
                  strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", stroke: "#1e293b", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      // ────── List: Alertes ──────
      case "list_alertes":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">Dernieres alertes</h3>
                {alertesEnCours > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{alertesEnCours}</span>
                )}
              </div>
              <button onClick={() => navigate("/registre")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                Tout voir <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestAlertes.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-600">
                <Shield className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucune alerte</p>
              </div>
            ) : (
              <div className="space-y-1">
                {latestAlertes.map((a, i) => (
                  <div
                    key={`${a.date}-${i}`}
                    className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.03] cursor-pointer border-b border-white/[0.03] last:border-0"
                    onClick={() => navigate("/registre")}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && navigate("/registre")}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.statut === "EN COURS" ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] text-slate-500 font-mono">{formatDate(a.date)}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${a.statut === "EN COURS" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{a.statut}</span>
                      </div>
                      <p className="text-xs text-slate-300 truncate font-medium">{a.clientConcerne}</p>
                      <p className="text-[11px] text-slate-500 truncate">{a.categorie}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ────── List: Activity ──────
      case "list_activity":
        return (
          <div className="glass-card p-6 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">Activite recente</h3>
              </div>
              <button onClick={() => navigate("/logs")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                Journal <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-600">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucune activite</p>
              </div>
            ) : (
              <div className="space-y-1">
                {latestLogs.map((l, i) => (
                  <div key={`${l.horodatage}-${i}`} className="py-2.5 px-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.03] last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {l.horodatage ? (() => {
                          try {
                            return new Date(l.horodatage.replace(" ", "T")).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                          } catch { return l.horodatage; }
                        })() : "\u2014"}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        l.typeAction === "CREATION" ? "bg-emerald-500/10 text-emerald-400" :
                        l.typeAction === "SUPPRESSION" ? "bg-red-500/10 text-red-400" :
                        l.typeAction === "ALERTE" ? "bg-amber-500/10 text-amber-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>{l.typeAction}</span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">{l.details}</p>
                    {l.refClient && <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{l.refClient}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ────── Actions rapides ──────
      case "actions":
        return (
          <div className="glass-card p-5 h-full">
            <RemoveBtn id={id} />
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-300">Actions rapides</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-10 text-xs" onClick={() => navigate("/nouveau-client")}>
                <UserPlus className="w-3.5 h-3.5" /> Nouveau client
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 h-10 text-xs" onClick={() => navigate("/controle")}>
                <ClipboardCheck className="w-3.5 h-3.5" /> Controle
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30 h-10 text-xs" onClick={() => navigate("/diagnostic")}>
                <Activity className="w-3.5 h-3.5" /> Diagnostic
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 h-10 text-xs" onClick={handleExportCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </div>
        );

      default: return null;
    }
  }, [
    editMode, clients, clientsActifs, alertes, alertesEnCours, scoreMoyen, revuesEchues,
    derniereFormation, prochainControle, latestAlertes, latestLogs, vigData, scoreDistribution,
    activityTimeline, gaugeData, navigate, handleExportCSV, RemoveBtn,
  ]);

  // ── Separate KPIs from other widgets ──
  const kpiIds = layout.filter(id => getDef(id)?.category === "KPI");
  const chartIds = layout.filter(id => {
    const d = getDef(id);
    return d && d.category !== "KPI";
  });

  // ── Loading state ──
  if (!configLoaded || dataLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-white/[0.03] rounded-lg animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04]" />
              </div>
              <div className="h-8 w-16 rounded bg-white/[0.04] mb-1" />
              <div className="h-3 w-24 rounded bg-white/[0.03]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`glass-card p-6 animate-pulse ${i === 2 ? "lg:col-span-2" : ""}`}>
              <div className="h-4 w-40 rounded bg-white/[0.04] mb-4" />
              <div className="h-48 w-full rounded-lg bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Group widgets by category for catalog ──
  const widgetsByCategory = WIDGET_REGISTRY.reduce((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category].push(w);
    return acc;
  }, {} as Record<string, WidgetDef[]>);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
              {greeting}{displayName ? `, ${displayName}` : ""}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">
                {clients.length} dossier{clients.length > 1 ? "s" : ""} · {alertesEnCours} alerte{alertesEnCours > 1 ? "s" : ""} active{alertesEnCours > 1 ? "s" : ""}
              </p>
              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 ${editMode ? "bg-blue-600 hover:bg-blue-700" : "border-white/[0.08] hover:bg-white/[0.04]"}`}
            onClick={() => setEditMode(!editMode)}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {editMode ? "Terminer" : "Personnaliser"}
          </Button>
        </div>

        {/* ── Edit/Catalog panel ── */}
        {editMode && (
          <div className="glass-card p-5 animate-fade-in-up space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">Configurer le tableau de bord</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Glissez-deposez les widgets pour les reorganiser. Cliquez pour ajouter ou retirer.</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-200 gap-1.5" onClick={resetLayout}>
                <RotateCcw className="w-3 h-3" /> Reinitialiser
              </Button>
            </div>
            {Object.entries(widgetsByCategory).map(([category, widgets]) => (
              <div key={category}>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{category}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {widgets.map(w => {
                    const active = layout.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        onClick={() => toggleWidget(w.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all ${
                          active
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            : "bg-white/[0.02] text-slate-500 border border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        {active ? <Eye className="w-3.5 h-3.5 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span className="truncate">{w.label}</span>
                        {!active && <Plus className="w-3 h-3 ml-auto flex-shrink-0 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── KPI row (sortable) ── */}
        {kpiIds.length > 0 && (
          <SortableContext items={kpiIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-up">
              {kpiIds.map(id => (
                <SortableWidget key={id} id={id} editMode={editMode}>
                  {renderWidget(id)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        )}

        {/* ── Charts & other widgets (sortable, 2-col grid) ── */}
        {chartIds.length > 0 && (
          <SortableContext items={chartIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up">
              {chartIds.map(id => {
                const def = getDef(id);
                const span = def?.cols === 2 ? "lg:col-span-2" : "";
                return (
                  <SortableWidget key={id} id={id} editMode={editMode}>
                    <div className={span}>
                      {renderWidget(id)}
                    </div>
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        )}

        {/* ── Empty state ── */}
        {layout.length === 0 && (
          <div className="glass-card p-12 text-center animate-fade-in-up">
            <LayoutDashboard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2 font-medium">Tableau de bord vide</p>
            <p className="text-sm text-slate-500 mb-4">Cliquez sur "Personnaliser" pour ajouter des widgets.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditMode(true); saveLayout(DEFAULT_LAYOUT); }}>
              <Plus className="w-4 h-4" /> Ajouter des widgets
            </Button>
          </div>
        )}

      </div>
    </DndContext>
  );
}
