import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getRevues,
  getRevueStats,
  generatePendingRevues,
  updateRevue,
  completeRevue,
  REVUE_TYPE_LABELS,
  type RevueMaintien,
  type RevueStats,
  type RevueFilters,
} from "@/lib/revueMaintien";
import {
  calculateRiskScore, calculateNextReviewDate, calculateReviewDueDate,
  isReviewDue, daysUntilReview, VIGILANCE_THRESHOLDS,
} from "@/lib/riskEngine";
import { useScoringData } from "@/hooks/useScoringData";
import {
  searchEnterprise, checkSanctions, checkBodacc, verifyGooglePlaces,
  checkNews, fetchDocuments, fetchInpiDocuments,
  createInitialScreening, type ScreeningState, type EnterpriseResult,
} from "@/lib/kycService";
import ScreeningPanel from "@/components/ScreeningPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw, Search, ClipboardCheck, AlertTriangle, Clock, ShieldAlert,
  CalendarClock, Loader2, CheckCircle2, Download, Eye, ChevronLeft,
  ChevronRight, Building2, Shield, ArrowRight, XCircle, FileDown, Save,
} from "lucide-react";
import { toast } from "sonner";
import type { MissionType, VigilanceLevel } from "@/lib/types";
import { MISSIONS } from "@/lib/constants";

// ─── Constants ─────────────────────────────────────────────────────
const REVUE_STEPS = ["Selection", "Informations", "Screening", "Questionnaire", "Decision"];

const STATUS_PILLS = [
  { value: "tous", label: "Toutes" },
  { value: "a_faire", label: "A faire" },
  { value: "en_cours", label: "En cours" },
  { value: "completee", label: "Completees" },
  { value: "reportee", label: "Reportees" },
];

const STATUS_LABELS: Record<string, string> = {
  a_faire: "A faire", en_cours: "En cours", completee: "Completee", reportee: "Reportee",
};

const QUESTIONS_LCB = [
  { id: "ppe", question: "Le client ou son representant est-il une PPE ?", reference: "Art. L.561-10 II CMF", malus: 100 },
  { id: "paysRisque", question: "Le client est-il lie a un pays a risque (GAFI / UE) ?", reference: "Art. L.561-10 I 4° CMF", malus: 100 },
  { id: "atypique", question: "Le montage juridique est-il atypique ou complexe ?", reference: "Art. L.561-10-2 CMF", malus: 100 },
  { id: "distanciel", question: "La relation est-elle integralement a distance ?", reference: "Art. R.561-5-2 CMF", malus: 40 },
  { id: "cash", question: "L'activite implique-t-elle la manipulation d'especes significatives ?", reference: "Art. L.561-15 CMF", malus: 30 },
  { id: "pression", question: "Le client exerce-t-il une pression ou urgence inhabituelle ?", reference: "Art. L.561-10-2 3° CMF", malus: 50 },
];

interface ClientRow {
  id: string;
  ref: string;
  raison_sociale: string;
  siren: string;
  forme: string;
  ape: string;
  mission: string;
  effectif: string;
  adresse: string;
  cp: string;
  ville: string;
  capital: number;
  dirigeant: string;
  tel: string;
  mail: string;
  date_creation: string;
  date_reprise: string;
  score_global: number;
  niv_vigilance: string;
  date_butoir: string;
  date_derniere_revue: string;
  ppe: string;
  pays_risque: string;
  atypique: string;
  distanciel: string;
  cash: string;
  pression: string;
  be: string;
  statut: string;
}

interface QuestionState {
  id: string;
  question: string;
  reference: string;
  malus: number;
  value: "OUI" | "NON";
}

// ─── Helper components ─────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "bg-red-500/15 text-red-400 border-red-500/30"
    : score >= 30 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  return <Badge variant="outline" className={color}>{score}</Badge>;
}

function VigilBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    SIMPLIFIEE: "bg-emerald-500/15 text-emerald-400",
    STANDARD: "bg-amber-500/15 text-amber-400",
    RENFORCEE: "bg-red-500/15 text-red-400",
  };
  return <Badge variant="outline" className={styles[level] || "bg-slate-500/15 text-slate-400"}>{level || "—"}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    a_faire: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    en_cours: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    completee: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    reportee: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  return <Badge variant="outline" className={styles[status] || ""}>{STATUS_LABELS[status] || status}</Badge>;
}

function EcheanceBadge({ date, status }: { date: string; status: string }) {
  if (status === "completee") return <span className="text-sm text-muted-foreground">{date}</span>;
  const today = new Date().toISOString().split("T")[0];
  const diff = (new Date(date).getTime() - new Date(today).getTime()) / 86400000;
  const color = diff < 0 ? "text-red-400 font-semibold" : diff < 7 ? "text-amber-400 font-medium" : "text-muted-foreground";
  return <span className={`text-sm ${color}`}>{date}{diff < 0 ? " (en retard)" : ""}</span>;
}

