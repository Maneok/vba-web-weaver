import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { clientsService } from "@/lib/supabaseService";
import { calculateRiskScore, calculateNextReviewDate, calculateDateButoir, getPilotageStatus, APE_SCORES, MISSION_SCORES, PAYS_RISQUE, APE_CASH, MISSION_FREQUENCE, normalizeAddress } from "@/lib/riskEngine";
import { searchPappers, checkGelAvoirs, type PappersResult } from "@/lib/pappersService";
import {
  searchEnterprise, checkSanctions, checkBodacc, verifyGooglePlaces, checkNews, analyzeNetwork, fetchDocuments, fetchInpiDocuments,
  INITIAL_SCREENING, type ScreeningState, type EnterpriseResult, type Dirigeant, type BeneficiaireEffectif,
  type InpiCompanyData, type InpiFinancials, type DataProvenance, type AmlSignal,
  computeKycCompleteness, detectAmlSignals, pickPrincipalDirigeant, formatDateFR,
  getFormeJuridiqueLabel,
} from "@/lib/kycService";
import ScreeningPanel from "@/components/ScreeningPanel";
import NetworkGraph from "@/components/NetworkGraph";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { generateLettreMission } from "@/lib/generateLettreMissionPdf";
import type { Client, OuiNon, MissionType, EtatPilotage } from "@/lib/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScoreGauge, VigilanceBadge } from "@/components/RiskBadges";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Search, Hash, Building2, User, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  Upload, FileText, AlertTriangle, Plus, Trash2, FileDown, Check, X, ArrowRight, Info,
  Map, ExternalLink, Eye, Clock, DollarSign, Calendar, ChevronDown, Lock, Sparkles,
  GripVertical, Flag, Shield, Briefcase, MapPin, Save, Wifi, WifiOff, Printer,
  ChevronUp, HelpCircle, BarChart3, History, RefreshCw, BookOpen,
} from "lucide-react";

import { FORMES_JURIDIQUES as FORMES, MISSIONS, FREQUENCES, DEFAULT_COMPTABLES as COMPTABLES, DEFAULT_ASSOCIES as ASSOCIES, DEFAULT_SUPERVISEURS as SUPERVISEURS } from "@/lib/constants";

const STEP_LABELS = ["Recherche", "Informations", "Personnes", "Questionnaire", "Scoring", "Documents"];

interface Beneficiaire {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  pourcentage: number;
  pourcentageVotes?: number;
}

interface QuestionLCB {
  id: string;
  question: string;
  reference: string;
  malus: number;
  value: "OUI" | "NON" | "N/A";
  commentaire: string;
}

const QUESTIONS_LCB: Omit<QuestionLCB, "value" | "commentaire">[] = [
  { id: "ppe", question: "Le client ou son representant est-il une Personne Politiquement Exposee (PPE) ?", reference: "Art. L.561-10 II CMF", malus: 100 },
  { id: "paysRisque", question: "Le client est-il lie a un pays a risque (liste GAFI / UE) ?", reference: "Art. L.561-10 I 4° CMF", malus: 100 },
  { id: "atypique", question: "Le montage juridique du client est-il atypique ou complexe sans justification economique ?", reference: "Art. L.561-10-2 CMF", malus: 100 },
  { id: "distanciel", question: "La relation d'affaires est-elle integralement a distance (jamais de rencontre physique) ?", reference: "Art. R.561-5-2 CMF", malus: 40 },
  { id: "cash", question: "L'activite du client implique-t-elle la manipulation d'especes significatives ?", reference: "Art. L.561-15 CMF", malus: 30 },
  { id: "pression", question: "Le client exerce-t-il une pression ou une urgence inhabituelle sur les delais ?", reference: "Art. L.561-10-2 3° CMF", malus: 50 },
  { id: "changeJuridiques", question: "Le client a-t-il effectue des changements juridiques frequents (forme, siege, objet) ?", reference: "Art. R.561-38 CMF", malus: 20 },
  { id: "structureComplexe", question: "La structure capitalistique est-elle opaque ou anormalement complexe ?", reference: "Art. L.561-10 II CMF", malus: 30 },
  { id: "filialesEtrangeres", question: "Le client detient-il des filiales dans des pays a fiscalite privilegiee ?", reference: "Art. L.561-10 I 4° CMF", malus: 25 },
  { id: "transactionsPays", question: "Des transactions significatives sont-elles realisees avec des pays a risque ?", reference: "Art. L.561-15 II CMF", malus: 25 },
  { id: "mouvementsCash", question: "Des mouvements d'argent liquide inhabituels sont-ils constates ?", reference: "Art. L.561-15 CMF", malus: 30 },
  { id: "capitalInconnus", question: "Le capital social est-il detenu par des personnes non identifiees ou des societes ecran ?", reference: "Art. L.561-2-2 CMF", malus: 50 },
  { id: "fournisseursPays", question: "Les principaux fournisseurs sont-ils situes dans des pays a risque ?", reference: "Art. L.561-10 I CMF", malus: 20 },
];

interface UploadedDoc {
  name: string;
  type: string;
  file?: File;
  fromPappers?: boolean;
  url?: string;
}

