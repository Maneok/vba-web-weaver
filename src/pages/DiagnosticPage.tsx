import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { runDiagnostic360, type DiagnosticReport, type DiagnosticItem } from "@/lib/diagnosticEngine";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const STATUS_CONFIG = {
  OK: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-800" },
  ALERTE: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800" },
  CRITIQUE: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800" },
};

const NOTE_COLORS: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-yellow-500",
  C: "bg-orange-500",
  D: "bg-red-500",
};

function DiagnosticItemCard({ item }: { item: DiagnosticItem }) {
  const config = STATUS_CONFIG[item.statut];
  const Icon = config.icon;
  return (
    <div className={`p-3 rounded-lg border ${config.border} ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{item.indicateur}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
              {item.statut}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
          {item.recommandation !== "Aucune action requise." && (
            <p className="text-xs mt-1.5 text-orange-700 dark:text-orange-400 font-medium">
              → {item.recommandation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticPage() {
  const { clients, collaborateurs, alertes, logs } = useAppState();

  const report = useMemo<DiagnosticReport>(
    () => runDiagnostic360(clients, collaborateurs, alertes, logs),
    [clients, collaborateurs, alertes, logs]
  );

  const categories = [...new Set(report.items.map(i => i.categorie))];
  const critiques = report.items.filter(i => i.statut === "CRITIQUE").length;
  const alerteCount = report.items.filter(i => i.statut === "ALERTE").length;
  const okCount = report.items.filter(i => i.statut === "OK").length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🛡 Diagnostic 360° Tracfin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse complete du dispositif LCB-FT — {report.dateGeneration}
          </p>
        </div>
        <Button onClick={() => generateDiagnosticPdf(report)} variant="outline" className="gap-2">
          <FileDown className="w-4 h-4" />
          Telecharger PDF
        </Button>
      </div>

      {/* Score Banner */}
      <Card className="overflow-hidden">
        <div className={`${NOTE_COLORS[report.noteLettre]} p-6 text-white`}>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-4xl font-black">{report.noteLettre}</span>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold">Score du dispositif : {report.scoreGlobalDispositif}/100</p>
              <p className="text-sm opacity-90 mt-1">{report.synthese}</p>
            </div>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{okCount}</p>
              <p className="text-xs text-muted-foreground">Conformes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{alerteCount}</p>
              <p className="text-xs text-muted-foreground">Alertes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{critiques}</p>
              <p className="text-xs text-muted-foreground">Critiques</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium">{report.items.length} indicateurs analyses</p>
              <p className="text-xs text-muted-foreground">sur l'ensemble du dispositif</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
        <div className="bg-green-500 transition-all" style={{ width: `${(okCount / report.items.length) * 100}%` }} />
        <div className="bg-orange-400 transition-all" style={{ width: `${(alerteCount / report.items.length) * 100}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${(critiques / report.items.length) * 100}%` }} />
      </div>

      {/* Detail by Category */}
      {categories.map(cat => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.items.filter(i => i.categorie === cat).map((item, idx) => (
              <DiagnosticItemCard key={idx} item={item} />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Priority Actions */}
      {report.recommandationsPrioritaires.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Actions correctives prioritaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.recommandationsPrioritaires.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded bg-red-50 dark:bg-red-950/20">
                  <span className="font-bold text-red-600 text-sm">{i + 1}.</span>
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
