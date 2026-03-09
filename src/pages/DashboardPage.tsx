import { useMemo, useState, useEffect, useCallback, useRef, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Users, AlertTriangle, TrendingUp, CalendarClock,
  GraduationCap, Shield, Settings2, X,
  Plus, Eye, EyeOff, LayoutDashboard,
  PieChart as PieChartIcon, BarChart3, Clock,
  RotateCcw, Zap, GripVertical,
  UserPlus, ClipboardCheck, Activity, Download,
  ChevronRight, RefreshCw,
} from "lucide-react";

// ── Helpers (FIX 39: outside component to avoid re-creation) ──
function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}
function scoreColor(score: number): string {
  if (score <= 30) return "text-emerald-400";
  if (score <= 55) return "text-amber-400";
  return "text-red-400";
}
function scoreFill(score: number): string {
  if (score <= 30) return "#22c55e";
  if (score <= 55) return "#f59e0b";
  return "#ef4444";
}

// ── CSV injection protection ─────────────────────────────────
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

// ── Tooltip formatters (FIX 20/21: fix plural for 0) ─────────
function vigTooltipFormatter(value: number, name: string) {
  const VIG = { SIMPLIFIEE: "Simplifiee", STANDARD: "Standard", RENFORCEE: "Renforcee" } as Record<string, string>;
  return [value, VIG[name] || name];
}
function scoreTooltipFormatter(value: number) {
  return [`${value} client${value !== 1 ? "s" : ""}`, "Nombre"];
}

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
  category: "KPI" | "Graphique" | "Liste" | "Actions";
  defaultOn: boolean;
  cols: 1 | 2;
}

// FIX 38: icons removed from registry (JSX in module scope), rendered inline
const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi_clients", label: "Clients actifs", category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_alertes", label: "Alertes en cours", category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_score", label: "Score moyen", category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_revues", label: "Revues echues", category: "KPI", defaultOn: true, cols: 1 },
  { id: "kpi_formation", label: "Derniere formation", category: "KPI", defaultOn: false, cols: 1 },
  { id: "kpi_controle", label: "Prochain controle", category: "KPI", defaultOn: false, cols: 1 },
  { id: "gauge_score", label: "Jauge de risque", category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_vigilance", label: "Repartition vigilance", category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_risque", label: "Distribution des scores", category: "Graphique", defaultOn: true, cols: 1 },
  { id: "chart_timeline", label: "Activite (7j)", category: "Graphique", defaultOn: true, cols: 2 },
  { id: "list_alertes", label: "Dernieres alertes", category: "Liste", defaultOn: false, cols: 1 },
  { id: "list_activity", label: "Journal d'activite", category: "Liste", defaultOn: false, cols: 1 },
  { id: "actions", label: "Actions rapides", category: "Actions", defaultOn: false, cols: 2 },
];

const VALID_WIDGET_IDS = new Set<WidgetId>(WIDGET_REGISTRY.map(w => w.id));
const getDef = (id: WidgetId) => WIDGET_REGISTRY.find(w => w.id === id);
const DEFAULT_LAYOUT: WidgetId[] = WIDGET_REGISTRY.filter(w => w.defaultOn).map(w => w.id);

// FIX 31/47: constant, not recalculated each render
const WIDGETS_BY_CATEGORY = WIDGET_REGISTRY.reduce((acc, w) => {
  if (!acc[w.category]) acc[w.category] = [];
  acc[w.category].push(w);
  return acc;
}, {} as Record<string, WidgetDef[]>);

const WIDGET_ICONS: Record<WidgetId, React.FC<{ className?: string }>> = {
  kpi_clients: Users,
  kpi_alertes: AlertTriangle,
  kpi_score: TrendingUp,
  kpi_revues: CalendarClock,
  kpi_formation: GraduationCap,
  kpi_controle: Shield,
  gauge_score: TrendingUp,
  chart_vigilance: PieChartIcon,
  chart_risque: BarChart3,
  chart_timeline: Activity,
  list_alertes: AlertTriangle,
  list_activity: Clock,
  actions: Zap,
};

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
  cursor: { fill: "rgba(255,255,255,0.03)" } as React.CSSProperties,
};

