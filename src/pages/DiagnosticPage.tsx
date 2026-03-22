import { useMemo, useEffect, useState, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { runDiagnostic360, type DiagnosticReport, type DiagnosticItem } from "@/lib/diagnosticEngine";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { controlesService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity,
  Users, FileText, BookOpen, BarChart3, Bell, ClipboardCheck,
  ChevronDown, MessageSquare, Save, Loader2,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

// ---------------------------------------------------------------------------
// Gauge component using Recharts RadialBarChart
// ---------------------------------------------------------------------------
function CircularGauge({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 80 ? "hsl(142, 71%, 45%)" : clamped >= 50 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  const data = [{ value: clamped, fill: color }];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <RadialBarChart
          width={112} height={112} cx={56} cy={56}
          innerRadius={40} outerRadius={52} startAngle={90} endAngle={-270}
          barSize={10} data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" angleAxisId={0} cornerRadius={6} />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center leading-tight max-w-[120px]">{label}</p>
      {sublabel && <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">{sublabel}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status config for diagnostic items
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  OK: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  ALERTE: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  CRITIQUE: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

const NOTE_COLORS: Record<string, string> = {
  A: "from-emerald-600/80 to-emerald-700/60",
  B: "from-yellow-600/80 to-yellow-700/60",
  C: "from-orange-600/80 to-orange-700/60",
  D: "from-red-600/80 to-red-700/60",
};

// ---------------------------------------------------------------------------
// DiagnosticItemCard
// ---------------------------------------------------------------------------
function DiagnosticItemCard({ item }: { item: DiagnosticItem }) {
  const config = STATUS_CONFIG[item.statut as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.OK;
  const Icon = config.icon;
  return (
    <div className={`p-3 rounded-lg border ${config.border} ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.indicateur}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
              {item.statut}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">{item.detail}</p>
          {item.recommandation !== "Aucune action requise." && (
            <p className="text-xs mt-1.5 text-amber-400 font-medium">
              &rarr; {item.recommandation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ icon: Icon, iconColor, label, value, sublabel }: {
  icon: typeof Users; iconColor: string; label: string; value: string | number; sublabel?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
          {sublabel && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CROEC Checklist
// ---------------------------------------------------------------------------
type CroecStatus = "conforme" | "non_conforme" | "na";

interface CroecItem {
  id: string;
  label: string;
  statut: CroecStatus;
  commentaire: string;
}

const CROEC_POINTS: { id: string; label: string }[] = [
  { id: "referent", label: "Designation du referent LCB-FT" },
  { id: "manuel", label: "Manuel des procedures internes a jour" },
  { id: "classification", label: "Classification des risques documentee" },
  { id: "formation", label: "Formation annuelle des collaborateurs" },
  { id: "registre", label: "Registre des alertes tenu" },
  { id: "lettre_mission", label: "Lettre de mission conforme (art. NP2300)" },
  { id: "kyc", label: "KYC complet pour chaque client" },
  { id: "be", label: "Beneficiaires effectifs identifies" },
  { id: "screening", label: "Screening sanctions realise" },
  { id: "conservation", label: "Conservation des documents 5 ans" },
  { id: "declaration", label: "Procedure de declaration de soupcon" },
  { id: "revues", label: "Revues de maintien a jour" },
];

const STATUS_LABELS: Record<CroecStatus, string> = {
  conforme: "Conforme",
  non_conforme: "Non conforme",
  na: "N/A",
};

const STATUS_BADGE_STYLES: Record<CroecStatus, string> = {
  conforme: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  non_conforme: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  na: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DiagnosticPage() {
  const { clients, collaborateurs, alertes, logs } = useAppState();
  const { profile } = useAuth();

  useDocumentTitle("Diagnostic");

  // --- Supabase data ---
  const [controles, setControles] = useState<Record<string, unknown>[]>([]);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [lmSignedCount, setLmSignedCount] = useState(0);
  const [lmTotalCount, setLmTotalCount] = useState(0);
  const [controlesQualiteCount, setControlesQualiteCount] = useState(0);

  // CROEC checklist state
  const [croecItems, setCroecItems] = useState<CroecItem[]>(
    CROEC_POINTS.map((p) => ({ id: p.id, label: p.label, statut: "non_conforme" as CroecStatus, commentaire: "" }))
  );
  const [croecOpen, setCroecOpen] = useState(false);
  const [savingCroec, setSavingCroec] = useState(false);

  useEffect(() => {
    let cancelled = false;

    controlesService.getAll()
      .then((data) => { if (!cancelled) setControles(data as Record<string, unknown>[]); })
      .catch((err) => {
        logger.error("[Diagnostic] controles error:", err);
        if (!cancelled) toast.error("Erreur lors du chargement des controles");
      });

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        // Parametres
        const { data: paramData } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("cle", "lcbft_config")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && paramData?.valeur) {
          const valeur = paramData.valeur as Record<string, unknown>;
          if (valeur.date_derniere_formation) {
            setDerniereFormation(valeur.date_derniere_formation as string);
          }
        }

        // Lettres de mission stats
        if (profile?.cabinet_id) {
          const { count: totalLm } = await supabase
            .from("lettres_mission")
            .select("*", { count: "exact", head: true })
            .eq("cabinet_id", profile.cabinet_id);
          if (!cancelled && totalLm !== null) setLmTotalCount(totalLm);

          const { count: signedLm } = await supabase
            .from("lettres_mission")
            .select("*", { count: "exact", head: true })
            .eq("cabinet_id", profile.cabinet_id)
            .eq("status", "signee");
          if (!cancelled && signedLm !== null) setLmSignedCount(signedLm);

          // Controles qualite count
          const { count: cqCount } = await supabase
            .from("controles_qualite")
            .select("*", { count: "exact", head: true })
            .eq("cabinet_id", profile.cabinet_id);
          if (!cancelled && cqCount !== null) setControlesQualiteCount(cqCount);

          // Load CROEC checklist from controles_croec
          const { data: croecRows } = await supabase
            .from("controles_croec")
            .select("*")
            .eq("cabinet_id", profile.cabinet_id)
            .order("date_controle", { ascending: false })
            .limit(1);

          if (!cancelled && croecRows && croecRows.length > 0) {
            const row = croecRows[0];
            const actions = row.actions_suite as CroecItem[] | null;
            if (actions && Array.isArray(actions)) {
              setCroecItems(actions);
            }
          }
        }
      } catch (err) {
        logger.error("[Diagnostic] loadData error:", err);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

  // --- Diagnostic engine report ---
  const report = useMemo<DiagnosticReport>(
    () => runDiagnostic360(clients, collaborateurs, alertes, logs),
    [clients, collaborateurs, alertes, logs]
  );

  // --- Computed indicators ---
  const indicators = useMemo(() => {
    const totalControles = controles.length;
    const conformes = controles.filter((c) => {
      const res = (c.resultat_global as string) || "";
      return res === "CONFORME" || res === "CONFORME AVEC RESERVES";
    }).length;
    const tauxConformite = totalControles > 0 ? (conformes / totalControles) * 100 : 0;

    const totalClients = clients.length;
    const kycComplete = clients.filter(
      (c) => c.be && c.be.trim() !== "" && c.dateExpCni && c.dateExpCni.trim() !== ""
    ).length;
    const tauxKYC = totalClients > 0 ? (kycComplete / totalClients) * 100 : 0;

    const totalAlertes = alertes.length;
    const alertesResolues = alertes.filter((a) => a.statut !== "EN COURS").length;
    const alertesRatio = totalAlertes > 0 ? (alertesResolues / totalAlertes) * 100 : 100;

    let formationPct = 0;
    let formationLabel = "Aucune formation";
    if (derniereFormation) {
      const formDate = new Date(derniereFormation);
      if (isNaN(formDate.getTime())) {
        formationPct = 0;
        formationLabel = "Date invalide";
      } else {
        const now = new Date();
        const diffMonths = (now.getFullYear() - formDate.getFullYear()) * 12 + (now.getMonth() - formDate.getMonth());
        if (diffMonths < 12) {
          formationPct = 100;
          formationLabel = `Il y a ${diffMonths} mois`;
        } else if (diffMonths < 24) {
          formationPct = Math.max(20, 100 - (diffMonths - 12) * 6);
          formationLabel = `Il y a ${diffMonths} mois`;
        } else {
          formationPct = 10;
          formationLabel = `Il y a ${Math.floor(diffMonths / 12)} ans`;
        }
      }
    }

    const avgScore = totalClients > 0
      ? clients.reduce((sum, c) => sum + (c.scoreGlobal || 0), 0) / totalClients
      : 0;
    const scoreInverted = Math.max(0, 100 - avgScore);

    // Collaborateurs formes (< 12 mois)
    const collabFormes = collaborateurs.filter((c) => {
      if (!c.derniereFormation) return false;
      const ts = new Date(c.derniereFormation).getTime();
      if (isNaN(ts)) return false;
      return (Date.now() - ts) / (1000 * 60 * 60 * 24) < 365;
    }).length;
    const pctCollabFormes = collaborateurs.length > 0 ? Math.round((collabFormes / collaborateurs.length) * 100) : 0;

    // LM signees
    const pctLmSignees = lmTotalCount > 0 ? Math.round((lmSignedCount / lmTotalCount) * 100) : 0;

    // Alertes en cours
    const alertesEnCours = alertes.filter((a) => a.statut === "EN COURS").length;

    return {
      tauxConformite, tauxKYC, alertesRatio, formationPct, formationLabel,
      scoreInverted, avgScore, collabFormes, pctCollabFormes, pctLmSignees, alertesEnCours,
    };
  }, [clients, alertes, controles, derniereFormation, collaborateurs, lmSignedCount, lmTotalCount]);

  // --- Score global de conformite ---
  const scoreConformite = useMemo(() => {
    const weights = [
      { value: indicators.tauxKYC, weight: 25 },
      { value: indicators.tauxConformite, weight: 20 },
      { value: indicators.alertesRatio, weight: 15 },
      { value: indicators.formationPct, weight: 15 },
      { value: indicators.scoreInverted, weight: 15 },
      { value: indicators.pctLmSignees, weight: 10 },
    ];
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    return Math.round(weights.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight);
  }, [indicators]);

  // --- Auto-generated recommendations ---
  const autoRecommandations = useMemo(() => {
    const recs: string[] = [];
    if (indicators.tauxConformite < 80) {
      recs.push(`Taux de conformite a ${Math.round(indicators.tauxConformite)}% — renforcer les controles qualite et planifier des revues periodiques.`);
    }
    if (indicators.tauxKYC < 80) {
      recs.push(`Completude KYC insuffisante (${Math.round(indicators.tauxKYC)}%) — verifier les pieces d'identite et beneficiaires effectifs manquants.`);
    }
    if (indicators.alertesRatio < 80) {
      recs.push(`${Math.round(100 - indicators.alertesRatio)}% des alertes sont encore en cours — prioriser le traitement des declarations de soupcon.`);
    }
    if (indicators.formationPct < 80) {
      recs.push(`Formation LCB-FT obsolete (${indicators.formationLabel}) — programmer une session de mise a jour pour l'equipe.`);
    }
    if (indicators.scoreInverted < 50) {
      recs.push(`Score de risque moyen eleve (${Math.round(indicators.avgScore)}/100) — revoir la classification des clients a risque.`);
    }
    return recs;
  }, [indicators]);

  // --- CROEC helpers ---
  const updateCroecItem = useCallback((id: string, field: "statut" | "commentaire", value: string) => {
    setCroecItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, [field]: value } : item)
    );
  }, []);

  const croecScore = useMemo(() => {
    const applicable = croecItems.filter((i) => i.statut !== "na");
    const conformes = applicable.filter((i) => i.statut === "conforme").length;
    return { conformes, total: applicable.length };
  }, [croecItems]);

  const saveCroecChecklist = useCallback(async () => {
    if (!profile?.cabinet_id) return;
    setSavingCroec(true);
    try {
      const { error } = await supabase.from("controles_croec").upsert({
        cabinet_id: profile.cabinet_id,
        date_controle: new Date().toISOString().split("T")[0],
        type: "CHECKLIST_PREPARATION",
        resultat: croecScore.total > 0 && croecScore.conformes === croecScore.total ? "CONFORME" : "AVEC_RESERVES",
        observations: `${croecScore.conformes}/${croecScore.total} points conformes`,
        actions_suite: croecItems as unknown as Record<string, unknown>,
      }, { onConflict: "cabinet_id,date_controle" });
      if (error) throw error;
      toast.success("Checklist CROEC enregistree");
    } catch (err) {
      logger.error("[Diagnostic] saveCroec error:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingCroec(false);
    }
  }, [profile?.cabinet_id, croecItems, croecScore]);

  const categories = [...new Set(report.items.map((i) => i.categorie))];
  const critiques = report.items.filter((i) => i.statut === "CRITIQUE").length;
  const alerteCount = report.items.filter((i) => i.statut === "ALERTE").length;
  const okCount = report.items.filter((i) => i.statut === "OK").length;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto" role="main" aria-label="Diagnostic 360 Tracfin">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            Diagnostic 360° Tracfin
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">
            Analyse complete du dispositif LCB-FT — {report.dateGeneration}
          </p>
        </div>
        <Button
          onClick={() => { try { generateDiagnosticPdf(report); toast.success("PDF diagnostic genere"); } catch { toast.error("Erreur lors de la generation du PDF"); } }}
          variant="outline"
          className="gap-2 border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
        >
          <FileDown className="w-4 h-4" />
          Exporter PDF
        </Button>
      </div>

      {/* ═══ KPI Dashboard Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={Users}
          iconColor="bg-blue-500"
          label="Clients actifs"
          value={clients.length}
          sublabel={lmTotalCount > 0 ? `${indicators.pctLmSignees}% avec LM signee` : undefined}
        />
        <KpiCard
          icon={BookOpen}
          iconColor="bg-purple-500"
          label="Collaborateurs"
          value={collaborateurs.length}
          sublabel={`${indicators.pctCollabFormes}% formes`}
        />
        <KpiCard
          icon={FileText}
          iconColor="bg-indigo-500"
          label="Lettres de mission"
          value={lmTotalCount}
          sublabel={`${lmSignedCount} signee${lmSignedCount > 1 ? "s" : ""}`}
        />
        <KpiCard
          icon={BarChart3}
          iconColor="bg-amber-500"
          label="Risque moyen"
          value={`${Math.round(indicators.avgScore)}/100`}
          sublabel={indicators.avgScore <= 25 ? "Faible" : indicators.avgScore <= 60 ? "Moyen" : "Eleve"}
        />
        <KpiCard
          icon={Bell}
          iconColor="bg-red-500"
          label="Alertes ouvertes"
          value={indicators.alertesEnCours}
          sublabel={`${alertes.length} au total`}
        />
        <KpiCard
          icon={ClipboardCheck}
          iconColor="bg-emerald-500"
          label="Controles qualite"
          value={controlesQualiteCount}
          sublabel={controles.length > 0 ? `${Math.round(indicators.tauxConformite)}% conformes` : undefined}
        />
      </div>

      {/* ═══ Score global de conformite ═══ */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/[0.06] dark:to-indigo-500/[0.04] border border-blue-200/40 dark:border-blue-500/15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Score global de conformite</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Moyenne ponderee de tous les indicateurs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black ${scoreConformite >= 80 ? "text-emerald-600 dark:text-emerald-400" : scoreConformite >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
            {scoreConformite}%
          </span>
        </div>
      </div>

      {/* Score Banner */}
      <div className="glass-card border border-white/10 rounded-xl overflow-hidden" role="region" aria-label="Score global du dispositif">
        <div className={`bg-gradient-to-r ${NOTE_COLORS[report.noteLettre] || NOTE_COLORS.D} p-6`}>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <span className="text-4xl font-black text-slate-900 dark:text-white">{report.noteLettre}</span>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                Score du dispositif : {report.scoreGlobalDispositif}/100
              </p>
              <p className="text-sm text-slate-700 dark:text-white/80 mt-1">{report.synthese}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{okCount}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400">Conformes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{alerteCount}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400">Alertes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{critiques}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400">Critiques</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{report.items.length} indicateurs analyses</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">sur l'ensemble du dispositif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex" role="progressbar" aria-valuenow={report.scoreGlobalDispositif} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-emerald-500 transition-all" style={{ width: `${report.items.length > 0 ? (okCount / report.items.length) * 100 : 0}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${report.items.length > 0 ? (alerteCount / report.items.length) * 100 : 0}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${report.items.length > 0 ? (critiques / report.items.length) * 100 : 0}%` }} />
      </div>

      {/* Circular Gauges */}
      <div className="glass-card border border-white/10 rounded-xl p-6" role="region" aria-label="Indicateurs cles de conformite">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Indicateurs cles</h2>
        </div>
        <div className="flex flex-wrap justify-around gap-6">
          <CircularGauge value={indicators.tauxConformite} label="Taux de conformite" sublabel={`${controles.length} controles`} />
          <CircularGauge value={indicators.tauxKYC} label="Completude KYC" sublabel={`${clients.length} clients`} />
          <CircularGauge value={indicators.alertesRatio} label="Alertes resolues" sublabel={`${alertes.length} alertes`} />
          <CircularGauge value={indicators.formationPct} label="Formation LCB-FT" sublabel={indicators.formationLabel} />
          <CircularGauge value={indicators.scoreInverted} label="Score risque moyen" sublabel={`${Math.round(indicators.avgScore)}/100`} />
        </div>
      </div>

      {/* Detail by Category */}
      {categories.map((cat) => (
        <div key={cat} className="glass-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{cat}</h3>
          <div className="space-y-2">
            {report.items
              .filter((i) => i.categorie === cat)
              .map((item, idx) => (
                <DiagnosticItemCard key={idx} item={item} />
              ))}
          </div>
        </div>
      ))}

      {/* Recommandations */}
      {autoRecommandations.length > 0 && (
        <div className="glass-card border border-white/10 rounded-xl p-5 ring-1 ring-amber-500/20">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Recommandations
          </h3>
          <div className="space-y-2">
            {autoRecommandations.map((rec, i) => (
              <div key={`auto-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <span className="font-bold text-amber-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Actions */}
      {report.recommandationsPrioritaires.length > 0 && (
        <div className="glass-card border border-white/10 rounded-xl p-5 ring-1 ring-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4" />
            Actions correctives prioritaires
          </h3>
          <div className="space-y-2">
            {report.recommandationsPrioritaires.map((rec, i) => (
              <div key={`prio-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <span className="font-bold text-red-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CHECKLIST CONTRÔLE CROEC ═══ */}
      <div className="glass-card border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setCroecOpen(!croecOpen)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Checklist Controle CROEC</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Preparation au controle qualite — {croecScore.conformes}/{croecScore.total} points conformes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${croecScore.total > 0 && croecScore.conformes === croecScore.total ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
              {croecScore.total > 0 ? Math.round((croecScore.conformes / croecScore.total) * 100) : 0}%
            </Badge>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${croecOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${croecOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-5 pb-5 border-t border-white/[0.06]">
            {/* Progress */}
            <div className="py-4">
              <div className="w-full h-2 rounded-full bg-slate-200/50 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${croecScore.total > 0 ? (croecScore.conformes / croecScore.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {croecItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono w-6 text-right shrink-0">{idx + 1}.</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0">{item.label}</p>

                  {/* Status toggle */}
                  <div className="flex gap-1 shrink-0">
                    {(["conforme", "non_conforme", "na"] as CroecStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateCroecItem(item.id, "statut", s)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                          item.statut === s
                            ? STATUS_BADGE_STYLES[s]
                            : "border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <div className="relative shrink-0">
                    <Input
                      value={item.commentaire}
                      onChange={(e) => updateCroecItem(item.id, "commentaire", e.target.value)}
                      placeholder="Commentaire..."
                      className="w-40 h-7 text-xs bg-transparent border-gray-200 dark:border-white/[0.06]"
                    />
                    {item.commentaire && (
                      <MessageSquare className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {croecScore.conformes}/{croecScore.total} points conformes
                {croecScore.total > 0 && croecScore.conformes === croecScore.total && (
                  <span className="ml-2 text-emerald-400 font-medium">— Pret pour le controle</span>
                )}
              </p>
              <Button
                onClick={saveCroecChecklist}
                disabled={savingCroec}
                size="sm"
                className="gap-2"
              >
                {savingCroec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
