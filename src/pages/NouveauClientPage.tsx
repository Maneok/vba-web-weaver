import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus, APE_SCORES, MISSION_SCORES, PAYS_RISQUE } from "@/lib/riskEngine";
import { searchPappers, checkGelAvoirs, type PappersResult } from "@/lib/pappersService";
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
import { ScoreGauge, VigilanceBadge } from "@/components/RiskBadges";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Search, Hash, Building2, User, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  Upload, FileText, AlertTriangle, Plus, Trash2, FileDown, Check, X, ArrowRight, Info,
} from "lucide-react";

const FORMES = ["ENTREPRISE INDIVIDUELLE", "SARL", "EURL", "SAS", "SCI", "SCP", "SELAS", "SELARL", "EARL", "SA", "ASSOCIATION", "SNC", "TRUST", "FIDUCIE", "FONDATION"];
const MISSIONS: MissionType[] = ["TENUE COMPTABLE", "REVISION / SURVEILLANCE", "SOCIAL / PAIE SEULE", "CONSEIL DE GESTION", "CONSTITUTION / CESSION", "DOMICILIATION", "IRPP"];
const FREQUENCES = ["MENSUEL", "TRIMESTRIEL", "ANNUEL"];
const COMPTABLES = ["MAGALIE", "JULIEN", "FANNY", "SERGE", "JOSE"];
const ASSOCIES = ["DIDIER", "PASCAL", "KEVIN"];
const SUPERVISEURS = ["SAMUEL", "BRAYAN"];

const STEP_LABELS = ["Recherche", "Informations", "Personnes", "Questionnaire", "Scoring", "Documents"];

interface Beneficiaire {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  pourcentage: number;
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
  const { clients, addClient } = useAppState();
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

  // Step 2 - Form
  const [form, setForm] = useState({
    raisonSociale: "", forme: "SARL", siren: "", capital: 0, ape: "", dirigeant: "",
    domaine: "", effectif: "", adresse: "", cp: "", ville: "",
    tel: "", mail: "", dateCreation: "", dateReprise: "",
    mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, reprise: 0, juridique: 0,
    frequence: "MENSUEL",
    comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
    iban: "", bic: "", dateFin: "",
  });

