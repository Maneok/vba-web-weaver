import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, AlertTriangle, TrendingUp, CalendarClock,
  GraduationCap, ClipboardCheck, UserPlus, Activity,
  Download, ChevronRight, Shield, Settings2, X,
  GripVertical, Plus, Eye, EyeOff, LayoutDashboard,
  PieChart as PieChartIcon, BarChart3, FileText, Clock,
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

const DEFAULT_LAYOUT: WidgetId[] = [
  "actions",
  "kpi_clients", "kpi_alertes", "kpi_score", "kpi_revues", "kpi_formation", "kpi_controle",
  "list_alertes", "list_activity",
  "chart_vigilance", "chart_risque",
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
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px", fontSize: "12px", color: "#e2e8f0",
  },
};

// ── CSV injection protection ─────────────────────────────────
function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (s.includes(";") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function DashboardPage() {
  const { clients, alertes, logs } = useAppState();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [layout, setLayout] = useState<WidgetId[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ── Load dashboard config ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("dashboard_configs")
          .select("layout")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          setLayout(data.layout as WidgetId[]);
        }
      } catch { /* use default */ }
      setConfigLoaded(true);
    })();
  }, [user]);

  // ── Load parametres ──
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("cle", "lcbft_config")
          .maybeSingle();
        if (data?.valeur) {
          const valeur = data.valeur as Record<string, unknown>;
          if (valeur.date_derniere_formation) setDerniereFormation(valeur.date_derniere_formation as string);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ── Save layout ──
  const saveLayout = useCallback(async (newLayout: WidgetId[]) => {
    setLayout(newLayout);
    if (!user) return;
    try {
      await supabase.from("dashboard_configs").upsert(
        { user_id: user.id, layout: newLayout },
        { onConflict: "user_id" }
      );
    } catch { /* silent */ }
  }, [user]);

  // ── KPI calculations ──
  const clientsActifs = useMemo(() => clients.filter(c => c.statut === "ACTIF").length, [clients]);
  const alertesEnCours = useMemo(() => alertes.filter(a => a.statut === "EN COURS").length, [alertes]);
  const scoreMoyen = useMemo(() => {
    if (clients.length === 0) return 0;
    return Math.round(clients.reduce((s, c) => s + c.scoreGlobal, 0) / clients.length);
  }, [clients]);
  const revuesEchues = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return clients.filter(c => c.dateButoir && c.dateButoir < today).length;
  }, [clients]);
  const prochainControle = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // ── Chart data ──
  const vigData = useMemo(() => {
    const counts = clients.reduce((acc, c) => { acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1; return acc; }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [clients]);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0, fill: "#22c55e" },
      { range: "21-40", min: 21, max: 40, count: 0, fill: "#84cc16" },
      { range: "41-60", min: 41, max: 60, count: 0, fill: "#f59e0b" },
      { range: "61-80", min: 61, max: 80, count: 0, fill: "#f97316" },
      { range: "81-100", min: 81, max: 100, count: 0, fill: "#ef4444" },
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
    logs.forEach(l => { if (l.horodatage) { const d = l.horodatage.split("T")[0]; if (d in days) days[d]++; } });
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      actions: count,
    }));
  }, [logs]);

  const latestAlertes = useMemo(() => [...alertes].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5), [alertes]);
  const latestLogs = useMemo(() => [...logs].sort((a, b) => (b.horodatage || "").localeCompare(a.horodatage || "")).slice(0, 5), [logs]);

  // ── CSV Export ──
  const handleExportCSV = () => {
    const headers = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable"];
    const rows = clients.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable].map(csvSafe));
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "export_complet_lcb.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Helpers ──
  function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
  }
  function scoreColor(score: number): string {
    if (score <= 40) return "text-emerald-400"; if (score <= 65) return "text-amber-400"; return "text-red-400";
  }
  function scoreIconBg(score: number): string {
    if (score <= 40) return "bg-emerald-500/10"; if (score <= 65) return "bg-amber-500/10"; return "bg-red-500/10";
  }

  // ── Widget Toggle ──
  const toggleWidget = (id: WidgetId) => {
    const newLayout = layout.includes(id) ? layout.filter(w => w !== id) : [...layout, id];
    saveLayout(newLayout);
  };
  const moveWidget = (id: WidgetId, dir: -1 | 1) => {
    const idx = layout.indexOf(id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= layout.length) return;
    const newLayout = [...layout];
    [newLayout[idx], newLayout[target]] = [newLayout[target], newLayout[idx]];
    saveLayout(newLayout);
  };

  // ── Widget Renderers ──
  const renderWidget = (id: WidgetId) => {
    const def = WIDGET_REGISTRY.find(w => w.id === id);
    if (!def) return null;

    const editOverlay = editMode ? (
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button onClick={() => moveWidget(id, -1)} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-400">↑</button>
        <button onClick={() => moveWidget(id, 1)} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-400">↓</button>
        <button onClick={() => toggleWidget(id)} className="w-6 h-6 rounded bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center"><X className="w-3 h-3 text-red-400" /></button>
      </div>
    ) : null;

    switch (id) {
      case "kpi_clients":
        return (
          <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
              <span className="text-[11px] text-slate-500">{clients.length} total</span>
            </div>
            <p className="text-3xl font-bold text-white">{clientsActifs}</p>
            <p className="text-xs text-slate-400 mt-1">Clients actifs</p>
          </div>
        );
      case "kpi_alertes":
        return (
          <div className={`glass-card p-5 hover:bg-white/[0.03] transition-colors relative group ${alertesEnCours > 0 ? "ring-1 ring-red-500/30" : ""}`}>
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${alertesEnCours > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <AlertTriangle className={`w-5 h-5 ${alertesEnCours > 0 ? "text-red-400" : "text-emerald-400"}`} />
              </div>
              <span className="text-[11px] text-slate-500">{alertes.length} au total</span>
            </div>
            <p className="text-3xl font-bold text-white">{alertesEnCours}</p>
            <p className="text-xs text-slate-400 mt-1">Alertes en cours</p>
          </div>
        );
      case "kpi_score":
        return (
          <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${scoreIconBg(scoreMoyen)} flex items-center justify-center`}><TrendingUp className={`w-5 h-5 ${scoreColor(scoreMoyen)}`} /></div>
              <span className="text-[11px] text-slate-500">sur 100</span>
            </div>
            <p className={`text-3xl font-bold ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
            <p className="text-xs text-slate-400 mt-1">Score moyen</p>
          </div>
        );
      case "kpi_revues":
        return (
          <div className={`glass-card p-5 hover:bg-white/[0.03] transition-colors relative group ${revuesEchues > 0 ? "ring-1 ring-red-500/30" : ""}`}>
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${revuesEchues > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
                <CalendarClock className={`w-5 h-5 ${revuesEchues > 0 ? "text-red-400" : "text-emerald-400"}`} />
              </div>
              <span className="text-[11px] text-slate-500">dossiers</span>
            </div>
            <p className="text-3xl font-bold text-white">{revuesEchues}</p>
            <p className="text-xs text-slate-400 mt-1">Revues echues</p>
          </div>
        );
      case "kpi_formation":
        return (
          <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-400" /></div>
              <span className="text-[11px] text-slate-500">formation</span>
            </div>
            <p className="text-lg font-bold text-white">{formatDate(derniereFormation)}</p>
            <p className="text-xs text-slate-400 mt-1">Derniere formation LCB</p>
          </div>
        );
      case "kpi_controle":
        return (
          <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-cyan-400" /></div>
              <span className="text-[11px] text-slate-500">planifie</span>
            </div>
            <p className="text-lg font-bold text-white">{formatDate(prochainControle)}</p>
            <p className="text-xs text-slate-400 mt-1">Prochain controle</p>
          </div>
        );

      case "chart_vigilance":
        return (
          <div className="glass-card p-6 relative group">
            {editOverlay}
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Repartition par niveau de vigilance</h3>
            <p className="text-[11px] text-slate-500 mb-4">{clients.length} dossiers analyses</p>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={vigData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                    {vigData.map((entry) => <Cell key={entry.name} fill={COLORS_VIG[entry.name] || "#64748b"} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {vigData.map(entry => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_VIG[entry.name] || "#64748b" }} />
                    <span className="text-xs text-slate-400">{VIG_LABELS[entry.name] || entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "chart_risque":
        return (
          <div className="glass-card p-6 relative group">
            {editOverlay}
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Distribution des scores de risque</h3>
            <p className="text-[11px] text-slate-500 mb-4">{clients.length} clients</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreDistribution} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Clients" radius={[4, 4, 0, 0]}>
                  {scoreDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "chart_timeline":
        return (
          <div className="glass-card p-6 relative group">
            {editOverlay}
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Activite des 7 derniers jours</h3>
            <p className="text-[11px] text-slate-500 mb-4">Actions enregistrees</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="actions" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case "list_alertes":
        return (
          <div className="glass-card p-6 relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300">Dernieres alertes</h3>
              <button onClick={() => navigate("/registre")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                Voir tout <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestAlertes.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Aucune alerte</p>
            ) : (
              <div className="space-y-3">
                {latestAlertes.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] text-slate-500 font-mono">{formatDate(a.date)}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${a.statut === "EN COURS" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          {a.statut}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate">{a.clientConcerne}</p>
                      <p className="text-[11px] text-slate-500 truncate">{a.categorie}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "list_activity":
        return (
          <div className="glass-card p-6 relative group">
            {editOverlay}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300">Activite recente</h3>
              <button onClick={() => navigate("/logs")} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                Voir tout <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {latestLogs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Aucune activite</p>
            ) : (
              <div className="space-y-3">
                {latestLogs.map((l, i) => (
                  <div key={i} className="py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {l.horodatage ? new Date(l.horodatage).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{l.typeAction}</span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">{l.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "actions":
        return (
          <div className="glass-card p-5 relative group">
            {editOverlay}
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Actions rapides</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/nouveau-client")}>
                <UserPlus className="w-3.5 h-3.5" /> Nouveau client
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => navigate("/controle")}>
                <ClipboardCheck className="w-3.5 h-3.5" /> Controle qualite
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => navigate("/diagnostic")}>
                <Activity className="w-3.5 h-3.5" /> Diagnostic 360
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={handleExportCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </div>
        );

      default: return null;
    }
  };

  // ── Determine grid classes ──
  const getGridClass = (id: WidgetId): string => {
    const def = WIDGET_REGISTRY.find(w => w.id === id);
    if (!def) return "";
    if (def.category === "KPI") return "";
    if (def.defaultSize === "lg") return "lg:col-span-2";
    if (def.defaultSize === "md") return "lg:col-span-1";
    return "";
  };

  const kpiWidgets = layout.filter(id => WIDGET_REGISTRY.find(w => w.id === id)?.category === "KPI");
  const otherWidgets = layout.filter(id => WIDGET_REGISTRY.find(w => w.id === id)?.category !== "KPI");

  if (!configLoaded) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-400" /> Tableau de bord
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} dossiers · {alertesEnCours} alerte(s) active(s)</p>
        </div>
        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          className={`gap-1.5 ${editMode ? "bg-blue-600 hover:bg-blue-700" : "border-white/[0.06]"}`}
          onClick={() => setEditMode(!editMode)}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {editMode ? "Terminer" : "Personnaliser"}
        </Button>
      </div>

      {/* Edit panel */}
      {editMode && (
        <div className="glass-card p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Widgets disponibles</h3>
            <Button variant="ghost" size="sm" className="text-xs text-slate-400" onClick={() => saveLayout(DEFAULT_LAYOUT)}>
              Reinitialiser
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {WIDGET_REGISTRY.map(w => {
              const active = layout.includes(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                    active
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      : "bg-white/[0.02] text-slate-500 border border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {w.label}
                  <Badge variant="outline" className="text-[9px] ml-auto border-white/10">{w.category}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
          {kpiWidgets.map(id => <div key={id}>{renderWidget(id)}</div>)}
        </div>
      )}

      {/* Other widgets */}
      {otherWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
          {otherWidgets.map(id => (
            <div key={id} className={getGridClass(id)}>
              {renderWidget(id)}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {layout.length === 0 && (
        <div className="glass-card p-12 text-center animate-fade-in-up">
          <LayoutDashboard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">Aucun widget affiche</p>
          <p className="text-sm text-slate-500 mb-4">Cliquez sur "Personnaliser" pour ajouter des widgets a votre tableau de bord.</p>
          <Button variant="outline" size="sm" onClick={() => { setEditMode(true); saveLayout(DEFAULT_LAYOUT); }}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter des widgets
          </Button>
        </div>
      )}
    </div>
  );
}
