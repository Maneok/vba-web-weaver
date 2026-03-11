import { useMemo, useEffect, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { runDiagnostic360, type DiagnosticReport, type DiagnosticItem } from "@/lib/diagnosticEngine";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { controlesService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileDown, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

// ---------------------------------------------------------------------------
// Gauge component using Recharts RadialBarChart
// ---------------------------------------------------------------------------
function CircularGauge({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 80 ? "#22c55e" : clamped >= 50 ? "#f59e0b" : "#ef4444";

  const data = [{ value: clamped, fill: color }];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <RadialBarChart
          width={112}
          height={112}
          cx={56}
          cy={56}
          innerRadius={40}
          outerRadius={52}
          startAngle={90}
          endAngle={-270}
          barSize={10}
          data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "rgba(255,255,255,0.06)" }}
            dataKey="value"
            angleAxisId={0}
            cornerRadius={6}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-100">{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-300 text-center leading-tight max-w-[120px]">{label}</p>
      {sublabel && <p className="text-[10px] text-slate-500 text-center">{sublabel}</p>}
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
            <p className="text-sm font-medium text-slate-200">{item.indicateur}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
              {item.statut}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{item.detail}</p>
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
// Main Page
// ---------------------------------------------------------------------------
export default function DiagnosticPage() {
  const { clients, collaborateurs, alertes, logs } = useAppState();

  useDocumentTitle("Diagnostic");

  // --- Supabase data: controles + parametres ---
  const [controles, setControles] = useState<Record<string, unknown>[]>([]);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    controlesService.getAll()
      .then((data) => { if (!cancelled) setControles(data as Record<string, unknown>[]); })
      .catch((err) => {
        logger.error("[Diagnostic] controles error:", err);
        if (!cancelled) toast.error("Erreur lors du chargement des controles");
      });

    async function loadParametres() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const { data } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("cle", "lcbft_config")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.valeur) {
          const valeur = data.valeur as Record<string, unknown>;
          if (cancelled) return;
          if (valeur.date_derniere_formation) {
            setDerniereFormation(valeur.date_derniere_formation as string);
          }
        }
      } catch (err: unknown) {
        logger.error("[Diagnostic] loadParametres error:", err);
        if (!cancelled) toast.error("Erreur lors du chargement des parametres");
      }
    }
    loadParametres();
    return () => { cancelled = true; };
  }, []);

  // --- Diagnostic engine report ---
  const report = useMemo<DiagnosticReport>(
    () => runDiagnostic360(clients, collaborateurs, alertes, logs),
    [clients, collaborateurs, alertes, logs]
  );

  // --- Computed indicators ---
  const indicators = useMemo(() => {
    // 1. Taux de conformite
    const totalControles = controles.length;
    const conformes = controles.filter((c) => {
      const res = (c.resultat_global as string) || "";
      return res === "CONFORME" || res === "CONFORME AVEC RESERVES";
    }).length;
    const tauxConformite = totalControles > 0 ? (conformes / totalControles) * 100 : 0;

    // 2. Completude KYC
    const totalClients = clients.length;
    const kycComplete = clients.filter(
      (c) => c.be && c.be.trim() !== "" && c.dateExpCni && c.dateExpCni.trim() !== ""
    ).length;
    const tauxKYC = totalClients > 0 ? (kycComplete / totalClients) * 100 : 0;

    // 3. Alertes ratio (resolved / total)
    const totalAlertes = alertes.length;
    const alertesResolues = alertes.filter((a) => a.statut !== "EN COURS").length;
    const alertesRatio = totalAlertes > 0 ? (alertesResolues / totalAlertes) * 100 : 100;

    // 4. Formation recency
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

    // 5. Score moyen (inverted: lower = better)
    const avgScore =
      totalClients > 0
        ? clients.reduce((sum, c) => sum + (c.scoreGlobal || 0), 0) / totalClients
        : 0;
    const scoreInverted = Math.max(0, 100 - avgScore);

    return { tauxConformite, tauxKYC, alertesRatio, formationPct, formationLabel, scoreInverted, avgScore };
  }, [clients, alertes, controles, derniereFormation]);

  // --- Auto-generated recommendations based on weak indicators ---
  const autoRecommandations = useMemo(() => {
    const recs: string[] = [];
    if (indicators.tauxConformite < 80) {
      recs.push(
        `Taux de conformite a ${Math.round(indicators.tauxConformite)}% — renforcer les controles qualite et planifier des revues periodiques.`
      );
    }
    if (indicators.tauxKYC < 80) {
      recs.push(
        `Completude KYC insuffisante (${Math.round(indicators.tauxKYC)}%) — verifier les pieces d'identite et beneficiaires effectifs manquants.`
      );
    }
    if (indicators.alertesRatio < 80) {
      recs.push(
        `${Math.round(100 - indicators.alertesRatio)}% des alertes sont encore en cours — prioriser le traitement des declarations de soupcon.`
      );
    }
    if (indicators.formationPct < 80) {
      recs.push(
        `Formation LCB-FT obsolete (${indicators.formationLabel}) — programmer une session de mise a jour pour l'equipe.`
      );
    }
    if (indicators.scoreInverted < 50) {
      recs.push(
        `Score de risque moyen eleve (${Math.round(indicators.avgScore)}/100) — revoir la classification des clients a risque.`
      );
    }
    return recs;
  }, [indicators]);

  const categories = [...new Set(report.items.map((i) => i.categorie))];
  const critiques = report.items.filter((i) => i.statut === "CRITIQUE").length;
  const alerteCount = report.items.filter((i) => i.statut === "ALERTE").length;
  const okCount = report.items.filter((i) => i.statut === "OK").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto" role="main" aria-label="Diagnostic 360 Tracfin">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            Diagnostic 360° Tracfin
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Analyse complete du dispositif LCB-FT — {report.dateGeneration}
          </p>
        </div>
        <Button
          onClick={() => { try { generateDiagnosticPdf(report); toast.success("PDF diagnostic genere"); } catch (err) { toast.error("Erreur lors de la generation du PDF"); } }}
          variant="outline"
          className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
          aria-label="Exporter le diagnostic en PDF"
        >
          <FileDown className="w-4 h-4" />
          Exporter le diagnostic en PDF
        </Button>
      </div>

      {/* Score Banner */}
      <div className="glass-card overflow-hidden" role="region" aria-label="Score global du dispositif">
        <div className={`bg-gradient-to-r ${NOTE_COLORS[report.noteLettre] || NOTE_COLORS.D} p-6`}>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <span className="text-4xl font-black text-white">{report.noteLettre}</span>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-white">
                Score du dispositif : {report.scoreGlobalDispositif}/100
              </p>
              <p className="text-sm text-white/80 mt-1">{report.synthese}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{okCount}</p>
              <p className="text-xs text-slate-400">Conformes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{alerteCount}</p>
              <p className="text-xs text-slate-400">Alertes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{critiques}</p>
              <p className="text-xs text-slate-400">Critiques</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-200">{report.items.length} indicateurs analyses</p>
              <p className="text-xs text-slate-500">sur l'ensemble du dispositif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex" role="progressbar" aria-label={`Repartition : ${okCount} conformes, ${alerteCount} alertes, ${critiques} critiques`} aria-valuenow={report.scoreGlobalDispositif} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-emerald-500 transition-all" style={{ width: `${report.items.length > 0 ? (okCount / report.items.length) * 100 : 0}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${report.items.length > 0 ? (alerteCount / report.items.length) * 100 : 0}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${report.items.length > 0 ? (critiques / report.items.length) * 100 : 0}%` }} />
      </div>

      {/* Circular Gauges */}
      <div className="glass-card p-6" role="region" aria-label="Indicateurs cles de conformite">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-200">Indicateurs cles</h2>
        </div>
        <div className="flex flex-wrap justify-around gap-6">
          <CircularGauge
            value={indicators.tauxConformite}
            label="Taux de conformite"
            sublabel={`${controles.length} controles`}
          />
          <CircularGauge
            value={indicators.tauxKYC}
            label="Completude KYC"
            sublabel={`${clients.length} clients`}
          />
          <CircularGauge
            value={indicators.alertesRatio}
            label="Alertes resolues"
            sublabel={`${alertes.length} alertes`}
          />
          <CircularGauge
            value={indicators.formationPct}
            label="Formation LCB-FT"
            sublabel={indicators.formationLabel}
          />
          <CircularGauge
            value={indicators.scoreInverted}
            label="Score risque moyen"
            sublabel={`${Math.round(indicators.avgScore)}/100`}
          />
        </div>
      </div>

      {/* Detail by Category */}
      {categories.map((cat) => (
        <div key={cat} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">{cat}</h3>
          <div className="space-y-2">
            {report.items
              .filter((i) => i.categorie === cat)
              .map((item, idx) => (
                <DiagnosticItemCard key={idx} item={item} />
              ))}
          </div>
        </div>
      ))}

      {/* Recommandations (auto-generated from weak indicators) */}
      {autoRecommandations.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-amber-500/20">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Recommandations
          </h3>
          <div className="space-y-2">
            {autoRecommandations.map((rec, i) => (
              <div key={`auto-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <span className="font-bold text-amber-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Actions from diagnostic engine */}
      {report.recommandationsPrioritaires.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4" />
            Actions correctives prioritaires
          </h3>
          <div className="space-y-2">
            {report.recommandationsPrioritaires.map((rec, i) => (
              <div key={`prio-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <span className="font-bold text-red-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
