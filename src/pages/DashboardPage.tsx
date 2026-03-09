import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, AlertTriangle, TrendingUp, CalendarClock,
  GraduationCap, ClipboardCheck, UserPlus, Activity,
  Download, ChevronRight, Shield, Settings2, X,
  Plus, Eye, EyeOff, LayoutDashboard,
  PieChart as PieChartIcon, BarChart3, FileText, Clock,
  ChevronUp, ChevronDown, RotateCcw, Zap,
  RefreshCw,
} from "lucide-react";

// ── Widget Registry ──────────────────────────────────────────
type WidgetId =
  | "kpi_clients" | "kpi_alertes" | "kpi_score" | "kpi_revues"
  | "kpi_formation" | "kpi_controle"
  | "chart_vigilance" | "chart_risque" | "chart_timeline"
  | "list_alertes" | "list_activity"
  | "actions";

interface WidgetDef {
  id: WidgetId;
  label: string;
  icon: React.ReactNode;
  category: "KPI" | "Graphique" | "Liste" | "Actions";
  defaultSize: "sm" | "md" | "lg";
}

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi_clients", label: "Clients actifs", icon: <Users className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "kpi_alertes", label: "Alertes en cours", icon: <AlertTriangle className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "kpi_score", label: "Score moyen", icon: <TrendingUp className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "kpi_revues", label: "Revues echues", icon: <CalendarClock className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "kpi_formation", label: "Derniere formation", icon: <GraduationCap className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "kpi_controle", label: "Prochain controle", icon: <Shield className="w-4 h-4" />, category: "KPI", defaultSize: "sm" },
  { id: "chart_vigilance", label: "Repartition vigilance", icon: <PieChartIcon className="w-4 h-4" />, category: "Graphique", defaultSize: "lg" },
  { id: "chart_risque", label: "Distribution des scores", icon: <BarChart3 className="w-4 h-4" />, category: "Graphique", defaultSize: "lg" },
  { id: "chart_timeline", label: "Activite recente (graph)", icon: <Activity className="w-4 h-4" />, category: "Graphique", defaultSize: "lg" },
  { id: "list_alertes", label: "Dernieres alertes", icon: <AlertTriangle className="w-4 h-4" />, category: "Liste", defaultSize: "md" },
  { id: "list_activity", label: "Journal d'activite", icon: <Clock className="w-4 h-4" />, category: "Liste", defaultSize: "md" },
  { id: "actions", label: "Actions rapides", icon: <FileText className="w-4 h-4" />, category: "Actions", defaultSize: "lg" },
];

const VALID_WIDGET_IDS = new Set(WIDGET_REGISTRY.map(w => w.id));

const DEFAULT_LAYOUT: WidgetId[] = [
  "actions",
  "kpi_clients", "kpi_alertes", "kpi_score", "kpi_revues", "kpi_formation", "kpi_controle",
  "chart_vigilance", "chart_risque", "chart_timeline",
  "list_alertes", "list_activity",
];

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