function KpiCard({ label, value, icon: Icon, color, bgColor }: {
  label: string; value: number; icon: typeof ClipboardCheck; color: string; bgColor: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}

// OPT-11: Review type label by vigilance
const REVIEW_TYPE_LABEL: Record<string, string> = {
  SIMPLIFIEE: "Bisannuelle (2 ans)",
  STANDARD: "Annuelle (1 an)",
  RENFORCEE: "Semestrielle (6 mois)",
};

const DRAFT_KEY = "draft_revue_maintien";

const PAGE_SIZE = 20;

// ─── Main Component ────────────────────────────────────────────────

export default function RevueMaintienPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const cabinetId = profile?.cabinet_id;
  const { scoringData } = useScoringData();

  // ─── Mode: "list" or "wizard" ────────────────────────────────────
  const [mode, setMode] = useState<"list" | "wizard">("list");
  const [wizardStep, setWizardStep] = useState(0);

  // ─── List state ──────────────────────────────────────────────────
  const [revues, setRevues] = useState<RevueMaintien[]>([]);
  const [stats, setStats] = useState<RevueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterStatus, setFilterStatus] = useState("tous");
  const [filterType, setFilterType] = useState("tous");
  const [filterRisk, setFilterRisk] = useState("tous");
  const [search, setSearch] = useState("");

  // Reporter dialog
  const [reporterRevueItem, setReporterRevueItem] = useState<RevueMaintien | null>(null);
  const [reporterDate, setReporterDate] = useState("");
  const [reporterMotif, setReporterMotif] = useState("");
  const [reporterLoading, setReporterLoading] = useState(false);

  // ─── Wizard state ────────────────────────────────────────────────
  const [selectedRevue, setSelectedRevue] = useState<RevueMaintien | null>(null);
  const [clientData, setClientData] = useState<ClientRow | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // Step 2: form edits
  const [editForm, setEditForm] = useState({
    adresse: "", cp: "", ville: "", dirigeant: "", effectif: "",
    capital: 0, tel: "", mail: "", mission: "TENUE COMPTABLE" as string,
  });
  const [apiRefreshLoading, setApiRefreshLoading] = useState(false);
  const [changesDetected, setChangesDetected] = useState<string[]>([]);

  // Step 3: screening
  const [screening, setScreening] = useState<ScreeningState>(() => createInitialScreening());
  const [screeningLaunched, setScreeningLaunched] = useState(false);
  const [beChecked, setBeChecked] = useState(false);
  const [docsChecked, setDocsChecked] = useState(false);

  // Step 4: questionnaire
  const [questions, setQuestions] = useState<QuestionState[]>(
    QUESTIONS_LCB.map(q => ({ ...q, value: "NON" as const }))
  );

  // Step 5: decision
  const [decision, setDecision] = useState<"maintien" | "vigilance_renforcee" | "fin_relation">("maintien");
  const [observations, setObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Computed scores ─────────────────────────────────────────────
  const scoreBefore = clientData?.score_global ?? 0;
  const vigilanceBefore = (clientData?.niv_vigilance ?? "STANDARD") as VigilanceLevel;

  const riskFlags = useMemo(() => ({
    ppe: questions.find(q => q.id === "ppe")?.value === "OUI",
    paysRisque: questions.find(q => q.id === "paysRisque")?.value === "OUI",
    atypique: questions.find(q => q.id === "atypique")?.value === "OUI",
    distanciel: questions.find(q => q.id === "distanciel")?.value === "OUI",
    cash: questions.find(q => q.id === "cash")?.value === "OUI",
    pression: questions.find(q => q.id === "pression")?.value === "OUI",
  }), [questions]);

  const scoreAfter = useMemo(() => {
    if (!clientData) return { scoreGlobal: 0, nivVigilance: "STANDARD" as VigilanceLevel, scoreActivite: 0, scorePays: 0, scoreMission: 0, scoreMaturite: 0, scoreStructure: 0, malus: 0 };
    return calculateRiskScore({
      ape: clientData.ape || "",
      paysRisque: riskFlags.paysRisque,
      mission: (editForm.mission || clientData.mission || "TENUE COMPTABLE") as string,
      dateCreation: clientData.date_creation || "2020-01-01",
      dateReprise: clientData.date_reprise || clientData.date_creation || "2020-01-01",
      effectif: editForm.effectif || clientData.effectif || "",
      forme: clientData.forme || "SARL",
      ...riskFlags,
    }, scoringData ?? undefined);
  }, [clientData, editForm.mission, editForm.effectif, riskFlags, scoringData]);

  const delta = scoreAfter.scoreGlobal - scoreBefore;

  // ─── List data loading ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!cabinetId) return;
    setLoading(true);
    try {
      const filters: RevueFilters = { status: filterStatus, type: filterType, riskLevel: filterRisk, search };
      const [revuesData, statsData] = await Promise.all([
        getRevues(cabinetId, filters),
        getRevueStats(cabinetId),
      ]);
      setRevues(revuesData);
      setStats(statsData);
      setVisibleCount(PAGE_SIZE);
    } catch (err: any) {
      toast.error("Erreur de chargement : " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [cabinetId, filterStatus, filterType, filterRisk, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Wizard: load client data ────────────────────────────────────
  const loadClientData = useCallback(async (revue: RevueMaintien) => {
    setClientLoading(true);
    try {
      const { data: client, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", revue.client_id)
        .single();
      if (error) throw error;

      const c = client as ClientRow;
      setClientData(c);
      setEditForm({
        adresse: c.adresse || "", cp: c.cp || "", ville: c.ville || "",
        dirigeant: c.dirigeant || "", effectif: c.effectif || "",
        capital: c.capital || 0, tel: c.tel || "", mail: c.mail || "",
        mission: c.mission || "TENUE COMPTABLE",
      });
      // Pre-fill questionnaire from existing flags
      setQuestions(prev => prev.map(q => {
        const flagMap: Record<string, string> = {
          ppe: c.ppe, paysRisque: c.pays_risque, atypique: c.atypique,
          distanciel: c.distanciel, cash: c.cash, pression: c.pression,
        };
        const val = flagMap[q.id];
        return val === "OUI" ? { ...q, value: "OUI" as const } : { ...q, value: "NON" as const };
      }));
      setChangesDetected([]);
      setScreening(createInitialScreening());
      setScreeningLaunched(false);
      setBeChecked(false);
      setDocsChecked(false);
      setDecision("maintien");
      setObservations("");
    } catch (err: any) {
      toast.error("Erreur chargement client : " + (err.message || err));
    } finally {
      setClientLoading(false);
    }
  }, []);

  const openWizard = useCallback((revue: RevueMaintien) => {
    setSelectedRevue(revue);
    setWizardStep(0);
    setMode("wizard");
    loadClientData(revue);
  }, [loadClientData]);

  // ─── Step 2: API refresh ─────────────────────────────────────────
  const handleApiRefresh = async () => {
    if (!clientData?.siren) return;
    setApiRefreshLoading(true);
    try {
      const { results } = await searchEnterprise("siren", clientData.siren);
      if (results.length > 0) {
        const r = results[0];
        const changes: string[] = [];
        if (r.adresse && r.adresse !== clientData.adresse) changes.push("Adresse");
        if (r.dirigeant && r.dirigeant !== clientData.dirigeant) changes.push("Dirigeant");
        if (r.effectif && r.effectif !== clientData.effectif) changes.push("Effectif");
        if (r.capital && r.capital !== clientData.capital) changes.push("Capital");
        setChangesDetected(changes);
        if (changes.length > 0) {
          setEditForm(prev => ({
            ...prev,
            adresse: r.adresse || prev.adresse,
            cp: r.code_postal || prev.cp,
            ville: r.ville || prev.ville,
            dirigeant: r.dirigeant || prev.dirigeant,
            effectif: r.effectif || prev.effectif,
            capital: r.capital || prev.capital,
            tel: r.telephone || prev.tel,
            mail: r.email || prev.mail,
          }));
          toast.success(`${changes.length} changement(s) detecte(s)`);
        } else {
          toast.info("Aucun changement detecte");
        }
      }
    } catch {
      toast.error("Erreur lors de la recherche API");
    } finally {
      setApiRefreshLoading(false);
    }
  };

  // ─── Step 3: Launch screening ────────────────────────────────────
  const launchScreening = async () => {
    if (!clientData?.siren) return;
    setScreeningLaunched(true);
    const siren = clientData.siren.replace(/\s/g, "");
    const raison = clientData.raison_sociale;
    const dirigeant = editForm.dirigeant || clientData.dirigeant;

    // Enterprise
    setScreening(prev => ({ ...prev, enterprise: { ...prev.enterprise, loading: true } }));
    searchEnterprise("siren", siren).then(r => {
      setScreening(prev => ({
        ...prev,
        enterprise: { loading: false, data: r.results, error: r.error || null },
      }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, enterprise: { loading: false, data: null, error: e.message } }));
    });

    // Sanctions
    setScreening(prev => ({ ...prev, sanctions: { ...prev.sanctions, loading: true } }));
    checkSanctions(
      [{ nom: dirigeant }],
      siren
    ).then(r => {
      setScreening(prev => ({ ...prev, sanctions: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, sanctions: { loading: false, data: null, error: e.message } }));
    });

    // BODACC
    setScreening(prev => ({ ...prev, bodacc: { ...prev.bodacc, loading: true } }));
    checkBodacc(siren, raison).then(r => {
      setScreening(prev => ({ ...prev, bodacc: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, bodacc: { loading: false, data: null, error: e.message } }));
    });

    // Google Places
    setScreening(prev => ({ ...prev, google: { ...prev.google, loading: true } }));
    verifyGooglePlaces(raison, clientData.ville).then(r => {
      setScreening(prev => ({ ...prev, google: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, google: { loading: false, data: null, error: e.message } }));
    });

    // News
    setScreening(prev => ({ ...prev, news: { ...prev.news, loading: true } }));
    checkNews(raison, dirigeant).then(r => {
      setScreening(prev => ({ ...prev, news: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, news: { loading: false, data: null, error: e.message } }));
    });

    // Documents
    setScreening(prev => ({ ...prev, documents: { ...prev.documents, loading: true } }));
    fetchDocuments(siren, raison).then(r => {
      setScreening(prev => ({ ...prev, documents: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, documents: { loading: false, data: null, error: e.message } }));
    });

    // INPI
    setScreening(prev => ({ ...prev, inpi: { ...prev.inpi, loading: true } }));
    fetchInpiDocuments(siren, true).then(r => {
      setScreening(prev => ({ ...prev, inpi: { loading: false, data: r, error: null } }));
    }).catch(e => {
      setScreening(prev => ({ ...prev, inpi: { loading: false, data: null, error: e.message } }));
    });
  };

  // ─── Step 5: Submit decision ─────────────────────────────────────
  const handleValidateRevue = async () => {
    if (!selectedRevue || !clientData || !profile) return;
    if ((decision === "vigilance_renforcee" || decision === "fin_relation") && !observations.trim()) {
      toast.error("Les observations sont obligatoires pour cette decision");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Complete revue via service
      await completeRevue(selectedRevue.id, {
        score_apres: scoreAfter.scoreGlobal,
        vigilance_apres: scoreAfter.nivVigilance,
        maintien: decision !== "fin_relation",
        observations,
        decision,
        decision_motif: decision !== "maintien" ? observations : undefined,
        kyc_verifie: true,
        be_verifie: beChecked,
        documents_a_jour: docsChecked,
      });

      // 2. Update client with new scores + edited fields
      const today = new Date().toISOString().split("T")[0];
      const newButoir = calculateNextReviewDate(
        decision === "vigilance_renforcee" ? "RENFORCEE" : scoreAfter.nivVigilance,
        today
      );

      const clientUpdates: Record<string, unknown> = {
        score_activite: scoreAfter.scoreActivite,
        score_pays: scoreAfter.scorePays,
        score_mission: scoreAfter.scoreMission,
        score_maturite: scoreAfter.scoreMaturite,
        score_structure: scoreAfter.scoreStructure,
        malus: scoreAfter.malus,
        score_global: scoreAfter.scoreGlobal,
        niv_vigilance: scoreAfter.nivVigilance,
        date_derniere_revue: today,
        date_butoir: newButoir,
        etat_pilotage: "A JOUR",
        // Edited fields
        adresse: editForm.adresse || clientData.adresse,
        cp: editForm.cp || clientData.cp,
        ville: editForm.ville || clientData.ville,
        dirigeant: editForm.dirigeant || clientData.dirigeant,
        effectif: editForm.effectif || clientData.effectif,
        capital: editForm.capital || clientData.capital,
        tel: editForm.tel || clientData.tel,
        mail: editForm.mail || clientData.mail,
        mission: editForm.mission || clientData.mission,
        // Questionnaire flags
        ppe: riskFlags.ppe ? "OUI" : "NON",
        pays_risque: riskFlags.paysRisque ? "OUI" : "NON",
        atypique: riskFlags.atypique ? "OUI" : "NON",
        distanciel: riskFlags.distanciel ? "OUI" : "NON",
        cash: riskFlags.cash ? "OUI" : "NON",
        pression: riskFlags.pression ? "OUI" : "NON",
        updated_at: new Date().toISOString(),
      };

      if (decision === "fin_relation") {
        clientUpdates.statut = "INACTIF";
        clientUpdates.etat = "ARCHIVE";
      }

      await supabase.from("clients").update(clientUpdates).eq("id", clientData.id);

      // 3. Client history
      await supabase.from("client_history").insert({
        cabinet_id: profile.cabinet_id,
        client_ref: clientData.ref,
        event_type: "REVUE_MAINTIEN",
        description: `Revue de maintien — Score ${scoreBefore} → ${scoreAfter.scoreGlobal} — Decision: ${decision}`,
        metadata: { scoreBefore, scoreAfter: scoreAfter.scoreGlobal, vigilanceBefore, vigilanceAfter: scoreAfter.nivVigilance, decision, observations },
        user_email: profile.email,
      }).then(() => {}).catch(() => {});

      // 4. Audit trail
      await supabase.from("audit_trail").insert({
        cabinet_id: profile.cabinet_id,
        user_id: profile.id,
        user_email: profile.email,
        action: "REVUE_MAINTIEN",
        table_name: "revue_maintien",
        record_id: clientData.ref,
        new_data: { decision, scoreAfter: scoreAfter.scoreGlobal, vigilanceAfter: scoreAfter.nivVigilance },
      }).then(() => {}).catch(() => {});

      toast.success("Revue de maintien validee");
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      setMode("list");
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── List helpers ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!cabinetId) return;
    setGenerating(true);
    try {
      const count = await generatePendingRevues(cabinetId);
      toast.success(`${count} revue(s) generee(s)`);
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  const handleReporter = async () => {
    if (!reporterRevueItem || !reporterDate) return;
    setReporterLoading(true);
    try {
      await updateRevue(reporterRevueItem.id, {
        status: "reportee",
        date_echeance: reporterDate,
        observations: reporterMotif ? `[Report] ${reporterMotif}` : reporterRevueItem.observations,
      });
      toast.success("Revue reportee");
      setReporterRevueItem(null);
      setReporterDate("");
      setReporterMotif("");
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setReporterLoading(false);
    }
  };

  const sortedRevues = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return [...revues].sort((a, b) => {
      const aRetard = a.status === "a_faire" && a.date_echeance < today ? 1 : 0;
      const bRetard = b.status === "a_faire" && b.date_echeance < today ? 1 : 0;
      if (bRetard !== aRetard) return bRetard - aRetard;
      const aScore = a.score_risque_avant ?? a.client_score ?? 0;
      const bScore = b.score_risque_avant ?? b.client_score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.date_echeance.localeCompare(b.date_echeance);
    });
  }, [revues]);

  const visibleRevues = useMemo(() => sortedRevues.slice(0, visibleCount), [sortedRevues, visibleCount]);
  const hasMore = visibleCount < sortedRevues.length;

  const handleExportCsv = () => {
    const headers = ["Client", "Ref", "Score", "Vigilance", "Type", "Echeance", "Statut"];
    const rows = sortedRevues.map(r => [
      r.client_nom || "—", r.client_ref || "—",
      String(r.score_risque_avant ?? r.client_score ?? 0),
      r.vigilance_avant || r.client_vigilance || "—",
      REVUE_TYPE_LABELS[r.type]?.label || r.type,
      r.date_echeance, STATUS_LABELS[r.status] || r.status,
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revues_maintien_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  };

  const getRowClassName = (revue: RevueMaintien) => {
    const today = new Date().toISOString().split("T")[0];
    const score = revue.score_risque_avant ?? revue.client_score ?? 0;
    if (revue.status === "completee") return "opacity-60";
    if (revue.status === "a_faire" && revue.date_echeance < today) return "border-l-2 border-l-red-500 bg-red-500/[0.03]";
    if (score >= 60) return "border-l-2 border-l-red-400";
    if (score >= 30) return "border-l-2 border-l-amber-400";
    return "";
  };

  // Scroll to top on wizard step change
  useEffect(() => {
    if (mode === "wizard") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep, mode]);

  // OPT-24: Auto-launch screening when entering step 3
  useEffect(() => {
    if (mode === "wizard" && wizardStep === 2 && clientData?.siren && !screeningLaunched) {
      launchScreening();
    }
  }, [mode, wizardStep, clientData?.siren, screeningLaunched]);

  // OPT-49: Draft auto-save to sessionStorage
  useEffect(() => {
    if (mode === "wizard" && clientData && selectedRevue) {
      const draft = {
        revueId: selectedRevue.id,
        wizardStep,
        editForm,
        questions: questions.map(q => ({ id: q.id, value: q.value })),
        decision,
        observations,
        beChecked,
        docsChecked,
      };
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
    }
  }, [mode, wizardStep, editForm, questions, decision, observations, beChecked, docsChecked, clientData, selectedRevue]);

  // Restore draft on wizard open
  useEffect(() => {
    if (mode === "wizard" && selectedRevue && clientData) {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.revueId === selectedRevue.id) {
            if (draft.wizardStep > 0) setWizardStep(draft.wizardStep);
            if (draft.editForm) setEditForm(prev => ({ ...prev, ...draft.editForm }));
            if (draft.questions) {
              setQuestions(prev => prev.map(q => {
                const saved = draft.questions.find((s: any) => s.id === q.id);
                return saved ? { ...q, value: saved.value } : q;
              }));
            }
            if (draft.decision) setDecision(draft.decision);
            if (draft.observations) setObservations(draft.observations);
            if (draft.beChecked) setBeChecked(draft.beChecked);
            if (draft.docsChecked) setDocsChecked(draft.docsChecked);
          }
        }
      } catch {}
    }
  }, [mode, selectedRevue?.id, clientData]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — WIZARD MODE
  // ═══════════════════════════════════════════════════════════════════
  if (mode === "wizard") {
    return (
      <div className="space-y-6 p-1">
        {/* OPT-50: Progress counter bar */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${((wizardStep + 1) / REVUE_STEPS.length) * 100}%` }}
            />
          </div>
          <span>Etape {wizardStep + 1}/{REVUE_STEPS.length}</span>
        </div>

        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); try { sessionStorage.removeItem(DRAFT_KEY); } catch {} }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Retour a la liste
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              Revue — {clientData?.raison_sociale || "Chargement..."}
            </h1>
            <p className="text-sm text-muted-foreground">
              {clientData?.ref} · SIREN {clientData?.siren}
              {selectedRevue && (
                <> · Type : {REVUE_TYPE_LABELS[selectedRevue.type]?.label || selectedRevue.type}</>
              )}
              {clientData?.niv_vigilance && (
                <> · {REVIEW_TYPE_LABEL[clientData.niv_vigilance] || "Annuelle"}</>
              )}
            </p>
          </div>
        </div>

        {/* Step navigation */}
        <div className="flex gap-1">
          {REVUE_STEPS.map((label, idx) => (
            <button
              key={idx}
              onClick={() => clientData && idx <= wizardStep && setWizardStep(idx)}
              className={`flex-1 text-center py-2 text-xs font-medium rounded-lg transition-colors ${
                idx === wizardStep
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                  : idx < wizardStep
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground border border-border"
              }`}
            >
              {idx < wizardStep && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
              {idx + 1}. {label}
            </button>
          ))}
        </div>

        {clientLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ─── STEP 1: Selection (summary) ────────────────── */}
            {wizardStep === 0 && clientData && (() => {
              const days = daysUntilReview(
                (clientData.niv_vigilance || "STANDARD") as VigilanceLevel,
                clientData.date_derniere_revue || "",
                clientData.date_creation || ""
              );
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Dossier selectionne</h2>
                      {/* OPT-4: Days remaining/overdue badge */}
                      {days <= 0 ? (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">{Math.abs(days)} jour(s) de retard</Badge>
                      ) : days <= 30 ? (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Dans {days} jour(s)</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Dans {days} jour(s)</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Raison sociale</span>
                        <p className="font-medium">{clientData.raison_sociale}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">SIREN</span>
                        <p className="font-medium font-mono">{clientData.siren}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Forme juridique</span>
                        <p className="font-medium">{clientData.forme}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Mission</span>
                        <p className="font-medium">{clientData.mission}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Score actuel</span>
                        <div className="mt-1 flex items-center gap-2">
                          <ScoreBadge score={scoreBefore} />
                          <span className="text-[10px] text-muted-foreground">/100</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Vigilance</span>
                        <div className="mt-1"><VigilBadge level={vigilanceBefore} /></div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Date butoir</span>
                        <p className="font-medium">{clientData.date_butoir || "—"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Derniere revue</span>
                        <p className="font-medium">{clientData.date_derniere_revue || "Jamais"}</p>
                      </div>
                    </div>
                    {/* OPT-11: Review type */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Periodicite de revue :</span>
                      <Badge variant="outline" className="text-xs">{REVIEW_TYPE_LABEL[clientData.niv_vigilance] || "Annuelle (1 an)"}</Badge>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── STEP 2: Informations ───────────────────────── */}
            {wizardStep === 1 && clientData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Verification des informations</h2>
                  <Button variant="outline" size="sm" onClick={handleApiRefresh} disabled={apiRefreshLoading}>
                    {apiRefreshLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Relancer la recherche API
                  </Button>
                </div>

                {changesDetected.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-amber-400">
                        {changesDetected.length} changement(s) detecte(s) : {changesDetected.join(", ")}
                      </span>
                    </div>
                    {/* OPT-18: Dirigeant change alert */}
                    {changesDetected.includes("Dirigeant") && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse">
                        <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="text-sm text-red-400 font-medium">
                          Changement de dirigeant detecte — verification accrue requise
                        </span>
                      </div>
                    )}
                    {/* OPT-19: Address change */}
                    {changesDetected.includes("Adresse") && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <Building2 className="h-4 w-4 text-orange-400 shrink-0" />
                        <span className="text-sm text-orange-400">Nouveau siege social detecte</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl border bg-card p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Adresse</Label>
                      <Input value={editForm.adresse} onChange={e => setEditForm(p => ({ ...p, adresse: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Code postal</Label>
                        <Input value={editForm.cp} onChange={e => setEditForm(p => ({ ...p, cp: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Ville</Label>
                        <Input value={editForm.ville} onChange={e => setEditForm(p => ({ ...p, ville: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Dirigeant principal</Label>
                      <Input value={editForm.dirigeant} onChange={e => setEditForm(p => ({ ...p, dirigeant: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Effectif</Label>
                      <Input value={editForm.effectif} onChange={e => setEditForm(p => ({ ...p, effectif: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Capital (EUR)</Label>
                      <Input type="number" value={editForm.capital} onChange={e => setEditForm(p => ({ ...p, capital: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mission</Label>
                      <Select value={editForm.mission} onValueChange={v => setEditForm(p => ({ ...p, mission: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MISSIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input value={editForm.tel} onChange={e => setEditForm(p => ({ ...p, tel: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={editForm.mail} onChange={e => setEditForm(p => ({ ...p, mail: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 3: Screening ──────────────────────────── */}
            {wizardStep === 2 && clientData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Verification BE & Screening</h2>
                  <Button onClick={launchScreening} disabled={screeningLaunched} variant={screeningLaunched ? "outline" : "default"}>
                    {screeningLaunched ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> : <Shield className="h-4 w-4 mr-2" />}
                    {screeningLaunched ? "Screening lance" : "Lancer le screening"}
                  </Button>
                </div>

                {/* BE section */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <h3 className="font-medium text-sm">Beneficiaires effectifs</h3>
                  {clientData.be ? (
                    <p className="text-sm">{clientData.be}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun BE renseigne</p>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border/50">
                    <Checkbox checked={beChecked} onCheckedChange={v => setBeChecked(!!v)} />
                    <span className="text-sm">BE verifies et conformes au RBE</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={docsChecked} onCheckedChange={v => setDocsChecked(!!v)} />
                    <span className="text-sm">Documents KYC a jour (CNI, KBIS, Statuts)</span>
                  </label>
                </div>

                {/* Screening results */}
                {screeningLaunched && (
                  <ScreeningPanel screening={screening} />
                )}
              </div>
            )}

            {/* ─── STEP 4: Questionnaire ──────────────────────── */}
            {wizardStep === 3 && clientData && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Questionnaire LCB-FT</h2>

                {/* Score delta preview */}
                <div className="rounded-xl border bg-card p-4 flex items-center gap-6">
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">Avant</span>
                    <span className={`text-2xl font-bold ${scoreBefore >= 60 ? "text-red-400" : scoreBefore >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                      {scoreBefore}
                    </span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">Apres</span>
                    <span className={`text-2xl font-bold ${scoreAfter.scoreGlobal >= 60 ? "text-red-400" : scoreAfter.scoreGlobal >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                      {scoreAfter.scoreGlobal}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">Delta</span>
                    <span className={`text-2xl font-bold ${delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {delta > 0 ? `+${delta}` : delta === 0 ? "0" : String(delta)}
                    </span>
                  </div>
                  <div className="ml-auto text-center">
                    <span className="text-xs text-muted-foreground block">Vigilance</span>
                    <VigilBadge level={scoreAfter.nivVigilance} />
                  </div>
                </div>

                {/* Questions — OPT-36: highlight changed, OPT-38: malus display */}
                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const originalValue = clientData ? ({
                      ppe: clientData.ppe, paysRisque: clientData.pays_risque,
                      atypique: clientData.atypique, distanciel: clientData.distanciel,
                      cash: clientData.cash, pression: clientData.pression,
                    } as Record<string, string>)[q.id] || "NON" : "NON";
                    const changed = q.value !== originalValue;
                    return (
                      <div key={q.id} className={`rounded-lg border p-4 flex items-start gap-4 transition-colors ${
                        changed ? "bg-amber-500/[0.07] border-amber-500/30" : "bg-card"
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{q.question}</p>
                            {changed && <Badge className="text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/30">Modifie</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs text-muted-foreground">{q.reference}</p>
                            <span className="text-[10px] text-red-400/70">+{q.malus} pts si OUI</span>
                          </div>
                        </div>
                        <RadioGroup
                          value={q.value}
                          onValueChange={(v) => {
                            setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, value: v as "OUI" | "NON" } : qq));
                            // OPT-40: Toast on vigilance threshold crossing
                            if (v === "OUI" && (q.id === "ppe" || q.id === "atypique")) {
                              toast.warning("Passage automatique en vigilance RENFORCEE");
                            }
                          }}
                          className="flex gap-3"
                        >
                          <div className="flex items-center gap-1">
                            <RadioGroupItem value="OUI" id={`${q.id}-oui`} />
                            <Label htmlFor={`${q.id}-oui`} className="text-sm cursor-pointer">Oui</Label>
                          </div>
                          <div className="flex items-center gap-1">
                            <RadioGroupItem value="NON" id={`${q.id}-non`} />
                            <Label htmlFor={`${q.id}-non`} className="text-sm cursor-pointer">Non</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── STEP 5: Decision ───────────────────────────── */}
            {wizardStep === 4 && clientData && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Decision de maintien</h2>

                {/* OPT-41: Complete summary */}
                <div className="rounded-xl border bg-card p-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Score avant</span>
                      <div className="mt-1"><ScoreBadge score={scoreBefore} /></div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Score apres</span>
                      <div className="mt-1"><ScoreBadge score={scoreAfter.scoreGlobal} /></div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vigilance avant</span>
                      <div className="mt-1"><VigilBadge level={vigilanceBefore} /></div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vigilance apres</span>
                      <div className="mt-1"><VigilBadge level={scoreAfter.nivVigilance} /></div>
                    </div>
                  </div>
                  {/* Summary row */}
                  <div className="flex flex-wrap gap-3 text-xs">
                    {changesDetected.length > 0 && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                        {changesDetected.length} changement(s) detecte(s)
                      </Badge>
                    )}
                    {screeningLaunched && screening.sanctions?.data && (
                      <Badge variant="outline" className={
                        screening.sanctions.data.hasCriticalMatch
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }>
                        Screening : {screening.sanctions.data.hasCriticalMatch ? "ALERTE" : "RAS"}
                      </Badge>
                    )}
                    {questions.filter(q => {
                      const orig = ({
                        ppe: clientData?.ppe, paysRisque: clientData?.pays_risque,
                        atypique: clientData?.atypique, distanciel: clientData?.distanciel,
                        cash: clientData?.cash, pression: clientData?.pression,
                      } as Record<string, string | undefined>)[q.id] || "NON";
                      return q.value !== orig;
                    }).length > 0 && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {questions.filter(q => {
                          const orig = ({
                            ppe: clientData?.ppe, paysRisque: clientData?.pays_risque,
                            atypique: clientData?.atypique, distanciel: clientData?.distanciel,
                            cash: clientData?.cash, pression: clientData?.pression,
                          } as Record<string, string | undefined>)[q.id] || "NON";
                          return q.value !== orig;
                        }).length} reponse(s) modifiee(s)
                      </Badge>
                    )}
                  </div>
                  {delta !== 0 && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${delta > 0 ? "bg-red-500/10 border border-red-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                      {delta > 0 ? <AlertTriangle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      <span className={`text-sm ${delta > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        Le score de risque a {delta > 0 ? "augmente" : "diminue"} de {Math.abs(delta)} point(s)
                      </span>
                    </div>
                  )}
                </div>

                {/* Decision buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setDecision("maintien")}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      decision === "maintien"
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-border hover:border-emerald-500/50"
                    }`}
                  >
                    <CheckCircle2 className={`h-6 w-6 mb-2 ${decision === "maintien" ? "text-emerald-400" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm">MAINTIEN</p>
                    <p className="text-xs text-muted-foreground mt-1">La relation d'affaires est maintenue</p>
                  </button>
                  <button
                    onClick={() => setDecision("vigilance_renforcee")}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      decision === "vigilance_renforcee"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-border hover:border-amber-500/50"
                    }`}
                  >
                    <AlertTriangle className={`h-6 w-6 mb-2 ${decision === "vigilance_renforcee" ? "text-amber-400" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm">VIGILANCE RENFORCEE</p>
                    <p className="text-xs text-muted-foreground mt-1">Maintien avec surveillance accrue</p>
                  </button>
                  <button
                    onClick={() => setDecision("fin_relation")}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      decision === "fin_relation"
                        ? "border-red-500 bg-red-500/10"
                        : "border-border hover:border-red-500/50"
                    }`}
                  >
                    <XCircle className={`h-6 w-6 mb-2 ${decision === "fin_relation" ? "text-red-400" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm">FIN DE RELATION</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommandation de fin de relation</p>
                  </button>
                </div>

                {/* OPT-44: Next review date */}
                <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Prochaine revue</span>
                    <p className="font-medium text-sm mt-0.5">
                      {calculateNextReviewDate(
                        decision === "vigilance_renforcee" ? "RENFORCEE" : scoreAfter.nivVigilance,
                        new Date().toISOString().split("T")[0]
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {REVIEW_TYPE_LABEL[decision === "vigilance_renforcee" ? "RENFORCEE" : scoreAfter.nivVigilance] || "Annuelle"}
                  </Badge>
                </div>

                {/* Observations */}
                <div className="space-y-2">
                  <Label>
                    Observations
                    {(decision === "vigilance_renforcee" || decision === "fin_relation") && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </Label>
                  <Textarea
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Observations, justification de la decision..."
                    rows={4}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Bottom navigation ────────────────────────────── */}
        {clientData && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setWizardStep(s => Math.max(0, s - 1))}
              disabled={wizardStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Precedent
            </Button>
            {wizardStep < 4 ? (
              <Button onClick={() => setWizardStep(s => s + 1)}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleValidateRevue}
                disabled={submitting}
                className={
                  decision === "maintien" ? "bg-emerald-600 hover:bg-emerald-700" :
                  decision === "vigilance_renforcee" ? "bg-amber-600 hover:bg-amber-700" :
                  "bg-red-600 hover:bg-red-700"
                }
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Valider la revue
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — LIST MODE
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revue & Maintien de mission</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des diligences de vigilance et maintien des relations d'affaires
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={sortedRevues.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generer les revues a faire
          </Button>
        </div>
      </div>

      {/* KPI Cards — OPT-8: 5 counters */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="A faire" value={stats.total_a_faire} icon={ClipboardCheck}
            color={stats.total_a_faire > 0 ? "text-amber-500" : "text-muted-foreground"}
            bgColor={stats.total_a_faire > 0 ? "bg-amber-500/10" : "bg-muted/50"} />
          <KpiCard label="En retard" value={stats.en_retard} icon={Clock}
            color={stats.en_retard > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}
            bgColor={stats.en_retard > 0 ? "bg-red-600/10" : "bg-muted/50"} />
          <KpiCard label="Risque eleve" value={stats.risque_eleve} icon={ShieldAlert}
            color={stats.risque_eleve > 0 ? "text-red-500" : "text-muted-foreground"}
            bgColor={stats.risque_eleve > 0 ? "bg-red-500/10" : "bg-muted/50"} />
          <KpiCard label="KYC expires" value={stats.kyc_expires} icon={AlertTriangle}
            color={stats.kyc_expires > 0 ? "text-red-500" : "text-muted-foreground"}
            bgColor={stats.kyc_expires > 0 ? "bg-red-500/10" : "bg-muted/50"} />
          <KpiCard label="Completees ce mois" value={stats.completees_ce_mois} icon={CheckCircle2}
            color={stats.completees_ce_mois > 0 ? "text-emerald-500" : "text-muted-foreground"}
            bgColor={stats.completees_ce_mois > 0 ? "bg-emerald-500/10" : "bg-muted/50"} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Statut</Label>
          <div className="flex gap-1">
            {STATUS_PILLS.map(pill => (
              <button
                key={pill.value}
                onClick={() => setFilterStatus(pill.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  filterStatus === pill.value
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/40 font-medium"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="annuelle">Annuelle</SelectItem>
              <SelectItem value="risque_eleve">Risque eleve</SelectItem>
              <SelectItem value="kyc_expiration">KYC expire</SelectItem>
              <SelectItem value="changement_situation">Changement situation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Niveau de risque</Label>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="eleve">Eleve (≥60)</SelectItem>
              <SelectItem value="moyen">Moyen (30-59)</SelectItem>
              <SelectItem value="faible">Faible (&lt;30)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Recherche client</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nom ou reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="w-[80px]">Score</TableHead>
              <TableHead>Vigilance</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Echeance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedRevues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    <span>Aucune revue a faire. Cliquez sur « Generer les revues » pour verifier.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleRevues.map(revue => {
                const score = revue.score_risque_avant ?? revue.client_score ?? 0;
                return (
                  <TableRow key={revue.id} className={getRowClassName(revue)}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{revue.client_nom || "—"}</span>
                        <span className="block text-xs text-muted-foreground">{revue.client_ref}</span>
                      </div>
                    </TableCell>
                    <TableCell><ScoreBadge score={score} /></TableCell>
                    <TableCell>
                      <VigilBadge level={revue.vigilance_avant || revue.client_vigilance || ""} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{REVUE_TYPE_LABELS[revue.type]?.label || revue.type}</Badge>
                    </TableCell>
                    <TableCell><EcheanceBadge date={revue.date_echeance} status={revue.status} /></TableCell>
                    <TableCell><StatusBadge status={revue.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {(revue.status === "a_faire" || revue.status === "en_cours") && (
                          <>
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => openWizard(revue)}>
                              <ClipboardCheck className="h-3 w-3 mr-1" /> Revue
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReporterRevueItem(revue)}>
                              <CalendarClock className="h-3 w-3 mr-1" /> Reporter
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/client/${revue.client_ref}`)}>
                          <Eye className="h-3 w-3 mr-1" /> Dossier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {hasMore && !loading && (
          <div className="flex justify-center py-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}>
              Voir plus ({sortedRevues.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>

      {/* Reporter Dialog */}
      <Dialog open={!!reporterRevueItem} onOpenChange={v => { if (!v) setReporterRevueItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reporter la revue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reporter-date">Nouvelle date d'echeance</Label>
              <Input id="reporter-date" type="date" value={reporterDate} onChange={e => setReporterDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporter-motif">Motif du report</Label>
              <Textarea id="reporter-motif" value={reporterMotif} onChange={e => setReporterMotif(e.target.value)} placeholder="Indiquer le motif du report..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReporterRevueItem(null)}>Annuler</Button>
            <Button onClick={handleReporter} disabled={!reporterDate || reporterLoading}>
              {reporterLoading ? "En cours..." : "Confirmer le report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
