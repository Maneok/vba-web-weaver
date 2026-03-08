import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Users, AlertTriangle, TrendingUp, CalendarClock,
  GraduationCap, ClipboardCheck, UserPlus, Activity,
  Download, ChevronRight, Shield,
} from "lucide-react";

const COLORS_VIG: Record<string, string> = {
  SIMPLIFIEE: "#22c55e",
  STANDARD: "#f59e0b",
  RENFORCEE: "#ef4444",
};

const VIG_LABELS: Record<string, string> = {
  SIMPLIFIEE: "Simplifiee",
  STANDARD: "Standard",
  RENFORCEE: "Renforcee",
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(217, 33%, 17%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
};

export default function DashboardPage() {
  const { clients, alertes, logs } = useAppState();
  const navigate = useNavigate();

  // --- Parametres from Supabase ---
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);

  useEffect(() => {
    async function loadParametres() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("cle", "lcbft_config")
        .maybeSingle();

      if (data?.valeur) {
        const valeur = data.valeur as Record<string, unknown>;
        if (valeur.date_derniere_formation) {
          setDerniereFormation(valeur.date_derniere_formation as string);
        }
      }
    }
    loadParametres();
  }, []);

  // --- KPI calculations ---
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

  // Prochain controle: 3 months from now as a reasonable default
  const prochainControle = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  // --- Vigilance distribution for pie chart ---
  const vigData = useMemo(() => {
    const counts = clients.reduce((acc, c) => {
      acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [clients]);

  // --- Latest alertes & logs ---
  const latestAlertes = useMemo(() => {
    return [...alertes]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 5);
  }, [alertes]);

  const latestLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => (b.horodatage || "").localeCompare(a.horodatage || ""))
      .slice(0, 5);
  }, [logs]);

  // --- Export CSV ---
  const handleExportCSV = () => {
    const headers = ["Ref", "Raison Sociale", "Score", "Vigilance", "Statut", "Comptable"];
    const rows = clients.map(c => [c.ref, c.raisonSociale, c.scoreGlobal, c.nivVigilance, c.statut, c.comptable]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export_complet_lcb.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Helpers ---
  function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  }

  function scoreColor(score: number): string {
    if (score <= 40) return "text-emerald-400";
    if (score <= 65) return "text-amber-400";
    return "text-red-400";
  }

  function scoreIconColor(score: number): string {
    if (score <= 40) return "bg-emerald-500/10";
    if (score <= 65) return "bg-amber-500/10";
    return "bg-red-500/10";
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 animate-fade-in-up">
        <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/nouveau-client")}>
          <UserPlus className="w-4 h-4" /> Nouveau client
        </Button>
        <Button variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => navigate("/controle")}>
          <ClipboardCheck className="w-4 h-4" /> Controle qualite
        </Button>
        <Button variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => navigate("/diagnostic")}>
          <Activity className="w-4 h-4" /> Diagnostic 360
        </Button>
        <Button variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={handleExportCSV}>
          <Download className="w-4 h-4" /> Exporter CSV
        </Button>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
        {/* Card 1: Clients actifs */}
        <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[11px] text-slate-500">{clients.length} total</span>
          </div>
          <p className="text-3xl font-bold text-white">{clientsActifs}</p>
          <p className="text-xs text-slate-400 mt-1">Clients actifs</p>
        </div>

        {/* Card 2: Alertes en cours */}
        <div className={`glass-card p-5 hover:bg-white/[0.03] transition-colors ${alertesEnCours > 0 ? "ring-1 ring-red-500/30" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg ${alertesEnCours > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
              <AlertTriangle className={`w-5 h-5 ${alertesEnCours > 0 ? "text-red-400" : "text-emerald-400"}`} />
            </div>
            <span className="text-[11px] text-slate-500">{alertes.length} au total</span>
          </div>
          <p className="text-3xl font-bold text-white">{alertesEnCours}</p>
          <p className="text-xs text-slate-400 mt-1">Alertes en cours</p>
        </div>

        {/* Card 3: Score moyen */}
        <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg ${scoreIconColor(scoreMoyen)} flex items-center justify-center`}>
              <TrendingUp className={`w-5 h-5 ${scoreColor(scoreMoyen)}`} />
            </div>
            <span className="text-[11px] text-slate-500">sur 100</span>
          </div>
          <p className={`text-3xl font-bold ${scoreColor(scoreMoyen)}`}>{scoreMoyen}</p>
          <p className="text-xs text-slate-400 mt-1">Score moyen</p>
        </div>

        {/* Card 4: Revues echues */}
        <div className={`glass-card p-5 hover:bg-white/[0.03] transition-colors ${revuesEchues > 0 ? "ring-1 ring-red-500/30" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg ${revuesEchues > 0 ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
              <CalendarClock className={`w-5 h-5 ${revuesEchues > 0 ? "text-red-400" : "text-emerald-400"}`} />
            </div>
            <span className="text-[11px] text-slate-500">dossiers</span>
          </div>
          <p className="text-3xl font-bold text-white">{revuesEchues}</p>
          <p className="text-xs text-slate-400 mt-1">Revues echues</p>
        </div>

        {/* Card 5: Derniere formation LCB */}
        <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-[11px] text-slate-500">formation</span>
          </div>
          <p className="text-lg font-bold text-white">{formatDate(derniereFormation)}</p>
          <p className="text-xs text-slate-400 mt-1">Derniere formation LCB</p>
        </div>

        {/* Card 6: Prochain controle */}
        <div className="glass-card p-5 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-[11px] text-slate-500">planifie</span>
          </div>
          <p className="text-lg font-bold text-white">{formatDate(prochainControle)}</p>
          <p className="text-xs text-slate-400 mt-1">Prochain controle</p>
        </div>
      </div>

      {/* Two-column section: Latest alertes + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
        {/* Latest alertes */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Dernieres alertes</h3>
            <button
              onClick={() => navigate("/registre")}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
            >
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
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        a.statut === "EN COURS"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}>
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

        {/* Recent activity */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Activite recente</h3>
            <button
              onClick={() => navigate("/logs")}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
            >
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
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                      {l.typeAction}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{l.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vigilance pie chart */}
      <div className="glass-card p-6 animate-fade-in-up">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Repartition par niveau de vigilance</h3>
        <p className="text-[11px] text-slate-500 mb-4">{clients.length} dossiers analyses</p>
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={vigData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {vigData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS_VIG[entry.name] || "#64748b"} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {vigData.map(entry => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_VIG[entry.name] || "#64748b" }} />
                <span className="text-xs text-slate-400">
                  {VIG_LABELS[entry.name] || entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
