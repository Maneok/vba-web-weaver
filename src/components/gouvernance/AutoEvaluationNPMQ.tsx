import { useState, useMemo, useEffect, useCallback } from "react";
import { autoEvalService, type AutoEvaluationRecord } from "@/lib/gouvernanceService";
import { logsService } from "@/lib/supabaseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, CheckCircle2, AlertTriangle, BarChart3, Save, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface Question {
  id: string;
  categorie: string;
  question: string;
  reponse: "OUI" | "NON" | "PARTIEL" | "NA" | "";
}

export const QUESTIONS_NPMQ: Omit<Question, "reponse">[] = [
  { id: "q1", categorie: "Organisation", question: "Un referent LCB-FT est-il formellement designe ?" },
  { id: "q2", categorie: "Organisation", question: "L'organigramme du dispositif est-il a jour ?" },
  { id: "q3", categorie: "Formation", question: "Tous les collaborateurs ont-ils suivi une formation LCB-FT de moins de 12 mois ?" },
  { id: "q4", categorie: "Formation", question: "Les attestations de formation sont-elles conservees ?" },
  { id: "q5", categorie: "Procedures", question: "Le manuel de procedures LCB-FT est-il valide et diffuse ?" },
  { id: "q6", categorie: "Procedures", question: "La procedure de declaration de soupcon est-elle documentee ?" },
  { id: "q7", categorie: "KYC", question: "Les pieces d'identite des clients sont-elles systematiquement verifiees ?" },
  { id: "q8", categorie: "KYC", question: "Les beneficiaires effectifs sont-ils identifies pour toutes les entites ?" },
  { id: "q9", categorie: "Risques", question: "La classification des risques est-elle appliquee a tous les clients ?" },
  { id: "q10", categorie: "Risques", question: "Les revues periodiques sont-elles effectuees dans les delais ?" },
  { id: "q11", categorie: "Controle", question: "Des controles internes sont-ils realises au moins une fois par an ?" },
  { id: "q12", categorie: "Controle", question: "Les non-conformites detectees font-elles l'objet d'actions correctives ?" },
  { id: "q13", categorie: "TRACFIN", question: "Le registre des declarations de soupcon est-il tenu a jour ?" },
  { id: "q14", categorie: "TRACFIN", question: "Les abstentions sont-elles documentees et justifiees ?" },
  { id: "q15", categorie: "Conservation", question: "Les documents sont-ils conserves pendant au moins 5 ans ?" },
];

export function computeScore(questions: Question[]): {
  answered: number;
  oui: number;
  non: number;
  partiel: number;
  total: number;
  score: number;
  catStats: Array<{ categorie: string; total: number; oui: number; partiel: number; pct: number }>;
} {
  const answered = questions.filter(q => q.reponse !== "").length;
  const oui = questions.filter(q => q.reponse === "OUI").length;
  const non = questions.filter(q => q.reponse === "NON").length;
  const partiel = questions.filter(q => q.reponse === "PARTIEL").length;
  const total = questions.length;
  // PARTIEL counts as 0.5, NA is excluded from denominator
  const na = questions.filter(q => q.reponse === "NA").length;
  const effectiveTotal = total - na;
  const effectiveScore = oui + (partiel * 0.5);
  const score = effectiveTotal > 0 ? Math.round((effectiveScore / effectiveTotal) * 100) : 0;

  const categories = [...new Set(questions.map(q => q.categorie))];
  const catStats = categories.map(cat => {
    const catQs = questions.filter(q => q.categorie === cat);
    const catOui = catQs.filter(q => q.reponse === "OUI").length;
    const catPartiel = catQs.filter(q => q.reponse === "PARTIEL").length;
    const catNa = catQs.filter(q => q.reponse === "NA").length;
    const catEffective = catQs.length - catNa;
    const catScore = catEffective > 0 ? Math.round(((catOui + catPartiel * 0.5) / catEffective) * 100) : 0;
    return { categorie: cat, total: catQs.length, oui: catOui, partiel: catPartiel, pct: catScore };
  });

  return { answered, oui, non, partiel, total, score, catStats };
}