export default function NouveauClientPage() {
  const navigate = useNavigate();
  const { clients, addClient, refreshClients } = useAppState();
  const [step, setStep] = useState(0);

  // Step 1 - Search
  const [searchMode, setSearchMode] = useState<"siren" | "nom" | "dirigeant">("siren");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PappersResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [selectedResult, setSelectedResult] = useState<PappersResult | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [duplicateRef, setDuplicateRef] = useState("");
  const [dataSource, setDataSource] = useState<string>("");
  const [gelAvoirsAlert, setGelAvoirsAlert] = useState<string[]>([]);
  const [screening, setScreening] = useState<ScreeningState>(INITIAL_SCREENING);
  const [autoFields, setAutoFields] = useState<Set<string>>(new Set());
  const [capitalSource, setCapitalSource] = useState("");
  const [selectedEnterprise, setSelectedEnterprise] = useState<EnterpriseResult | null>(null);
  // CORRECTION 3: Data provenance tracking
  const [dataProvenance, setDataProvenance] = useState<DataProvenance[]>([]);
  // CORRECTION 7: AML structural signals
  const [amlSignals, setAmlSignals] = useState<AmlSignal[]>([]);

  // Step 2 - Form
  const [form, setForm] = useState({
    raisonSociale: "", forme: "SARL", siren: "", siret: "", capital: 0, ape: "", dirigeant: "",
    domaine: "", effectif: "", adresse: "", cp: "", ville: "",
    tel: "", mail: "", siteWeb: "", dateCreation: "", dateReprise: "",
    mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, reprise: 0, juridique: 0,
    frequence: "MENSUEL",
    comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
    iban: "", bic: "", dateFin: "",
    // INPI enriched fields
    objetSocial: "", duree: "", dateClotureExercice: "",
  });

  // Step 3 - Beneficiaires
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [beScreening, setBeScreening] = useState<Record<string, "loading" | "clean" | "match" | "error">>({});

  // Step 4 - Questionnaire
  const [questions, setQuestions] = useState<QuestionLCB[]>(
    QUESTIONS_LCB.map(q => ({ ...q, value: "NON" as const, commentaire: "" }))
  );

  // Step 5 - Decision
  const [decision, setDecision] = useState<"ACCEPTER" | "ACCEPTER_RESERVE" | "REFUSER" | "">("");
  const [motifRefus, setMotifRefus] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  // Step 6 - Documents
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // FIX 18: Submission loading state to prevent double-click
  const [isSubmitting, setIsSubmitting] = useState(false);
  // FIX 36: Loading state for generate PDF buttons
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  // FIX 37: Drag-over highlight per upload zone
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  // Draft banner state
  const [draftBanner, setDraftBanner] = useState<{ restoredAt: Date } | null>(null);

  // Idee 28: Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdClientRef, setCreatedClientRef] = useState("");

  // #1: Animated placeholder cycling
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const PLACEHOLDERS = useMemo(() => ({
    siren: ["123 456 789", "987 654 321", "412 345 678"],
    nom: ["BOULANGERIE MARTIN", "PHARMACIE DUPONT", "SCI IMMOBILIERE"],
    dirigeant: ["MARTIN Jean-Pierre", "DUPONT Marie", "BERNARD Paul"],
  }), []);

  // #2: Search history
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("search_history_lcb") || "[]").slice(0, 5); }
    catch { return []; }
  });
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  // #71: Step transition direction
  const [stepDirection, setStepDirection] = useState<"left" | "right">("right");
  const prevStepRef = useRef(0);

  // #77: Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // #81: Search debounce timer
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // #90: Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // #11: Collapsible sections state for step 1
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // #40: Collapsed beneficiaires
  const [collapsedBE, setCollapsedBE] = useState<Record<number, boolean>>({});

  // #51: Animated score
  const [animatedScore, setAnimatedScore] = useState(0);

  // #57: Motif decision (for ACCEPTER_RESERVE)
  const [motifReserve, setMotifReserve] = useState("");

  // #91: Field entry animation tracking
  const [fieldsVisible, setFieldsVisible] = useState(false);

  // #74: Save draft floating button feedback
  const [draftSaved, setDraftSaved] = useState(false);

  // #23: Inline validation errors for step 1
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const set = useCallback((key: string, val: unknown) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setHasUnsavedChanges(true);
  }, []);

  // FIX 1: Scroll to top on step change + track direction (#71)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStepDirection(step > prevStepRef.current ? "right" : "left");
    prevStepRef.current = step;
    setFieldsVisible(false);
    const t = setTimeout(() => setFieldsVisible(true), 50);
    return () => clearTimeout(t);
  }, [step]);

  // #1: Cycle placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // #90: Online status tracking
  useEffect(() => {
    const onLine = () => setIsOnline(true);
    const offLine = () => setIsOnline(false);
    window.addEventListener("online", onLine);
    window.addEventListener("offline", offLine);
    return () => { window.removeEventListener("online", onLine); window.removeEventListener("offline", offLine); };
  }, []);

  // #77: Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && step > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, step]);

  // #51: Animate score on step 4
  useEffect(() => {
    if (step === 4) {
      setAnimatedScore(0);
      const target = adjustedScore;
      const duration = 1200;
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedScore(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [step, adjustedScore]);

  // FIX 9: Save draft to localStorage on step change (silent)
  useEffect(() => {
    if (step > 0 || form.siren) {
      const draftData = { form, step, beneficiaires, questions, decision, motifRefus, savedAt: Date.now() };
      sessionStorage.setItem("draft_nouveau_client", JSON.stringify(draftData));
      // Also save per-SIREN draft for multi-draft support
      if (form.siren) {
        const cleanSiren = form.siren.replace(/\s/g, "");
        if (cleanSiren.length === 9) {
          sessionStorage.setItem(`draft_nc_${cleanSiren}`, JSON.stringify(draftData));
        }
      }
    }
  }, [step, form, beneficiaires, questions, decision, motifRefus]);

  // FIX 2: Silent draft restore — no popup
  const restoreDraft = useCallback((draft: string) => {
    try {
      const data = JSON.parse(draft);
      if (data.form?.siren) {
        setForm(data.form);
        setStep(data.step || 0);
        if (data.beneficiaires) setBeneficiaires(data.beneficiaires);
        if (data.questions) setQuestions(data.questions);
        if (data.decision) setDecision(data.decision);
        if (data.motifRefus) setMotifRefus(data.motifRefus);
        setDraftBanner({ restoredAt: new Date(data.savedAt || Date.now()) });
      }
    } catch {}
  }, []);

  // On mount: silently restore draft if exists
  useEffect(() => {
    const draft = sessionStorage.getItem("draft_nouveau_client");
    if (draft) {
      try {
        const data = JSON.parse(draft);
        if (data.form?.siren) {
          restoreDraft(draft);
        }
      } catch {}
    }
  }, [restoreDraft]);

  // Auto-flag PPE if sanctions screening detects it
  const sanctionsPPE = screening.sanctions.data?.hasPPE ?? false;
  const sanctionsCritical = screening.sanctions.data?.hasCriticalMatch ?? false;

  // P5-16: Fix useMemo misuse — all these trigger side effects (setState/toast) so must be useEffect
  // P6-30: Auto-set questionnaire answers based on screening results — also handle critical match
  useEffect(() => {
    if (sanctionsPPE) {
      setQuestions(prev => prev.map(q =>
        q.id === "ppe" && q.value !== "OUI"
          ? { ...q, value: "OUI" as const, commentaire: q.commentaire || "PPE detectee automatiquement via OpenSanctions" }
          : q
      ));
    }
  }, [sanctionsPPE]);

  // P6-31: Auto-flag atypique if critical sanctions match detected
  useEffect(() => {
    if (sanctionsCritical) {
      setQuestions(prev => prev.map(q =>
        q.id === "atypique" && q.value !== "OUI"
          ? { ...q, value: "OUI" as const, commentaire: q.commentaire || "Match critique OpenSanctions — verification manuelle requise" }
          : q
      ));
    }
  }, [sanctionsCritical]);

  // P6-25: Auto-suggest frequency based on mission type — only on mission change (not frequence)
  const prevMissionRef = useMemo(() => ({ current: form.mission }), []);
  useEffect(() => {
    const suggested = MISSION_FREQUENCE[form.mission];
    if (suggested && form.mission !== prevMissionRef.current) {
      set("frequence", suggested);
    }
    prevMissionRef.current = form.mission;
  }, [form.mission, set, prevMissionRef]);

  // #24: Auto-detect domiciliataire → mission DOMICILIATION
  const inpiDomiciliataire = screening.inpi.data?.companyData?.domiciliataire;
  useEffect(() => {
    if (inpiDomiciliataire) {
      set("mission", "DOMICILIATION");
    }
  }, [inpiDomiciliataire, set]);

  // Idée 4: Auto-detect cash-intensive APE
  useEffect(() => {
    if (form.ape && APE_CASH.includes(form.ape)) {
      setQuestions(prev => {
        const cashQ = prev.find(q => q.id === "cash");
        if (cashQ && cashQ.value !== "OUI") {
          toast.warning("Secteur a risque especes detecte (APE " + form.ape + ")");
          return prev.map(q =>
            q.id === "cash"
              ? { ...q, value: "OUI" as const, commentaire: q.commentaire || `Secteur a risque especes detecte automatiquement (APE ${form.ape})` }
              : q
          );
        }
        return prev;
      });
    }
  }, [form.ape]);

  // P6-32: Auto-detect pays risque from BE nationalities — use beKey to avoid re-triggering
  useEffect(() => {
    if (beneficiaires.length > 0) {
      const paysRisqueMatch = beneficiaires.find(b => {
        const nat = (b.nationalite || "").toUpperCase();
        return nat && nat !== "FRANCAISE" && nat !== "FRANÇAISE" && nat !== "FRENCH" && PAYS_RISQUE.some(p => nat.includes(p));
      });
      if (paysRisqueMatch) {
        setQuestions(prev => {
          const q = prev.find(q => q.id === "paysRisque");
          if (q && q.value === "OUI") return prev; // Already set, don't re-toast
          return prev.map(q =>
            q.id === "paysRisque" && q.value !== "OUI"
              ? { ...q, value: "OUI" as const, commentaire: q.commentaire || `Pays a risque detecte via BE : ${paysRisqueMatch.nationalite}` }
              : q
          );
        });
      }
    }
  }, [beneficiaires]);

  // #25: Auto-detect pays risque from address or dirigeant nationality
  const inpiPays = screening.inpi.data?.companyData?.adresse?.pays;
  useEffect(() => {
    const paysAddr = (inpiPays || "").toUpperCase();
    const isForeignAddress = paysAddr && paysAddr !== "" && paysAddr !== "FRANCE" && paysAddr !== "FR";
    const dirNationalites = screening.inpi.data?.companyData?.dirigeants?.map(d => (d.nationalite || "").toUpperCase()) ?? [];
    const paysRisqueDetected = isForeignAddress && PAYS_RISQUE.some(p => paysAddr.includes(p));
    const dirPaysRisque = dirNationalites.find(n => PAYS_RISQUE.some(p => n.includes(p)));
    if (paysRisqueDetected || dirPaysRisque) {
      setQuestions(prev => prev.map(q =>
        q.id === "paysRisque" && q.value !== "OUI"
          ? { ...q, value: "OUI" as const, commentaire: q.commentaire || `Pays a risque detecte automatiquement : ${paysRisqueDetected ? paysAddr : dirPaysRisque}` }
          : q
      ));
    }
  }, [inpiPays, screening.inpi.data?.companyData?.dirigeants]);

  // Risk flags derived from questionnaire
  const riskFlags = useMemo(() => ({
    ppe: questions.find(q => q.id === "ppe")?.value === "OUI",
    paysRisque: questions.find(q => q.id === "paysRisque")?.value === "OUI",
    atypique: questions.find(q => q.id === "atypique")?.value === "OUI",
    distanciel: questions.find(q => q.id === "distanciel")?.value === "OUI",
    cash: questions.find(q => q.id === "cash")?.value === "OUI",
    pression: questions.find(q => q.id === "pression")?.value === "OUI",
  }), [questions]);

  // Compute risk score
  const risk = useMemo(() => calculateRiskScore({
    ape: form.ape,
    paysRisque: riskFlags.paysRisque,
    mission: form.mission,
    dateCreation: form.dateCreation || "2020-01-01",
    dateReprise: form.dateReprise || form.dateCreation || "2020-01-01",
    effectif: form.effectif,
    forme: form.forme,
    ...riskFlags,
  }), [form.ape, form.mission, form.dateCreation, form.dateReprise, form.effectif, form.forme, riskFlags]);

  // Extra malus from questionnaire (beyond basic 6)
  const extraMalus = useMemo(() => {
    return questions
      .filter(q => q.value === "OUI" && !["ppe", "paysRisque", "atypique", "distanciel", "cash", "pression"].includes(q.id))
      .reduce((sum, q) => sum + q.malus, 0);
  }, [questions]);

  const bodaccMalus = screening.bodacc.data?.malus ?? 0;
  const totalMalus = risk.malus + extraMalus + bodaccMalus;
  const adjustedScore = Math.min(risk.scoreGlobal + extraMalus + bodaccMalus, 120);

  // Radar data
  const radarData = useMemo(() => [
    { subject: "Activite", score: risk.scoreActivite, fullMark: 100 },
    { subject: "Pays", score: risk.scorePays, fullMark: 100 },
    { subject: "Mission", score: risk.scoreMission, fullMark: 100 },
    { subject: "Maturite", score: risk.scoreMaturite, fullMark: 100 },
    { subject: "Structure", score: risk.scoreStructure, fullMark: 100 },
    { subject: "Malus", score: Math.min(totalMalus, 100), fullMark: 100 },
  ], [risk, totalMalus]);

  // BE sum check
  const beSumOk = useMemo(() => {
    if (beneficiaires.length === 0) return true;
    const sum = beneficiaires.reduce((s, b) => s + b.pourcentage, 0);
    return Math.abs(sum - 100) < 0.01;
  }, [beneficiaires]);

  // KYC completeness
  // FIX 13: Corrected KBIS matching — "Actes" is NOT a KBIS equivalent
  // Only "kbis", "extrait rne", "extrait rbe" count as KBIS
  // FIX P4-11: Accept lien_direct status, fix KBIS matching, exclude needsAuth-only docs
  const kycCompleteness = useMemo(() => {
    const required = ["KBIS", "Statuts", "CNI", "RIB"];
    const autoDocs = [
      ...(screening.documents.data?.documents ?? []),
      ...(screening.inpi.data?.documents ?? []),
    ];
    const found = required.filter(r =>
      documents.some(d => d.type.toUpperCase().includes(r.toUpperCase())) ||
      autoDocs.some(d => {
        const typeUp = d.type.toUpperCase();
        const typeMatch = typeUp.includes(r.toUpperCase());
        // Only Extrait RNE/RBE count as KBIS equivalent, NOT generic "Actes"
        const kbisMatch = r === "KBIS" && (typeUp.includes("EXTRAIT") || typeUp === "KBIS");
        const isAvailable = d.status === "auto" || d.status === "lien_direct" || (d as any).storedInSupabase === true;
        const notAuthOnly = !(d as any).needsAuth || (d as any).storedInSupabase;
        return (typeMatch || kbisMatch) && isAvailable && notAuthOnly;
      })
    );
    return Math.round((found.length / required.length) * 100);
  }, [documents, screening.documents.data, screening.inpi.data]);

  // Idee 18: SPEC_O90 KYC completeness — required fields
  const specO90Kyc = useMemo(() => {
    const requiredFields: Array<{ label: string; filled: boolean }> = [
      { label: "Raison sociale", filled: !!form.raisonSociale },
      { label: "Forme juridique", filled: !!form.forme },
      { label: "SIREN", filled: !!form.siren && form.siren.replace(/\s/g, "").length === 9 },
      { label: "Code APE", filled: !!form.ape },
      { label: "Dirigeant", filled: !!form.dirigeant },
      { label: "Adresse", filled: !!form.adresse },
      { label: "Code postal", filled: !!form.cp },
      { label: "Ville", filled: !!form.ville },
      { label: "Capital social", filled: form.capital > 0 },
      { label: "Date de creation", filled: !!form.dateCreation },
      { label: "Type de mission", filled: !!form.mission },
      { label: "Associe signataire", filled: !!form.associe },
      { label: "Beneficiaires effectifs", filled: beneficiaires.length > 0 },
      { label: "Decision d'acceptation", filled: decision !== "" },
    ];
    const filled = requiredFields.filter(f => f.filled).length;
    const missing = requiredFields.filter(f => !f.filled).map(f => f.label);
    return { percent: Math.round((filled / requiredFields.length) * 100), missing, total: requiredFields.length, filled };
  }, [form, beneficiaires, decision]);

  // Questions validation - all OUI need comments
  const questionsValid = useMemo(() => {
    return questions.every(q => q.value !== "OUI" || q.commentaire.trim().length > 0);
  }, [questions]);

  // #8: Screening progress indicator
  const screeningProgress = useMemo(() => {
    const keys = ["enterprise", "sanctions", "bodacc", "google", "news", "network", "documents", "inpi"] as const;
    const totalCount = keys.length;
    const completedCount = keys.filter(k => !screening[k].loading && (screening[k].data !== null || screening[k].error !== null)).length;
    return { completedCount, totalCount };
  }, [screening]);

  // #23: Screening running — any key has loading=true
  const screeningRunning = useMemo(() => {
    const keys = ["enterprise", "sanctions", "bodacc", "google", "news", "network", "documents", "inpi"] as const;
    return keys.some(k => screening[k].loading);
  }, [screening]);

  // Launch parallel screening checks
  const launchScreening = (enterprise: EnterpriseResult) => {
    const siren = enterprise.siren;
    const dirigeants = enterprise.dirigeants ?? [];
    const raisonSociale = enterprise.raison_sociale;
    const ville = enterprise.ville;
    const dirigeantPrincipal = enterprise.dirigeant;

    // #28: All screening calls launched in parallel via Promise.allSettled pattern
    // #30: Each call tracks response time

    // Sanctions check
    const t0sanctions = Date.now();
    setScreening(prev => ({ ...prev, sanctions: { loading: true, data: null, error: null } }));
    const personsToCheck = dirigeants.map(d => ({
      nom: d.nom, prenom: d.prenom, dateNaissance: d.date_naissance, nationalite: d.nationalite,
    }));
    checkSanctions(personsToCheck, siren.replace(/\s/g, "")).then(data => {
      setScreening(prev => ({ ...prev, sanctions: { loading: false, data, error: null, timeMs: Date.now() - t0sanctions } }));
      if (data.hasCriticalMatch) toast.error("ALERTE SANCTIONS : Match critique detecte !");
      if (data.hasPPE) toast.warning("PPE detectee — vigilance RENFORCEE requise");
    }).catch(() => setScreening(prev => ({ ...prev, sanctions: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0sanctions } })));

    // BODACC check
    const t0bodacc = Date.now();
    setScreening(prev => ({ ...prev, bodacc: { loading: true, data: null, error: null } }));
    checkBodacc(siren, raisonSociale, enterprise.complements as Record<string, unknown>).then(data => {
      setScreening(prev => ({ ...prev, bodacc: { loading: false, data, error: null, timeMs: Date.now() - t0bodacc } }));
      if (data.hasProcedureCollective) toast.warning("Procedure collective detectee (BODACC)");
    }).catch(() => setScreening(prev => ({ ...prev, bodacc: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0bodacc } })));

    // Google Places
    const t0google = Date.now();
    setScreening(prev => ({ ...prev, google: { loading: true, data: null, error: null } }));
    verifyGooglePlaces(raisonSociale, ville).then(data => {
      setScreening(prev => ({ ...prev, google: { loading: false, data, error: null, timeMs: Date.now() - t0google } }));
    }).catch(() => setScreening(prev => ({ ...prev, google: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0google } })));

    // News check
    const t0news = Date.now();
    setScreening(prev => ({ ...prev, news: { loading: true, data: null, error: null } }));
    checkNews(raisonSociale, dirigeantPrincipal).then(data => {
      setScreening(prev => ({ ...prev, news: { loading: false, data, error: null, timeMs: Date.now() - t0news } }));
      if (data.hasNegativeNews) toast.error("Article negatif detecte dans la presse !");
    }).catch(() => setScreening(prev => ({ ...prev, news: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0news } })));

    // Network analysis
    const t0network = Date.now();
    setScreening(prev => ({ ...prev, network: { loading: true, data: null, error: null } }));
    analyzeNetwork(siren, dirigeants).then(data => {
      setScreening(prev => ({ ...prev, network: { loading: false, data, error: null, timeMs: Date.now() - t0network } }));
    }).catch(() => setScreening(prev => ({ ...prev, network: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0network } })));

    // Documents fetch
    const t0docs = Date.now();
    setScreening(prev => ({ ...prev, documents: { loading: true, data: null, error: null } }));
    fetchDocuments(siren, raisonSociale).then(data => {
      setScreening(prev => ({ ...prev, documents: { loading: false, data, error: null, timeMs: Date.now() - t0docs } }));
    }).catch(() => setScreening(prev => ({ ...prev, documents: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0docs } })));

    // INPI documents fetch — Phase 1: INPI as priority data source
    const t0inpi = Date.now();
    setScreening(prev => ({ ...prev, inpi: { loading: true, data: null, error: null } }));
    fetchInpiDocuments(siren.replace(/\s/g, "")).then(data => {
      setScreening(prev => ({ ...prev, inpi: { loading: false, data, error: data.error || null, timeMs: Date.now() - t0inpi } }));
      if (data.totalDocuments > 0) toast.success(`${data.totalDocuments} document(s) INPI recupere(s)`);
      else if (data.error) toast.warning(`INPI: ${data.error}`);

      // Phase 1: Enrich form with INPI data (highest priority)
      if (data.companyData) {
        const inpi = data.companyData;
        const updates: Record<string, unknown> = {};
        const newAuto = new Set<string>();
        const inpiAutoSet = (key: string, val: string | number | undefined | null) => {
          if (val && val !== "" && val !== 0) { updates[key] = val; newAuto.add(key); }
        };
        // INPI priority fields
        if (inpi.capital > 0) { inpiAutoSet("capital", inpi.capital); setCapitalSource("INPI"); }
        if (inpi.denomination) inpiAutoSet("raisonSociale", inpi.denomination.toUpperCase());
        const addr = [inpi.adresse.numVoie, inpi.adresse.typeVoie, inpi.adresse.voie].filter(Boolean).join(" ").toUpperCase();
        if (addr) inpiAutoSet("adresse", addr);
        if (inpi.adresse.codePostal) inpiAutoSet("cp", inpi.adresse.codePostal);
        if (inpi.adresse.commune) inpiAutoSet("ville", inpi.adresse.commune.toUpperCase());
        if (inpi.dirigeants?.length > 0 && inpi.dirigeants[0]) {
          inpiAutoSet("dirigeant", `${inpi.dirigeants[0].nom ?? ""} ${inpi.dirigeants[0].prenom ?? ""}`.trim().toUpperCase());
        }
        // FIX 4+5+6: Enrich with INPI-specific fields
        if (inpi.objetSocial) inpiAutoSet("objetSocial", inpi.objetSocial);
        if (inpi.duree) inpiAutoSet("duree", inpi.duree);
        if (inpi.dateClotureExercice) inpiAutoSet("dateClotureExercice", inpi.dateClotureExercice);
        // FIX 6: Apply forme juridique label from INPI code
        if (inpi.formeJuridique) {
          const formeLabel = getFormeJuridiqueLabel(inpi.formeJuridique);
          const formeMatch = FORMES.find(f => f === formeLabel || formeLabel.toUpperCase().includes(f));
          if (formeMatch) inpiAutoSet("forme", formeMatch);
        }
        if (Object.keys(updates).length > 0) {
          setForm(prev => ({ ...prev, ...updates }));
          setAutoFields(prev => new Set([...prev, ...newAuto]));
        }

        // Phase 4: Merge INPI BE with existing — FIX 8: Deduplicate, prefer dirigeant version with prenom
        if (inpi.beneficiaires && inpi.beneficiaires.length > 0) {
          setBeneficiaires(prev => {
            // Build dirigeant lookup by nom (uppercase) for prenom enrichment
            const dirLookup = new Map<string, { prenom: string; dateNaissance: string; nationalite: string }>();
            (inpi.dirigeants || []).forEach((d: any) => {
              const nomUp = (d.nom || "").toUpperCase();
              if (nomUp && d.prenom) {
                dirLookup.set(nomUp, { prenom: d.prenom, dateNaissance: d.dateNaissance || "", nationalite: d.nationalite || "Francaise" });
              }
            });

            // Merge INPI BE, enriching with dirigeant prenom if missing
            const enrichedBE = inpi.beneficiaires.map(b => {
              const nomUp = (b.nom || "").toUpperCase();
              const dirMatch = dirLookup.get(nomUp);
              // FIX 8: If BE has no prenom but a dirigeant with same nom has one, use it
              const prenom = b.prenom || (dirMatch?.prenom || "");
              const dateNaissance = b.dateNaissance || (dirMatch?.dateNaissance || "");
              const nationalite = b.nationalite || (dirMatch?.nationalite || "Francaise");
              return {
                nom: b.nom || "",
                prenom,
                dateNaissance,
                nationalite,
                pourcentage: b.pourcentageParts || 0,
              };
            });

            // Deduplicate: by nom (uppercase), keep the version with the most info
            const deduped = new Map<string, typeof enrichedBE[0]>();
            for (const be of enrichedBE) {
              const key = be.nom.toUpperCase();
              const existing = deduped.get(key);
              if (!existing || (!existing.prenom && be.prenom) || (!existing.dateNaissance && be.dateNaissance)) {
                deduped.set(key, be);
              }
            }

            // Merge with previous, avoiding duplicates
            const existingNoms = new Set(prev.map(b => b.nom.toUpperCase()));
            const newBE = Array.from(deduped.values()).filter(b => !existingNoms.has(b.nom.toUpperCase()));

            // Also update existing entries that lack prenom
            const updated = prev.map(b => {
              if (!b.prenom) {
                const match = deduped.get(b.nom.toUpperCase());
                if (match?.prenom) return { ...b, prenom: match.prenom, dateNaissance: b.dateNaissance || match.dateNaissance, nationalite: b.nationalite || match.nationalite };
              }
              return b;
            });

            return [...updated, ...newBE];
          });
        } else if (inpi.dirigeants && inpi.dirigeants.length > 0) {
          // No BE from INPI — pre-fill with dirigeants at 0% for manual entry
          setBeneficiaires(prev => {
            if (prev.length > 0 && prev.some(b => b.pourcentage > 0)) return prev; // Don't overwrite if already filled
            const existing = new Set(prev.map(b => b.nom.toUpperCase()));
            const dirBE = inpi.dirigeants
              .filter((d: any) => !existing.has((d.nom || "").toUpperCase()))
              .map((d: any) => ({
                nom: d.nom || "",
                prenom: d.prenom || "",
                dateNaissance: d.dateNaissance || "",
                nationalite: d.nationalite || "Francaise",
                pourcentage: 0,
                pourcentageVotes: 0,
              }));
            // FIX 8: Also enrich existing entries that lack prenom
            const updated = prev.map(b => {
              if (!b.prenom) {
                const dirMatch = inpi.dirigeants.find((d: any) => (d.nom || "").toUpperCase() === b.nom.toUpperCase() && d.prenom);
                if (dirMatch) return { ...b, prenom: dirMatch.prenom, dateNaissance: b.dateNaissance || dirMatch.dateNaissance || "", nationalite: b.nationalite || dirMatch.nationalite || "Francaise" };
              }
              return b;
            });
            return [...updated, ...dirBE];
          });
        }

        // CORRECTION 3: Build provenance records
        const now = new Date().toISOString();
        const prov: DataProvenance[] = [];
        if (inpi.denomination) prov.push({ field: "denomination", value: inpi.denomination, source: "INPI", retrievedAt: now, confidence: "single_source" });
        if (inpi.capital > 0) prov.push({ field: "capital", value: inpi.capital, source: "INPI", retrievedAt: now, confidence: "single_source" });
        if (inpi.formeJuridique) prov.push({ field: "formeJuridique", value: inpi.formeJuridique, source: "INPI", retrievedAt: now, confidence: "single_source" });
        if (inpi.objetSocial) prov.push({ field: "objetSocial", value: inpi.objetSocial, source: "INPI", retrievedAt: now, confidence: "single_source" });
        if (inpi.adresse.commune) prov.push({ field: "adresse", value: `${inpi.adresse.numVoie} ${inpi.adresse.typeVoie} ${inpi.adresse.voie}`.trim(), source: "INPI", retrievedAt: now, confidence: "single_source" });
        setDataProvenance(prev => [...prev, ...prov]);

        // CORRECTION 7: Detect AML signals
        const signals = detectAmlSignals(inpi, selectedEnterprise, data.financials);
        if (signals.length > 0) {
          setAmlSignals(signals);
          signals.forEach(s => {
            if (s.severity === "red") toast.error(`AML: ${s.message}`);
            else if (s.severity === "orange") toast.warning(`AML: ${s.message}`);
          });
        }

        // CORRECTION 6: RGPD non-diffusion alert
        if (inpi.nonDiffusible) {
          toast.warning("Entreprise non-diffusible — donnees soumises a restriction de diffusion (art. R.123-320 C.com)");
        }
        if (inpi.domiciliataire) toast.info(`Domiciliataire detecte : ${inpi.domiciliataire}`);
        if (inpi.associeUnique) toast.warning("Associe unique detecte (INPI)");
      }
    }).catch(() => setScreening(prev => ({ ...prev, inpi: { loading: false, data: null, error: "Service indisponible", timeMs: Date.now() - t0inpi } })));
  };

  // #13-16: Auto-format helpers
  const formatSirenInput = useCallback((val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 9);
    return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  }, []);

  const formatSiretInput = useCallback((val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 9) return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
    const siren = digits.slice(0, 9).replace(/(\d{3})(?=\d)/g, "$1 ");
    return `${siren} ${digits.slice(9)}`.trim();
  }, []);

  const formatPhoneInput = useCallback((val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }, []);

  const formatPostalCode = useCallback((val: string) => {
    return val.replace(/\D/g, "").slice(0, 5);
  }, []);

  // #83: Input sanitization
  const sanitizeInput = useCallback((val: string) => {
    return val.replace(/[<>{}]/g, "").trim();
  }, []);

  // #22: Smooth scroll to first error
  const scrollToFirstError = useCallback(() => {
    const firstError = document.querySelector("[data-error='true']");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Step 1: Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    // #2: Save to search history
    setSearchHistory(prev => {
      const updated = [searchQuery.trim(), ...prev.filter(h => h !== searchQuery.trim())].slice(0, 5);
      localStorage.setItem("search_history_lcb", JSON.stringify(updated));
      return updated;
    });
    setShowSearchHistory(false);
    setSearchLoading(true);
    setSearchError("");
    setSearchResults([]);
    setSelectedResult(null);
    setDuplicateWarning("");
    setDuplicateRef("");
    setScreening(INITIAL_SCREENING);
    // BUG 1: Full state reset when user searches a new SIREN
    setForm({
      raisonSociale: "", forme: "SARL", siren: "", siret: "", capital: 0, ape: "", dirigeant: "",
      domaine: "", effectif: "", adresse: "", cp: "", ville: "",
      tel: "", mail: "", siteWeb: "", dateCreation: "", dateReprise: "",
      mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, reprise: 0, juridique: 0,
      frequence: "MENSUEL",
      comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
      iban: "", bic: "", dateFin: "",
      objetSocial: "", duree: "", dateClotureExercice: "",
    });
    setBeneficiaires([]);
    setBeScreening({});
    setDocuments([]);
    setAmlSignals([]);
    setDataProvenance([]);
    setCapitalSource("");
    setAutoFields(new Set());
    setSelectedEnterprise(null);
    setGelAvoirsAlert([]);
    setDecision("");
    setMotifRefus("");
    setDataSource("");
    setQuestions(QUESTIONS_LCB.map(q => ({ ...q, value: "NON" as const, commentaire: "" })));

    // FIX 2: Auto-load draft if SIREN matches
    const cleanSearch = searchQuery.trim().replace(/\s/g, "");
    if (searchMode === "siren" && /^\d{9,14}$/.test(cleanSearch)) {
      const sirenKey = cleanSearch.slice(0, 9);
      const existingDraft = sessionStorage.getItem(`draft_nc_${sirenKey}`);
      if (existingDraft) {
        restoreDraft(existingDraft);
        // Continue with search to refresh screening data
      }
    }

    // FIX 30: Auto-detect search mode from query content
    let effectiveMode = searchMode;
    if (/^\d{9,14}$/.test(cleanSearch)) {
      effectiveMode = "siren";
    } else if (/[a-zA-ZÀ-ÿ]/.test(cleanSearch) && effectiveMode === "siren") {
      effectiveMode = "nom";
    }

    // Primary: new enterprise-lookup (Annuaire Entreprises)
    setScreening(prev => ({ ...prev, enterprise: { loading: true, data: null, error: null } }));

    const entRes = await searchEnterprise(effectiveMode, searchQuery.trim());

    if (entRes.results && entRes.results.length > 0) {
      setDataSource("annuaire_entreprises");
      setScreening(prev => ({ ...prev, enterprise: { loading: false, data: entRes.results, error: null } }));

      // Map to PappersResult format for compatibility
      const mapped: PappersResult[] = entRes.results.map(r => ({
        siren: r.siren,
        raison_sociale: r.raison_sociale,
        forme_juridique: r.forme_juridique,
        forme_juridique_raw: r.forme_juridique_raw,
        adresse: r.adresse,
        code_postal: r.code_postal,
        ville: r.ville,
        ape: r.ape,
        libelle_ape: r.libelle_ape,
        capital: r.capital,
        date_creation: r.date_creation,
        effectif: r.effectif,
        dirigeant: r.dirigeant,
        beneficiaires_effectifs: "",
        beneficiaires_details: [],
        representants: r.dirigeants.map(d => ({ nom: `${d.prenom} ${d.nom}`, qualite: d.qualite })),
        documents_disponibles: [],
        document_urls: {},
        source: "pappers" as const,
      }));

      setSearchResults(mapped);
      setSearchLoading(false);

      if (mapped.length === 1) {
        selectPappersResult(mapped[0], entRes.results);
        launchScreening(entRes.results[0]);
      }
    } else {
      // Fallback to old Pappers service
      setScreening(prev => ({ ...prev, enterprise: { loading: false, data: null, error: entRes.error ?? "Aucun resultat" } }));
      const res = await searchPappers(effectiveMode, searchQuery.trim());
      setSearchLoading(false);

      if (res.error && (!res.results || res.results.length === 0)) {
        setSearchError(res.error ?? "Aucun resultat trouve.");
        return;
      }
      if (!res.results || res.results.length === 0) {
        setSearchError("Aucun resultat trouve.");
        return;
      }

      setDataSource(res.source || res.results[0]?.source || "pappers");
      setSearchResults(res.results);
      if (res.results.length === 1) {
        selectPappersResult(res.results[0]);
      }
    }
  };

  const selectPappersResult = (result: PappersResult, enterpriseResults?: EnterpriseResult[]) => {
    // Check for duplicate SIREN
    const existing = clients.find(c => c.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, ""));
    if (existing) {
      setDuplicateWarning(`Ce SIREN existe deja : ${existing.raisonSociale} (${existing.ref})`);
      setDuplicateRef(existing.ref);
    } else {
      setDuplicateWarning("");
      setDuplicateRef("");
    }

    // P6-24: Launch screening if enterprise data available — also use passed results to avoid stale state
    const entSourceForScreening = enterpriseResults ?? screening.enterprise.data;
    if (entSourceForScreening) {
      const ent = entSourceForScreening.find(e => e.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, ""));
      if (ent && !screening.sanctions.data && !screening.sanctions.loading) {
        launchScreening(ent);
      }
    }

    // P6-18: Check gel des avoirs in background — add .catch() to prevent unhandled rejection
    checkGelAvoirs(result.siren, result.dirigeant).then(gel => {
      if (gel.matched) {
        setGelAvoirsAlert(gel.matches);
        toast.error("ALERTE : Entite trouvee dans le registre des gels d'avoirs !");
      } else {
        setGelAvoirsAlert([]);
      }
    }).catch(() => {
      console.warn("[GelAvoirs] Service indisponible");
      setGelAvoirsAlert([]);
    });

    setSelectedResult(result);

    // Find matching enterprise data for enrichment (use passed results to avoid stale state)
    const entSource = enterpriseResults ?? screening.enterprise.data;
    const entData = entSource?.find(
      e => e.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, "")
    );
    if (entData) setSelectedEnterprise(entData);

    // Populate form with enriched data
    // FIX 6: Apply forme juridique label from code if needed
    const rawForme = entData?.forme_juridique ?? result.forme_juridique ?? "";
    const rawFormeCode = (entData as any)?.forme_juridique_code ?? "";
    const resolvedForme = rawFormeCode ? getFormeJuridiqueLabel(rawFormeCode) : rawForme;
    const formeMatch = FORMES.find(f =>
      f === resolvedForme ||
      f === rawForme ||
      (result.forme_juridique_raw || "").toUpperCase().includes(f) ||
      resolvedForme.toUpperCase().includes(f)
    );

    const newAutoFields = new Set<string>();
    const updates: Record<string, unknown> = {};

    const autoSet = (key: string, val: string | number | undefined) => {
      if (val && val !== "" && val !== 0) {
        updates[key] = val;
        newAutoFields.add(key);
      }
    };

    autoSet("siren", result.siren);
    autoSet("siret", entData?.siret);
    autoSet("raisonSociale", result.raison_sociale);
    autoSet("forme", formeMatch || entData?.forme_juridique || result.forme_juridique);
    autoSet("adresse", entData?.adresse || result.adresse);
    autoSet("cp", entData?.code_postal || result.code_postal);
    autoSet("ville", entData?.ville || result.ville);
    autoSet("ape", result.ape);
    autoSet("domaine", entData?.libelle_ape || result.libelle_ape);
    autoSet("capital", entData?.capital || result.capital);
    autoSet("dateCreation", result.date_creation);
    autoSet("effectif", result.effectif);
    autoSet("dirigeant", entData?.dirigeants ? pickPrincipalDirigeant(entData.dirigeants) : result.dirigeant);
    // Enriched Pappers fields
    autoSet("tel", entData?.telephone);
    autoSet("mail", entData?.email);
    autoSet("siteWeb", entData?.site_web);

    if (entData?.capital_source) setCapitalSource(entData.capital_source);

    setForm(prev => ({ ...prev, ...updates }));
    // P6-19: Merge auto fields instead of replacing — preserves INPI auto fields set later
    setAutoFields(prev => new Set([...prev, ...newAutoFields]));

    // CORRECTION 3: Track provenance from enterprise-lookup (Annuaire + Pappers)
    const now = new Date().toISOString();
    const src = (entData?.capital_source === "Pappers" ? "Pappers" : "AnnuaireEntreprises") as DataProvenance["source"];
    const provEntries: DataProvenance[] = [];
    if (result.siren) provEntries.push({ field: "siren", value: result.siren, source: "AnnuaireEntreprises", retrievedAt: now, confidence: "single_source" });
    if (result.raison_sociale) provEntries.push({ field: "denomination", value: result.raison_sociale, source: "AnnuaireEntreprises", retrievedAt: now, confidence: "single_source" });
    if (entData?.capital && entData.capital > 0) provEntries.push({ field: "capital", value: entData.capital, source: src, retrievedAt: now, confidence: "single_source" });
    if (entData?.telephone) provEntries.push({ field: "telephone", value: entData.telephone, source: "Pappers", retrievedAt: now, confidence: "single_source" });
    if (entData?.email) provEntries.push({ field: "email", value: entData.email, source: "Pappers", retrievedAt: now, confidence: "single_source" });
    setDataProvenance(prev => [...prev, ...provEntries]);

    // Parse beneficiaires from enriched data (Pappers via enterprise-lookup)
    const enrichedBE = entData?.beneficiaires_effectifs;
    if (enrichedBE && enrichedBE.length > 0) {
      const parsed: Beneficiaire[] = enrichedBE.map(b => ({
        nom: b.nom || "",
        prenom: b.prenom || "",
        dateNaissance: b.date_naissance || "",
        nationalite: b.nationalite || "Francaise",
        pourcentage: b.pourcentage_parts || 0,
        pourcentageVotes: b.pourcentage_votes || 0,
      }));
      setBeneficiaires(parsed);
    } else if (result.beneficiaires_details && result.beneficiaires_details.length > 0) {
      const parsed: Beneficiaire[] = result.beneficiaires_details.map(b => ({
        nom: b.nom || "",
        prenom: b.prenom || "",
        dateNaissance: b.date_de_naissance || "",
        nationalite: b.nationalite || "Francaise",
        pourcentage: b.pourcentage_parts || 0,
        pourcentageVotes: b.pourcentage_votes || 0,
      }));
      setBeneficiaires(parsed);
    } else if (result.beneficiaires_effectifs) {
      const parts = result.beneficiaires_effectifs.split(/[,/]/).map(s => s.trim()).filter(Boolean);
      const parsed: Beneficiaire[] = parts.map(p => {
        const match = p.match(/^(.+?)\s*\((\d+)%?\)$/);
        if (match) {
          const names = match[1].trim().split(" ");
          return {
            nom: names.slice(-1)[0] || "",
            prenom: names.slice(0, -1).join(" ") || "",
            dateNaissance: "",
            nationalite: "Francaise",
            pourcentage: parseInt(match[2], 10),
          };
        }
        return { nom: p, prenom: "", dateNaissance: "", nationalite: "Francaise", pourcentage: 0 };
      });
      setBeneficiaires(parsed);
    }

    // FIX 2: Fallback BE — deduce from legal form when no BE found
    if (
      !enrichedBE?.length &&
      !result.beneficiaires_details?.length &&
      !result.beneficiaires_effectifs &&
      (result.dirigeant || entData?.dirigeant)
    ) {
      const forme = (formeMatch || entData?.forme_juridique || result.forme_juridique || "").toUpperCase();
      const isAssocieUnique = forme.includes("SASU") || forme.includes("EURL") || forme.includes("INDIVIDUEL") || forme.includes("EI");

      if (isAssocieUnique) {
        // Associe unique → dirigeant = BE a 100%
        const dir = entData?.dirigeant || result.dirigeant || "";
        const names = dir.split(" ");
        setBeneficiaires([{
          nom: names[0] || "",
          prenom: names.slice(1).join(" ") || "",
          dateNaissance: "",
          nationalite: "Francaise",
          pourcentage: 100,
          pourcentageVotes: 100,
        }]);
      } else {
        // Plusieurs dirigeants possibles (SAS, SARL, etc.) → pre-remplir avec % a 0 pour saisie manuelle
        const dirigeantsList = entData?.dirigeants ?? [];
        if (dirigeantsList.length > 0) {
          setBeneficiaires(dirigeantsList.map((d: any) => ({
            nom: d.nom || "",
            prenom: d.prenom || "",
            dateNaissance: d.date_naissance || "",
            nationalite: d.nationalite || "Francaise",
            pourcentage: 0,
            pourcentageVotes: 0,
          })));
        }
      }
    }

    // Auto-add Pappers docs
    if (result.documents_disponibles?.length) {
      const pDocs: UploadedDoc[] = result.documents_disponibles.map(d => ({
        name: d.type,
        type: d.type,
        fromPappers: true,
        url: d.url,
      }));
      setDocuments(prev => [...prev.filter(d => !d.fromPappers), ...pDocs]);
    }
  };

  // Step 3: beneficiaires management
  const addBeneficiaire = () => {
    setBeneficiaires(prev => [...prev, { nom: "", prenom: "", dateNaissance: "", nationalite: "Francaise", pourcentage: 0 }]);
  };
  const updateBeneficiaire = (idx: number, field: keyof Beneficiaire, val: string | number) => {
    setBeneficiaires(prev => prev.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  };
  const removeBeneficiaire = (idx: number) => {
    setBeneficiaires(prev => prev.filter((_, i) => i !== idx));
  };

  // #22: Screen each BE via OpenSanctions
  const screenBeneficiaires = useCallback((bList: Beneficiaire[]) => {
    bList.forEach(b => {
      if (!b.nom || b.nom.length < 2) return;
      const key = `${b.nom}-${b.prenom}`;
      if (beScreening[key]) return; // already screened
      setBeScreening(prev => ({ ...prev, [key]: "loading" }));
      checkSanctions([{ nom: b.nom, prenom: b.prenom, dateNaissance: b.dateNaissance, nationalite: b.nationalite }])
        .then(result => {
          setBeScreening(prev => ({ ...prev, [key]: result.hasCriticalMatch || result.hasPPE ? "match" : "clean" }));
          if (result.hasCriticalMatch) toast.error(`ALERTE : ${b.prenom} ${b.nom} — match sanctions`);
          if (result.hasPPE) toast.warning(`PPE detectee : ${b.prenom} ${b.nom}`);
        })
        .catch(() => setBeScreening(prev => ({ ...prev, [key]: "error" })));
    });
  }, [beScreening]);

  // Auto-screen BE when they are first set
  useEffect(() => {
    if (beneficiaires.length > 0 && step === 2) {
      screenBeneficiaires(beneficiaires);
    }
  }, [beneficiaires.length, step]);

  // Step 4: question update
  const updateQuestion = (idx: number, field: "value" | "commentaire", val: string) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  // Step 6: file upload
  // FIX 16: File size limit (10 MB)
  // FIX 17: File type validation (PDF, images, common doc formats)
  const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".doc", ".docx", ".xls", ".xlsx"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    // FIX 50: Extended type detection with more keywords
    const typeMap: Record<string, string> = {
      kbis: "KBIS", extrait: "KBIS", statuts: "Statuts", statut: "Statuts",
      cni: "CNI", identite: "CNI", passeport: "CNI", carte_identite: "CNI",
      rib: "RIB", iban: "RIB", releve: "RIB",
      justificatif: "Justificatif", domicile: "Justificatif", edf: "Justificatif",
      organigramme: "Organigramme", bilan: "Comptes annuels", comptes: "Comptes annuels",
      pv: "PV AG", assemblee: "PV AG",
    };
    const validFiles: File[] = [];
    for (const f of Array.from(files)) {
      // FIX 16: Reject files > 10 MB
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`Fichier "${f.name}" trop volumineux (max 10 Mo)`);
        continue;
      }
      // FIX 17: Validate file extension
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Type de fichier non autorise : ${ext} (${f.name})`);
        continue;
      }
      validFiles.push(f);
    }
    const newDocs: UploadedDoc[] = validFiles.map(f => {
      const lower = f.name.toLowerCase();
      const detectedType = Object.entries(typeMap).find(([k]) => lower.includes(k))?.[1] || "Autre";
      return { name: f.name, type: detectedType, file: f };
    });
    if (newDocs.length > 0) setDocuments(prev => [...prev, ...newDocs]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const removeDocument = (idx: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  // Final submission
  const handleSubmit = async () => {
    // FIX 18: Prevent double submission
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
    // FIX 21: Validate motifRefus when decision is REFUSER
    if (decision === "REFUSER" && !motifRefus.trim()) {
      toast.error("Le motif de refus est obligatoire");
      setIsSubmitting(false);
      return;
    }
    // FIX P4-27: Warn if essential documents are missing (non-blocking)
    const autoDocs = [
      ...(screening.documents.data?.documents ?? []),
      ...(screening.inpi.data?.documents ?? []),
    ];
    const hasKbis = autoDocs.some(d => d.type?.toUpperCase().includes("KBIS") && (d.storedInSupabase || d.status === "auto"));
    const hasStatuts = autoDocs.some(d => d.type?.toUpperCase().includes("STATUT") && (d.storedInSupabase || d.status === "auto"));
    if (!hasKbis && !hasStatuts && form.forme !== "ENTREPRISE INDIVIDUELLE") {
      toast.warning("Attention : ni le Kbis ni les Statuts n'ont ete recuperes automatiquement. Verifiez les documents.");
    }

    // FIX 10: Check for duplicate SIREN before creating
    const existingSiren = clients.find(c => c.siren?.replace(/\s/g, "") === form.siren?.replace(/\s/g, ""));
    if (existingSiren) {
      toast.warning(`Ce client existe deja : ${existingSiren.raisonSociale} — Ref. ${existingSiren.ref}`);
      setIsSubmitting(false);
      return;
    }
    const now = new Date().toISOString().split("T")[0];
    const year = new Date().getFullYear().toString().slice(-2);

    // #19: Ref auto-increment from Supabase (with local fallback)
    let nextNum: number;
    try {
      const dbClients = await clientsService.getAll();
      if (dbClients && dbClients.length > 0) {
        const dbNums = dbClients.map((c: any) => {
          const match = (c.ref || "").match(/CLI-\d{2}-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        nextNum = (dbNums.length > 0 ? Math.max(...dbNums) : 0) + 1;
      } else {
        // Fallback to local
        const existingNums = clients.map(c => {
          const match = c.ref.match(/CLI-\d{2}-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
      }
    } catch {
      // Fallback to local calculation
      const existingNums = clients.map(c => {
        const match = c.ref.match(/CLI-\d{2}-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    }
    const ref = `CLI-${year}-${String(nextNum).padStart(3, "0")}`;
    // Idée 9: Date butoir auto-calculated based on vigilance level from today
    const dateButoir = calculateDateButoir(risk.nivVigilance);

    // #20: Store BE as JSON to preserve full data (nom, prenom, dateNaissance, nationalite, pourcentage)
    const beStr = JSON.stringify(beneficiaires.filter(b => b.nom));

    const etat = decision === "REFUSER" ? "REFUSE" : decision === "ACCEPTER_RESERVE" ? "EN COURS" : "VALIDE";

    const newClient: Client = {
      ref,
      etat: etat as Client["etat"],
      comptable: form.comptable,
      mission: form.mission,
      raisonSociale: form.raisonSociale,
      forme: form.forme,
      adresse: form.adresse,
      cp: form.cp,
      ville: form.ville,
      siren: form.siren,
      capital: form.capital,
      ape: form.ape,
      dirigeant: form.dirigeant,
      domaine: form.domaine,
      effectif: form.effectif,
      tel: form.tel,
      mail: form.mail,
      dateCreation: form.dateCreation,
      dateReprise: form.dateReprise || form.dateCreation,
      honoraires: form.honoraires,
      reprise: form.reprise,
      juridique: form.juridique,
      frequence: form.frequence,
      iban: form.iban,
      bic: form.bic,
      associe: form.associe,
      superviseur: form.superviseur,
      ppe: riskFlags.ppe ? "OUI" : "NON" as OuiNon,
      paysRisque: riskFlags.paysRisque ? "OUI" : "NON" as OuiNon,
      atypique: riskFlags.atypique ? "OUI" : "NON" as OuiNon,
      distanciel: riskFlags.distanciel ? "OUI" : "NON" as OuiNon,
      cash: riskFlags.cash ? "OUI" : "NON" as OuiNon,
      pression: riskFlags.pression ? "OUI" : "NON" as OuiNon,
      ...risk,
      scoreGlobal: adjustedScore,
      dateCreationLigne: now,
      dateDerniereRevue: now,
      dateButoir,
      etatPilotage: getPilotageStatus(dateButoir) as EtatPilotage,
      dateExpCni: "",
      statut: "ACTIF",
      be: beStr,
      dateFin: form.dateFin || undefined,
      // CORRECTION 3: Store provenance
      dataProvenance: dataProvenance.length > 0 ? dataProvenance : undefined,
      // CORRECTION 6: RGPD flag
      nonDiffusible: screening.inpi.data?.companyData?.nonDiffusible ?? false,
      // CORRECTION 1: Person type
      typePersonne: screening.inpi.data?.companyData?.typePersonne,
    };

    // Force RENFORCEE if gel des avoirs matched
    if (gelAvoirsAlert.length > 0) {
      newClient.nivVigilance = "RENFORCEE";
      newClient.scoreGlobal = Math.max(newClient.scoreGlobal, 100);
    }

    // CORRECTION 7: Apply AML structural malus
    const amlMalus = amlSignals.reduce((sum, s) => sum + s.malus, 0);
    if (amlMalus > 0) {
      newClient.scoreGlobal = Math.min(newClient.scoreGlobal + amlMalus, 120);
      if (newClient.scoreGlobal >= 60) newClient.nivVigilance = "RENFORCEE";
      else if (newClient.scoreGlobal >= 25) newClient.nivVigilance = "STANDARD";
    }

    addClient(newClient);

    // P5-3: Clear draft AFTER successful addClient (was before, losing data on failure)
    sessionStorage.removeItem("draft_nouveau_client");
    const cleanSirenDraft = form.siren?.replace(/\s/g, "");
    if (cleanSirenDraft && cleanSirenDraft.length === 9) sessionStorage.removeItem(`draft_nc_${cleanSirenDraft}`);

    // FIX 22: Store motifRefus in audit trail when client is refused
    if (decision === "REFUSER" && motifRefus.trim()) {
      try {
        const { logAudit } = await import("@/lib/auth/auditTrail");
        await logAudit({
          action: "REFUS_CLIENT",
          table_name: "clients",
          record_id: ref,
          new_data: { motifRefus: motifRefus.trim(), raisonSociale: form.raisonSociale, siren: form.siren },
        });
      } catch {
        // Non-blocking
      }
    }

    // FIX 14: Upload manual documents to Supabase storage
    const manualDocs = documents.filter(d => d.file);
    if (manualDocs.length > 0) {
      const cleanSirenForStorage = form.siren?.replace(/\s/g, "") || ref;
      for (const doc of manualDocs) {
        if (!doc.file) continue;
        try {
          const ext = doc.file.name.split(".").pop() || "pdf";
          const safeType = doc.type.replace(/[^a-zA-Z0-9_-]/g, "_");
          const storagePath = `${cleanSirenForStorage}/${safeType}_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("kyc-documents")
            .upload(storagePath, doc.file, {
              contentType: doc.file.type || "application/octet-stream",
              upsert: true,
            });
          if (uploadErr) {
            logger.error(`[Submit] Upload failed for ${doc.name}:`, uploadErr.message);
          } else {
            logger.debug(`[Submit] Uploaded ${doc.name} → ${storagePath}`);
          }
        } catch (err) {
          logger.error(`[Submit] Upload error for ${doc.name}:`, err);
        }
      }
    }

    // #25: Refresh clients from Supabase after creation
    refreshClients().catch(() => {});

    // Idee 27: Auto-generate fiche PDF in background
    try {
      generateFicheAcceptation(newClient);
      toast.success("Fiche LCB-FT generee automatiquement");
    } catch {
      toast.warning("Erreur lors de la generation automatique de la fiche PDF");
    }

    // Idee 28: Show success modal instead of navigating directly
    setCreatedClientRef(ref);
    setShowSuccessModal(true);
    } catch (err) {
      logger.error("[Submit] Error:", err);
      toast.error("Erreur lors de la creation du client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = useMemo(() => {
    switch (step) {
      case 0: return true;
      // FIX P4-28: Also validate capital > 0 for non-EI forms
      case 1: {
        const baseValid = !!(form.raisonSociale && form.siren && form.siren.replace(/\s/g, "").length === 9 && form.forme && form.ape && form.dirigeant && form.adresse && form.cp && form.ville);
        const needsCapital = form.forme !== "ENTREPRISE INDIVIDUELLE" && form.forme !== "ASSOCIATION";
        return baseValid && (!needsCapital || form.capital > 0);
      }
      case 2: return true;
      case 3: return questionsValid;
      case 4: return decision !== "";
      case 5: return true;
      default: return true;
    }
  }, [step, form, questionsValid, decision]);

  // Validation errors for step 2
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (step >= 1) {
      if (!form.raisonSociale) errors.raisonSociale = "Obligatoire";
      if (!form.siren || form.siren.replace(/\s/g, "").length !== 9) errors.siren = "Le SIREN doit comporter 9 chiffres";
      // P5-7: Accept French (0X) and international (+33X) formats, strip spaces/dots/dashes
      if (form.tel) {
        const cleanTel = form.tel.replace(/[\s.\-()]/g, "");
        if (!/^(0\d{9}|\+\d{10,14})$/.test(cleanTel)) errors.tel = "Format: 0XXXXXXXXX ou +33XXXXXXXXX";
      }
      if (form.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail)) errors.mail = "Email invalide";
      // FIX P4-30: Accept international IBANs (15-34 chars), validate format
      if (form.iban) {
        const cleanIban = form.iban.replace(/\s/g, "").toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban)) {
          errors.iban = "IBAN invalide (ex: FR76 XXXX ...)";
        }
      }
    }
    return errors;
  }, [step, form]);

  // Idée 6: Average honoraires for same mission type
  const avgHonoraires = useMemo(() => {
    const sameMission = clients.filter(c => c.mission === form.mission && c.honoraires > 0);
    if (sameMission.length === 0) return null;
    const avg = Math.round(sameMission.reduce((sum, c) => sum + c.honoraires, 0) / sameMission.length);
    return avg;
  }, [clients, form.mission]);

  // Idée 13: Alert société récente (< 12 mois)
  const societeRecenteAlert = useMemo(() => {
    if (!form.dateCreation) return null;
    const created = new Date(form.dateCreation);
    // P5-23: Guard against invalid date
    if (isNaN(created.getTime())) return null;
    const now = new Date();
    const diffMonths = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (diffMonths >= 0 && diffMonths < 12) return diffMonths;
    return null;
  }, [form.dateCreation]);

  // Idée 15: Alert effectif zéro + CA > 500k
  const effectifZeroCaAlert = useMemo(() => {
    const financials = screening.inpi.data?.financials;
    if (!financials || financials.length === 0) return null;
    const latestCA = financials[0]?.chiffreAffaires;
    const effectif = form.effectif || "";
    // P5-8: More robust zero-employee detection (old: includes("0") matched "10", "20", "100", etc.)
    const hasZeroEmployees = /^0\b|^0 |AUCUN|NEANT/i.test(effectif.trim()) || effectif.trim() === "0";
    if (hasZeroEmployees && latestCA && latestCA > 500000) {
      return latestCA;
    }
    return null;
  }, [screening.inpi.data?.financials, form.effectif]);

  // Idée 14: Alert capital bas (< 500€) for SAS/SARL only
  const capitalBasAlert = useMemo(() => {
    if (form.capital > 0 && form.capital < 500) {
      const f = form.forme.toUpperCase();
      const isEI = f.includes("INDIVIDUEL") || f.includes("EI") || f.includes("AUTO");
      if (!isEI) return form.capital;
    }
    return null;
  }, [form.capital, form.forme]);

  // Idée 17: Address divergence INPI vs Annuaire
  const addressDivergence = useMemo(() => {
    const inpiAddr = screening.inpi.data?.companyData?.adresse;
    if (!inpiAddr || !selectedEnterprise) return null;
    const inpiFull = normalizeAddress([inpiAddr.numVoie, inpiAddr.typeVoie, inpiAddr.voie, inpiAddr.codePostal, inpiAddr.commune].filter(Boolean).join(" "));
    const annuaireFull = normalizeAddress([selectedEnterprise.adresse, selectedEnterprise.code_postal, selectedEnterprise.ville].filter(Boolean).join(" "));
    if (inpiFull && annuaireFull && inpiFull !== annuaireFull) {
      return {
        inpi: [inpiAddr.numVoie, inpiAddr.typeVoie, inpiAddr.voie, inpiAddr.codePostal, inpiAddr.commune].filter(Boolean).join(" "),
        annuaire: [selectedEnterprise.adresse, selectedEnterprise.code_postal, selectedEnterprise.ville].filter(Boolean).join(" "),
      };
    }
    return null;
  }, [screening.inpi.data?.companyData?.adresse, selectedEnterprise]);

  // Idée 16: INPI historique timeline + alert if dirigeant change < 6 months
  const inpiHistorique = screening.inpi.data?.companyData?.historique ?? [];
  const recentDirigeantChange = useMemo(() => {
    if (inpiHistorique.length === 0) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return inpiHistorique.some(evt => {
      const evtDate = new Date(evt.date);
      return evtDate >= sixMonthsAgo && (evt.type.toLowerCase().includes("dirigeant") || evt.description.toLowerCase().includes("dirigeant"));
    });
  }, [inpiHistorique]);

  // CORRECTION 1: Detect if EI/personne physique for adapted form labels
  const isPersonnePhysique = screening.inpi.data?.companyData?.typePersonne === "physique";

  // Idee 30: Dynamic doc checklist per vigilance level
  // FIX 43: Vigilance-level checklist — STANDARD adds Justificatif, RENFORCEE adds more
  // FIX P4-31: Adapt checklist for EI (no KBIS/Statuts needed)
  const vigilanceDocChecklist = useMemo(() => {
    const isEI = isPersonnePhysique || form.forme === "ENTREPRISE INDIVIDUELLE";
    const base = isEI ? [
      { key: "KBIS", label: "Extrait RNE / Avis SIRENE", types: ["KBIS", "EXTRAIT", "SIRENE"] },
      { key: "CNI", label: "CNI entrepreneur", types: ["CNI", "IDENTITE", "PASSEPORT"] },
      { key: "RIB", label: "RIB / IBAN", types: ["RIB"] },
    ] : [
      { key: "KBIS", label: "Extrait Kbis / RNE", types: ["KBIS", "EXTRAIT"] },
      { key: "Statuts", label: "Statuts a jour", types: ["STATUTS", "STATUT"] },
      { key: "CNI", label: "CNI dirigeant", types: ["CNI", "IDENTITE", "PASSEPORT"] },
      { key: "RIB", label: "RIB / IBAN", types: ["RIB"] },
    ];
    if (risk.nivVigilance === "STANDARD" || risk.nivVigilance === "RENFORCEE") {
      base.push({ key: "Justificatif", label: "Justificatif domicile", types: ["JUSTIFICATIF", "DOMICILE"] });
    }
    if (risk.nivVigilance === "RENFORCEE") {
      base.push({ key: "Comptes", label: "Comptes annuels", types: ["COMPTES", "BILAN"] });
      base.push({ key: "PV", label: "PV d'AG / Actes", types: ["PV", "ACTE"] });
      base.push({ key: "Organigramme", label: "Organigramme", types: ["ORGANIGRAMME"] });
    }
    return base;
  }, [risk.nivVigilance, isPersonnePhysique, form.forme]);

  // Idee 24: Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step > 0) setStep(s => s - 1);
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const active = document.activeElement;
        if (active && (active.tagName === "TEXTAREA")) return;
        if (active && active.tagName === "INPUT") {
          e.preventDefault();
          if (step < 5 && canGoNext) setStep(s => s + 1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, canGoNext]);

  // Idee 22: Helper to get source type for a field
  const getFieldSource = useCallback((fieldName: string): "INPI" | "AnnuaireEntreprises" | null => {
    if (!autoFields.has(fieldName)) return null;
    const prov = dataProvenance.find(p => {
      const fieldMap: Record<string, string[]> = {
        raisonSociale: ["denomination"], siren: ["siren"], adresse: ["adresse"],
        cp: ["codePostal"], ville: ["commune"], capital: ["capital"],
        dirigeant: ["dirigeant"], domaine: ["domaine"], ape: ["ape"],
        tel: ["telephone"], mail: ["email"],
      };
      return (fieldMap[fieldName] || [fieldName]).includes(p.field);
    });
    if (prov?.source === "INPI") return "INPI";
    if (prov?.source === "AnnuaireEntreprises" || prov?.source === "Pappers") return "AnnuaireEntreprises";
    return null;
  }, [autoFields, dataProvenance]);

  // #98: Improved badge colors for vigilance levels
  const vigilanceColor = risk.nivVigilance === "SIMPLIFIEE" ? "#10b981" : risk.nivVigilance === "STANDARD" ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Nouveau Client</h1>
          <p className="text-sm text-slate-500 mt-0.5">Parcours d'entree en relation</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Idee 18: KYC progress bar */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                specO90Kyc.percent === 100
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
              }`}>
                <span className={`text-xs font-bold ${specO90Kyc.percent === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                  KYC {specO90Kyc.percent}%
                </span>
                <Progress value={specO90Kyc.percent} className="w-16 h-1.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-slate-900 border-white/10">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Champs obligatoires SPEC_O90</h4>
              <p className="text-[10px] text-slate-500 mb-3">{specO90Kyc.filled}/{specO90Kyc.total} remplis</p>
              {specO90Kyc.missing.length > 0 ? (
                <ul className="space-y-1">
                  {specO90Kyc.missing.map(m => (
                    <li key={m} className="flex items-center gap-2 text-xs text-amber-400">
                      <X className="w-3 h-3 shrink-0" /> {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Tous les champs sont remplis</p>
              )}
            </PopoverContent>
          </Popover>
          <ScoreGauge score={adjustedScore} />
          <VigilanceBadge level={risk.nivVigilance} />
          {(() => {
            const reasons: string[] = [];
            if (riskFlags.ppe) reasons.push("PPE");
            if (riskFlags.paysRisque) reasons.push("Pays risque");
            if (riskFlags.atypique) reasons.push("Atypique");
            if (risk.scoreActivite > 60) reasons.push("Score activite > 60");
            if (gelAvoirsAlert.length > 0) reasons.push("Gel avoirs");
            if (reasons.length > 0 && risk.nivVigilance === "RENFORCEE") {
              return <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Force : {reasons.join(", ")}</Badge>;
            }
            return null;
          })()}
        </div>
      </div>

      {/* FIX 2: Draft restored banner */}
      {draftBanner && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">
              Brouillon restaure — derniere modification il y a {(() => {
                const diff = Date.now() - new Date(draftBanner.restoredAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return "quelques secondes";
                if (mins < 60) return `${mins} min`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours}h`;
                return `${Math.floor(hours / 24)}j`;
              })()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={() => {
              const cleanSiren = form.siren?.replace(/\s/g, "");
              sessionStorage.removeItem("draft_nouveau_client");
              if (cleanSiren && cleanSiren.length === 9) {
                sessionStorage.removeItem(`draft_nc_${cleanSiren}`);
              }
              setDraftBanner(null);
              toast.success("Brouillon supprime");
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Supprimer le brouillon
          </Button>
        </div>
      )}

      {/* FIX 46: Improved stepper with animated transitions + #72: Connected line + #73: Checkmarks */}
      <div className="glass-card p-4 shadow-lg">
        {/* #75: Estimated completion time */}
        <div className="flex items-center justify-end gap-1.5 mb-2">
          <Clock className="w-3 h-3 text-slate-600" />
          <span className="text-[9px] text-slate-600">
            ~{[2, 3, 2, 3, 1, 2][step]} min restante(s) pour cette etape
          </span>
        </div>
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => i <= step && setStep(i)}
              aria-label={`Etape ${i + 1}: ${label}${i < step ? " (complétée)" : i === step ? " (en cours)" : ""}`}
              aria-current={i === step ? "step" : undefined}
              disabled={i > step}
              className={`flex items-center gap-2 transition-opacity ${i <= step ? "cursor-pointer opacity-100" : "cursor-default opacity-50"}`}
            >
              {/* #73: Completion checkmarks + #97: Shadow on active */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                i < step ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-90" :
                i === step ? "bg-blue-500 text-white ring-4 ring-blue-500/20 shadow-xl shadow-blue-500/30 scale-110" :
                "bg-white/[0.06] text-slate-500"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline transition-colors ${
                i < step ? "text-emerald-400" : i === step ? "text-slate-200" : "text-slate-600"
              }`}>{label}</span>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 lg:w-16 h-0.5 mx-2 rounded-full transition-colors duration-300 ${i < step ? "bg-emerald-500" : "bg-white/[0.06]"}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* #90: Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-fade-in-up">
          <WifiOff className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">Connexion perdue — les recherches API ne sont pas disponibles</span>
        </div>
      )}

      {/* Step content */}
      <div className={`glass-card p-6 transition-all duration-300 ${fieldsVisible ? "opacity-100 translate-y-0" : stepDirection === "right" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4"}`} style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
        {/* STEP 0: SEARCH */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Recherche de l'entreprise</h2>
                <p className="text-sm text-slate-500">Recherchez par SIREN, nom de societe ou dirigeant via l'API Pappers</p>
              </div>
              {/* #5: Creation manuelle shortcut */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-white/[0.06] text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-200 hover:scale-[1.02]"
                onClick={() => setStep(1)}
              >
                <Plus className="w-3.5 h-3.5" /> Creation manuelle
              </Button>
            </div>

            {/* #4: Search mode tabs with icons */}
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06] w-fit">
              {([
                { value: "siren", icon: Hash, label: "SIREN" },
                { value: "nom", icon: Building2, label: "Nom societe" },
                { value: "dirigeant", icon: User, label: "Dirigeant" },
              ] as const).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSearchMode(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    searchMode === tab.value
                      ? "bg-blue-500/20 text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={e => {
                    let val = e.target.value;
                    // FIX P4-40: Auto-format SIREN with spaces (123 456 789)
                    const digitsOnly = val.replace(/[^\d]/g, "");
                    if (/^\d+$/.test(digitsOnly) && digitsOnly.length <= 14) {
                      val = digitsOnly.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
                    }
                    setSearchQuery(val);
                    setShowSearchHistory(val.length === 0);
                    // #11: Auto-detect SIREN vs company name
                    const trimmed = val.trim().replace(/\s/g, "");
                    if (/^\d+$/.test(trimmed) && searchMode !== "dirigeant") {
                      setSearchMode("siren");
                    } else if (/[a-zA-ZÀ-ÿ]/.test(trimmed) && searchMode === "siren") {
                      setSearchMode("nom");
                    }
                  }}
                  onFocus={() => { if (!searchQuery && searchHistory.length > 0) setShowSearchHistory(true); }}
                  onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder={(() => {
                    const items = PLACEHOLDERS[searchMode];
                    return items[placeholderIdx % items.length];
                  })()}
                  className="pl-9 pr-9 bg-white/[0.03] border-white/[0.06] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                />
                {/* #3: Clear button */}
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchError(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {/* #2: Search history dropdown */}
                {showSearchHistory && searchHistory.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-slate-900 border border-white/[0.1] rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
                      <History className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Recherches recentes</span>
                    </div>
                    {searchHistory.map((h, i) => (
                      <button
                        key={i}
                        onMouseDown={() => { setSearchQuery(h); setShowSearchHistory(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                      >
                        <Clock className="w-3 h-3 text-slate-600" /> {h}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSearch} disabled={searchLoading || screeningRunning || !searchQuery.trim() || !isOnline} className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1.5">Recuperer</span>
              </Button>
            </div>
            {/* #8: Keyboard shortcut hint */}
            <p className="text-[10px] text-slate-600 -mt-4 flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-500 font-mono text-[9px]">Entree</kbd> pour rechercher
              {searchMode === "siren" && <span className="text-slate-600 ml-2">Format: 9 chiffres</span>}
            </p>

            {/* #6: Loading skeleton cards */}
            {searchLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 w-48 bg-white/[0.06] rounded" />
                        <div className="h-3 w-32 bg-white/[0.04] rounded" />
                      </div>
                      <div className="h-8 w-8 bg-white/[0.04] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchError && !searchLoading && (
              <div className="p-6 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                {/* #10: Empty state illustration */}
                <Search className="w-10 h-10 mx-auto mb-3 text-red-400/30" />
                <p className="text-sm text-red-400 font-medium">{searchError}</p>
                <p className="text-xs text-red-400/60 mt-1">Verifiez l'orthographe ou essayez un autre mode de recherche</p>
              </div>
            )}

            {gelAvoirsAlert.length > 0 && (
              <div className="p-4 rounded-lg bg-red-500/15 border-2 border-red-500/40">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-bold text-red-400">ALERTE : Registre des gels d'avoirs du Tresor</span>
                </div>
                {gelAvoirsAlert.map((msg, i) => (
                  <p key={i} className="text-xs text-red-300 ml-7">{msg}</p>
                ))}
                <p className="text-xs text-red-400 mt-2 ml-7 font-semibold">Vigilance RENFORCEE obligatoire — Validation du referent LCB requise</p>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-400">{duplicateWarning}</span>
                </div>
                {duplicateRef && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => navigate(`/client/${duplicateRef}`)}>
                    Voir le client existant <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {searchResults.length > 1 && !searchLoading && (
              <div className="space-y-2">
                {/* #7: Result count badge */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Resultats</Label>
                  <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0">{searchResults.length}</Badge>
                  <span className="text-[10px] text-slate-600">— selectionnez une entreprise</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectPappersResult(r)}
                      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.005] ${
                        selectedResult?.siren === r.siren
                          ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          {/* #9: Highlight matching text */}
                          <span className="font-medium text-sm text-slate-200">
                            {highlightMatch(r.raison_sociale, searchQuery)}
                          </span>
                          <span className="text-slate-500 ml-2 text-xs">({formatSiren(r.siren)})</span>
                        </div>
                        {selectedResult?.siren === r.siren && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{r.forme_juridique_raw} - {r.ville} - APE: {r.ape}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* #8: Screening progress indicator */}
            {(screening.enterprise.loading || screening.enterprise.data || screeningRunning) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{screeningProgress.completedCount}/{screeningProgress.totalCount} APIs terminees</span>
                  {screeningRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
                </div>
                <Progress value={(screeningProgress.completedCount / screeningProgress.totalCount) * 100} className="h-2" />
                {/* #9: Skip screening button */}
                {screeningRunning && (
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors mt-1"
                  >
                    Passer et completer plus tard &rarr;
                  </button>
                )}
              </div>
            )}

            {/* Screening Panel */}
            {(screening.enterprise.loading || screening.enterprise.data || screening.sanctions.loading || screening.sanctions.data) && (
              <ScreeningPanel screening={screening} />
            )}

            {/* CORRECTION 7: AML Structural Signals */}
            {amlSignals.length > 0 && (
              <div className="space-y-2">
                {amlSignals.map((signal, i) => (
                  <div key={i} className={`p-3 rounded-lg flex items-start gap-2 ${
                    signal.severity === "red" ? "bg-red-500/10 border border-red-500/20" :
                    signal.severity === "orange" ? "bg-amber-500/10 border border-amber-500/20" :
                    "bg-blue-500/10 border border-blue-500/20"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                      signal.severity === "red" ? "text-red-400" : signal.severity === "orange" ? "text-amber-400" : "text-blue-400"
                    }`} />
                    <div>
                      <span className={`text-xs font-semibold ${
                        signal.severity === "red" ? "text-red-400" : signal.severity === "orange" ? "text-amber-400" : "text-blue-400"
                      }`}>{signal.message}</span>
                      {signal.malus > 0 && <span className="text-[10px] text-slate-500 ml-2">(malus +{signal.malus})</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CORRECTION 6: RGPD non-diffusion banner */}
            {screening.inpi.data?.companyData?.nonDiffusible && (
              <div className="p-4 rounded-lg bg-amber-500/10 border-2 border-amber-500/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">Donnees soumises a restriction de diffusion</span>
                </div>
                <p className="text-xs text-amber-300 mt-1 ml-7">Art. R.123-320 C.com — Les donnees de cette entreprise ne doivent pas figurer dans les exports CSV ni les rapports partages. Stockage autorise pour obligations LCB-FT (art. L.561-5 CMF).</p>
              </div>
            )}

            {/* Map embed — OpenStreetMap with Nominatim geocoding fallback (#9-11) */}
            {(screening.google.data || form.adresse) && (
              <MapSection
                lat={screening.google.data?.place?.lat ?? null}
                lng={screening.google.data?.place?.lng ?? null}
                adresse={form.adresse}
                cp={form.cp}
                ville={form.ville}
                raisonSociale={form.raisonSociale}
              />
            )}

            {/* Network Graph preview (Probleme 9) */}
            {screening.network.data && screening.network.data.nodes?.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-300">Reseau dirigeants</h3>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {screening.network.data.totalCompanies ?? 0} societe(s), {screening.network.data.totalPersons ?? 0} personne(s) — cliquez un noeud pour plus d'infos
                  </span>
                </div>
                <div className="p-2">
                  <NetworkGraph
                    nodes={screening.network.data.nodes}
                    edges={screening.network.data.edges ?? []}
                    height={350}
                  />
                </div>
                {(screening.network.data.alertes?.length ?? 0) > 0 && (
                  <div className="px-4 py-3 border-t border-white/[0.06] space-y-1">
                    {screening.network.data.alertes.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${a.severity === "red" ? "text-red-400" : "text-amber-400"}`} />
                        <span className={a.severity === "red" ? "text-red-300" : "text-amber-300"}>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedResult && (
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Donnees recuperees</span>
                  <Badge className="border-0 text-[10px] bg-slate-500/20 text-slate-400">{dataSource === "pappers" ? "Pappers" : "data.gouv"}</Badge>
                  {screening.inpi.data?.companyData && <Badge className="border-0 text-[10px] bg-blue-500/20 text-blue-400">INPI</Badge>}
                  {screening.inpi.data?.companyData && capitalSource === "INPI" && <Badge className="border-0 text-[10px] bg-emerald-500/20 text-emerald-400">Verifie</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-slate-500">Raison sociale</span><p className="text-slate-200 font-medium mt-0.5">{selectedResult.raison_sociale}</p></div>
                  <div><span className="text-slate-500">SIREN</span><p className="text-slate-200 font-mono mt-0.5">{formatSiren(selectedResult.siren)}</p></div>
                  <div><span className="text-slate-500">Forme</span><p className="text-slate-200 mt-0.5">{selectedResult.forme_juridique_raw}</p></div>
                  <div><span className="text-slate-500">APE</span><p className="text-slate-200 mt-0.5">{selectedResult.ape} - {selectedResult.libelle_ape}</p></div>
                  <div><span className="text-slate-500">Capital</span><p className="text-slate-200 mt-0.5">{(() => { const cap = selectedEnterprise?.capital || selectedResult.capital || 0; const forme = (selectedResult.forme_juridique_raw || "").toUpperCase(); const isEI = forme.includes("INDIVIDUEL") || forme.includes("EI"); if (isEI && cap === 0) return "N/A"; return cap > 0 ? `${cap.toLocaleString()} EUR` : "Non renseigne"; })()} {capitalSource && (selectedEnterprise?.capital || selectedResult.capital || 0) > 0 && <span className="text-[10px] text-slate-500">({capitalSource})</span>}</p></div>
                  <div><span className="text-slate-500">Dirigeant</span><p className="text-slate-200 mt-0.5">{form.dirigeant || selectedResult.dirigeant || "—"}</p></div>
                  <div><span className="text-slate-500">Ville</span><p className="text-slate-200 mt-0.5">{selectedResult.ville}</p></div>
                  <div><span className="text-slate-500">Creation</span><p className="text-slate-200 mt-0.5">{selectedResult.date_creation ? formatDateFR(selectedResult.date_creation) : "—"}</p></div>
                </div>
                {dataSource !== "pappers" && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/10 flex items-center gap-2 text-xs">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">Documents et BE non disponibles via {dataSource}.</span>
                    <a
                      href={`https://www.pappers.fr/entreprise/${selectedResult.siren.replace(/\s/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline hover:text-blue-300"
                    >
                      Voir sur Pappers.fr
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 1: INFORMATION — FIX 4: Split into 2 sections */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Informations du client</h2>
              {/* #24: Required fields progress bar */}
              {(() => {
                const reqFields = [form.raisonSociale, form.siren, form.forme, form.ape, form.dirigeant, form.adresse, form.cp, form.ville];
                const filled = reqFields.filter(Boolean).length;
                const pct = Math.round((filled / reqFields.length) * 100);
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{filled}/{reqFields.length} obligatoires</span>
                    <Progress value={pct} className="w-20 h-1.5" />
                    <span className={`text-xs font-bold ${pct === 100 ? "text-emerald-400" : "text-amber-400"}`}>{pct}%</span>
                  </div>
                );
              })()}
            </div>

            {/* KYC Completeness indicator */}
            {selectedEnterprise && (
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-300">Completude KYC</span>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const kyc = computeKycCompleteness(selectedEnterprise, screening.documents.data, screening.inpi.data?.documents, documents);
                    return (
                      <>
                        <Progress value={kyc.percent} className="w-32 h-2" />
                        <span className={`text-sm font-bold ${kyc.percent >= 80 ? "text-emerald-400" : "text-amber-400"}`}>{kyc.percent}%</span>
                        {kyc.missing.length > 0 && (
                          <span className="text-[10px] text-slate-500">Manque : {kyc.missing.join(", ")}</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ===== SECTION 1: Identite (collapsible #11) ===== */}
            <Collapsible open={!collapsedSections["identite"]} onOpenChange={open => setCollapsedSections(prev => ({ ...prev, identite: !open }))}>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.03] overflow-hidden">
                <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between hover:bg-blue-500/[0.05] transition-colors">
                  <div className="flex items-center gap-2">
                    {/* #28: Section header with icon */}
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-blue-400">Identite de l'entreprise</h3>
                    {/* #21: Auto-filled badge */}
                    {autoFields.size > 0 && (
                      <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-0 gap-1">
                        <Sparkles className="w-3 h-3" /> {autoFields.size} champ(s) auto-remplis
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${collapsedSections["identite"] ? "-rotate-90" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 pt-2">
                    {/* #27: 3-column grid for short fields */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <div data-error={!!validationErrors.raisonSociale}>
                        <SourceField
                          label={isPersonnePhysique ? "Nom du dirigeant *" : "Raison Sociale *"}
                          value={form.raisonSociale}
                          onChange={v => { set("raisonSociale", sanitizeInput(v)); setTouchedFields(prev => new Set(prev).add("raisonSociale")); }}
                          error={touchedFields.has("raisonSociale") ? validationErrors.raisonSociale : undefined}
                          source={autoFields.has("raisonSociale") ? (screening.inpi.data?.companyData?.denomination ? "INPI" : "data.gouv") : undefined}
                          required
                          isLocked={false}
                          autoFilled={autoFields.has("raisonSociale")}
                        />
                        {/* #12: Field completion check */}
                        {form.raisonSociale && <div className="flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-[9px] text-emerald-400">Rempli</span></div>}
                      </div>
                      <SourceField label="Forme Juridique *" type="select" value={form.forme} options={FORMES} onChange={v => set("forme", v)} source={autoFields.has("forme") ? "INPI" : undefined} required autoFilled={autoFields.has("forme")} />
                      <SourceField label="Dirigeant *" value={form.dirigeant} onChange={v => { set("dirigeant", sanitizeInput(v)); setTouchedFields(prev => new Set(prev).add("dirigeant")); }} source={autoFields.has("dirigeant") ? "data.gouv" : undefined} required autoFilled={autoFields.has("dirigeant")} />
                      {/* #13: SIREN auto-format + #30: Lock when auto-filled */}
                      <div data-error={!!validationErrors.siren}>
                        <SourceField
                          label="SIREN *"
                          value={form.siren}
                          onChange={v => { set("siren", formatSirenInput(v)); setTouchedFields(prev => new Set(prev).add("siren")); }}
                          error={touchedFields.has("siren") ? validationErrors.siren : undefined}
                          placeholder="XXX XXX XXX"
                          source={autoFields.has("siren") ? "data.gouv" : undefined}
                          required
                          isLocked={autoFields.has("siren")}
                          autoFilled={autoFields.has("siren")}
                        />
                      </div>
                      {/* #14: SIRET auto-format */}
                      <SourceField label="SIRET" value={form.siret} onChange={v => set("siret", formatSiretInput(v))} placeholder="XXX XXX XXX XXXXX" source={autoFields.has("siret") ? "data.gouv" : undefined} autoFilled={autoFields.has("siret")} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-slate-500 uppercase">Capital social {form.forme !== "ENTREPRISE INDIVIDUELLE" && <span className="text-red-400">*</span>}</Label>
                          {capitalSource && form.capital > 0 && <Badge className={`text-[9px] border-0 ${capitalSource === "INPI" ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-400"}`}>{capitalSource}</Badge>}
                        </div>
                        <Input type="number" value={form.capital || ""} onChange={e => set("capital", Number(e.target.value))} placeholder="Non renseigne" className={`bg-white/[0.03] mt-1 ${autoFields.has("capital") ? "bg-blue-500/[0.03]" : ""} ${!form.capital ? "border-amber-500/50" : "border-emerald-500/30"}`} />
                        {(() => {
                          const f = form.forme.toUpperCase();
                          const isEI = f.includes("INDIVIDUEL") || f.includes("EI");
                          if (isEI && !form.capital) return <p className="text-[10px] text-slate-500 mt-0.5">N/A (Entreprise individuelle)</p>;
                          if (!form.capital) return <p className="text-[10px] text-amber-400 mt-0.5">Non renseigne — a completer</p>;
                          return null;
                        })()}
                      </div>
                      {/* #19: APE tooltip */}
                      <div>
                        <SourceField label="Code APE *" value={form.ape} onChange={v => set("ape", sanitizeInput(v))} placeholder="Ex: 56.10A" source={autoFields.has("ape") ? "data.gouv" : undefined} required hint={form.domaine ? form.domaine : undefined} autoFilled={autoFields.has("ape")} />
                        {form.ape && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 mt-0.5">
                                <HelpCircle className="w-3 h-3" /> Qu'est-ce que le code APE ?
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 bg-slate-900 border-white/10 text-xs text-slate-300">
                              Le code APE (Activite Principale Exercee) est attribue par l'INSEE. Il determine le score de risque sectoriel dans le calcul LCB-FT.
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      <SourceField label="Domaine d'activite" value={form.domaine} onChange={v => set("domaine", sanitizeInput(v))} source={autoFields.has("domaine") ? "data.gouv" : undefined} autoFilled={autoFields.has("domaine")} />
                      <SourceField label="Effectif" value={form.effectif} onChange={v => set("effectif", sanitizeInput(v))} source={autoFields.has("effectif") ? "data.gouv" : undefined} autoFilled={autoFields.has("effectif")} />
                    </div>

                    {/* Dates row */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                      {/* #26: Date picker */}
                      <div>
                        <SourceField label="Date de creation" value={form.dateCreation} onChange={v => set("dateCreation", v)} type="date" source={autoFields.has("dateCreation") ? "data.gouv" : undefined} autoFilled={autoFields.has("dateCreation")} />
                        {form.dateCreation && <p className="text-[10px] text-slate-500 mt-0.5">{formatDateFR(form.dateCreation)}</p>}
                      </div>
                      {form.dateClotureExercice && (
                        <SourceField label="Date de cloture" value={formatCloture(form.dateClotureExercice)} onChange={v => set("dateClotureExercice", v)} source="INPI" autoFilled />
                      )}
                      {form.duree && (
                        <SourceField label="Duree (ans)" value={form.duree} onChange={v => set("duree", v)} source="INPI" autoFilled />
                      )}
                    </div>

                    {/* #18: Objet social with character count */}
                    {form.objetSocial && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase">Objet social</Label>
                            <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0">INPI</Badge>
                          </div>
                          <span className="text-[9px] text-slate-600">{form.objetSocial.length} caracteres</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 p-2 rounded bg-white/[0.02] border border-white/[0.06]">{form.objetSocial.slice(0, 300)}{form.objetSocial.length > 300 ? "..." : ""}</p>
                      </div>
                    )}

                    {/* INPI badges */}
                    {screening.inpi.data?.companyData && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                        {screening.inpi.data.companyData.capitalVariable && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Capital variable</Badge>}
                        {screening.inpi.data.companyData.ess && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">ESS</Badge>}
                        {screening.inpi.data.companyData.societeMission && <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0">Societe a mission</Badge>}
                        {screening.inpi.data.companyData.associeUnique && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Associe unique</Badge>}
                        {screening.inpi.data.companyData.nonDiffusible && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0">Non diffusible</Badge>}
                        {screening.inpi.data.companyData.domiciliataire && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Domiciliataire</Badge>}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* ===== SECTION 2: Coordonnees (collapsible #11) ===== */}
            <Collapsible open={!collapsedSections["coordonnees"]} onOpenChange={open => setCollapsedSections(prev => ({ ...prev, coordonnees: !open }))}>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.02] overflow-hidden">
                <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between hover:bg-cyan-500/[0.05] transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-cyan-400">Coordonnees</h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${collapsedSections["coordonnees"] ? "-rotate-90" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 pt-2 grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <SourceField label="Adresse *" value={form.adresse} onChange={v => { set("adresse", sanitizeInput(v)); setTouchedFields(prev => new Set(prev).add("adresse")); }} source={autoFields.has("adresse") ? (screening.inpi.data?.companyData ? "INPI" : "data.gouv") : undefined} required autoFilled={autoFields.has("adresse")} />
                    {/* #16: Postal code auto-format */}
                    <SourceField label="Code Postal *" value={form.cp} onChange={v => { set("cp", formatPostalCode(v)); setTouchedFields(prev => new Set(prev).add("cp")); }} source={autoFields.has("cp") ? "INPI" : undefined} required autoFilled={autoFields.has("cp")} />
                    <SourceField label="Ville *" value={form.ville} onChange={v => { set("ville", sanitizeInput(v)); setTouchedFields(prev => new Set(prev).add("ville")); }} source={autoFields.has("ville") ? "INPI" : undefined} required autoFilled={autoFields.has("ville")} />
                    {/* #15: Phone auto-format */}
                    <FormField label="Telephone" value={form.tel} onChange={v => set("tel", formatPhoneInput(v))} error={validationErrors.tel} placeholder="XX XX XX XX XX" isAuto={autoFields.has("tel")} needsCompletion={!!selectedResult && !form.tel} />
                    <FormField label="Email" value={form.mail} onChange={v => set("mail", v)} error={validationErrors.mail} placeholder="email@exemple.fr" isAuto={autoFields.has("mail")} needsCompletion={!!selectedResult && !form.mail} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-slate-500 uppercase">Site web</Label>
                        {autoFields.has("siteWeb") && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
                      </div>
                      <Input value={form.siteWeb} onChange={e => set("siteWeb", e.target.value)} placeholder="https://..." className="bg-white/[0.03] mt-1 border-white/[0.06] focus:ring-2 focus:ring-blue-500/30" />
                      {form.siteWeb && (() => {
                        try {
                          const url = new URL(form.siteWeb.startsWith("http") ? form.siteWeb : `https://${form.siteWeb}`);
                          if (url.protocol !== "http:" && url.protocol !== "https:") return null;
                          return (
                            <a href={url.href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5 inline-flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Ouvrir le site
                            </a>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Alerte société récente */}
            {societeRecenteAlert !== null && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-sm text-orange-400 font-medium">Societe creee il y a {societeRecenteAlert} mois — anciennete inferieure a 12 mois (score maturite : 65)</span>
              </div>
            )}

            {/* Alerte capital bas */}
            {capitalBasAlert !== null && (
              <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">Capital faible ({capitalBasAlert} EUR) pour une {form.forme} — a surveiller</span>
              </div>
            )}

            {/* Alerte effectif zéro + CA élevé */}
            {effectifZeroCaAlert !== null && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-sm text-orange-400 font-medium">CA eleve ({effectifZeroCaAlert.toLocaleString("fr-FR")} EUR) avec effectif a 0 — risque de societe de facturation</span>
              </div>
            )}

            {/* Divergence d'adresse INPI vs Annuaire */}
            {addressDivergence && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <Badge className="text-[9px] bg-orange-500/20 text-orange-400 border-0">Divergence d'adresse</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs ml-6">
                  <div>
                    <span className="text-slate-500">INPI :</span>
                    <p className="text-slate-300 mt-0.5">{addressDivergence.inpi}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Annuaire :</span>
                    <p className="text-slate-300 mt-0.5">{addressDivergence.annuaire}</p>
                  </div>
                </div>
              </div>
            )}

            {/* FIX 54: Improved separator with icon */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.08]" /></div>
              <div className="relative flex justify-center">
                <span className="bg-[hsl(217,33%,12%)] px-4 text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <ChevronDown className="w-3 h-3" /> Informations a completer <ChevronDown className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* ===== SECTION 3: Mission & Equipe (collapsible #11) ===== */}
            <Collapsible open={!collapsedSections["mission"]} onOpenChange={open => setCollapsedSections(prev => ({ ...prev, mission: !open }))}>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.02] overflow-hidden">
                <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between hover:bg-amber-500/[0.05] transition-colors">
                  <div className="flex items-center gap-2">
                    {/* #28: Section header with icon */}
                    <Briefcase className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-400">Mission et equipe</h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${collapsedSections["mission"] ? "-rotate-90" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 pt-2">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField label="Type de mission *" type="select" value={form.mission} options={MISSIONS} onChange={v => set("mission", v)} />
                      <FormField label="Frequence" type="select" value={form.frequence} options={FREQUENCES} onChange={v => set("frequence", v)} />
                      <div>
                        <FormField label="Honoraires HT" value={form.honoraires} onChange={v => set("honoraires", Number(v))} type="number" />
                        {avgHonoraires && (
                          <p className="text-[10px] text-blue-400 mt-0.5 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Moyenne cabinet pour {form.mission} : {avgHonoraires.toLocaleString("fr-FR")} EUR HT/an
                          </p>
                        )}
                      </div>
                      <FormField label="Frais constitution" value={form.reprise} onChange={v => set("reprise", Number(v))} type="number" />
                      <FormField label="Honoraires juridique" value={form.juridique} onChange={v => set("juridique", Number(v))} type="number" />
                      <FormField label="IBAN" value={form.iban} onChange={v => set("iban", v)} error={validationErrors.iban} placeholder="FR76..." autoComplete="off" />
                      <FormField label="BIC" value={form.bic} onChange={v => set("bic", v)} placeholder="BNPAFRPP" autoComplete="off" />
                      <FormField label="Date de reprise" value={form.dateReprise} onChange={v => set("dateReprise", v)} type="date" />
                      <FormField label="Date de fin (optionnel)" value={form.dateFin} onChange={v => set("dateFin", v)} type="date" />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* ===== SECTION 4: Equipe (collapsible #11) ===== */}
            <Collapsible open={!collapsedSections["equipe"]} onOpenChange={open => setCollapsedSections(prev => ({ ...prev, equipe: !open }))}>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.02] overflow-hidden">
                <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between hover:bg-violet-500/[0.05] transition-colors">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-violet-400">Equipe assignee</h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${collapsedSections["equipe"] ? "-rotate-90" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 pt-2 grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField label="Comptable assigne *" type="select" value={form.comptable} options={COMPTABLES} onChange={v => set("comptable", v)} />
                    <FormField label="Associe signataire *" type="select" value={form.associe} options={ASSOCIES} onChange={v => set("associe", v)} />
                    <FormField label="Superviseur" type="select" value={form.superviseur} options={SUPERVISEURS} onChange={v => set("superviseur", v)} />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {/* STEP 2: BENEFICIAIRES */}
        {step === 2 && (
          <div className="space-y-6">
            {/* FIX 59: Improved BE header with count */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Beneficiaires effectifs</h2>
                <p className="text-sm text-slate-500 mt-0.5">Personnes detenant plus de 25% du capital ou des droits de vote</p>
              </div>
              <div className="flex items-center gap-2">
                {beneficiaires.length > 0 && (
                  <Badge className={`text-[9px] border-0 ${beSumOk ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {beneficiaires.length} BE — {beneficiaires.reduce((s, b) => s + b.pourcentage, 0)}%
                  </Badge>
                )}
                <Button onClick={addBeneficiaire} variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400">
                  <Plus className="w-4 h-4" /> Ajouter
                </Button>
              </div>
            </div>

            {!beSumOk && beneficiaires.length > 0 && beneficiaires.some(b => b.pourcentage > 0) && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm text-amber-400">
                  La somme des pourcentages ({beneficiaires.reduce((s, b) => s + b.pourcentage, 0)}%) ne fait pas 100%
                </span>
              </div>
            )}

            {beneficiaires.length > 0 && beneficiaires.every(b => b.pourcentage === 0) && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-orange-400 font-medium">Aucun beneficiaire effectif declare au RNE pour cette societe.</span>
                  <p className="text-xs text-orange-400/80 mt-1">La declaration des BE est obligatoire (art. L.561-46 CMF). Veuillez saisir manuellement les pourcentages de detention ci-dessous.</p>
                </div>
              </div>
            )}

            {/* #38: Duplicate detection */}
            {(() => {
              const seen = new Map<string, number>();
              const dupes: string[] = [];
              beneficiaires.forEach((b, i) => {
                const key = `${(b.nom || "").toUpperCase()}-${(b.prenom || "").toUpperCase()}`;
                if (key !== "-" && seen.has(key)) dupes.push(`${b.prenom} ${b.nom} (lignes ${(seen.get(key) ?? 0) + 1} et ${i + 1})`);
                else seen.set(key, i);
              });
              if (dupes.length === 0) return null;
              return (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-sm text-orange-400">Doublons detectes : {dupes.join(", ")}</span>
                </div>
              );
            })()}

            {beneficiaires.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun beneficiaire effectif ajoute</p>
                <p className="text-xs mt-1">Utilisez le bouton + Ajouter pour saisir manuellement</p>
              </div>
            )}

            {/* Idee 23: Mini pie chart for BE repartition */}
            {beneficiaires.length > 0 && beneficiaires.some(b => b.pourcentage > 0) && (() => {
              const beSum = beneficiaires.reduce((s, b) => s + b.pourcentage, 0);
              const overBudget = beSum > 100;
              const pieData = beneficiaires.filter(b => b.pourcentage > 0).map((b, i) => ({
                name: `${b.prenom} ${b.nom}`.trim() || `BE ${i + 1}`,
                value: b.pourcentage,
              }));
              if (beSum < 100) pieData.push({ name: "Non attribue", value: 100 - beSum });
              const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981"];
              return (
                <div className={`p-4 rounded-lg border ${overBudget ? "border-red-500/30 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-300">Repartition du capital</h3>
                    <span className={`text-sm font-bold font-mono ${overBudget ? "text-red-400" : beSum === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                      {beSum}%{overBudget && " — Depasse 100% !"}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={idx === pieData.length - 1 && !overBudget && beSum < 100 ? "rgba(255,255,255,0.06)" : overBudget ? "#ef4444" : COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px", color: "#e2e8f0" }} formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            <div className="space-y-4">
              {beneficiaires.map((b, i) => {
                const key = `${b.nom}-${b.prenom}`;
                const status = beScreening[key];
                const isCollapsed = collapsedBE[i];
                return (
                  <div key={i} className={`rounded-lg border transition-all duration-200 overflow-hidden ${
                    status === "match" ? "border-red-500/30 bg-red-500/[0.03]" :
                    "border-white/[0.06] bg-white/[0.02]"
                  }`}>
                    {/* #37: Compact header + #40: Collapse toggle + #33: Percentage bar */}
                    <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setCollapsedBE(prev => ({ ...prev, [i]: !prev[i] }))}>
                      <div className="flex items-center gap-3 min-w-0">
                        {/* #31: Drag handle placeholder */}
                        <GripVertical className="w-4 h-4 text-slate-600 shrink-0 cursor-grab" />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-slate-400 shrink-0">BE {i + 1}</span>
                          <span className="text-sm text-slate-200 truncate">{b.prenom} {b.nom || "—"}</span>
                          {/* #39: Sanctions check status */}
                          {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />}
                          {status === "clean" && <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {status === "match" && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />}
                          {status === "error" && <span className="text-[9px] text-slate-500 shrink-0">N/A</span>}
                        </div>
                        {/* #33: Visual percentage bar */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto mr-4">
                          <div className="w-20 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                b.pourcentage > 50 ? "bg-blue-500" : b.pourcentage > 25 ? "bg-cyan-500" : b.pourcentage > 0 ? "bg-amber-500" : "bg-slate-600"
                              }`}
                              style={{ width: `${Math.min(b.pourcentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-300 w-10 text-right">{b.pourcentage}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); removeBeneficiaire(i); }} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0 transition-all hover:scale-110">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                      </div>
                    </div>
                    {/* #40: Collapsible details */}
                    {!isCollapsed && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-[10px] text-slate-500 uppercase">Nom</Label>
                            <Input value={b.nom} onChange={e => updateBeneficiaire(i, "nom", sanitizeInput(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm focus:ring-2 focus:ring-blue-500/30" placeholder="NOM" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500 uppercase">Prenom</Label>
                            <Input value={b.prenom} onChange={e => updateBeneficiaire(i, "prenom", sanitizeInput(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm focus:ring-2 focus:ring-blue-500/30" placeholder="Prenom" />
                          </div>
                          {/* #35: Date picker for birth date */}
                          <div>
                            <Label className="text-[10px] text-slate-500 uppercase">Date naissance</Label>
                            <Input type="date" value={b.dateNaissance} onChange={e => updateBeneficiaire(i, "dateNaissance", e.target.value)} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm focus:ring-2 focus:ring-blue-500/30" />
                          </div>
                          {/* #34: Nationality with common suggestions */}
                          <div>
                            <Label className="text-[10px] text-slate-500 uppercase">Nationalite</Label>
                            <Input value={b.nationalite} onChange={e => updateBeneficiaire(i, "nationalite", sanitizeInput(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm focus:ring-2 focus:ring-blue-500/30" placeholder="FRANCAISE" list={`nat-list-${i}`} />
                            <datalist id={`nat-list-${i}`}>
                              {["FRANCAISE", "ALGERIENNE", "MAROCAINE", "TUNISIENNE", "PORTUGAISE", "ITALIENNE", "ESPAGNOLE", "ALLEMANDE", "BELGE", "BRITANNIQUE", "AMERICAINE", "CHINOISE", "RUSSE", "TURQUE", "LIBANAISE"].map(n => <option key={n} value={n} />)}
                            </datalist>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <Label className="text-[10px] text-slate-500">% parts — {b.pourcentage}%</Label>
                            <Slider
                              value={[b.pourcentage]}
                              onValueChange={([v]) => updateBeneficiaire(i, "pourcentage", v)}
                              min={0} max={100} step={1}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500">% votes — {b.pourcentageVotes ?? 0}%</Label>
                            <Slider
                              value={[b.pourcentageVotes ?? 0]}
                              onValueChange={([v]) => updateBeneficiaire(i, "pourcentageVotes", v)}
                              min={0} max={100} step={1}
                              className="mt-2"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: QUESTIONNAIRE LCB-FT */}
        {step === 3 && (
          <div className="space-y-6">
            {/* FIX 58: Questionnaire header with OUI count + #41: Progress */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Questionnaire LCB-FT</h2>
                <p className="text-sm text-slate-500 mt-0.5">Evaluation des facteurs de risque reglementaires</p>
              </div>
              <div className="flex items-center gap-3">
                {/* #41: Progress indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{questions.filter(q => q.value !== "NON").length}/{questions.length}</span>
                  <Progress value={(questions.filter(q => q.value !== "NON").length / questions.length) * 100} className="w-16 h-1.5" />
                </div>
                {questions.filter(q => q.value === "OUI").length > 0 && (
                  <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0">
                    {questions.filter(q => q.value === "OUI").length} risque(s)
                  </Badge>
                )}
                {/* #48: Running malus score */}
                <Badge className={`text-[9px] border-0 font-mono ${extraMalus > 0 ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-slate-400"}`}>
                  {extraMalus > 0 ? `+${extraMalus + risk.malus} pts` : "0 malus"}
                </Badge>
              </div>
            </div>

            {/* #43: Real-time risk level indicator */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Niveau de risque en temps reel :</span>
              <VigilanceBadge level={risk.nivVigilance} />
              <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    adjustedScore >= 60 ? "bg-red-500" : adjustedScore >= 25 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min((adjustedScore / 120) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">{adjustedScore}/120</span>
            </div>

            {/* #45: "Tout NON" shortcut */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-white/[0.06] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all"
                onClick={() => {
                  setQuestions(prev => prev.map(q => ({ ...q, value: "NON" as const, commentaire: q.value === "OUI" ? q.commentaire : "" })));
                  toast.success("Toutes les reponses ont ete mises a NON");
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Tout mettre a NON
              </Button>
            </div>

            {/* #42: Group by risk category */}
            {(() => {
              const categories: { label: string; icon: typeof Shield; ids: string[]; color: string }[] = [
                { label: "Risque PPE / Sanctions", icon: Shield, ids: ["ppe"], color: "red" },
                { label: "Risque geographique", icon: MapPin, ids: ["paysRisque", "filialesEtrangeres", "transactionsPays", "fournisseursPays"], color: "amber" },
                { label: "Risque operationnel", icon: AlertTriangle, ids: ["cash", "mouvementsCash", "pression", "distanciel"], color: "orange" },
                { label: "Risque structurel", icon: Building2, ids: ["atypique", "structureComplexe", "changeJuridiques", "capitalInconnus"], color: "blue" },
              ];
              return categories.map(cat => {
                const catQuestions = questions.filter(q => cat.ids.includes(q.id));
                if (catQuestions.length === 0) return null;
                const catOuiCount = catQuestions.filter(q => q.value === "OUI").length;
                const colorMap: Record<string, string> = { red: "border-red-500/20 bg-red-500/[0.02]", amber: "border-amber-500/20 bg-amber-500/[0.02]", orange: "border-orange-500/20 bg-orange-500/[0.02]", blue: "border-blue-500/20 bg-blue-500/[0.02]" };
                const textMap: Record<string, string> = { red: "text-red-400", amber: "text-amber-400", orange: "text-orange-400", blue: "text-blue-400" };
                return (
                  <div key={cat.label} className={`rounded-lg border ${colorMap[cat.color]} overflow-hidden`}>
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      <cat.icon className={`w-4 h-4 ${textMap[cat.color]}`} />
                      <span className={`text-xs font-semibold ${textMap[cat.color]}`}>{cat.label}</span>
                      {catOuiCount > 0 && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0 ml-auto">{catOuiCount} OUI</Badge>}
                    </div>
                    <div className="space-y-0">
                      {catQuestions.map(q => {
                        const qi = questions.findIndex(qq => qq.id === q.id);
                        return (
                          <div key={q.id} className={`p-4 border-t transition-all duration-200 ${
                            q.value === "OUI" ? "border-red-500/20 bg-red-500/5" : "border-white/[0.04] hover:bg-white/[0.02]"
                          }`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm text-slate-200">{q.question}</p>
                                {/* #46: Tooltip for regulatory reference */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="text-[10px] text-slate-500 mt-1 font-mono hover:text-blue-400 transition-colors flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" /> {q.reference}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 bg-slate-900 border-white/10 text-xs text-slate-300">
                                    Reference reglementaire : {q.reference}. Malus associe : +{q.malus} points sur le score global de risque.
                                  </PopoverContent>
                                </Popover>
                              </div>
                              {/* #44: Larger clickable area for radio buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {(["OUI", "NON", "N/A"] as const).map(val => (
                                  <button
                                    key={val}
                                    onClick={() => updateQuestion(qi, "value", val)}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
                                      q.value === val
                                        ? val === "OUI" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : val === "NON" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-500 text-white"
                                        : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                                    }`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* #49: Highlight high-risk answers */}
                            {q.value === "OUI" && (
                              <div className="mt-3 space-y-2 animate-fade-in-up">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className={`w-3.5 h-3.5 ${q.malus >= 50 ? "text-red-400 animate-pulse" : "text-amber-400"}`} />
                                  <span className={`text-xs font-semibold ${q.malus >= 50 ? "text-red-400" : "text-amber-400"}`}>
                                    Malus : +{q.malus} points {q.malus >= 100 && "— VIGILANCE RENFORCEE"}
                                  </span>
                                </div>
                                {/* #50: Comment field */}
                                <Textarea
                                  value={q.commentaire}
                                  onChange={e => updateQuestion(qi, "commentaire", sanitizeInput(e.target.value))}
                                  placeholder="Commentaire obligatoire — justifiez votre reponse..."
                                  className={`bg-white/[0.03] border-white/[0.06] text-sm min-h-[60px] focus:ring-2 focus:ring-red-500/30 transition-all ${!q.commentaire ? "border-red-500/50" : "border-emerald-500/30"}`}
                                />
                                {/* #18: Character count */}
                                <div className="flex items-center justify-between">
                                  {!q.commentaire && <p className="text-[10px] text-red-400">Commentaire obligatoire pour chaque reponse OUI</p>}
                                  {q.commentaire && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Commentaire renseigne</p>}
                                  <span className="text-[9px] text-slate-600">{q.commentaire.length} car.</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Uncategorized questions */}
            {(() => {
              const categorizedIds = ["ppe", "paysRisque", "filialesEtrangeres", "transactionsPays", "fournisseursPays", "cash", "mouvementsCash", "pression", "distanciel", "atypique", "structureComplexe", "changeJuridiques", "capitalInconnus"];
              const uncategorized = questions.filter(q => !categorizedIds.includes(q.id));
              if (uncategorized.length === 0) return null;
              return (
                <div className="space-y-3">
                  {uncategorized.map(q => {
                    const qi = questions.findIndex(qq => qq.id === q.id);
                    return (
                      <div key={q.id} className={`p-4 rounded-lg border transition-all duration-200 ${
                        q.value === "OUI" ? "border-red-500/30 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm text-slate-200">{q.question}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">{q.reference}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(["OUI", "NON", "N/A"] as const).map(val => (
                              <button
                                key={val}
                                onClick={() => updateQuestion(qi, "value", val)}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
                                  q.value === val
                                    ? val === "OUI" ? "bg-red-500 text-white shadow-md" : val === "NON" ? "bg-emerald-500 text-white shadow-md" : "bg-slate-500 text-white"
                                    : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        {q.value === "OUI" && (
                          <div className="mt-3 space-y-2 animate-fade-in-up">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-xs text-red-400 font-semibold">Malus : +{q.malus} points</span>
                            </div>
                            <Textarea value={q.commentaire} onChange={e => updateQuestion(qi, "commentaire", sanitizeInput(e.target.value))} placeholder="Commentaire obligatoire..." className={`bg-white/[0.03] border-white/[0.06] text-sm min-h-[60px] ${!q.commentaire ? "border-red-500/50" : ""}`} />
                            {!q.commentaire && <p className="text-[10px] text-red-400">Commentaire obligatoire</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP 4: SCORING & DECISION */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Scoring et Decision</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* #53: Improved radar chart */}
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300">Radar de risque 6 axes</h3>
                  {/* #52: Score breakdown tooltip */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                        <HelpCircle className="w-3.5 h-3.5" /> Detail
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-slate-900 border-white/10">
                      <h4 className="text-xs font-semibold text-slate-300 mb-2">Contribution de chaque facteur</h4>
                      <div className="space-y-1.5">
                        {radarData.map(d => (
                          <div key={d.subject} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{d.subject}</span>
                            <span className={`font-mono font-bold ${d.score >= 60 ? "text-red-400" : d.score >= 25 ? "text-amber-400" : "text-emerald-400"}`}>{d.score}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="score" stroke={vigilanceColor} fill={vigilanceColor} fillOpacity={0.2} strokeWidth={2.5} dot={{ fill: vigilanceColor, r: 3.5, strokeWidth: 0 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0" }} formatter={(v: number) => [`${v}/100`, "Score"]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Score gauge */}
              <div className="space-y-4">
                {/* #51: Animated gauge with count-up */}
                <div className="p-6 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center shadow-lg">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Score Global</p>
                  <div className="relative w-40 h-40 mx-auto">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke={vigilanceColor}
                        strokeWidth="10"
                        strokeDasharray={`${(Math.min(animatedScore, 120) / 120) * 314} 314`}
                        strokeLinecap="round"
                        className="transition-all duration-300 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      {/* #51: Animated score reveal */}
                      <span className="text-4xl font-bold text-white tabular-nums">{animatedScore}</span>
                      <span className="text-[10px] text-slate-500">/120</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <VigilanceBadge level={risk.nivVigilance} />
                  </div>
                  {/* #55: Risk level explanation */}
                  <p className="text-[10px] text-slate-500 mt-2">
                    {risk.nivVigilance === "SIMPLIFIEE" && "Risque faible — mesures de vigilance allégées autorisées"}
                    {risk.nivVigilance === "STANDARD" && "Risque moyen — mesures de vigilance normales requises"}
                    {risk.nivVigilance === "RENFORCEE" && "Risque élevé — mesures de vigilance renforcées obligatoires (art. L.561-10 CMF)"}
                  </p>
                  {/* #54: Comparison with cabinet average */}
                  {(() => {
                    const avgScore = clients.length > 0 ? Math.round(clients.reduce((s, c) => s + (c.scoreGlobal || 0), 0) / clients.length) : null;
                    if (avgScore === null) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-2">
                        <span className="text-[10px] text-slate-500">Moyenne cabinet :</span>
                        <span className="text-xs font-mono font-bold text-slate-400">{avgScore}/120</span>
                        {adjustedScore > avgScore && <span className="text-[9px] text-amber-400">+{adjustedScore - avgScore} au-dessus</span>}
                        {adjustedScore < avgScore && <span className="text-[9px] text-emerald-400">{avgScore - adjustedScore} en-dessous</span>}
                        {adjustedScore === avgScore && <span className="text-[9px] text-slate-500">= moyenne</span>}
                      </div>
                    );
                  })()}
                </div>

                {/* Score breakdown */}
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">Decomposition</h3>
                  <div className="space-y-2">
                    {/* FIX 49: Score decomposition with visual bars */}
                    {[
                      { label: "Activite (APE)", score: risk.scoreActivite, max: 100, desc: `Code ${form.ape}` },
                      { label: "Pays", score: risk.scorePays, max: 100, desc: riskFlags.paysRisque ? "Pays a risque detecte" : "Aucun risque pays" },
                      { label: "Mission", score: risk.scoreMission, max: 100, desc: form.mission },
                      { label: "Maturite", score: risk.scoreMaturite, max: 100, desc: "Anciennete de la relation" },
                      { label: "Structure", score: risk.scoreStructure, max: 100, desc: form.forme },
                      { label: "Malus", score: totalMalus, max: 100, desc: `${questions.filter(q => q.value === "OUI").length} facteur(s) actif(s)` },
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-slate-300">{item.label}</span>
                            <span className="text-[10px] text-slate-500 ml-2">{item.desc}</span>
                          </div>
                          <span className={`text-sm font-bold font-mono tabular-nums ${
                            item.score >= 60 ? "text-red-400" : item.score >= 25 ? "text-amber-400" : "text-emerald-400"
                          }`}>{item.score}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.score >= 60 ? "bg-red-500" : item.score >= 25 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min((item.score / item.max) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Idée 9: Date butoir auto-calculée */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-300">Date butoir prochaine revue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200 font-mono">{formatDateFR(calculateDateButoir(risk.nivVigilance))}</span>
                <span className="text-[10px] text-slate-500">
                  ({risk.nivVigilance === "SIMPLIFIEE" ? "+3 ans" : risk.nivVigilance === "STANDARD" ? "+2 ans" : "+1 an"})
                </span>
              </div>
            </div>

            {/* Screening summary at scoring step */}
            {(screening.sanctions.data || screening.bodacc.data || screening.google.data || screening.news.data) && (
              <div className="lg:col-span-2">
                <ScreeningPanel screening={screening} compact />
              </div>
            )}

            {/* FIX 52: Improved decision section with shadows and transitions */}
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Decision</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setDecision("ACCEPTER")}
                  aria-pressed={decision === "ACCEPTER"}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-center focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none ${
                    decision === "ACCEPTER" ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10" : "border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/5"
                  }`}
                >
                  <Check className={`w-6 h-6 mx-auto mb-2 transition-colors ${decision === "ACCEPTER" ? "text-emerald-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "ACCEPTER" ? "text-emerald-400" : "text-slate-400"}`}>Accepter</p>
                </button>
                <button
                  onClick={() => setDecision("ACCEPTER_RESERVE")}
                  aria-pressed={decision === "ACCEPTER_RESERVE"}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-center focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${
                    decision === "ACCEPTER_RESERVE" ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10" : "border-white/[0.06] hover:border-amber-500/30 hover:bg-amber-500/5"
                  }`}
                >
                  <AlertTriangle className={`w-6 h-6 mx-auto mb-2 transition-colors ${decision === "ACCEPTER_RESERVE" ? "text-amber-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "ACCEPTER_RESERVE" ? "text-amber-400" : "text-slate-400"}`}>Accepter sous reserve</p>
                </button>
                <button
                  onClick={() => setDecision("REFUSER")}
                  aria-pressed={decision === "REFUSER"}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-center focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:outline-none ${
                    decision === "REFUSER" ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-500/10" : "border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/5"
                  }`}
                >
                  <X className={`w-6 h-6 mx-auto mb-2 transition-colors ${decision === "REFUSER" ? "text-red-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "REFUSER" ? "text-red-400" : "text-slate-400"}`}>Refuser</p>
                </button>
              </div>

              {/* #57: Motif textarea for both REFUSER and ACCEPTER_RESERVE */}
              {decision === "REFUSER" && (
                <div className="mt-4 animate-fade-in-up">
                  <Label className="text-xs text-red-400 font-semibold">Motif du refus (obligatoire)</Label>
                  <Textarea
                    value={motifRefus}
                    onChange={e => setMotifRefus(sanitizeInput(e.target.value))}
                    placeholder="Indiquez le motif de refus..."
                    className={`bg-white/[0.03] mt-1 focus:ring-2 focus:ring-red-500/30 ${!motifRefus ? "border-red-500/50" : "border-white/[0.06]"}`}
                  />
                  {!motifRefus && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Le motif est obligatoire pour un refus</p>}
                  <div className="flex justify-end mt-1"><span className="text-[9px] text-slate-600">{motifRefus.length} car.</span></div>
                </div>
              )}
              {decision === "ACCEPTER_RESERVE" && (
                <div className="mt-4 animate-fade-in-up">
                  <Label className="text-xs text-amber-400 font-semibold">Motif de la reserve (recommande)</Label>
                  <Textarea
                    value={motifReserve}
                    onChange={e => setMotifReserve(sanitizeInput(e.target.value))}
                    placeholder="Indiquez les reserves et conditions d'acceptation..."
                    className="bg-white/[0.03] border-white/[0.06] mt-1 focus:ring-2 focus:ring-amber-500/30"
                  />
                  <div className="flex justify-end mt-1"><span className="text-[9px] text-slate-600">{motifReserve.length} car.</span></div>
                </div>
              )}
            </div>

            {/* #60: Print/export scoring summary */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/[0.06] text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all hover:scale-[1.02]"
              onClick={() => {
                window.print();
                toast.info("Impression du scoring lancee");
              }}
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer le scoring
            </Button>
          </div>
        )}

        {/* STEP 5: DOCUMENTS */}
        {step === 5 && (
          <div className="space-y-6">
            {/* Header with KYC progress */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Documents et finalisation</h2>
                <p className="text-sm text-slate-500 mt-0.5">Verifiez les pieces collectees et uploadez les justificatifs manquants</p>
              </div>
              <div className="flex items-center gap-3">
                {/* FIX 38: Refresh documents button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-400 hover:text-blue-300 h-7 px-2"
                  disabled={screening.inpi.loading || screening.documents.loading}
                  onClick={async () => {
                    if (form.siren && selectedEnterprise) {
                      const siren = form.siren.replace(/\s/g, "");
                      // FIX P4-26: Invalidate cache before refresh to force fresh data
                      try {
                        await supabase.from("api_cache").delete().eq("siren", siren).in("api_name", ["inpi", "documents"]);
                      } catch { /* non-critical */ }
                      setScreening(prev => ({
                        ...prev,
                        inpi: { loading: true, data: null, error: null },
                        documents: { loading: true, data: null, error: null },
                      }));
                      fetchInpiDocuments(siren).then(data => {
                        setScreening(prev => ({ ...prev, inpi: { loading: false, data, error: data.error || null } }));
                        if (data.totalDocuments > 0) toast.success(`${data.totalDocuments} document(s) INPI re-recupere(s)`);
                      }).catch(() => setScreening(prev => ({ ...prev, inpi: { loading: false, data: null, error: "Echec" } })));
                      fetchDocuments(siren, form.raisonSociale).then(data => {
                        setScreening(prev => ({ ...prev, documents: { loading: false, data, error: null } }));
                      }).catch(() => setScreening(prev => ({ ...prev, documents: { loading: false, data: null, error: "Echec" } })));
                    }
                  }}
                >
                  {(screening.inpi.loading || screening.documents.loading) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  <span className="ml-1">Rafraichir</span>
                </Button>
                <span className="text-xs text-slate-500">KYC</span>
                <Progress value={kycCompleteness} className="w-28 h-2.5" />
                <span className={`text-sm font-bold tabular-nums ${kycCompleteness === 100 ? "text-emerald-400" : kycCompleteness >= 60 ? "text-amber-400" : "text-red-400"}`}>{kycCompleteness}%</span>
              </div>
            </div>

            {/* Recapitulatif compact */}
            <Collapsible>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-slate-300">Recapitulatif du dossier</h3>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Raison sociale", value: form.raisonSociale, ok: !!form.raisonSociale },
                      { label: "SIREN", value: form.siren, ok: !!form.siren },
                      { label: "Forme juridique", value: form.forme, ok: !!form.forme },
                      { label: "Adresse", value: [form.adresse, form.cp, form.ville].filter(Boolean).join(", "), ok: !!(form.adresse && form.cp && form.ville) },
                      { label: "Dirigeant", value: form.dirigeant, ok: !!form.dirigeant },
                      { label: "Score / Vigilance", value: `${adjustedScore}/120 — ${risk.nivVigilance}`, ok: true },
                      { label: "Beneficiaires", value: `${beneficiaires.length} BE`, ok: beneficiaires.length > 0 },
                      { label: "Decision", value: decision || "—", ok: !!decision },
                      { label: "Docs manuels", value: `${documents.length} fichier(s)`, ok: documents.length > 0 },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-2 p-2 rounded bg-white/[0.02]">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.ok ? "bg-emerald-400" : "bg-orange-400"}`} />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500">{item.label}</p>
                          <p className="text-xs text-slate-200 truncate">{item.value || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* FIX 56: Show INPI/document fetch errors */}
            {screening.inpi.error && !screening.inpi.loading && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-400">Erreur INPI : {screening.inpi.error}</p>
                  <p className="text-[10px] text-red-400/70 mt-0.5">Cliquez "Rafraichir" pour reessayer</p>
                </div>
              </div>
            )}
            {/* FIX P4-49: Better error display with inline retry */}
            {screening.documents.error && !screening.documents.loading && (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">Documents : {screening.documents.error}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] text-amber-400 h-6 px-2" onClick={() => {
                  if (form.siren) {
                    setScreening(prev => ({ ...prev, documents: { loading: true, data: null, error: null } }));
                    fetchDocuments(form.siren.replace(/\s/g, ""), form.raisonSociale).then(data => {
                      setScreening(prev => ({ ...prev, documents: { loading: false, data, error: null } }));
                    }).catch(() => setScreening(prev => ({ ...prev, documents: { loading: false, data: null, error: "Echec" } })));
                  }
                }}>Reessayer</Button>
              </div>
            )}

            {/* SECTION 1: Extrait RNE / Kbis — affiché en premier car c'est le doc le plus important */}
            {(() => {
              // FIX P4-24+46: Deduplicate KBIS/RBE extraits from both sources
              const extraitInpi = (screening.inpi.data?.documents ?? []).filter(d =>
                (d.type?.toLowerCase() === "kbis") && d.storedInSupabase
              );
              const extraitPappers = (screening.documents.data?.documents ?? []).filter(d =>
                (d.type?.toLowerCase() === "kbis" || d.type?.toLowerCase() === "extrait rbe") && d.url
              );
              // Prefer INPI stored docs, add Pappers only if it provides different source
              const seenSources = new Set(extraitInpi.map(d => String(d.source || "").toLowerCase()));
              const uniquePappers = extraitPappers.filter(d => !seenSources.has(String(d.source || "").toLowerCase()));
              const allExtraits = [...extraitInpi, ...uniquePappers];
              const isLoading = screening.inpi.loading || screening.documents.loading;
              if (isLoading && allExtraits.length === 0) {
                return (
                  <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                      <p className="text-sm text-blue-400">Recuperation de l'extrait Kbis / RNE en cours...</p>
                    </div>
                  </div>
                );
              }
              if (allExtraits.length === 0 && !isLoading) {
                return (
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-400">Aucun extrait Kbis / RNE disponible</p>
                          <p className="text-[10px] text-amber-500/70 mt-0.5">L'extrait sera genere automatiquement lors du rafraichissement si les donnees INPI sont disponibles</p>
                        </div>
                      </div>
                      {/* FIX P4-50: Inline retry for missing KBIS */}
                      <Button variant="ghost" size="sm" className="text-[10px] text-amber-400 h-6 px-2 shrink-0" onClick={() => {
                        if (form.siren) {
                          const siren = form.siren.replace(/\s/g, "");
                          setScreening(prev => ({ ...prev, inpi: { loading: true, data: null, error: null } }));
                          fetchInpiDocuments(siren, true).then(data => {
                            setScreening(prev => ({ ...prev, inpi: { loading: false, data, error: data.error || null } }));
                            if (data.totalDocuments > 0) toast.success(`${data.totalDocuments} document(s) recupere(s)`);
                          }).catch(() => setScreening(prev => ({ ...prev, inpi: { loading: false, data: null, error: "Echec" } })));
                        }
                      }}>Reessayer</Button>
                    </div>
                  </div>
                );
              }
              if (allExtraits.length === 0) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Extrait Kbis / RNE</Label>
                  </div>
                  {allExtraits.map((doc, i) => {
                    const isHtml = doc.url?.includes(".html") || doc.label?.includes("RNE");
                    const source = String(doc.source || "inpi").toLowerCase() === "pappers" ? "Pappers" : "INPI";
                    return (
                      <div key={`kbis-${i}`} className="flex items-center justify-between p-4 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{doc.label}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-0">{source}</Badge>
                              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-0">{isHtml ? "HTML" : "PDF"}</Badge>
                              {doc.dateDepot && <span className="text-[9px] text-slate-500">{formatDateFR(doc.dateDepot)}</span>}
                            </div>
                          </div>
                        </div>
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 ml-3 text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> {isHtml ? "Ouvrir" : "Telecharger"}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* SECTION 2: Statuts & Actes INPI recuperes */}
            {(() => {
              // FIX P4-17: Merge sources, prefer stored PDFs, better dedup
              const inpiDocs = (screening.inpi.data?.documents ?? []).filter(d => d.type?.toLowerCase() !== "kbis");
              const fetchDocs = (screening.documents.data?.documents ?? []).filter(d =>
                d.type?.toLowerCase() !== "kbis" && d.status !== "manquant"
              );
              const seen = new Set<string>();
              // Prefer inpi docs first (more likely to have stored PDFs)
              const allDocs = [...inpiDocs, ...fetchDocs].filter(d => {
                const dateKey = (d as any).dateDepot || (d as any).dateCloture || "";
                const key = `${d.type}-${(d as any).source || ""}-${dateKey}`.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              const storedDocs = allDocs.filter(d => d.storedInSupabase);
              const linkDocs = allDocs.filter(d => !d.storedInSupabase && d.url && d.status !== "manquant" && !(d as any).needsAuth);
              const isLoading = screening.inpi.loading || screening.documents.loading;

              if (storedDocs.length === 0 && linkDocs.length === 0 && !isLoading) {
                return (
                  <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-slate-500" />
                      <p className="text-sm text-slate-400">Aucun acte ou statut recupere automatiquement</p>
                    </div>
                  </div>
                );
              }

              // Map doc types to readable labels
              const typeLabel = (t: string) => {
                const map: Record<string, string> = {
                  "Statuts": "Statuts", "PV AG": "PV d'AG", "Actes": "Acte juridique",
                  "Comptes annuels": "Comptes annuels", "Extrait RBE": "Extrait RBE",
                };
                return map[t] || t;
              };
              // Icon color by type
              const typeColor = (t: string) => {
                if (t === "Statuts") return "text-violet-400 bg-violet-500/10";
                if (t === "PV AG") return "text-cyan-400 bg-cyan-500/10";
                if (t.includes("Comptes")) return "text-amber-400 bg-amber-500/10";
                return "text-slate-400 bg-white/[0.06]";
              };

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Documents collectes</Label>
                      <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{storedDocs.length + linkDocs.length}</Badge>
                    </div>
                    {isLoading && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                  </div>

                  {/* Stored PDFs */}
                  {storedDocs.map((doc, i) => (
                    <div key={`stored-${i}`} className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeColor(doc.type)}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate max-w-[400px]">{doc.label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge className="text-[8px] bg-emerald-500/15 text-emerald-400 border-0 px-1.5">{typeLabel(doc.type)}</Badge>
                            <span className="text-[8px] text-emerald-500/70">PDF stocke</span>
                            {doc.source && <span className="text-[8px] text-slate-500">{String(doc.source).toLowerCase() === "pappers" ? "Pappers" : "INPI"}</span>}
                            {doc.dateDepot && <span className="text-[8px] text-slate-500">{formatDateFR(doc.dateDepot)}</span>}
                            {doc.dateCloture && <span className="text-[8px] text-slate-500">Cloture {formatDateFR(doc.dateCloture)}</span>}
                          </div>
                        </div>
                      </div>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 ml-2 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors opacity-80 group-hover:opacity-100">
                          <FileDown className="w-3 h-3" /> Ouvrir
                        </a>
                      )}
                    </div>
                  ))}

                  {/* Link-only docs */}
                  {linkDocs.map((doc, i) => (
                    <div key={`link-${i}`} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeColor(doc.type)}`}>
                          <ExternalLink className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-300 truncate max-w-[400px]">{doc.label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge className="text-[8px] bg-white/[0.06] text-slate-400 border-0 px-1.5">{typeLabel(doc.type)}</Badge>
                            <span className="text-[8px] text-amber-400/70">Lien externe</span>
                            {doc.source && <span className="text-[8px] text-slate-500">{String(doc.source).toLowerCase() === "pappers" ? "Pappers" : "INPI"}</span>}
                          </div>
                        </div>
                      </div>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 ml-2 text-[11px] font-medium bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors opacity-80 group-hover:opacity-100">
                          <ExternalLink className="w-3 h-3" /> Voir
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Donnees financieres — improved formatting */}
            {screening.inpi.data?.financials && screening.inpi.data.financials.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Donnees financieres</Label>
                  <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{screening.inpi.data.financials.length} exercice(s)</Badge>
                </div>
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.03]">
                          <th className="text-left py-2.5 px-3 text-slate-500 font-medium">Indicateur</th>
                          {screening.inpi.data.financials.map((f, i) => (
                            <th key={i} className="text-right py-2.5 px-3 text-slate-400 font-medium">
                              {f.dateCloture ? formatDateFR(f.dateCloture) : `Exercice ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Chiffre d'affaires", key: "chiffreAffaires" as const },
                          { label: "Resultat net", key: "resultat" as const },
                          { label: "Total bilan", key: "totalBilan" as const },
                          { label: "Capitaux propres", key: "capitauxPropres" as const },
                          { label: "Dettes", key: "dettes" as const },
                          { label: "Effectif", key: "effectif" as const },
                        ].map(row => {
                          const hasData = screening.inpi.data!.financials.some(f => f[row.key] != null);
                          if (!hasData) return null;
                          return (
                            <tr key={row.key} className="border-t border-white/[0.04] hover:bg-white/[0.03] even:bg-white/[0.01]">
                              <td className="py-2 px-3 text-slate-400">{row.label}</td>
                              {screening.inpi.data!.financials.map((f, i) => {
                                const val = f[row.key];
                                const isNeg = typeof val === "number" && val < 0;
                                return (
                                  <td key={i} className={`text-right py-2 px-3 font-mono tabular-nums ${isNeg ? "text-red-400" : "text-slate-200"}`}>
                                    {val != null ? (row.key === "effectif" ? val : `${typeof val === "number" ? val.toLocaleString("fr-FR") : val} \u20AC`) : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {screening.inpi.data.financials.some(f => f.resultat != null && f.resultat < 0) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">Resultat net negatif — vigilance recommandee</span>
                  </div>
                )}
                {screening.inpi.data.financials.some(f => f.capitauxPropres != null && f.capitauxPropres < 0) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">Capitaux propres negatifs — alerte financiere</span>
                  </div>
                )}
              </div>
            )}

            {/* FIX 40: Improved INPI Historique Timeline */}
            {inpiHistorique.length > 0 && (
              <Collapsible defaultOpen={recentDirigeantChange}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Historique INPI</h3>
                    <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{inpiHistorique.length}</Badge>
                    {recentDirigeantChange && (
                      <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Dirigeant modifie
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="relative pl-6 space-y-0">
                    {inpiHistorique.slice(0, 10).map((evt, i) => {
                      const evtDate = new Date(evt.date);
                      const sixMonthsAgo = new Date();
                      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                      const isRecent = evtDate >= sixMonthsAgo;
                      const isDirigeant = evt.type.toLowerCase().includes("dirigeant") || evt.description.toLowerCase().includes("dirigeant");
                      return (
                        <div key={i} className="relative pb-4">
                          {i < inpiHistorique.slice(0, 10).length - 1 && (
                            <div className="absolute left-[-16px] top-3 bottom-0 w-px bg-white/[0.08]" />
                          )}
                          <div className={`absolute left-[-20px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                            isRecent && isDirigeant ? "bg-red-400 border-red-500" :
                            isRecent ? "bg-amber-400 border-amber-500" :
                            "bg-slate-600 border-slate-500"
                          }`} />
                          <div className={`p-2 rounded-lg ${isRecent && isDirigeant ? "bg-red-500/5 border border-red-500/20" : "bg-white/[0.02]"}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono">{formatDateFR(evt.date)}</span>
                              <Badge className={`text-[9px] border-0 ${
                                isDirigeant ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"
                              }`}>{evt.type}</Badge>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">{evt.description}</p>
                            {evt.detail && <p className="text-[10px] text-slate-500 mt-0.5">{evt.detail}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {inpiHistorique.length > 10 && (
                    <p className="text-[10px] text-slate-500 text-center mt-2">+ {inpiHistorique.length - 10} evenement(s) anterieurs</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 2: Checklist documentaire dynamique (Idee 30) */}
            {(() => {
              // FIX 29: Deduplicate documents from both sources before checklist matching
              const rawDocs = [
                // FIX P4-12: Prefer INPI docs first (higher quality), then documents-fetch
                ...(screening.inpi.data?.documents ?? []),
                ...(screening.documents.data?.documents ?? []),
              ];
              const seenKeys = new Set<string>();
              const allDocs = rawDocs.filter(d => {
                // FIX P4-12: Better dedup key — type+source+date instead of type+label
                const dateKey = (d as any).dateDepot || (d as any).dateCloture || "";
                const key = `${d.type.toUpperCase()}-${(d as any).source || ""}-${dateKey}`;
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
              });
              // FIX P4-10: needsAuth docs are NOT accessible — don't count them as stored
              const hasStoredPdf = (types: string[]) => allDocs.some(d =>
                types.some(t => d.type.toUpperCase().includes(t)) &&
                (d as any).storedInSupabase === true
              );
              const hasUpload = (types: string[]) => documents.some(d =>
                types.some(t => d.type.toUpperCase().includes(t))
              );

              const results = vigilanceDocChecklist.map(c => ({
                ...c,
                hasPdf: hasStoredPdf(c.types),
                hasUpload: hasUpload(c.types),
                found: hasStoredPdf(c.types) || hasUpload(c.types),
                manual: ["CNI", "RIB", "Justificatif", "Organigramme"].includes(c.key),
              }));
              const foundCount = results.filter(r => r.found).length;
              const pct = Math.round((foundCount / vigilanceDocChecklist.length) * 100);

              return (
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-300">Checklist documentaire</h3>
                      <Badge className={`text-[9px] border-0 ${
                        risk.nivVigilance === "SIMPLIFIEE" ? "bg-emerald-500/20 text-emerald-400" :
                        risk.nivVigilance === "STANDARD" ? "bg-amber-500/20 text-amber-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>{risk.nivVigilance} — {vigilanceDocChecklist.length} doc(s) requis</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="w-24 h-2" />
                      <span className={`text-sm font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                    </div>
                  </div>
                  {/* FIX 41: Responsive checklist grid with better mobile layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {results.map(item => (
                      <div key={item.key} className={`p-2.5 rounded-lg border text-center transition-colors ${
                        item.found ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"
                      }`}>
                        {item.found ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" /> : <X className="w-4 h-4 text-red-400 mx-auto mb-0.5" />}
                        <p className={`text-[11px] font-medium leading-tight ${item.found ? "text-emerald-400" : "text-red-400"}`}>{item.label}</p>
                        {item.hasPdf && <p className="text-[8px] text-emerald-500 mt-0.5">PDF INPI</p>}
                        {item.hasUpload && !item.hasPdf && <p className="text-[8px] text-amber-400 mt-0.5">Upload manuel</p>}
                        {!item.found && item.manual && <p className="text-[8px] text-red-400 mt-0.5">Manuel requis</p>}
                        {!item.found && !item.manual && <p className="text-[8px] text-red-400 mt-0.5">Manquant</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* SECTION 3: Upload zones for manual documents */}
            <div className="space-y-3">
              {/* #61: Document checklist + FIX 60: Improved manual docs header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Documents manuels a fournir</Label>
                  {/* #69: Document status badges */}
                  {documents.length > 0 && (
                    <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-0 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {documents.length} fichier(s) uploade(s)
                    </Badge>
                  )}
                </div>
                {/* #64: File size total */}
                {documents.filter(d => d.file).length > 0 && (
                  <span className="text-[9px] text-slate-500">
                    Total : {(documents.filter(d => d.file).reduce((s, d) => s + (d.file?.size || 0), 0) / 1024 / 1024).toFixed(1)} Mo
                  </span>
                )}
              </div>
              {/* FIX 44: Dynamic upload zones based on vigilance level */}
              {[
                { type: "CNI", label: "CNI du dirigeant", desc: "Carte d'identite ou passeport en cours de validite" },
                { type: "RIB", label: "RIB / IBAN", desc: "Releve d'identite bancaire du compte professionnel" },
                ...(risk.nivVigilance !== "SIMPLIFIEE" ? [{ type: "Justificatif", label: "Justificatif de domicile", desc: "Justificatif de domicile du siege (< 3 mois)" }] : []),
                ...(risk.nivVigilance === "RENFORCEE" ? [{ type: "Organigramme", label: "Organigramme de la structure", desc: "Schema de l'organisation capitalistique et des liens" }] : []),
              ].map(zone => {
                const uploaded = documents.filter(d => d.type.toUpperCase().includes(zone.type.toUpperCase()));
                return (
                  <div key={zone.type} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-200 font-medium">{zone.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{zone.desc}</p>
                      </div>
                      {uploaded.length > 0 ? (
                        <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">Uploade</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0">A fournir</Badge>
                      )}
                    </div>
                    {uploaded.length > 0 ? (
                      <div className="px-4 pb-3 space-y-1.5">
                        {uploaded.map((doc, i) => {
                          const docIdx = documents.findIndex(d => d === doc);
                          const ext = doc.name.split(".").pop()?.toLowerCase() || "";
                          const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                          return (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 transition-all hover:bg-emerald-500/10">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* #63: File preview icon */}
                                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isImage ? "bg-violet-500/10" : "bg-blue-500/10"}`}>
                                  {isImage ? <Eye className="w-4 h-4 text-violet-400" /> : <FileText className="w-4 h-4 text-blue-400" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs text-slate-300 truncate block">{doc.name}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {/* #64: File size display */}
                                    {doc.file && <span className="text-[9px] text-slate-500">{doc.file.size > 1024 * 1024 ? `${(doc.file.size / 1024 / 1024).toFixed(1)} Mo` : `${(doc.file.size / 1024).toFixed(0)} Ko`}</span>}
                                    <span className="text-[9px] text-emerald-500 uppercase">{ext}</span>
                                    {/* #69: Status badge */}
                                    <Badge className="text-[8px] bg-emerald-500/15 text-emerald-400 border-0">Pret</Badge>
                                  </div>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeDocument(docIdx)} className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0 shrink-0 transition-all hover:scale-110">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <label className="block px-4 pb-3">
                        <div
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverZone(zone.type); }}
                          onDragLeave={() => setDragOverZone(null)}
                          onDrop={e => {
                            e.preventDefault(); e.stopPropagation();
                            setDragOverZone(null);
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              const validFiles = Array.from(files).filter(f => {
                                if (f.size > MAX_FILE_SIZE) { toast.error(`Fichier "${f.name}" trop volumineux (max 10 Mo)`); return false; }
                                const rawExt = f.name.split(".").pop()?.toLowerCase();
                                const ext = rawExt && rawExt !== f.name.toLowerCase() ? "." + rawExt : "";
                                if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) { toast.error(`Type non autorise : ${ext || "inconnu"}`); return false; }
                                return true;
                              });
                              const newDocs: UploadedDoc[] = validFiles.map(f => ({
                                name: f.name, type: zone.type, file: f,
                              }));
                              if (newDocs.length > 0) setDocuments(prev => [...prev, ...newDocs]);
                            }
                          }}
                          className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                            dragOverZone === zone.type
                              ? "border-blue-400 bg-blue-500/10 scale-[1.01]"
                              : "border-white/[0.08] hover:border-blue-500/30"
                          }`}
                        >
                          {/* #62: Improved drag zone styling */}
                          <Upload className={`w-6 h-6 mx-auto mb-1.5 transition-transform duration-200 ${dragOverZone === zone.type ? "text-blue-400 scale-110" : "text-slate-600"}`} />
                          <p className={`text-[11px] font-medium ${dragOverZone === zone.type ? "text-blue-400" : "text-slate-500"}`}>
                            {dragOverZone === zone.type ? "Deposez le fichier ici" : "Glissez ou cliquez pour uploader"}
                          </p>
                          <p className="text-[9px] text-slate-600 mt-0.5">PDF, JPG, PNG — max 10 Mo</p>
                          <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" onChange={e => {
                            if (e.target.files) {
                              const validFiles = Array.from(e.target.files).filter(f => {
                                if (f.size > MAX_FILE_SIZE) { toast.error(`Fichier "${f.name}" trop volumineux (max 10 Mo)`); return false; }
                                const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
                                if (!ALLOWED_EXTENSIONS.includes(ext)) { toast.error(`Type non autorise : ${ext}`); return false; }
                                return true;
                              });
                              const newDocs: UploadedDoc[] = validFiles.map(f => ({
                                name: f.name, type: zone.type, file: f,
                              }));
                              if (newDocs.length > 0) setDocuments(prev => [...prev, ...newDocs]);
                            }
                          }} />
                        </div>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Other uploaded documents — FIX 42: Show file size and type */}
            {documents.filter(d => !["CNI", "RIB", "JUSTIFICATIF"].some(t => d.type.toUpperCase().includes(t))).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Autres documents uploades</Label>
                {documents.filter(d => !["CNI", "RIB", "JUSTIFICATIF"].some(t => d.type.toUpperCase().includes(t))).map((doc, i) => {
                  const docIdx = documents.findIndex(d => d === doc);
                  const ext = doc.name.split(".").pop()?.toUpperCase() || "?";
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Upload manuel</Badge>
                            <span className="text-[9px] text-slate-500">{ext}</span>
                            {doc.file && <span className="text-[9px] text-slate-500">{(doc.file.size / 1024).toFixed(0)} Ko</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDocument(docIdx)} className="text-slate-500 hover:text-red-400 h-7 w-7 p-0 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Generate buttons + batch download */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                disabled={generatingPdf === "fiche"}
                onClick={() => {
                  const tempClient = buildTempClient();
                  if (!tempClient) { toast.error("Impossible de generer la fiche : donnees manquantes"); return; }
                  setGeneratingPdf("fiche");
                  try {
                    generateFicheAcceptation(tempClient);
                    toast.success("Fiche LCB-FT generee");
                  } catch { toast.error("Erreur lors de la generation de la fiche"); }
                  finally { setGeneratingPdf(null); }
                }}
              >
                {generatingPdf === "fiche" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Generer fiche LCB-FT (PDF)
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                disabled={generatingPdf === "lettre"}
                onClick={() => {
                  const tempClient = buildTempClient();
                  if (!tempClient) { toast.error("Impossible de generer la lettre : donnees manquantes"); return; }
                  setGeneratingPdf("lettre");
                  try {
                    generateLettreMission(tempClient);
                    toast.success("Lettre de mission generee");
                  } catch { toast.error("Erreur lors de la generation de la lettre"); }
                  finally { setGeneratingPdf(null); }
                }}
              >
                {generatingPdf === "lettre" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Generer lettre de mission (PDF)
              </Button>
              {/* FIX 39+P4-25: Batch download all stored documents, deduplicated */}
              {(() => {
                const rawStoredDocs = [
                  ...(screening.inpi.data?.documents ?? []),
                  ...(screening.documents.data?.documents ?? []),
                ].filter(d => d.url && (d.storedInSupabase || d.status === "auto"));
                const seenUrls = new Set<string>();
                const allStoredDocs = rawStoredDocs.filter(d => {
                  if (!d.url || seenUrls.has(d.url)) return false;
                  seenUrls.add(d.url);
                  return true;
                });
                if (allStoredDocs.length < 2) return null;
                return (
                  <Button
                    variant="outline"
                    className="gap-2 border-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-400"
                    onClick={() => {
                      allStoredDocs.forEach((doc, i) => {
                        setTimeout(() => {
                          const a = document.createElement("a");
                          a.href = doc.url!;
                          a.target = "_blank";
                          a.rel = "noopener noreferrer";
                          a.click();
                        }, i * 300);
                      });
                      toast.success(`Ouverture de ${allStoredDocs.length} document(s)`);
                    }}
                  >
                    <FileDown className="w-4 h-4" /> Tout telecharger ({allStoredDocs.length})
                  </Button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* #74: Floating save draft button */}
      {step > 0 && hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 shadow-lg border-white/[0.1] bg-slate-900/90 backdrop-blur-sm transition-all duration-200 hover:scale-105 ${draftSaved ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 hover:text-blue-400"}`}
            onClick={() => {
              const draftData = { form, step, beneficiaires, questions, decision, motifRefus, savedAt: Date.now() };
              sessionStorage.setItem("draft_nouveau_client", JSON.stringify(draftData));
              setDraftSaved(true);
              toast.success("Brouillon sauvegarde");
              setTimeout(() => setDraftSaved(false), 2000);
            }}
          >
            {draftSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {draftSaved ? "Sauvegarde" : "Sauvegarder brouillon"}
          </Button>
        </div>
      )}

      {/* FIX 47: Improved navigation buttons with step indicator + #80: Breadcrumb */}
      <div className="space-y-3">
        {/* #80: Breadcrumb navigation */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <button onClick={() => navigate("/bdd")} className="hover:text-slate-400 transition-colors">Clients</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-500">Nouveau</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-400">{STEP_LABELS[step]}</span>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => step > 0 ? setStep(step - 1) : navigate("/bdd")}
            className="gap-1.5 border-white/[0.06] hover:bg-white/[0.04] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Annuler" : "Precedent"}
          </Button>

          {/* #76: Navigation hints */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500 tabular-nums">Etape {step + 1} / {STEP_LABELS.length}</span>
            <span className="text-[9px] text-slate-600">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">Esc</kbd> precedent
              {" "}<kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">Entree</kbd> suivant
            </span>
          </div>

          {step < 5 ? (
            <Button
              onClick={() => {
                if (!canGoNext) {
                  const missing: string[] = [];
                  if (step === 1) {
                    if (!form.raisonSociale) missing.push("Raison sociale");
                    if (!form.siren || form.siren.replace(/\s/g, "").length !== 9) missing.push("SIREN (9 chiffres)");
                    if (!form.forme) missing.push("Forme juridique");
                    if (!form.ape) missing.push("Code APE");
                    if (!form.dirigeant) missing.push("Dirigeant");
                    if (!form.adresse) missing.push("Adresse");
                    if (!form.cp) missing.push("Code postal");
                    if (!form.ville) missing.push("Ville");
                  }
                  if (step === 3 && !questionsValid) missing.push("Commentaires obligatoires pour reponses OUI");
                  if (step === 4 && !decision) missing.push("Decision requise");
                  if (missing.length > 0) {
                    toast.warning(`Champs manquants : ${missing.join(", ")}`);
                    // #22: Smooth scroll to first error
                    scrollToFirstError();
                  }
                  return;
                }
                setStep(step + 1);
              }}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-blue-500/10"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isOnline}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creation en cours...</>
              ) : (
                <><Check className="w-4 h-4" /> Valider et creer le client</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Idee 28: Success modal — FIX P4-13: Backdrop click + Escape key dismissal + #95/#96: Animation */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in-up"
          onClick={() => navigate("/bdd")}
          onKeyDown={e => { if (e.key === "Escape") navigate("/bdd"); }}
          role="dialog"
          aria-modal="true"
          aria-label="Client cree avec succes"
          tabIndex={0}
          ref={el => el?.focus()}
        >
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              {/* #95: Success animation */}
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 animate-bounce" style={{ animationDuration: "1s", animationIterationCount: "2" }}>
                <Sparkles className="w-6 h-6 text-emerald-400 absolute animate-ping" style={{ animationDuration: "1.5s" }} />
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Client cree avec succes</h2>
              <p className="text-sm text-slate-400 mt-2">{form.raisonSociale} — {createdClientRef}</p>
              <p className="text-xs text-slate-500 mt-1">Fiche LCB-FT generee automatiquement</p>
              {/* FIX 45: Show document count in success modal */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {(screening.inpi.data?.documents ?? []).filter(d => d.storedInSupabase).length + documents.length} doc(s)
                </span>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Score {adjustedScore}/120
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  risk.nivVigilance === "SIMPLIFIEE" ? "text-emerald-400 bg-emerald-500/10" :
                  risk.nivVigilance === "STANDARD" ? "text-amber-400 bg-amber-500/10" :
                  "text-red-400 bg-red-500/10"
                }`}>
                  {risk.nivVigilance}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate(`/client/${createdClientRef}`)}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" /> Voir la fiche client
              </Button>
              <Button
                onClick={() => navigate(`/lettre-mission/${createdClientRef}`)}
                variant="outline"
                className="w-full gap-2 border-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-400"
              >
                <FileDown className="w-4 h-4" /> Generer la lettre de mission
              </Button>
              <Button
                onClick={() => navigate("/bdd")}
                variant="ghost"
                className="w-full gap-2 text-slate-400 hover:text-slate-200"
              >
                <ArrowRight className="w-4 h-4" /> Retour a la base clients
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function buildTempClient(): Client | null {
    const now = new Date().toISOString().split("T")[0];
    const dateButoir = calculateDateButoir(risk.nivVigilance);
    return {
      ref: "CLI-XX-000", etat: "EN COURS", comptable: form.comptable, mission: form.mission,
      raisonSociale: form.raisonSociale, forme: form.forme, adresse: form.adresse,
      cp: form.cp, ville: form.ville, siren: form.siren, capital: form.capital,
      ape: form.ape, dirigeant: form.dirigeant, domaine: form.domaine, effectif: form.effectif,
      tel: form.tel, mail: form.mail, dateCreation: form.dateCreation,
      dateReprise: form.dateReprise || form.dateCreation, honoraires: form.honoraires,
      reprise: form.reprise, juridique: form.juridique, frequence: form.frequence, iban: form.iban, bic: form.bic,
      associe: form.associe, superviseur: form.superviseur,
      ppe: riskFlags.ppe ? "OUI" : "NON", paysRisque: riskFlags.paysRisque ? "OUI" : "NON",
      atypique: riskFlags.atypique ? "OUI" : "NON", distanciel: riskFlags.distanciel ? "OUI" : "NON",
      cash: riskFlags.cash ? "OUI" : "NON", pression: riskFlags.pression ? "OUI" : "NON",
      ...risk, dateCreationLigne: now, dateDerniereRevue: now, dateButoir,
      etatPilotage: getPilotageStatus(dateButoir) as EtatPilotage,
      dateExpCni: "", statut: "ACTIF",
      be: beneficiaires.map(b => `${b.prenom} ${b.nom} (${b.pourcentage}%)`).join(", "),
    };
  }
}

// Reusable form field with auto badge and empty indicator
function MapSection({ lat, lng, adresse, cp, ville, raisonSociale }: {
  lat: number | null; lng: number | null; adresse: string; cp: string; ville: string; raisonSociale: string;
}) {
  const [geoLat, setGeoLat] = useState<number | null>(lat);
  const [geoLng, setGeoLng] = useState<number | null>(lng);
  const [geoLoading, setGeoLoading] = useState(false);

  const fullAddr = [adresse, cp, ville].filter(Boolean).join(" ");
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(fullAddr || raisonSociale)}`;

  useEffect(() => {
    if (lat && lng) { setGeoLat(lat); setGeoLng(lng); return; }
    if (!fullAddr || fullAddr.length < 5) return;
    setGeoLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddr)}&limit=1`, { signal: AbortSignal.timeout(10000) })
      .then(r => r.json())
      .then((data: Array<{ lat: string; lon: string }>) => {
        if (data.length > 0) { setGeoLat(parseFloat(data[0].lat)); setGeoLng(parseFloat(data[0].lon)); }
      })
      .catch(() => {})
      .finally(() => setGeoLoading(false));
  }, [lat, lng, fullAddr]);

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-300">Localisation</h3>
          {geoLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
        </div>
        <div className="flex items-center gap-2">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Google Maps
          </a>
          {geoLat && geoLng && (
            <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${geoLat},${geoLng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Street View
            </a>
          )}
        </div>
      </div>
      {geoLat && geoLng && (
        <iframe
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoLng - 0.005}%2C${geoLat - 0.005}%2C${geoLng + 0.005}%2C${geoLat + 0.005}&layer=mapnik&marker=${geoLat}%2C${geoLng}`}
          width="100%" height="250" style={{ border: 0 }} loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}

// #9: Highlight matching text in search results
function highlightMatch(text: string, query: string): JSX.Element | string {
  if (!query || !text) return text;
  const cleanQuery = query.replace(/\s/g, "").toLowerCase();
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(cleanQuery);
  if (idx === -1) {
    // Try word-by-word matching
    const words = query.trim().split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return text;
    let result = text;
    const parts: (JSX.Element | string)[] = [];
    let lastIdx = 0;
    for (const word of words) {
      const wIdx = result.toLowerCase().indexOf(word.toLowerCase(), lastIdx);
      if (wIdx >= 0) {
        if (wIdx > lastIdx) parts.push(result.slice(lastIdx, wIdx));
        parts.push(<mark key={`${wIdx}-${word}`} className="bg-blue-500/30 text-blue-300 px-0.5 rounded">{result.slice(wIdx, wIdx + word.length)}</mark>);
        lastIdx = wIdx + word.length;
      }
    }
    if (lastIdx < result.length) parts.push(result.slice(lastIdx));
    return parts.length > 0 ? <>{parts}</> : text;
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/30 text-blue-300 px-0.5 rounded">{text.slice(idx, idx + cleanQuery.length)}</mark>
      {text.slice(idx + cleanQuery.length)}
    </>
  );
}

// #18: Format SIREN "123456789" → "123 456 789"
function formatSiren(s: string): string {
  const clean = (s || "").replace(/\s/g, "");
  if (clean.length !== 9) return s;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}

// #15: Format date cloture "3112" → "31/12"
function formatCloture(val: string): string {
  if (!val) return "";
  const clean = val.replace(/\//g, "");
  if (/^\d{4}$/.test(clean)) {
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
  }
  return val;
}

// FIX 15: Removed duplicate formatDateCloture — use formatCloture instead

// FIX 4: FormField with source badge (INPI / data.gouv)
// #25: Color-coded borders, #29: Auto-filled background, #30: Lock icon
function SourceField({ label, value, onChange, type = "text", error, placeholder, options, source, required, hint, isLocked, autoFilled }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "select";
  error?: string;
  placeholder?: string;
  options?: string[];
  source?: string;
  required?: boolean;
  hint?: string;
  isLocked?: boolean;
  autoFilled?: boolean;
}) {
  const isEmpty = !value || value === "" || value === 0;
  const showOrange = required && isEmpty && !error;
  // #25: Color-coded borders
  const borderClass = error ? "border-red-500/50" : showOrange ? "border-amber-500/50" : !isEmpty ? "border-emerald-500/20" : "border-white/[0.06]";
  // #29: Auto-filled background tint
  const bgClass = autoFilled && !isEmpty ? "bg-blue-500/[0.04]" : "bg-white/[0.03]";

  if (type === "select" && options) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-slate-500 uppercase">
            {label}
            {/* #17: Red asterisk for required */}
            {required && !label.includes("*") && <span className="text-red-400 ml-0.5">*</span>}
          </Label>
          {source && !isEmpty && <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0 gap-0.5">{autoFilled && <Sparkles className="w-2.5 h-2.5" />}{source}</Badge>}
        </div>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className={`${bgClass} mt-1 ${borderClass} focus:ring-2 focus:ring-blue-500/30 transition-all`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] text-slate-500 uppercase">
          {label}
          {required && !label.includes("*") && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        {/* #30: Lock icon when auto-filled */}
        {isLocked && <Lock className="w-3 h-3 text-slate-600" />}
        {source && !isEmpty && <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0 gap-0.5">{autoFilled && <Sparkles className="w-2.5 h-2.5" />}{source}</Badge>}
      </div>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={isLocked}
        className={`${bgClass} mt-1 ${borderClass} focus:ring-2 focus:ring-blue-500/30 transition-all ${isLocked ? "cursor-not-allowed opacity-70" : ""}`}
      />
      {/* #23: Inline validation errors + #94: Error styling */}
      {error && <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", error, placeholder, options, isAuto, required, hint, needsCompletion, sourceType, autoComplete }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "select";
  error?: string;
  placeholder?: string;
  options?: string[];
  isAuto?: boolean;
  required?: boolean;
  hint?: string;
  needsCompletion?: boolean;
  sourceType?: "INPI" | "AnnuaireEntreprises" | null;
  autoComplete?: string;
}) {
  const isEmpty = !value || value === "" || value === 0;
  const showOrange = (required && isEmpty && !error) || needsCompletion;

  // Idee 22: Source badge
  const sourceBadge = (() => {
    if (isAuto && !isEmpty && sourceType === "INPI") return <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">INPI</span>;
    if (isAuto && !isEmpty && sourceType === "AnnuaireEntreprises") return <span className="text-[9px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded-full font-medium">data.gouv</span>;
    if (isAuto && !isEmpty) return <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>;
    if (required && isEmpty) return <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-medium">A completer</span>;
    if (!isEmpty) return <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">✓</span>;
    return null;
  })();

  if (type === "select" && options) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-slate-500 uppercase">{label}</Label>
          {sourceBadge}
        </div>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className={`bg-white/[0.03] mt-1 ${showOrange ? "border-amber-500/50" : "border-white/[0.06]"}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {showOrange && <p className="text-[10px] text-amber-400 mt-0.5">A completer manuellement</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] text-slate-500 uppercase">{label}</Label>
        {sourceBadge}
      </div>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`bg-white/[0.03] mt-1 focus:ring-2 focus:ring-blue-500/30 transition-all ${error ? "border-red-500/50" : showOrange ? "border-amber-500/50" : !isEmpty ? "border-emerald-500/20" : "border-white/[0.06]"}`}
      />
      {/* #94: Error styling with icon */}
      {error && <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> {error}</p>}
      {needsCompletion && !error && isEmpty && <p className="text-[10px] text-amber-400 mt-0.5">A completer</p>}
      {showOrange && !error && !needsCompletion && isEmpty && <p className="text-[10px] text-amber-400 mt-0.5">A completer manuellement</p>}
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}