  // Step 3 - Beneficiaires
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);

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

  const set = useCallback((key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val })), []);

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

  const totalMalus = risk.malus + extraMalus;
  const adjustedScore = Math.min(risk.scoreGlobal + extraMalus, 120);

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
  const kycCompleteness = useMemo(() => {
    const required = ["KBIS", "Statuts", "CNI", "RIB"];
    const found = required.filter(r => documents.some(d => d.type.toUpperCase().includes(r.toUpperCase())));
    return Math.round((found.length / required.length) * 100);
  }, [documents]);

  // Questions validation - all OUI need comments
  const questionsValid = useMemo(() => {
    return questions.every(q => q.value !== "OUI" || q.commentaire.trim().length > 0);
  }, [questions]);

  // Step 1: Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResults([]);
    setSelectedResult(null);
    setDuplicateWarning("");

    const res = await searchPappers(searchMode, searchQuery.trim());
    setSearchLoading(false);

    if (res.error && (!res.results || res.results.length === 0)) {
      setSearchError(res.error);
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
  };

  const selectPappersResult = (result: PappersResult) => {
    // Check for duplicate SIREN
    const existing = clients.find(c => c.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, ""));
    if (existing) {
      setDuplicateWarning(`Ce SIREN existe deja : ${existing.raisonSociale} (${existing.ref})`);
      setDuplicateRef(existing.ref);
    } else {
      setDuplicateWarning("");
      setDuplicateRef("");
    }

    // Check gel des avoirs in background
    checkGelAvoirs(result.siren, result.dirigeant).then(gel => {
      if (gel.matched) {
        setGelAvoirsAlert(gel.matches);
        toast.error("ALERTE : Entite trouvee dans le registre des gels d'avoirs !");
      } else {
        setGelAvoirsAlert([]);
      }
    });

    setSelectedResult(result);

    // Populate form
    const formeMatch = FORMES.find(f =>
      f === result.forme_juridique ||
      (result.forme_juridique_raw || "").toUpperCase().includes(f)
    );

    setForm(prev => ({
      ...prev,
      siren: result.siren,
      raisonSociale: result.raison_sociale,
      forme: formeMatch || result.forme_juridique || prev.forme,
      adresse: result.adresse || prev.adresse,
      cp: result.code_postal || prev.cp,
      ville: result.ville || prev.ville,
      ape: result.ape || prev.ape,
      domaine: result.libelle_ape || prev.domaine,
      capital: result.capital || prev.capital,
      dateCreation: result.date_creation || prev.dateCreation,
      effectif: result.effectif || prev.effectif,
      dirigeant: result.dirigeant || prev.dirigeant,
    }));

    // Parse beneficiaires from Pappers (prefer structured details)
    if (result.beneficiaires_details && result.beneficiaires_details.length > 0) {
      const parsed: Beneficiaire[] = result.beneficiaires_details.map(b => ({
        nom: b.nom || "",
        prenom: b.prenom || "",
        dateNaissance: b.date_de_naissance || "",
        nationalite: b.nationalite || "Francaise",
        pourcentage: b.pourcentage_parts || 0,
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

  // Step 4: question update
  const updateQuestion = (idx: number, field: "value" | "commentaire", val: string) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  // Step 6: file upload
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const typeMap: Record<string, string> = {
      kbis: "KBIS", statuts: "Statuts", cni: "CNI", rib: "RIB",
      identite: "CNI", passeport: "CNI",
    };
    const newDocs: UploadedDoc[] = Array.from(files).map(f => {
      const lower = f.name.toLowerCase();
      const detectedType = Object.entries(typeMap).find(([k]) => lower.includes(k))?.[1] || "Autre";
      return { name: f.name, type: detectedType, file: f };
    });
    setDocuments(prev => [...prev, ...newDocs]);
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
  const handleSubmit = () => {
    const now = new Date().toISOString().split("T")[0];
    const existingNums = clients.map(c => {
      const match = c.ref.match(/CLI-\d{2}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = Math.max(0, ...existingNums) + 1;
    const year = new Date().getFullYear().toString().slice(-2);
    const ref = `CLI-${year}-${String(nextNum).padStart(3, "0")}`;
    const dateButoir = calculateNextReviewDate(risk.nivVigilance, now);

    const beStr = beneficiaires
      .filter(b => b.nom)
      .map(b => `${b.prenom} ${b.nom} (${b.pourcentage}%)`)
      .join(", ");

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
    };

    // Force RENFORCEE if gel des avoirs matched
    if (gelAvoirsAlert.length > 0) {
      newClient.nivVigilance = "RENFORCEE";
      newClient.scoreGlobal = Math.max(newClient.scoreGlobal, 100);
    }

    addClient(newClient);
    toast.success(`Client ${form.raisonSociale} cree avec succes (${ref})`);
    navigate("/bdd");
  };

  const canGoNext = useMemo(() => {
    switch (step) {
      case 0: return true; // Search is optional (can skip)
      case 1: return form.raisonSociale && form.siren && form.forme && form.ape;
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
      if (form.tel && !/^0\d{9}$/.test(form.tel.replace(/\s/g, ""))) errors.tel = "Format: 0XXXXXXXXX";
      if (form.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail)) errors.mail = "Email invalide";
      if (form.iban && !/^FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}$/.test(form.iban.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim())) {
        // simplified IBAN check - just check FR prefix and length
        if (!form.iban.startsWith("FR") || form.iban.replace(/\s/g, "").length !== 27) {
          errors.iban = "IBAN invalide (FR + 25 caracteres)";
        }
      }
    }
    return errors;
  }, [step, form]);

  const vigilanceColor = risk.nivVigilance === "SIMPLIFIEE" ? "#22c55e" : risk.nivVigilance === "STANDARD" ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Nouveau Client</h1>
          <p className="text-sm text-slate-500 mt-0.5">Parcours d'entree en relation</p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreGauge score={adjustedScore} />
          <VigilanceBadge level={risk.nivVigilance} />
        </div>
      </div>

      {/* Stepper */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 ${i <= step ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? "bg-emerald-500 text-white" :
                i === step ? "bg-blue-500 text-white ring-4 ring-blue-500/20" :
                "bg-white/[0.06] text-slate-500"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                i <= step ? "text-slate-200" : "text-slate-600"
              }`}>{label}</span>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 lg:w-16 h-px mx-2 ${i < step ? "bg-emerald-500" : "bg-white/[0.06]"}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="glass-card p-6 animate-fade-in-up">
        {/* STEP 0: SEARCH */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Recherche de l'entreprise</h2>
              <p className="text-sm text-slate-500">Recherchez par SIREN, nom de societe ou dirigeant via l'API Pappers</p>
            </div>

            <div className="flex gap-3">
              <Select value={searchMode} onValueChange={v => setSearchMode(v as typeof searchMode)}>
                <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="siren"><span className="flex items-center gap-1.5"><Hash className="w-3 h-3" /> SIREN</span></SelectItem>
                  <SelectItem value="nom"><span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Nom societe</span></SelectItem>
                  <SelectItem value="dirigeant"><span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Dirigeant</span></SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder={searchMode === "siren" ? "Ex: 412 345 678" : searchMode === "nom" ? "Ex: BOULANGERIE MARTIN" : "Ex: MARTIN Jean-Pierre"}
                  className="pl-9 bg-white/[0.03] border-white/[0.06]"
                />
              </div>

              <Button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()} className="bg-blue-600 hover:bg-blue-700">
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1.5">Recuperer</span>
              </Button>
            </div>

            {searchError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{searchError}</div>
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

            {searchResults.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">{searchResults.length} resultats - selectionnez :</Label>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectPappersResult(r)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedResult?.siren === r.siren
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm text-slate-200">{r.raison_sociale}</span>
                          <span className="text-slate-500 ml-2 text-xs">({r.siren})</span>
                        </div>
                        {selectedResult?.siren === r.siren && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{r.forme_juridique_raw} - {r.ville} - APE: {r.ape}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedResult && (
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Donnees recuperees</span>
                  <Badge className={`border-0 text-[10px] ${
                    dataSource === "pappers" ? "bg-emerald-500/20 text-emerald-400" :
                    dataSource === "insee" ? "bg-blue-500/20 text-blue-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    {dataSource === "pappers" ? "Donnees Pappers" : dataSource === "insee" ? "Donnees INSEE" : "Donnees data.gouv"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-slate-500">Raison sociale</span><p className="text-slate-200 font-medium mt-0.5">{selectedResult.raison_sociale}</p></div>
                  <div><span className="text-slate-500">SIREN</span><p className="text-slate-200 font-mono mt-0.5">{selectedResult.siren}</p></div>
                  <div><span className="text-slate-500">Forme</span><p className="text-slate-200 mt-0.5">{selectedResult.forme_juridique_raw}</p></div>
                  <div><span className="text-slate-500">APE</span><p className="text-slate-200 mt-0.5">{selectedResult.ape} - {selectedResult.libelle_ape}</p></div>
                  <div><span className="text-slate-500">Capital</span><p className="text-slate-200 mt-0.5">{selectedResult.capital?.toLocaleString()} EUR</p></div>
                  <div><span className="text-slate-500">Dirigeant</span><p className="text-slate-200 mt-0.5">{selectedResult.dirigeant || "—"}</p></div>
                  <div><span className="text-slate-500">Ville</span><p className="text-slate-200 mt-0.5">{selectedResult.ville}</p></div>
                  <div><span className="text-slate-500">Creation</span><p className="text-slate-200 mt-0.5">{selectedResult.date_creation}</p></div>
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

        {/* STEP 1: INFORMATION */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Informations du client</h2>

            {/* Identite */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Identite</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Raison Sociale *" value={form.raisonSociale} onChange={v => set("raisonSociale", v)} error={validationErrors.raisonSociale} />
                <FormField label="Forme Juridique *" type="select" value={form.forme} options={FORMES} onChange={v => set("forme", v)} />
                <FormField label="SIREN *" value={form.siren} onChange={v => set("siren", v)} error={validationErrors.siren} placeholder="9 chiffres" />
                <FormField label="Code APE *" value={form.ape} onChange={v => set("ape", v)} placeholder="Ex: 56.10A" />
                <FormField label="Capital social" value={form.capital} onChange={v => set("capital", Number(v))} type="number" />
                <FormField label="Date de creation" value={form.dateCreation} onChange={v => set("dateCreation", v)} type="date" />
              </div>
            </div>

            {/* Dirigeant & Domaine */}
            <div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Dirigeant" value={form.dirigeant} onChange={v => set("dirigeant", v)} />
                <FormField label="Domaine d'activite" value={form.domaine} onChange={v => set("domaine", v)} />
                <FormField label="Effectif" value={form.effectif} onChange={v => set("effectif", v)} />
              </div>
            </div>

            {/* Coordonnees */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Coordonnees</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Adresse" value={form.adresse} onChange={v => set("adresse", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Code Postal" value={form.cp} onChange={v => set("cp", v)} />
                  <FormField label="Ville" value={form.ville} onChange={v => set("ville", v)} />
                </div>
                <FormField label="Telephone" value={form.tel} onChange={v => set("tel", v)} error={validationErrors.tel} placeholder="0XXXXXXXXX" />
                <FormField label="Email" value={form.mail} onChange={v => set("mail", v)} error={validationErrors.mail} placeholder="email@exemple.fr" />
              </div>
            </div>

            {/* Mission */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Mission</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Type de mission *" type="select" value={form.mission} options={MISSIONS} onChange={v => set("mission", v)} />
                <FormField label="Frequence" type="select" value={form.frequence} options={FREQUENCES} onChange={v => set("frequence", v)} />
                <FormField label="Honoraires HT" value={form.honoraires} onChange={v => set("honoraires", Number(v))} type="number" />
                <FormField label="Reprise (montant)" value={form.reprise} onChange={v => set("reprise", Number(v))} type="number" />
                <FormField label="Juridique (montant)" value={form.juridique} onChange={v => set("juridique", Number(v))} type="number" />
                <FormField label="Date de reprise" value={form.dateReprise} onChange={v => set("dateReprise", v)} type="date" />
                <FormField label="Date de fin (optionnel)" value={form.dateFin} onChange={v => set("dateFin", v)} type="date" />
                <FormField label="Associe signataire" type="select" value={form.associe} options={ASSOCIES} onChange={v => set("associe", v)} />
                <FormField label="Superviseur" type="select" value={form.superviseur} options={SUPERVISEURS} onChange={v => set("superviseur", v)} />
                <FormField label="Comptable" type="select" value={form.comptable} options={COMPTABLES} onChange={v => set("comptable", v)} />
              </div>
            </div>

            {/* Bancaire */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Bancaire</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="IBAN" value={form.iban} onChange={v => set("iban", v)} error={validationErrors.iban} placeholder="FR76..." />
                <FormField label="BIC" value={form.bic} onChange={v => set("bic", v)} placeholder="BNPAFRPP" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BENEFICIAIRES */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Beneficiaires effectifs</h2>
                <p className="text-sm text-slate-500 mt-0.5">Personnes detenant plus de 25% du capital ou des droits de vote</p>
              </div>
              <Button onClick={addBeneficiaire} variant="outline" className="gap-1.5 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>

            {!beSumOk && beneficiaires.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm text-amber-400">
                  La somme des pourcentages ({beneficiaires.reduce((s, b) => s + b.pourcentage, 0)}%) ne fait pas 100%
                </span>
              </div>
            )}

            {beneficiaires.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun beneficiaire effectif ajoute</p>
                <p className="text-xs mt-1">Les beneficiaires recuperes via Pappers apparaitront automatiquement</p>
              </div>
            )}

            <div className="space-y-4">
              {beneficiaires.map((b, i) => (
                <div key={i} className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400">Beneficiaire {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeBeneficiaire(i)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <Label className="text-[10px] text-slate-500">Nom</Label>
                      <Input value={b.nom} onChange={e => updateBeneficiaire(i, "nom", e.target.value)} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">Prenom</Label>
                      <Input value={b.prenom} onChange={e => updateBeneficiaire(i, "prenom", e.target.value)} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">Date naissance</Label>
                      <Input type="date" value={b.dateNaissance} onChange={e => updateBeneficiaire(i, "dateNaissance", e.target.value)} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">Nationalite</Label>
                      <Input value={b.nationalite} onChange={e => updateBeneficiaire(i, "nationalite", e.target.value)} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">% detention</Label>
                      <Input type="number" value={b.pourcentage} onChange={e => updateBeneficiaire(i, "pourcentage", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" min={0} max={100} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: QUESTIONNAIRE LCB-FT */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Questionnaire LCB-FT</h2>
              <p className="text-sm text-slate-500 mt-0.5">Evaluation des facteurs de risque reglementaires</p>
            </div>

            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className={`p-4 rounded-lg border transition-colors ${
                  q.value === "OUI" ? "border-red-500/30 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-slate-200">{q.question}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">{q.reference}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(["OUI", "NON", "N/A"] as const).map(val => (
                        <button
                          key={val}
                          onClick={() => updateQuestion(i, "value", val)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            q.value === val
                              ? val === "OUI" ? "bg-red-500 text-white" : val === "NON" ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                              : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {q.value === "OUI" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs text-red-400 font-semibold">Malus : +{q.malus} points</span>
                      </div>
                      <Textarea
                        value={q.commentaire}
                        onChange={e => updateQuestion(i, "commentaire", e.target.value)}
                        placeholder="Commentaire obligatoire - justifiez votre reponse..."
                        className={`bg-white/[0.03] border-white/[0.06] text-sm min-h-[60px] ${!q.commentaire ? "border-red-500/50" : ""}`}
                      />
                      {!q.commentaire && <p className="text-[10px] text-red-400">Commentaire obligatoire pour chaque reponse OUI</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: SCORING & DECISION */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Scoring et Decision</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Radar de risque 6 axes</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="score" stroke={vigilanceColor} fill={vigilanceColor} fillOpacity={0.15} strokeWidth={2} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Score gauge */}
              <div className="space-y-4">
                {/* Animated gauge */}
                <div className="p-6 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Score Global</p>
                  <div className="relative w-40 h-40 mx-auto">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke={vigilanceColor}
                        strokeWidth="10"
                        strokeDasharray={`${(Math.min(adjustedScore, 120) / 120) * 314} 314`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-4xl font-bold text-white">{adjustedScore}</span>
                      <span className="text-[10px] text-slate-500">/120</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <VigilanceBadge level={risk.nivVigilance} />
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">Decomposition</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Activite (APE)", score: risk.scoreActivite, desc: `Code ${form.ape}` },
                      { label: "Pays", score: risk.scorePays, desc: riskFlags.paysRisque ? "Pays a risque detecte" : "Aucun risque pays" },
                      { label: "Mission", score: risk.scoreMission, desc: form.mission },
                      { label: "Maturite", score: risk.scoreMaturite, desc: "Anciennete de la relation" },
                      { label: "Structure", score: risk.scoreStructure, desc: form.forme },
                      { label: "Malus", score: totalMalus, desc: `${questions.filter(q => q.value === "OUI").length} facteur(s) actif(s)` },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-300">{item.label}</span>
                          <span className="text-[10px] text-slate-500 ml-2">{item.desc}</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${
                          item.score >= 60 ? "text-red-400" : item.score >= 25 ? "text-amber-400" : "text-emerald-400"
                        }`}>{item.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Decision */}
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Decision</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setDecision("ACCEPTER")}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    decision === "ACCEPTER" ? "border-emerald-500 bg-emerald-500/10" : "border-white/[0.06] hover:border-emerald-500/30"
                  }`}
                >
                  <Check className={`w-6 h-6 mx-auto mb-2 ${decision === "ACCEPTER" ? "text-emerald-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "ACCEPTER" ? "text-emerald-400" : "text-slate-400"}`}>Accepter</p>
                </button>
                <button
                  onClick={() => setDecision("ACCEPTER_RESERVE")}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    decision === "ACCEPTER_RESERVE" ? "border-amber-500 bg-amber-500/10" : "border-white/[0.06] hover:border-amber-500/30"
                  }`}
                >
                  <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${decision === "ACCEPTER_RESERVE" ? "text-amber-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "ACCEPTER_RESERVE" ? "text-amber-400" : "text-slate-400"}`}>Accepter sous reserve</p>
                </button>
                <button
                  onClick={() => setDecision("REFUSER")}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    decision === "REFUSER" ? "border-red-500 bg-red-500/10" : "border-white/[0.06] hover:border-red-500/30"
                  }`}
                >
                  <X className={`w-6 h-6 mx-auto mb-2 ${decision === "REFUSER" ? "text-red-400" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${decision === "REFUSER" ? "text-red-400" : "text-slate-400"}`}>Refuser</p>
                </button>
              </div>

              {decision === "REFUSER" && (
                <div className="mt-4">
                  <Label className="text-xs text-slate-400">Motif du refus (obligatoire)</Label>
                  <Textarea
                    value={motifRefus}
                    onChange={e => setMotifRefus(e.target.value)}
                    placeholder="Indiquez le motif de refus..."
                    className="bg-white/[0.03] border-white/[0.06] mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: DOCUMENTS */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Documents et finalisation</h2>
                <p className="text-sm text-slate-500 mt-0.5">Uploadez les justificatifs et generez les documents</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Completude KYC</span>
                <div className="flex items-center gap-2">
                  <Progress value={kycCompleteness} className="w-24 h-2" />
                  <span className={`text-sm font-bold ${kycCompleteness === 100 ? "text-emerald-400" : "text-amber-400"}`}>{kycCompleteness}%</span>
                </div>
              </div>
            </div>

            {/* Drag & Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/[0.08] hover:border-white/[0.15]"
              }`}
            >
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-300">Glissez-deposez vos fichiers ici</p>
              <p className="text-xs text-slate-500 mt-1">KBIS, Statuts, CNI, RIB, autres documents</p>
              <label className="mt-4 inline-block">
                <input type="file" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                <span className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 underline">ou parcourir</span>
              </label>
            </div>

            {/* Documents list */}
            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm text-slate-200">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{doc.type}</Badge>
                          {doc.fromPappers ? (
                            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">Auto-recupere</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">A fournir manuellement</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeDocument(i)} className="text-slate-500 hover:text-red-400 h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* KYC completeness detail */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-xs font-semibold text-slate-300 mb-3">Completude KYC</h3>
              <div className="grid grid-cols-4 gap-3">
                {["KBIS", "Statuts", "CNI", "RIB"].map(type => {
                  const found = documents.some(d => d.type.toUpperCase().includes(type.toUpperCase()));
                  return (
                    <div key={type} className={`p-3 rounded-lg border text-center ${
                      found ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/[0.06]"
                    }`}>
                      {found ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" /> : <X className="w-5 h-5 text-slate-500 mx-auto mb-1" />}
                      <p className={`text-xs font-medium ${found ? "text-emerald-400" : "text-slate-500"}`}>{type}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generate buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                onClick={() => {
                  const tempClient = buildTempClient();
                  if (tempClient) generateFicheAcceptation(tempClient);
                  toast.success("Fiche LCB-FT generee");
                }}
              >
                <FileDown className="w-4 h-4" /> Generer fiche LCB-FT (PDF)
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                onClick={() => {
                  const tempClient = buildTempClient();
                  if (tempClient) generateLettreMission(tempClient);
                  toast.success("Lettre de mission generee");
                }}
              >
                <FileDown className="w-4 h-4" /> Generer lettre de mission (PDF)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => step > 0 ? setStep(step - 1) : navigate("/bdd")}
          className="gap-1.5 border-white/[0.06] hover:bg-white/[0.04]"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? "Annuler" : "Precedent"}
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canGoNext}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-4 h-4" />
            Valider et creer le client
          </Button>
        )}
      </div>
    </div>
  );

  function buildTempClient(): Client | null {
    const now = new Date().toISOString().split("T")[0];
    const dateButoir = calculateNextReviewDate(risk.nivVigilance, now);
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

// Reusable form field
function FormField({ label, value, onChange, type = "text", error, placeholder, options }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "select";
  error?: string;
  placeholder?: string;
  options?: string[];
}) {
  if (type === "select" && options) {
    return (
      <div>
        <Label className="text-[10px] text-slate-500 uppercase">{label}</Label>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className="bg-white/[0.03] border-white/[0.06] mt-1">
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
      <Label className="text-[10px] text-slate-500 uppercase">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-white/[0.03] border-white/[0.06] mt-1 ${error ? "border-red-500/50" : ""}`}
      />
      {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}