// ── CSV injection protection ─────────────────────────────────
function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (s.includes(";") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ── Custom pie chart label ───────────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Custom tooltip formatters ────────────────────────────────
function vigTooltipFormatter(value: number, name: string) {
  return [value, VIG_LABELS[name] || name];
}

function scoreTooltipFormatter(value: number) {
  return [`${value} client${value > 1 ? "s" : ""}`, "Nombre"];
}

export default function DashboardPage() {
  const { clients, alertes, logs, isLoading: dataLoading } = useAppState();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [layout, setLayout] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // FIX 23: Debounce layout saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          // FIX 33: Validate saved layout IDs still exist in registry
          const validLayout = (data.layout as string[]).filter(id => VALID_WIDGET_IDS.has(id as WidgetId)) as WidgetId[];
          if (validLayout.length > 0) {
            setLayout(validLayout);
          }
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

  // FIX 23: Debounced save layout
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

  // Cleanup debounce timer
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
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
  const prochainControle = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // FIX 21: Additional KPIs
  const clientsParStatut = useMemo(() => {
    const counts: Record<string, number> = { ACTIF: 0, RETARD: 0, INACTIF: 0 };
    clients.forEach(c => { counts[c.statut] = (counts[c.statut] || 0) + 1; });
    return counts;
  }, [clients]);

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

  // FIX 22: Fix activity timeline parsing — horodatage uses "YYYY-MM-DD HH:MM" (space) format
  const activityTimeline = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    logs.forEach(l => {
      if (l.horodatage) {
        // Handle both "YYYY-MM-DD HH:MM" (space) and "YYYY-MM-DDTHH:MM" (ISO) formats
        const d = l.horodatage.split(/[T ]/)[0];
        if (d in days) days[d]++;
      }
    });
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      fullDate: date,
      actions: count,
    }));
  }, [logs]);

  const latestAlertes = useMemo(() => [...alertes].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5), [alertes]);
  const latestLogs = useMemo(() => [...logs].sort((a, b) => (b.horodatage || "").localeCompare(a.horodatage || "")).slice(0, 6), [logs]);

  // ── CSV Export ──
  const handleExportCSV = useCallback(() => {
    if (clients.length === 0) {
      toast.error("Aucun client a exporter");
      return;
    }
    const headers = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable", "Date Butoir"];
    const rows = clients.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable, c.dateButoir].map(csvSafe));
    // FIX 25: Add BOM for proper Excel encoding
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
  function scoreGlow(score: number): string {
    if (score <= 30) return "kpi-glow-green"; if (score <= 55) return "kpi-glow-amber"; return "kpi-glow-red";
  }
  function scoreIconBg(score: number): string {
    if (score <= 30) return "bg-emerald-500/10"; if (score <= 55) return "bg-amber-500/10"; return "bg-red-500/10";
  }

  // ── Greeting ──
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon apres-midi";
    return "Bonsoir";
  }, []);

  const displayName = profile?.full_name?.split(" ")[0] || "";

  // ── Widget Toggle (FIX 37: wrapped in useCallback) ──
  const toggleWidget = useCallback((id: WidgetId) => {
    const newLayout = layout.includes(id) ? layout.filter(w => w !== id) : [...layout, id];
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const moveWidget = useCallback((id: WidgetId, dir: -1 | 1) => {
    const idx = layout.indexOf(id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= layout.length) return;
    const newLayout = [...layout];
    [newLayout[idx], newLayout[target]] = [newLayout[target], newLayout[idx]];
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const resetLayout = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
    toast.success("Tableau de bord reinitialise");
  }, [saveLayout]);

  // ── Edit overlay for widgets ──
  const EditOverlay = useCallback(({ id }: { id: WidgetId }) => {
    if (!editMode) return null;
    const idx = layout.indexOf(id);
    const isFirst = idx === 0;
    const isLast = idx === layout.length - 1;
    return (
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => moveWidget(id, -1)}
          disabled={isFirst}
          aria-label="Monter le widget"
          className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <button
          onClick={() => moveWidget(id, 1)}
          disabled={isLast}
          aria-label="Descendre le widget"
          className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <button
          onClick={() => toggleWidget(id)}
          aria-label="Masquer le widget"
          className="w-7 h-7 rounded-md bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    );
  }, [editMode, layout, moveWidget, toggleWidget]);

  // ── Widget Renderers ──
  const renderWidget = useCallback((id: WidgetId, index: number) => {
    const def = WIDGET_REGISTRY.find(w => w.id === id);
    if (!def) return null;

    const delay = Math.min(index * 50, 300);

    switch (id) {
      case "kpi_clients":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer kpi-glow-blue"
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/bdd")}
            role="button"
            tabIndex={0}
            aria-label={`${clientsActifs} clients actifs sur ${clients.length} total`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">{clients.length} total</span>
                {clientsParStatut.RETARD > 0 && (
                  <span className="text-[10px] text-amber-400">{clientsParStatut.RETARD} en retard</span>
                )}
              </div>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{clientsActifs}</p>
            <p className="text-xs text-slate-400 mt-1">Clients actifs</p>
            <div className="mt-2 w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${clients.length > 0 ? (clientsActifs / clients.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        );

      case "kpi_alertes":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer ${alertesEnCours > 0 ? "ring-1 ring-red-500/30 kpi-glow-red" : "kpi-glow-green"}`}
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/registre")}
            role="button"
            tabIndex={0}
            aria-label={`${alertesEnCours} alertes en cours`}
            onKeyDown={e => e.key === "Enter" && navigate("/registre")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${alertesEnCours > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <AlertTriangle className={`w-5 h-5 ${alertesEnCours > 0 ? "text-red-400 animate-pulse" : "text-emerald-400"}`} />
              </div>
              <span className="text-[11px] text-slate-500">{alertes.length} au total</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${alertesEnCours > 0 ? "text-red-400" : "text-emerald-400"}`}>{alertesEnCours}</p>
            <p className="text-xs text-slate-400 mt-1">Alertes en cours</p>
          </div>
        );

      case "kpi_score":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer ${scoreGlow(scoreMoyen)}`}
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/bdd")}
            role="button"
            tabIndex={0}
            aria-label={`Score moyen de risque: ${scoreMoyen} sur 100`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${scoreIconBg(scoreMoyen)} flex items-center justify-center`}>
                <TrendingUp className={`w-5 h-5 ${scoreColor(scoreMoyen)}`} />
              </div>
              <span className="text-[11px] text-slate-500">/ 100</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
            <p className="text-xs text-slate-400 mt-1">Score moyen de risque</p>
            <div className="mt-2 w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${scoreMoyen <= 30 ? "bg-emerald-500" : scoreMoyen <= 55 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${scoreMoyen}%` }}
              />
            </div>
          </div>
        );

      case "kpi_revues":
        return (
          <div
            className={`glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer ${revuesEchues > 0 ? "ring-1 ring-red-500/30 kpi-glow-red" : "kpi-glow-green"}`}
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/bdd")}
            role="button"
            tabIndex={0}
            aria-label={`${revuesEchues} revues echues`}
            onKeyDown={e => e.key === "Enter" && navigate("/bdd")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${revuesEchues > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <CalendarClock className={`w-5 h-5 ${revuesEchues > 0 ? "text-red-400" : "text-emerald-400"}`} />
              </div>
              <span className="text-[11px] text-slate-500">
                {revuesEchues > 0 ? "a traiter" : "tout ok"}
              </span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${revuesEchues > 0 ? "text-red-400" : "text-white"}`}>{revuesEchues}</p>
            <p className="text-xs text-slate-400 mt-1">Revues periodiques echues</p>
          </div>
        );

      case "kpi_formation":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer"
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/gouvernance")}
            role="button"
            tabIndex={0}
            aria-label={`Derniere formation LCB: ${derniereFormation || "non renseignee"}`}
            onKeyDown={e => e.key === "Enter" && navigate("/gouvernance")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[11px] text-slate-500">LCB-FT</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{formatDate(derniereFormation)}</p>
            <p className="text-xs text-slate-400 mt-1">Derniere formation</p>
          </div>
        );

      case "kpi_controle":
        return (
          <div
            className="glass-card p-5 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-200 relative group cursor-pointer"
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => navigate("/controle")}
            role="button"
            tabIndex={0}
            aria-label={`Prochain controle qualite: ${prochainControle}`}
            onKeyDown={e => e.key === "Enter" && navigate("/controle")}
          >
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-[11px] text-slate-500">planifie</span>
            </div>
            <p className="text-lg font-bold text-white">{formatDate(prochainControle)}</p>
            <p className="text-xs text-slate-400 mt-1">Prochain controle qualite</p>
          </div>
        );

      case "chart_vigilance":
        return (
          <div className="glass-card p-6 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Repartition par vigilance</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {clients.length} dossiers
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">Niveau de vigilance applique</p>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <PieChartIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Aucun dossier</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={vigData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={vigData.length > 1 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                      label={renderPieLabel}
                      labelLine={false}
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {vigData.map((entry) => <Cell key={entry.name} fill={COLORS_VIG[entry.name] || "#64748b"} />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={vigTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-3">
                  {vigData.map(entry => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS_VIG[entry.name] || "#64748b" }} />
                      <span className="text-xs text-slate-400">{VIG_LABELS[entry.name] || entry.name}</span>
                      <span className="text-xs font-semibold text-slate-300">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "chart_risque":
        return (
          <div className="glass-card p-6 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Distribution des scores</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {clients.length} clients
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">Score de risque global</p>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Aucun client</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreDistribution} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} label={{ value: "Clients", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={scoreTooltipFormatter} />
                  <Bar dataKey="count" name="Clients" radius={[6, 6, 0, 0]} animationDuration={800}>
                    {scoreDistribution.map((entry) => <Cell key={entry.range} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );

      case "chart_timeline":
        return (
          <div className="glass-card p-6 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-300">Activite des 7 derniers jours</h3>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
                {activityTimeline.reduce((s, d) => s + d.actions, 0)} actions
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">Actions enregistrees dans le journal</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={activityTimeline}>
                <defs>
                  <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v} action${v > 1 ? "s" : ""}`, "Activite"]} />
                <Area
                  type="monotone"
                  dataKey="actions"
                  stroke="#3b82f6"
                  fill="url(#colorActions)"
                  strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", stroke: "#1e293b", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case "list_alertes":
        return (
          <div className="glass-card p-6 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">Dernieres alertes</h3>
                {alertesEnCours > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                    {alertesEnCours}
                  </span>
                )}
              </div>
              <button onClick={() => navigate("/registre")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                Tout voir <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestAlertes.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Shield className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucune alerte</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Tout est conforme</p>
              </div>
            ) : (
              <div className="space-y-1">
                {latestAlertes.map((a, i) => (
                  <div
                    key={`${a.date}-${a.clientConcerne}-${i}`}
                    className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.03] cursor-pointer border-b border-white/[0.03] last:border-0 transition-colors"
                    onClick={() => navigate("/registre")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && navigate("/registre")}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.statut === "EN COURS" ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] text-slate-500 font-mono">{formatDate(a.date)}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${a.statut === "EN COURS" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          {a.statut}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate font-medium">{a.clientConcerne}</p>
                      <p className="text-[11px] text-slate-500 truncate">{a.categorie}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "list_activity":
        return (
          <div className="glass-card p-6 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">Activite recente</h3>
              </div>
              <button onClick={() => navigate("/logs")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                Journal <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucune activite</p>
              </div>
            ) : (
              <div className="space-y-1">
                {latestLogs.map((l, i) => (
                  <div key={`${l.horodatage}-${i}`} className="py-2.5 px-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.03] last:border-0 transition-colors">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {l.horodatage ? (() => {
                          try {
                            const d = new Date(l.horodatage.replace(" ", "T"));
                            return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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

      case "actions":
        return (
          <div className="glass-card p-5 relative group" style={{ animationDelay: `${delay}ms` }}>
            <EditOverlay id={id} />
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-300">Actions rapides</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-10 text-xs"
                onClick={() => navigate("/nouveau-client")}
              >
                <UserPlus className="w-3.5 h-3.5" /> Nouveau client
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/[0.08] hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 h-10 text-xs transition-all"
                onClick={() => navigate("/controle")}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Controle
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30 h-10 text-xs transition-all"
                onClick={() => navigate("/diagnostic")}
              >
                <Activity className="w-3.5 h-3.5" /> Diagnostic
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/[0.08] hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 h-10 text-xs transition-all"
                onClick={handleExportCSV}
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </div>
        );

      default: return null;
    }
  }, [
    editMode, layout, clients, clientsActifs, clientsParStatut, alertes, alertesEnCours,
    scoreMoyen, revuesEchues, derniereFormation, prochainControle, latestAlertes, latestLogs,
    vigData, scoreDistribution, activityTimeline, navigate, handleExportCSV,
    EditOverlay, moveWidget, toggleWidget,
  ]);

  // ── Determine grid classes ──
  const getGridClass = (id: WidgetId): string => {
    const def = WIDGET_REGISTRY.find(w => w.id === id);
    if (!def) return "";
    if (def.category === "KPI") return "";
    if (id === "actions") return "lg:col-span-2";
    if (def.defaultSize === "lg") return "lg:col-span-1";
    if (def.defaultSize === "md") return "lg:col-span-1";
    return "";
  };

  const kpiWidgets = layout.filter(id => WIDGET_REGISTRY.find(w => w.id === id)?.category === "KPI");
  const otherWidgets = layout.filter(id => WIDGET_REGISTRY.find(w => w.id === id)?.category !== "KPI");

  // ── Loading state ──
  if (!configLoaded || dataLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-white/[0.03] rounded-lg animate-pulse mt-2" />
          </div>
          <div className="h-9 w-32 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04]" />
                <div className="w-12 h-3 rounded bg-white/[0.03]" />
              </div>
              <div className="h-8 w-16 rounded bg-white/[0.04] mb-1" />
              <div className="h-3 w-24 rounded bg-white/[0.03]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-4 w-40 rounded bg-white/[0.04] mb-4" />
              <div className="h-48 w-full rounded-lg bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Group widgets by category for edit panel ──
  const widgetsByCategory = WIDGET_REGISTRY.reduce((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category].push(w);
    return acc;
  }, {} as Record<string, WidgetDef[]>);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
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

      {/* Edit panel */}
      {editMode && (
        <div className="glass-card p-5 animate-fade-in-up space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Configurer le tableau de bord</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-slate-200 gap-1.5"
              onClick={resetLayout}
            >
              <RotateCcw className="w-3 h-3" /> Reinitialiser
            </Button>
          </div>
          {Object.entries(widgetsByCategory).map(([category, widgets]) => (
            <div key={category}>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{category}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {widgets.map(w => {
                  const active = layout.includes(w.id);
                  const idx = layout.indexOf(w.id);
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
                      {active && <span className="ml-auto text-[9px] text-blue-400/60 font-mono flex-shrink-0">#{idx + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in-up">
          {kpiWidgets.map((id, i) => <div key={id}>{renderWidget(id, i)}</div>)}
        </div>
      )}

      {/* Other widgets */}
      {otherWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up">
          {otherWidgets.map((id, i) => (
            <div key={id} className={getGridClass(id)}>
              {renderWidget(id, kpiWidgets.length + i)}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
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
  );
}