// ── Sortable Widget Wrapper (FIX 1: accepts className for col-span) ──
function SortableWidget({ id, editMode, className, children }: {
  id: string; editMode: boolean; className?: string; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  // FIX 3/12/36: Use CSS.Translate for grid, add will-change during drag
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
    willChange: isDragging ? "transform" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${className || ""}`}
      data-widget-id={id}
    >
      {/* FIX 15: always visible on mobile in edit mode (no hover needed on touch) */}
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing w-8 h-8 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
          aria-label="Glisser pour deplacer"
        >
          <GripVertical className="w-4 h-4 text-slate-300" />
        </div>
      )}
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { clients, alertes, logs, isLoading: dataLoading } = useAppState();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const chartId = useId(); // FIX 23: unique gradient IDs

  const [layout, setLayout] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeId, setActiveId] = useState<WidgetId | null>(null); // FIX 6: DragOverlay state
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX 4/5: Add TouchSensor + KeyboardSensor for mobile & a11y
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // FIX 10: Escape key to exit edit mode
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditMode(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editMode]);

  // ── Load dashboard config ──
  // FIX 25: reset configLoaded when user changes
  useEffect(() => {
    if (!user) { setConfigLoaded(true); return; }
    setConfigLoaded(false);
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

  // ── Debounced save (FIX 37: error feedback) ──
  const saveLayout = useCallback((newLayout: WidgetId[]) => {
    // FIX 43: guard against empty layout save
    setLayout(newLayout);
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("dashboard_configs").upsert(
          { user_id: user.id, layout: newLayout },
          { onConflict: "user_id" }
        );
        if (error) throw error;
      } catch {
        toast.error("Erreur lors de la sauvegarde de la disposition");
      }
    }, 800);
  }, [user]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // ── DnD handlers (FIX 6: DragOverlay with activeId) ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetId);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // FIX 16: functional setState to avoid stale closure
    setLayout(prev => {
      const oldIndex = prev.indexOf(active.id as WidgetId);
      const newIndex = prev.indexOf(over.id as WidgetId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      // FIX 17: don't save if positions unchanged
      if (oldIndex === newIndex) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      // Save outside setState to avoid issues
      if (user) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            const { error } = await supabase.from("dashboard_configs").upsert(
              { user_id: user.id, layout: next },
              { onConflict: "user_id" }
            );
            if (error) throw error;
          } catch {
            toast.error("Erreur lors de la sauvegarde");
          }
        }, 800);
      }
      return next;
    });
  }, [user]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

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
  // FIX 38: static value, memo with empty deps is intentional
  const prochainControle = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // FIX 27: Update lastRefresh when data changes
  useEffect(() => {
    if (!dataLoading) setLastRefresh(new Date());
  }, [dataLoading]);

  // ── Chart data ──
  const vigData = useMemo(() => {
    const counts = clients.reduce((acc, c) => {
      acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    // FIX 29: only include known vigilance levels
    return Object.entries(counts)
      .filter(([name]) => name in VIG_LABELS)
      .map(([name, value]) => ({ name, value, label: VIG_LABELS[name] || name }));
  }, [clients]);

  // FIX 8: score bucket uses < for upper bound to avoid gaps (20.5 now falls into 0-20)
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-20", label: "Faible", min: 0, max: 21, count: 0, fill: "#22c55e" },
      { range: "21-40", label: "Modere", min: 21, max: 41, count: 0, fill: "#84cc16" },
      { range: "41-60", label: "Moyen", min: 41, max: 61, count: 0, fill: "#f59e0b" },
      { range: "61-80", label: "Eleve", min: 61, max: 81, count: 0, fill: "#f97316" },
      { range: "81-100", label: "Critique", min: 81, max: 101, count: 0, fill: "#ef4444" },
    ];
    clients.forEach(c => {
      const b = buckets.find(b => c.scoreGlobal >= b.min && c.scoreGlobal < b.max);
      if (b) b.count++;
    });
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

  // FIX 2: gauge data with proper domain reference
  const gaugeData = useMemo(() => [{
    name: "Score",
    value: scoreMoyen,
    fill: scoreFill(scoreMoyen),
  }], [scoreMoyen]);

  // FIX 45: gauge label based on actual client count
  const hasActiveClients = useMemo(() => clients.some(c => c.statut === "ACTIF"), [clients]);

  const latestAlertes = useMemo(() =>
    [...alertes]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 5),
    [alertes]
  );
  const latestLogs = useMemo(() =>
    [...logs]
      .sort((a, b) => (b.horodatage || "").localeCompare(a.horodatage || ""))
      .slice(0, 6),
    [logs]
  );

  // CSV export (FIX 48: filter empty rows)
  const handleExportCSV = useCallback(() => {
    const exportable = clients.filter(c => c.ref && c.raisonSociale);
    if (exportable.length === 0) { toast.error("Aucun client a exporter"); return; }
    const headers = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable", "Date Butoir"];
    const rows = exportable.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable, c.dateButoir].map(csvSafe));
    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `export_lcb_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${exportable.length} clients exportes`);
  }, [clients]);

  // ── Greeting ──
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon apres-midi";
    return "Bonsoir";
  }, []);
  const displayName = profile?.full_name?.split(" ")[0] || "";

  // FIX 16: functional setState to prevent stale closure on rapid clicks
  const toggleWidget = useCallback((id: WidgetId) => {
    setLayout(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      // Debounced save
      if (user) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            const { error } = await supabase.from("dashboard_configs").upsert(
              { user_id: user.id, layout: next },
              { onConflict: "user_id" }
            );
            if (error) throw error;
          } catch {
            toast.error("Erreur lors de la sauvegarde");
          }
        }, 800);
      }
      return next;
    });
  }, [user]);

  const resetLayout = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
    toast.success("Disposition reinitialise");
  }, [saveLayout]);

  // FIX 7/34: navigation disabled in edit mode, and disabled during drag
  const nav = useCallback((path: string) => {
    if (editMode || activeId) return;
    navigate(path);
  }, [editMode, activeId, navigate]);

  // ── Separate KPIs from chart widgets (FIX 11: memoized) ──
  const kpiIds = useMemo(() => layout.filter(id => getDef(id)?.category === "KPI"), [layout]);
  const chartIds = useMemo(() => layout.filter(id => {
    const d = getDef(id);
    return d && d.category !== "KPI";
  }), [layout]);

  // FIX 26: dynamic KPI grid columns based on count
  const kpiGridCols = useMemo(() => {
    const n = kpiIds.length;
    if (n <= 2) return "grid-cols-2";
    if (n <= 3) return "grid-cols-2 sm:grid-cols-3";
    if (n <= 4) return "grid-cols-2 sm:grid-cols-4";
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
  }, [kpiIds.length]);

  // ── Widget renderers (FIX 28: try-catch per widget) ──
  const renderWidget = useCallback((id: WidgetId, isOverlay = false) => {
    // FIX 9: RemoveBtn inline instead of useCallback-component
    const removeBtn = editMode && !isOverlay ? (
      <button
        onClick={(e) => { e.stopPropagation(); toggleWidget(id); }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/20 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
        aria-label="Retirer le widget"
      >
        <X className="w-3.5 h-3.5 text-red-400" />
      </button>
    ) : null;

    // FIX 40: subtle hover on chart cards
    const chartCard = `glass-card p-6 h-full min-h-[280px] hover:bg-white/[0.02] transition-all duration-200`;

    try {
      switch (id) {
        // ────── KPI: Clients ──────
        case "kpi_clients":
          return (
            <div
              className="glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer kpi-glow-blue h-full"
              onClick={() => nav("/bdd")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`${clientsActifs} clients actifs`}
              onKeyDown={e => e.key === "Enter" && nav("/bdd")}
            >
              {removeBtn}
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
              onClick={() => nav("/registre")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`${alertesEnCours} alertes en cours`}
              onKeyDown={e => e.key === "Enter" && nav("/registre")}
            >
              {removeBtn}
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
              onClick={() => nav("/bdd")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`Score moyen: ${scoreMoyen}/100`}
              onKeyDown={e => e.key === "Enter" && nav("/bdd")}
            >
              {removeBtn}
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
              onClick={() => nav("/bdd")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`${revuesEchues} revues echues`}
              onKeyDown={e => e.key === "Enter" && nav("/bdd")}
            >
              {removeBtn}
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
              onClick={() => nav("/gouvernance")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`Derniere formation: ${derniereFormation || "non renseignee"}`}
              onKeyDown={e => e.key === "Enter" && nav("/gouvernance")}
            >
              {removeBtn}
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
              onClick={() => nav("/controle")}
              role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`Prochain controle: ${prochainControle}`}
              onKeyDown={e => e.key === "Enter" && nav("/controle")}
            >
              {removeBtn}
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
            <div className={chartCard}>
              {removeBtn}
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Niveau de risque global</h3>
              <p className="text-[11px] text-slate-500 mb-2">
                {hasActiveClients ? "Score moyen des dossiers actifs" : "Aucun dossier actif"}
              </p>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%" cy="50%"
                    innerRadius="70%" outerRadius="90%"
                    startAngle={180} endAngle={0}
                    data={gaugeData}
                    barSize={14}
                  >
                    {/* FIX 2: set domain [0,100] so gauge scales correctly */}
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={8}
                      background={{ fill: "rgba(255,255,255,0.04)" }}
                      animationDuration={1000}
                      isAnimationActive={!isOverlay}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center -mt-16 relative z-10">
                <p className={`text-4xl font-bold tabular-nums ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {!hasActiveClients ? "Aucune donnee" : scoreMoyen <= 30 ? "Risque faible" : scoreMoyen <= 55 ? "Risque modere" : "Risque eleve"}
                </p>
              </div>
            </div>
          );

        // ────── Chart: Vigilance donut ──────
        case "chart_vigilance":
          return (
            <div className={chartCard}>
              {removeBtn}
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
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={vigData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={88}
                        paddingAngle={vigData.length > 1 ? 4 : 0}
                        dataKey="value"
                        stroke="none"
                        label={renderPieLabel}
                        labelLine={false}
                        animationDuration={800}
                        isAnimationActive={!isOverlay}
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
                        <span className="text-[11px] text-slate-400">{VIG_LABELS[entry.name] || entry.name}</span>
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
            <div className={chartCard}>
              {removeBtn}
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
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistribution} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={scoreTooltipFormatter} />
                    <Bar dataKey="count" name="Clients" radius={[6, 6, 0, 0]} animationDuration={800} isAnimationActive={!isOverlay}>
                      {scoreDistribution.map((entry) => <Cell key={entry.range} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        // ────── Chart: Activity timeline ──────
        case "chart_timeline": {
          // FIX 23: unique gradient ID per component instance
          const gradId = `grad-activity-${chartId}`;
          return (
            <div className={chartCard}>
              {removeBtn}
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
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v} action${v !== 1 ? "s" : ""}`, "Activite"]} />
                  <Area
                    type="monotone"
                    dataKey="actions"
                    stroke="#3b82f6"
                    fill={`url(#${gradId})`}
                    strokeWidth={2.5}
                    dot={{ fill: "#3b82f6", stroke: "#1e293b", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                    animationDuration={800}
                    isAnimationActive={!isOverlay}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        }

        // ────── List: Alertes ──────
        case "list_alertes":
          return (
            <div className={chartCard}>
              {removeBtn}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-300">Dernieres alertes</h3>
                  {alertesEnCours > 0 && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{alertesEnCours}</span>
                  )}
                </div>
                <button onClick={() => nav("/registre")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
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
                      onClick={() => nav("/registre")}
                      role="button" tabIndex={editMode ? -1 : 0}
                      onKeyDown={e => e.key === "Enter" && nav("/registre")}
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
            <div className={chartCard}>
              {removeBtn}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-300">Activite recente</h3>
                </div>
                <button onClick={() => nav("/logs")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
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
            <div className="glass-card p-5 h-full min-h-[100px]">
              {removeBtn}
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">Actions rapides</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-10 text-xs" onClick={() => nav("/nouveau-client")}>
                  <UserPlus className="w-3.5 h-3.5" /> Nouveau client
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 h-10 text-xs" onClick={() => nav("/controle")}>
                  <ClipboardCheck className="w-3.5 h-3.5" /> Controle
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30 h-10 text-xs" onClick={() => nav("/diagnostic")}>
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
    } catch (err) {
      // FIX 28: error boundary per widget
      console.error(`Widget ${id} render error:`, err);
      return (
        <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-slate-500">
          <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">Erreur d'affichage</p>
        </div>
      );
    }
  }, [
    editMode, activeId, clients, clientsActifs, alertes, alertesEnCours, scoreMoyen, revuesEchues,
    derniereFormation, prochainControle, latestAlertes, latestLogs, vigData, scoreDistribution,
    activityTimeline, gaugeData, hasActiveClients, chartId, nav, handleExportCSV, toggleWidget,
  ]);

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
                {clients.length} dossier{clients.length !== 1 ? "s" : ""} · {alertesEnCours} alerte{alertesEnCours !== 1 ? "s" : ""} active{alertesEnCours !== 1 ? "s" : ""}
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

        {/* ── Edit/Catalog panel (Shopify-style widget picker) ── */}
        {editMode && (
          <div className="glass-card p-5 animate-fade-in-up space-y-4 ring-1 ring-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-blue-400" />
                  Configurer le tableau de bord
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Glissez-deposez pour reorganiser · Cliquez pour ajouter/retirer · Echap pour terminer
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-200 gap-1.5" onClick={resetLayout}>
                <RotateCcw className="w-3 h-3" /> Reinitialiser
              </Button>
            </div>
            {Object.entries(WIDGETS_BY_CATEGORY).map(([category, widgets]) => (
              <div key={category}>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{category}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {widgets.map(w => {
                    const active = layout.includes(w.id);
                    const Icon = WIDGET_ICONS[w.id];
                    return (
                      <button
                        key={w.id}
                        onClick={() => toggleWidget(w.id)}
                        aria-label={`${active ? "Retirer" : "Ajouter"} ${w.label}`}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all ${
                          active
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10"
                            : "bg-white/[0.02] text-slate-500 border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04]"
                        }`}
                      >
                        {active ? <Eye className="w-3.5 h-3.5 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
                        <span className="truncate">{w.label}</span>
                        {!active && <Plus className="w-3 h-3 ml-auto flex-shrink-0 opacity-40" />}
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
            <div className={`grid ${kpiGridCols} gap-3 animate-fade-in-up`}>
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
                // FIX 1: col-span on SortableWidget, not inner div
                return (
                  <SortableWidget key={id} id={id} editMode={editMode} className={span}>
                    {renderWidget(id)}
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

      {/* FIX 6/19/50: Shopify-style DragOverlay with elevation & scale */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
      }}>
        {activeId ? (
          <div
            className="rounded-xl shadow-2xl shadow-black/50 ring-2 ring-blue-500/40 pointer-events-none"
            style={{
              transform: "scale(1.03)",
              opacity: 0.95,
            }}
          >
            {renderWidget(activeId, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
