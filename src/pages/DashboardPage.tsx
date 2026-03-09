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
  ChevronRight, RefreshCw, Briefcase, UserCheck,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────
function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}
function scoreColor(s: number) { return s <= 30 ? "text-emerald-400" : s <= 55 ? "text-amber-400" : "text-red-400"; }
function scoreFill(s: number) { return s <= 30 ? "#22c55e" : s <= 55 ? "#f59e0b" : "#ef4444"; }
function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (s.includes(";") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const R = Math.PI / 180, r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Widget Registry ──────────────────────────────────────────
type WidgetSize = "kpi" | "chart" | "wide";
type WidgetId =
  | "kpi_clients" | "kpi_alertes" | "kpi_score" | "kpi_revues"
  | "kpi_formation" | "kpi_controle"
  | "gauge_score" | "chart_vigilance" | "chart_risque" | "chart_timeline"
  | "chart_statut" | "chart_pilotage" | "chart_alertes"
  | "chart_missions" | "chart_comptable"
  | "actions";

interface WidgetDef {
  id: WidgetId;
  label: string;
  category: "KPI" | "Graphique" | "Actions";
  defaultOn: boolean;
  size: WidgetSize;
}

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi_clients", label: "Clients actifs", category: "KPI", defaultOn: true, size: "kpi" },
  { id: "kpi_alertes", label: "Alertes en cours", category: "KPI", defaultOn: true, size: "kpi" },
  { id: "kpi_score", label: "Score moyen", category: "KPI", defaultOn: true, size: "kpi" },
  { id: "kpi_revues", label: "Revues echues", category: "KPI", defaultOn: true, size: "kpi" },
  { id: "kpi_formation", label: "Derniere formation", category: "KPI", defaultOn: false, size: "kpi" },
  { id: "kpi_controle", label: "Prochain controle", category: "KPI", defaultOn: false, size: "kpi" },
  { id: "gauge_score", label: "Jauge de risque", category: "Graphique", defaultOn: true, size: "chart" },
  { id: "chart_vigilance", label: "Repartition vigilance", category: "Graphique", defaultOn: true, size: "chart" },
  { id: "chart_statut", label: "Statut des dossiers", category: "Graphique", defaultOn: true, size: "chart" },
  { id: "chart_risque", label: "Distribution des scores", category: "Graphique", defaultOn: true, size: "chart" },
  { id: "chart_timeline", label: "Activite (7j)", category: "Graphique", defaultOn: true, size: "wide" },
  { id: "chart_pilotage", label: "Etat de pilotage", category: "Graphique", defaultOn: false, size: "chart" },
  { id: "chart_alertes", label: "Alertes par categorie", category: "Graphique", defaultOn: false, size: "chart" },
  { id: "chart_missions", label: "Types de missions", category: "Graphique", defaultOn: false, size: "chart" },
  { id: "chart_comptable", label: "Clients par comptable", category: "Graphique", defaultOn: false, size: "chart" },
  { id: "actions", label: "Actions rapides", category: "Actions", defaultOn: false, size: "wide" },
];

const VALID_IDS = new Set<WidgetId>(WIDGET_REGISTRY.map(w => w.id));
const getDef = (id: WidgetId) => WIDGET_REGISTRY.find(w => w.id === id);
const DEFAULT_LAYOUT: WidgetId[] = WIDGET_REGISTRY.filter(w => w.defaultOn).map(w => w.id);

const WIDGETS_BY_CAT = WIDGET_REGISTRY.reduce((a, w) => {
  (a[w.category] ??= []).push(w);
  return a;
}, {} as Record<string, WidgetDef[]>);

const WIDGET_ICONS: Record<WidgetId, React.FC<{ className?: string }>> = {
  kpi_clients: Users, kpi_alertes: AlertTriangle, kpi_score: TrendingUp,
  kpi_revues: CalendarClock, kpi_formation: GraduationCap, kpi_controle: Shield,
  gauge_score: TrendingUp, chart_vigilance: PieChartIcon, chart_risque: BarChart3,
  chart_timeline: Activity, chart_statut: PieChartIcon, chart_pilotage: Clock,
  chart_alertes: AlertTriangle, chart_missions: Briefcase, chart_comptable: UserCheck,
  actions: Zap,
};