export default function AutoEvaluationNPMQ() {
  const [questions, setQuestions] = useState<Question[]>(
    QUESTIONS_NPMQ.map(q => ({ ...q, reponse: "" }))
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AutoEvaluationRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const records = await autoEvalService.getAll();
      setHistory(records);
      // Load most recent evaluation's answers
      if (records.length > 0) {
        const latest = records[0];
        if (latest.reponses) {
          setQuestions(prev =>
            prev.map(q => ({
              ...q,
              reponse: (latest.reponses[q.id] as Question["reponse"]) || "",
            }))
          );
        }
      }
    } catch (err) {
      logger.error("AutoEvaluation", "loadData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReponse = (id: string, reponse: Question["reponse"]) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, reponse } : q));
  };

  const stats = useMemo(() => computeScore(questions), [questions]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const reponses: Record<string, string> = {};
      for (const q of questions) {
        if (q.reponse) reponses[q.id] = q.reponse;
      }
      const record: Omit<AutoEvaluationRecord, "id"> & { id?: string } = {
        date: new Date().toISOString().split("T")[0],
        reponses,
        score: stats.score,
      };
      const created = await autoEvalService.create(record);
      if (created) {
        setHistory(prev => [created, ...prev]);
        toast.success("Auto-evaluation sauvegardee");
        logsService.add("SAVE_AUTOEVALUATION", `Score: ${stats.score}%`, undefined, "auto_evaluations").catch(() => {});
      }
    } catch (err) {
      logger.error("AutoEvaluation", "handleSave error:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [questions, stats.score]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Score global */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold">Score de conformite</h3>
                <p className="text-xs text-slate-500">{stats.answered}/{stats.total} questions repondues</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${
                stats.score >= 80 ? "text-emerald-400" :
                stats.score >= 50 ? "text-amber-400" : "text-red-400"
              }`}>
                {stats.score}%
              </span>
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Sauvegarder
                </Button>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setShowHistory(!showHistory)}>
                    <History className="w-3 h-3" />
                    Historique ({history.length})
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Progress value={stats.score} className="h-3" />
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-500">Conforme : {stats.oui}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-500">Partiel : {stats.partiel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-slate-500">Non conforme : {stats.non}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      {showHistory && history.length > 0 && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              Historique des evaluations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-sm">{new Date(h.date).toLocaleDateString("fr-FR")}</span>
                  <Badge className={`text-xs ${
                    h.score >= 80 ? "bg-emerald-500/15 text-emerald-400" :
                    h.score >= 50 ? "bg-amber-500/15 text-amber-400" :
                    "bg-red-500/15 text-red-400"
                  }`}>
                    {h.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.catStats.map(cat => (
          <Card key={cat.categorie} className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${
                cat.pct >= 80 ? "text-emerald-400" :
                cat.pct >= 50 ? "text-amber-400" : "text-red-400"
              }`}>
                {cat.pct}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{cat.categorie}</p>
              <p className="text-[10px] text-slate-600">{cat.oui}/{cat.total}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Questions */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
            Questionnaire d'auto-evaluation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {questions.map((q, i) => {
              const showCatHeader = i === 0 || q.categorie !== questions[i - 1].categorie;
              return (
                <div key={q.id}>
                  {showCatHeader && (
                    <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                      <div className="h-px flex-1 bg-slate-800" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{q.categorie}</span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-md bg-white/[0.02] border border-white/[0.04] gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {q.reponse === "OUI" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : q.reponse === "NON" ? (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                      )}
                      <span className="text-sm">{q.question}</span>
                    </div>
                    <Select value={q.reponse || "empty"} onValueChange={v => handleReponse(q.id, v === "empty" ? "" : v as Question["reponse"])}>
                      <SelectTrigger className="w-[120px] shrink-0">
                        {q.reponse ? (
                          <Badge className={`text-xs ${
                            q.reponse === "OUI" ? "bg-emerald-500/15 text-emerald-400" :
                            q.reponse === "NON" ? "bg-red-500/15 text-red-400" :
                            q.reponse === "PARTIEL" ? "bg-amber-500/15 text-amber-400" :
                            "bg-slate-500/15 text-slate-400"
                          }`}>{q.reponse}</Badge>
                        ) : (
                          <SelectValue placeholder="---" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">---</SelectItem>
                        <SelectItem value="OUI">Oui</SelectItem>
                        <SelectItem value="NON">Non</SelectItem>
                        <SelectItem value="PARTIEL">Partiel</SelectItem>
                        <SelectItem value="NA">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