// Size → CSS grid span
const SIZE_SPAN: Record<WidgetSize, string> = {
  kpi: "",
  chart: "lg:col-span-2",
  wide: "col-span-2 lg:col-span-4",
};

// ── Chart constants ──────────────────────────────────────────
const VIG_COLORS: Record<string, string> = { SIMPLIFIEE: "#22c55e", STANDARD: "#f59e0b", RENFORCEE: "#ef4444" };
const VIG_LABELS: Record<string, string> = { SIMPLIFIEE: "Simplifiee", STANDARD: "Standard", RENFORCEE: "Renforcee" };
const STATUT_COLORS: Record<string, string> = { ACTIF: "#3b82f6", RETARD: "#f59e0b", INACTIF: "#64748b" };
const PILOTAGE_COLORS: Record<string, string> = { "A JOUR": "#22c55e", "RETARD": "#ef4444", "BIENTÔT": "#f59e0b" };
const TT = {
  contentStyle: {
    backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", fontSize: "12px", color: "#e2e8f0", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  cursor: { fill: "rgba(255,255,255,0.03)" } as React.CSSProperties,
};

// ── Sortable Widget ──────────────────────────────────────────
function SortableWidget({ id, editMode, className, children }: {
  id: string; editMode: boolean; className?: string; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : "auto",
    willChange: isDragging ? "transform" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`relative group ${className || ""}`} data-widget-id={id}>
      {editMode && (
        <div {...attributes} {...listeners}
          className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 hover:bg-black/70 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
          aria-label="Glisser pour deplacer">
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
  const gid = useId();

  const [layout, setLayout] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Escape to exit edit mode
  useEffect(() => {
    if (!editMode) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setEditMode(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [editMode]);

  // Load config
  useEffect(() => {
    if (!user) { setConfigLoaded(true); return; }
    setConfigLoaded(false);
    let c = false;
    (async () => {
      try {
        const { data } = await supabase.from("dashboard_configs").select("layout").eq("user_id", user.id).maybeSingle();
        if (!c && data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          const valid = (data.layout as string[]).filter(id => VALID_IDS.has(id as WidgetId)) as WidgetId[];
          if (valid.length > 0) setLayout(valid);
        }
      } catch { /* default */ }
      if (!c) setConfigLoaded(true);
    })();
    return () => { c = true; };
  }, [user]);

  // Load parametres
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const { data } = await supabase.from("parametres").select("valeur").eq("cle", "lcbft_config").maybeSingle();
        if (!c && data?.valeur) {
          const v = data.valeur as Record<string, unknown>;
          if (v.date_derniere_formation) setDerniereFormation(v.date_derniere_formation as string);
        }
      } catch { /* silent */ }
    })();
    return () => { c = true; };
  }, []);

  // Debounced save
  const persistLayout = useCallback((next: WidgetId[]) => {
    if (!user) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("dashboard_configs").upsert(
          { user_id: user.id, layout: next }, { onConflict: "user_id" }
        );
        if (error) throw error;
      } catch { toast.error("Erreur de sauvegarde"); }
    }, 600);
  }, [user]);

  useEffect(() => () => { if (saveRef.current) clearTimeout(saveRef.current); }, []);

  const updateLayout = useCallback((next: WidgetId[]) => {
    setLayout(next);
    persistLayout(next);
  }, [persistLayout]);

  // DnD
  const onDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as WidgetId), []);
  const onDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLayout(prev => {
      const oi = prev.indexOf(active.id as WidgetId);
      const ni = prev.indexOf(over.id as WidgetId);
      if (oi === -1 || ni === -1 || oi === ni) return prev;
      const next = arrayMove(prev, oi, ni);
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);
  const onDragCancel = useCallback(() => setActiveId(null), []);

  // Update lastRefresh
  useEffect(() => { if (!dataLoading) setLastRefresh(new Date()); }, [dataLoading]);

  // ── Data ──────────────────────────────────────────────────
  const clientsActifs = useMemo(() => clients.filter(c => c.statut === "ACTIF").length, [clients]);
  const alertesEnCours = useMemo(() => alertes.filter(a => a.statut === "EN COURS").length, [alertes]);
  const scoreMoyen = useMemo(() => {
    const a = clients.filter(c => c.statut === "ACTIF");
    return a.length === 0 ? 0 : Math.round(a.reduce((s, c) => s + c.scoreGlobal, 0) / a.length);
  }, [clients]);
  const revuesEchues = useMemo(() => {
    const t = new Date().toISOString().split("T")[0];
    return clients.filter(c => c.dateButoir && c.dateButoir < t && c.statut === "ACTIF").length;
  }, [clients]);
  const prochainControle = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split("T")[0];
  }, []);
  const hasActive = useMemo(() => clients.some(c => c.statut === "ACTIF"), [clients]);

  // Chart data
  const vigData = useMemo(() => {
    const c: Record<string, number> = {};
    clients.forEach(cl => { if (cl.nivVigilance in VIG_LABELS) c[cl.nivVigilance] = (c[cl.nivVigilance] || 0) + 1; });
    return Object.entries(c).map(([n, v]) => ({ name: n, value: v }));
  }, [clients]);

  const statutData = useMemo(() => {
    const c: Record<string, number> = { ACTIF: 0, RETARD: 0, INACTIF: 0 };
    clients.forEach(cl => { c[cl.statut] = (c[cl.statut] || 0) + 1; });
    return Object.entries(c).filter(([, v]) => v > 0).map(([n, v]) => ({ name: n, value: v, fill: STATUT_COLORS[n] || "#64748b" }));
  }, [clients]);

  const pilotageData = useMemo(() => {
    const c: Record<string, number> = {};
    clients.forEach(cl => { if (cl.etatPilotage) c[cl.etatPilotage] = (c[cl.etatPilotage] || 0) + 1; });
    return Object.entries(c).map(([n, v]) => ({ name: n, value: v, fill: PILOTAGE_COLORS[n] || "#64748b" }));
  }, [clients]);

  const alerteCatData = useMemo(() => {
    const c: Record<string, number> = {};
    alertes.forEach(a => { if (a.categorie) c[a.categorie] = (c[a.categorie] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([n, v]) => ({ name: n.length > 18 ? n.slice(0, 16) + "..." : n, fullName: n, value: v }));
  }, [alertes]);

  const missionData = useMemo(() => {
    const c: Record<string, number> = {};
    clients.forEach(cl => { if (cl.mission) c[cl.mission] = (c[cl.mission] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([n, v]) => ({ name: n.length > 16 ? n.slice(0, 14) + "..." : n, fullName: n, value: v }));
  }, [clients]);

  const comptableData = useMemo(() => {
    const c: Record<string, number> = {};
    clients.forEach(cl => { if (cl.comptable) c[cl.comptable] = (c[cl.comptable] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([n, v]) => ({ name: n.length > 14 ? n.slice(0, 12) + "..." : n, fullName: n, value: v }));
  }, [clients]);

  const scoreDistribution = useMemo(() => {
    const b = [
      { label: "Faible", min: 0, max: 21, count: 0, fill: "#22c55e" },
      { label: "Modere", min: 21, max: 41, count: 0, fill: "#84cc16" },
      { label: "Moyen", min: 41, max: 61, count: 0, fill: "#f59e0b" },
      { label: "Eleve", min: 61, max: 81, count: 0, fill: "#f97316" },
      { label: "Critique", min: 81, max: 101, count: 0, fill: "#ef4444" },
    ];
    clients.forEach(cl => { const bk = b.find(x => cl.scoreGlobal >= x.min && cl.scoreGlobal < x.max); if (bk) bk.count++; });
    return b;
  }, [clients]);

  const timeline = useMemo(() => {
    const d: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { const dt = new Date(now); dt.setDate(dt.getDate() - i); d[dt.toISOString().split("T")[0]] = 0; }
    logs.forEach(l => { if (l.horodatage) { const k = l.horodatage.split(/[T ]/)[0]; if (k in d) d[k]++; } });
    return Object.entries(d).map(([dt, n]) => ({
      date: new Date(dt + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }), actions: n,
    }));
  }, [logs]);

  const gaugeData = useMemo(() => [{ name: "Score", value: scoreMoyen, fill: scoreFill(scoreMoyen) }], [scoreMoyen]);

  // CSV export
  const exportCSV = useCallback(() => {
    const ex = clients.filter(c => c.ref && c.raisonSociale);
    if (!ex.length) { toast.error("Aucun client"); return; }
    const h = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable", "Date Butoir"];
    const rows = ex.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable, c.dateButoir].map(csvSafe));
    const csv = "\uFEFF" + [h.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `export_lcb_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${ex.length} clients exportes`);
  }, [clients]);

  // Greeting
  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? "Bonjour" : h < 18 ? "Bon apres-midi" : "Bonsoir"; }, []);
  const name = profile?.full_name?.split(" ")[0] || "";

  // Toggle / reset
  const toggleWidget = useCallback((id: WidgetId) => {
    setLayout(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const resetLayout = useCallback(() => {
    updateLayout(DEFAULT_LAYOUT);
    toast.success("Disposition reinitialise");
  }, [updateLayout]);

  // Nav guard
  const nav = useCallback((p: string) => { if (!editMode && !activeId) navigate(p); }, [editMode, activeId, navigate]);

  // ── Render widget ─────────────────────────────────────────
  const renderWidget = useCallback((id: WidgetId, overlay = false) => {
    const rm = editMode && !overlay ? (
      <button onClick={e => { e.stopPropagation(); toggleWidget(id); }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/20 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
        aria-label="Retirer">{<X className="w-3.5 h-3.5 text-red-400" />}</button>
    ) : null;
    const cc = "glass-card p-5 h-full min-h-[260px] hover:bg-white/[0.02] transition-all duration-200";
    const kc = "glass-card p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer h-full";
    const noAnim = overlay;

    try {
      switch (id) {
        // ═══ KPIs ═══════════════════════════════════════════
        case "kpi_clients":
          return (
            <div className={`${kc} kpi-glow-blue`} onClick={() => nav("/bdd")} role="button" tabIndex={editMode ? -1 : 0}
              aria-label={`${clientsActifs} clients actifs`} onKeyDown={e => e.key === "Enter" && nav("/bdd")}>
              {rm}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
                <span className="text-xs text-slate-500">{clients.length} total</span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">{clientsActifs}</p>
              <p className="text-xs text-slate-500 mt-1">Clients actifs</p>
              <div className="mt-3 w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${clients.length > 0 ? (clientsActifs / clients.length) * 100 : 0}%` }} />
              </div>
            </div>
          );

        case "kpi_alertes":
          return (
            <div className={`${kc} ${alertesEnCours > 0 ? "ring-1 ring-red-500/20 kpi-glow-red" : "kpi-glow-green"}`}
              onClick={() => nav("/registre")} role="button" tabIndex={editMode ? -1 : 0} aria-label={`${alertesEnCours} alertes`}
              onKeyDown={e => e.key === "Enter" && nav("/registre")}>
              {rm}
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

        case "kpi_score":
          return (
            <div className={`${kc} ${scoreMoyen <= 30 ? "kpi-glow-green" : scoreMoyen <= 55 ? "kpi-glow-amber" : "kpi-glow-red"}`}
              onClick={() => nav("/bdd")} role="button" tabIndex={editMode ? -1 : 0} aria-label={`Score: ${scoreMoyen}/100`}
              onKeyDown={e => e.key === "Enter" && nav("/bdd")}>
              {rm}
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

        case "kpi_revues":
          return (
            <div className={`${kc} ${revuesEchues > 0 ? "ring-1 ring-red-500/20 kpi-glow-red" : "kpi-glow-green"}`}
              onClick={() => nav("/bdd")} role="button" tabIndex={editMode ? -1 : 0} onKeyDown={e => e.key === "Enter" && nav("/bdd")}>
              {rm}
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

        case "kpi_formation":
          return (
            <div className={kc} onClick={() => nav("/gouvernance")} role="button" tabIndex={editMode ? -1 : 0}
              onKeyDown={e => e.key === "Enter" && nav("/gouvernance")}>
              {rm}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-400" /></div>
                <span className="text-xs text-slate-500">LCB-FT</span>
              </div>
              <p className="text-lg font-bold text-white truncate">{formatDate(derniereFormation)}</p>
              <p className="text-xs text-slate-500 mt-1">Derniere formation</p>
            </div>
          );

        case "kpi_controle":
          return (
            <div className={kc} onClick={() => nav("/controle")} role="button" tabIndex={editMode ? -1 : 0}
              onKeyDown={e => e.key === "Enter" && nav("/controle")}>
              {rm}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-cyan-400" /></div>
                <span className="text-xs text-slate-500">planifie</span>
              </div>
              <p className="text-lg font-bold text-white">{formatDate(prochainControle)}</p>
              <p className="text-xs text-slate-500 mt-1">Prochain controle</p>
            </div>
          );

        // ═══ GAUGE ══════════════════════════════════════════
        case "gauge_score":
          return (
            <div className={cc}>
              {rm}
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Niveau de risque</h3>
              <p className="text-[11px] text-slate-500 mb-1">{hasActive ? "Score moyen des dossiers" : "Aucun dossier actif"}</p>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart cx="50%" cy="55%" innerRadius="70%" outerRadius="90%" startAngle={180} endAngle={0} data={gaugeData} barSize={14}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(255,255,255,0.04)" }} animationDuration={1000} isAnimationActive={!noAnim} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-20 relative z-10 pb-2">
                <p className={`text-4xl font-bold tabular-nums ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
                <p className="text-[11px] text-slate-500">{!hasActive ? "—" : scoreMoyen <= 30 ? "Faible" : scoreMoyen <= 55 ? "Modere" : "Eleve"}</p>
              </div>
            </div>
          );

        // ═══ CHARTS ═════════════════════════════════════════
        case "chart_vigilance":
          return (
            <div className={cc}>
              {rm}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-300">Vigilance</h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">{clients.length}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Niveau applique par dossier</p>
              {vigData.length === 0 ? <EmptyChart /> : (<>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={vigData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={vigData.length > 1 ? 4 : 0}
                    dataKey="value" stroke="none" label={renderPieLabel} labelLine={false} animationDuration={800} isAnimationActive={!noAnim}>
                    {vigData.map(e => <Cell key={e.name} fill={VIG_COLORS[e.name] || "#64748b"} />)}
                  </Pie><Tooltip {...TT} formatter={(v: number, n: string) => [v, VIG_LABELS[n] || n]} /></PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-1">
                  {vigData.map(e => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VIG_COLORS[e.name] }} />
                      <span className="text-[11px] text-slate-400">{VIG_LABELS[e.name]}</span>
                      <span className="text-[11px] font-semibold text-slate-300">{e.value}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          );

        case "chart_statut":
          return (
            <div className={cc}>
              {rm}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-300">Statut des dossiers</h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">{clients.length}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Repartition Actif / Retard / Inactif</p>
              {statutData.length === 0 ? <EmptyChart /> : (<>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={statutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={statutData.length > 1 ? 4 : 0}
                    dataKey="value" stroke="none" label={renderPieLabel} labelLine={false} animationDuration={800} isAnimationActive={!noAnim}>
                    {statutData.map(e => <Cell key={e.name} fill={e.fill} />)}
                  </Pie><Tooltip {...TT} formatter={(v: number) => [`${v} dossier${v !== 1 ? "s" : ""}`, "Nombre"]} /></PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-1">
                  {statutData.map(e => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.fill }} />
                      <span className="text-[11px] text-slate-400">{e.name}</span>
                      <span className="text-[11px] font-semibold text-slate-300">{e.value}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          );

        case "chart_risque":
          return (
            <div className={cc}>
              {rm}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-300">Scores de risque</h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">{clients.length}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Distribution par tranche</p>
              {clients.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistribution} barCategoryGap="18%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                    <Tooltip {...TT} formatter={(v: number) => [`${v} client${v !== 1 ? "s" : ""}`, "Nombre"]} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={800} isAnimationActive={!noAnim}>
                      {scoreDistribution.map(e => <Cell key={e.label} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        case "chart_timeline": {
          const g = `g-tl-${gid}`;
          return (
            <div className={cc}>
              {rm}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-300">Activite des 7 derniers jours</h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                  {timeline.reduce((s, d) => s + d.actions, 0)} actions
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Volume d'actions journalier</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline}>
                  <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip {...TT} formatter={(v: number) => [`${v} action${v !== 1 ? "s" : ""}`, "Activite"]} />
                  <Area type="monotone" dataKey="actions" stroke="#3b82f6" fill={`url(#${g})`} strokeWidth={2.5}
                    dot={{ fill: "#3b82f6", stroke: "#1e293b", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                    animationDuration={800} isAnimationActive={!noAnim} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        }

        case "chart_pilotage":
          return (
            <div className={cc}>
              {rm}
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Etat de pilotage</h3>
              <p className="text-[11px] text-slate-500 mb-2">A jour / Retard / Bientot</p>
              {pilotageData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pilotageData} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                    <Tooltip {...TT} formatter={(v: number) => [`${v} dossier${v !== 1 ? "s" : ""}`, "Nombre"]} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800} isAnimationActive={!noAnim}>
                      {pilotageData.map(e => <Cell key={e.name} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        case "chart_alertes":
          return (
            <div className={cc}>
              {rm}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-300">Alertes par categorie</h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">{alertes.length}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Top categories d'alertes</p>
              {alerteCatData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={alerteCatData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip {...TT} formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [`${v} alerte${v !== 1 ? "s" : ""}`, p.payload.fullName]} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} animationDuration={800} isAnimationActive={!noAnim} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        case "chart_missions":
          return (
            <div className={cc}>
              {rm}
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Types de missions</h3>
              <p className="text-[11px] text-slate-500 mb-2">Repartition des missions clients</p>
              {missionData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={missionData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip {...TT} formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [`${v} client${v !== 1 ? "s" : ""}`, p.payload.fullName]} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} animationDuration={800} isAnimationActive={!noAnim} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        case "chart_comptable":
          return (
            <div className={cc}>
              {rm}
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Clients par comptable</h3>
              <p className="text-[11px] text-slate-500 mb-2">Top 5 des collaborateurs</p>
              {comptableData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comptableData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip {...TT} formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [`${v} client${v !== 1 ? "s" : ""}`, p.payload.fullName]} />
                    <Bar dataKey="value" fill="#06b6d4" radius={[0, 6, 6, 0]} animationDuration={800} isAnimationActive={!noAnim} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );

        // ═══ ACTIONS ════════════════════════════════════════
        case "actions":
          return (
            <div className="glass-card p-5 h-full">
              {rm}
              <div className="flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-slate-300">Actions rapides</h3></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-10 text-xs" onClick={() => nav("/nouveau-client")}><UserPlus className="w-3.5 h-3.5" /> Nouveau client</Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-blue-500/10 hover:text-blue-400 h-10 text-xs" onClick={() => nav("/controle")}><ClipboardCheck className="w-3.5 h-3.5" /> Controle</Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-400 h-10 text-xs" onClick={() => nav("/diagnostic")}><Activity className="w-3.5 h-3.5" /> Diagnostic</Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.08] hover:bg-cyan-500/10 hover:text-cyan-400 h-10 text-xs" onClick={exportCSV}><Download className="w-3.5 h-3.5" /> Export CSV</Button>
              </div>
            </div>
          );

        default: return null;
      }
    } catch (err) {
      console.error(`Widget ${id} error:`, err);
      return <div className="glass-card p-6 h-full flex items-center justify-center text-slate-500"><AlertTriangle className="w-6 h-6 opacity-30 mr-2" /><span className="text-sm">Erreur</span></div>;
    }
  }, [
    editMode, activeId, clients, clientsActifs, alertes, alertesEnCours, scoreMoyen, revuesEchues,
    derniereFormation, prochainControle, hasActive, vigData, statutData, pilotageData, alerteCatData,
    missionData, comptableData, scoreDistribution, timeline, gaugeData, gid, nav, exportCSV, toggleWidget,
  ]);

  // ── Loading ───────────────────────────────────────────────
  if (!configLoaded || dataLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">
        <div><div className="h-6 w-48 bg-white/[0.04] rounded-lg animate-pulse" /><div className="h-4 w-32 bg-white/[0.03] rounded-lg animate-pulse mt-2" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card p-5 animate-pulse"><div className="w-10 h-10 rounded-xl bg-white/[0.04] mb-3" /><div className="h-8 w-16 bg-white/[0.04] rounded mb-1" /><div className="h-3 w-24 bg-white/[0.03] rounded" /></div>)}
          {[...Array(4)].map((_, i) => <div key={i + 4} className="glass-card p-5 animate-pulse lg:col-span-2"><div className="h-4 w-36 bg-white/[0.04] rounded mb-3" /><div className="h-44 bg-white/[0.03] rounded-lg" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
              {greeting}{name ? `, ${name}` : ""}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">{clients.length} dossier{clients.length !== 1 ? "s" : ""} · {alertesEnCours} alerte{alertesEnCours !== 1 ? "s" : ""}</p>
              <span className="text-[10px] text-slate-600 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" />{lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <Button variant={editMode ? "default" : "outline"} size="sm"
            className={`gap-1.5 ${editMode ? "bg-blue-600 hover:bg-blue-700" : "border-white/[0.08] hover:bg-white/[0.04]"}`}
            onClick={() => setEditMode(!editMode)}>
            <Settings2 className="w-3.5 h-3.5" />{editMode ? "Terminer" : "Personnaliser"}
          </Button>
        </div>

        {/* Catalog */}
        {editMode && (
          <div className="glass-card p-5 animate-fade-in-up space-y-4 ring-1 ring-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-blue-400" />Widgets disponibles</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Glissez pour reorganiser · Cliquez pour ajouter/retirer · Echap pour terminer</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 gap-1.5" onClick={resetLayout}><RotateCcw className="w-3 h-3" /> Reset</Button>
            </div>
            {Object.entries(WIDGETS_BY_CAT).map(([cat, ws]) => (
              <div key={cat}>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {ws.map(w => {
                    const on = layout.includes(w.id);
                    const Ic = WIDGET_ICONS[w.id];
                    return (
                      <button key={w.id} onClick={() => toggleWidget(w.id)} aria-label={`${on ? "Retirer" : "Ajouter"} ${w.label}`}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all ${on
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-white/[0.02] text-slate-500 border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04]"}`}>
                        {on ? <Eye className="w-3.5 h-3.5 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                        <Ic className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                        <span className="truncate">{w.label}</span>
                        {!on && <Plus className="w-3 h-3 ml-auto flex-shrink-0 opacity-40" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Unified grid - ALL widgets */}
        {layout.length > 0 && (
          <SortableContext items={layout} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
              {layout.map(id => {
                const def = getDef(id);
                return (
                  <SortableWidget key={id} id={id} editMode={editMode} className={def ? SIZE_SPAN[def.size] : ""}>
                    {renderWidget(id)}
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        )}

        {/* Empty */}
        {layout.length === 0 && (
          <div className="glass-card p-12 text-center animate-fade-in-up">
            <LayoutDashboard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2 font-medium">Tableau de bord vide</p>
            <p className="text-sm text-slate-500 mb-4">Cliquez sur "Personnaliser" pour ajouter des widgets.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditMode(true); updateLayout(DEFAULT_LAYOUT); }}>
              <Plus className="w-4 h-4" /> Ajouter des widgets
            </Button>
          </div>
        )}
      </div>

      {/* DragOverlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeId ? (
          <div className="rounded-xl shadow-2xl shadow-black/50 ring-2 ring-blue-500/40 pointer-events-none" style={{ transform: "scale(1.02)", opacity: 0.95 }}>
            {renderWidget(activeId, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Empty chart placeholder ─────────────────────────────────
function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-600">
      <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
      <p className="text-sm">Aucune donnee</p>
    </div>
  );
}
