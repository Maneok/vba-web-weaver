import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus, APE_SCORES, MISSION_SCORES, PAYS_RISQUE } from "@/lib/riskEngine";
import { searchPappers, checkGelAvoirs, type PappersResult } from "@/lib/pappersService";
import {
  searchEnterprise, checkSanctions, checkBodacc, verifyGooglePlaces, checkNews, analyzeNetwork, fetchDocuments, fetchInpiDocuments,
  INITIAL_SCREENING, type ScreeningState, type EnterpriseResult, type Dirigeant, type BeneficiaireEffectif,
  type InpiCompanyData, type InpiFinancials, type DataProvenance, type AmlSignal,
  computeKycCompleteness, detectAmlSignals, pickPrincipalDirigeant, formatDateFR,
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
import { ScoreGauge, VigilanceBadge } from "@/components/RiskBadges";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Search, Hash, Building2, User, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  Upload, FileText, AlertTriangle, Plus, Trash2, FileDown, Check, X, ArrowRight, Info,
  Map, ExternalLink, Eye,
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

  const set = useCallback((key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val })), []);

  // Auto-flag PPE if sanctions screening detects it
  const sanctionsPPE = screening.sanctions.data?.hasPPE ?? false;
  const sanctionsCritical = screening.sanctions.data?.hasCriticalMatch ?? false;

  // Auto-set questionnaire answers based on screening results
  useMemo(() => {
    if (sanctionsPPE) {
      setQuestions(prev => prev.map(q =>
        q.id === "ppe" && q.value !== "OUI"
          ? { ...q, value: "OUI" as const, commentaire: q.commentaire || "PPE detectee automatiquement via OpenSanctions" }
          : q
      ));
    }
  }, [sanctionsPPE]);

  // #24: Auto-detect domiciliataire → mission DOMICILIATION
  const inpiDomiciliataire = screening.inpi.data?.companyData?.domiciliataire;
  useMemo(() => {
    if (inpiDomiciliataire) {
      set("mission", "DOMICILIATION");
    }
  }, [inpiDomiciliataire]);

  // #25: Auto-detect pays risque from address or dirigeant nationality
  const inpiPays = screening.inpi.data?.companyData?.adresse?.pays;
  useMemo(() => {
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
  const kycCompleteness = useMemo(() => {
    const required = ["KBIS", "Statuts", "CNI", "RIB"];
    const autoDocs = screening.documents.data?.documents ?? [];
    const found = required.filter(r =>
      documents.some(d => d.type.toUpperCase().includes(r.toUpperCase())) ||
      autoDocs.some(d => d.type.toUpperCase().includes(r.toUpperCase()) && d.status === "auto")
    );
    return Math.round((found.length / required.length) * 100);
  }, [documents, screening.documents.data]);

  // Questions validation - all OUI need comments
  const questionsValid = useMemo(() => {
    return questions.every(q => q.value !== "OUI" || q.commentaire.trim().length > 0);
  }, [questions]);

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
        if (inpi.dirigeants.length > 0) {
          inpiAutoSet("dirigeant", `${inpi.dirigeants[0].nom} ${inpi.dirigeants[0].prenom}`.trim().toUpperCase());
        }
        if (Object.keys(updates).length > 0) {
          setForm(prev => ({ ...prev, ...updates }));
          setAutoFields(prev => new Set([...prev, ...newAuto]));
        }

        // Phase 4: Merge INPI BE with existing
        if (inpi.beneficiaires && inpi.beneficiaires.length > 0) {
          setBeneficiaires(prev => {
            const existing = new Set(prev.map(b => `${b.nom.toUpperCase()}-${b.prenom.toUpperCase()}`));
            const inpiBE = inpi.beneficiaires
              .filter(b => !existing.has(`${b.nom.toUpperCase()}-${b.prenom.toUpperCase()}`))
              .map(b => ({
                nom: b.nom || "",
                prenom: b.prenom || "",
                dateNaissance: b.dateNaissance || "",
                nationalite: b.nationalite || "Francaise",
                pourcentage: b.pourcentageParts || 0,
              }));
            return [...prev, ...inpiBE];
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

  // Step 1: Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
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

    // Primary: new enterprise-lookup (Annuaire Entreprises)
    setScreening(prev => ({ ...prev, enterprise: { loading: true, data: null, error: null } }));

    const entRes = await searchEnterprise(searchMode, searchQuery.trim());

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
        selectPappersResult(mapped[0]);
        launchScreening(entRes.results[0]);
      }
    } else {
      // Fallback to old Pappers service
      setScreening(prev => ({ ...prev, enterprise: { loading: false, data: null, error: entRes.error ?? "Aucun resultat" } }));
      const res = await searchPappers(searchMode, searchQuery.trim());
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

    // Launch screening if enterprise data available
    if (screening.enterprise.data) {
      const ent = screening.enterprise.data.find(e => e.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, ""));
      if (ent && !screening.sanctions.data && !screening.sanctions.loading) {
        launchScreening(ent);
      }
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

    // Find matching enterprise data for enrichment
    const entData = screening.enterprise.data?.find(
      e => e.siren.replace(/\s/g, "") === result.siren.replace(/\s/g, "")
    );
    if (entData) setSelectedEnterprise(entData);

    // Populate form with enriched data
    const formeMatch = FORMES.find(f =>
      f === result.forme_juridique ||
      f === (entData?.forme_juridique ?? "") ||
      (result.forme_juridique_raw || "").toUpperCase().includes(f)
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
    setAutoFields(newAutoFields);

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

  // CORRECTION 1: Detect if EI/personne physique for adapted form labels
  const isPersonnePhysique = screening.inpi.data?.companyData?.typePersonne === "physique";

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
            {screening.network.data && screening.network.data.nodes.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-300">Reseau dirigeants</h3>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {screening.network.data.totalCompanies} societe(s), {screening.network.data.totalPersons} personne(s) — cliquez un noeud pour plus d'infos
                  </span>
                </div>
                <div className="p-2">
                  <NetworkGraph
                    nodes={screening.network.data.nodes}
                    edges={screening.network.data.edges}
                    height={350}
                  />
                </div>
                {screening.network.data.alertes.length > 0 && (
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
                  <div><span className="text-slate-500">SIREN</span><p className="text-slate-200 font-mono mt-0.5">{selectedResult.siren}</p></div>
                  <div><span className="text-slate-500">Forme</span><p className="text-slate-200 mt-0.5">{selectedResult.forme_juridique_raw}</p></div>
                  <div><span className="text-slate-500">APE</span><p className="text-slate-200 mt-0.5">{selectedResult.ape} - {selectedResult.libelle_ape}</p></div>
                  <div><span className="text-slate-500">Capital</span><p className="text-slate-200 mt-0.5">{(() => { const cap = selectedEnterprise?.capital || selectedResult.capital || 0; return cap > 0 ? `${cap.toLocaleString()} EUR` : "Non renseigne"; })()} {capitalSource && (selectedEnterprise?.capital || selectedResult.capital || 0) > 0 && <span className="text-[10px] text-slate-500">({capitalSource})</span>}</p></div>
                  <div><span className="text-slate-500">Dirigeant</span><p className="text-slate-200 mt-0.5">{selectedResult.dirigeant || "—"}</p></div>
                  <div><span className="text-slate-500">Ville</span><p className="text-slate-200 mt-0.5">{selectedResult.ville}</p></div>
                  <div><span className="text-slate-500">Creation</span><p className="text-slate-200 mt-0.5">{selectedResult.date_creation ? selectedResult.date_creation.split("-").reverse().join("/") : "—"}</p></div>
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

            {/* KYC Completeness indicator */}
            {selectedEnterprise && (
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-300">Completude KYC</span>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const kyc = computeKycCompleteness(selectedEnterprise, screening.documents.data);
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

            {/* Identite */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Identite</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={isPersonnePhysique ? "Nom du dirigeant *" : "Raison Sociale *"} value={form.raisonSociale} onChange={v => set("raisonSociale", v)} error={validationErrors.raisonSociale} isAuto={autoFields.has("raisonSociale")} required />
                <FormField label="Forme Juridique *" type="select" value={form.forme} options={FORMES} onChange={v => set("forme", v)} isAuto={autoFields.has("forme")} required />
                <FormField label="SIREN *" value={form.siren} onChange={v => set("siren", v)} error={validationErrors.siren} placeholder="9 chiffres" isAuto={autoFields.has("siren")} required />
                <FormField label="SIRET" value={form.siret} onChange={v => set("siret", v)} placeholder="14 chiffres" isAuto={autoFields.has("siret")} />
                <FormField label="Code APE *" value={form.ape} onChange={v => set("ape", v)} placeholder="Ex: 56.10A" isAuto={autoFields.has("ape")} required hint={form.domaine ? form.domaine : undefined} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase">Capital social</Label>
                    {autoFields.has("capital") && form.capital > 0 && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
                    {capitalSource && form.capital > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      capitalSource === "INPI" ? "bg-blue-500/20 text-blue-400" :
                      capitalSource === "Pappers" ? "bg-violet-500/20 text-violet-400" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>{capitalSource}</span>}
                  </div>
                  <Input type="number" value={form.capital || ""} onChange={e => set("capital", Number(e.target.value))} placeholder="Non renseigne" className={`bg-white/[0.03] mt-1 ${!form.capital ? "border-amber-500/50" : "border-white/[0.06]"}`} />
                  {!form.capital && <p className="text-[10px] text-amber-400 mt-0.5">Non renseigne — a completer</p>}
                </div>
                <div>
                  <FormField label="Date de creation" value={form.dateCreation} onChange={v => set("dateCreation", v)} type="date" isAuto={autoFields.has("dateCreation")} />
                  {form.dateCreation && <p className="text-[10px] text-slate-500 mt-0.5">{formatDateFR(form.dateCreation)}</p>}
                </div>
              </div>
            </div>

            {/* Dirigeant & Domaine */}
            <div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Dirigeant" value={form.dirigeant} onChange={v => set("dirigeant", v)} isAuto={autoFields.has("dirigeant")} />
                <FormField label="Domaine d'activite" value={form.domaine} onChange={v => set("domaine", v)} isAuto={autoFields.has("domaine")} />
                <FormField label="Effectif" value={form.effectif} onChange={v => set("effectif", v)} isAuto={autoFields.has("effectif")} />
              </div>
            </div>

            {/* Coordonnees */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Coordonnees</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Adresse" value={form.adresse} onChange={v => set("adresse", v)} isAuto={autoFields.has("adresse")} required />
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Code Postal" value={form.cp} onChange={v => set("cp", v)} isAuto={autoFields.has("cp")} />
                  <FormField label="Ville" value={form.ville} onChange={v => set("ville", v)} isAuto={autoFields.has("ville")} />
                </div>
                <FormField label="Telephone" value={form.tel} onChange={v => set("tel", v)} error={validationErrors.tel} placeholder="0XXXXXXXXX" isAuto={autoFields.has("tel")} needsCompletion={!!selectedResult && !form.tel} />
                <FormField label="Email" value={form.mail} onChange={v => set("mail", v)} error={validationErrors.mail} placeholder="email@exemple.fr" isAuto={autoFields.has("mail")} needsCompletion={!!selectedResult && !form.mail} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase">Site web</Label>
                    {autoFields.has("siteWeb") && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
                  </div>
                  <Input value={form.siteWeb} onChange={e => set("siteWeb", e.target.value)} placeholder="https://..." className="bg-white/[0.03] mt-1 border-white/[0.06]" />
                  {form.siteWeb && (
                    <a href={form.siteWeb.startsWith("http") ? form.siteWeb : `https://${form.siteWeb}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5 inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Ouvrir le site
                    </a>
                  )}
                </div>
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

            {/* BUG 2: INPI company details — moved from Documents to Informations */}
            {screening.inpi.data?.companyData && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Donnees complementaires (INPI)</h3>
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2 text-xs">
                  {screening.inpi.data.companyData.objetSocial && (
                    <div><span className="text-slate-500">Objet social:</span> <span className="text-slate-300 ml-1">{screening.inpi.data.companyData.objetSocial.slice(0, 200)}{screening.inpi.data.companyData.objetSocial.length > 200 ? "..." : ""}</span></div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {screening.inpi.data.companyData.duree && (
                      <div><span className="text-slate-500">Duree:</span> <span className="text-slate-200 ml-1">{screening.inpi.data.companyData.duree} ans</span></div>
                    )}
                    {screening.inpi.data.companyData.dateClotureExercice && (
                      <div><span className="text-slate-500">Cloture:</span> <span className="text-slate-200 ml-1">{screening.inpi.data.companyData.dateClotureExercice}</span></div>
                    )}
                    {screening.inpi.data.companyData.dateImmatriculation && (
                      <div><span className="text-slate-500">Immatriculation:</span> <span className="text-slate-200 ml-1">{screening.inpi.data.companyData.dateImmatriculation}</span></div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {screening.inpi.data.companyData.capitalVariable && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Capital variable</Badge>}
                    {screening.inpi.data.companyData.ess && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">ESS</Badge>}
                    {screening.inpi.data.companyData.societeMission && <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0">Societe a mission</Badge>}
                    {screening.inpi.data.companyData.associeUnique && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Associe unique</Badge>}
                    {screening.inpi.data.companyData.nonDiffusible && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0">Non diffusible</Badge>}
                    {screening.inpi.data.companyData.domiciliataire && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Domiciliataire</Badge>}
                  </div>
                </div>
              </div>
            )}
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">Beneficiaire {i + 1}</span>
                      {(() => {
                        const key = `${b.nom}-${b.prenom}`;
                        const status = beScreening[key];
                        if (status === "loading") return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />;
                        if (status === "clean") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                        if (status === "match") return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
                        if (status === "error") return <span className="text-[9px] text-slate-500">N/A</span>;
                        return null;
                      })()}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeBeneficiaire(i)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-6 gap-3">
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
                      <Label className="text-[10px] text-slate-500">% parts</Label>
                      <Input type="number" value={b.pourcentage} onChange={e => updateBeneficiaire(i, "pourcentage", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" min={0} max={100} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">% votes</Label>
                      <Input type="number" value={b.pourcentageVotes ?? 0} onChange={e => updateBeneficiaire(i, "pourcentageVotes", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06] h-9 text-sm" min={0} max={100} />
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

            {/* Screening summary at scoring step */}
            {(screening.sanctions.data || screening.bodacc.data || screening.google.data || screening.news.data) && (
              <div className="lg:col-span-2">
                <ScreeningPanel screening={screening} compact />
              </div>
            )}

            {/* Decision */}
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] lg:col-span-2">
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

            {/* SECTION 1: Documents INPI recuperes (vrais PDFs uniquement) */}
            {(() => {
              // Merge real PDFs from documents-fetch and inpi-documents
              const docsFetch = (screening.documents.data?.documents ?? []).filter(d =>
                (d as any).storedInSupabase === true || ((d as any).downloadable && d.status === "auto")
              );
              const docsInpi = (screening.inpi.data?.documents ?? []).filter(d => d.storedInSupabase);
              // Deduplicate by storageUrl
              const seen = new Set<string>();
              const allPdfs = [...docsFetch, ...docsInpi].filter(d => {
                const url = (d as any).storageUrl || (d as any).url || "";
                if (seen.has(url)) return false;
                seen.add(url);
                return true;
              });
              return allPdfs.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Documents recuperes automatiquement (INPI)</Label>
                  {allPdfs.map((doc, i) => (
                    <div key={`pdf-${i}`} className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <div>
                          <p className="text-sm text-slate-200">{doc.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{doc.type}</Badge>
                            <Badge className="text-[9px] bg-indigo-500/20 text-indigo-400 border-0">INPI</Badge>
                            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">PDF stocke</Badge>
                          </div>
                        </div>
                      </div>
                      {((doc as any).storageUrl || doc.url) && (
                        <a href={(doc as any).storageUrl || doc.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-2.5 py-1 rounded flex items-center gap-1">
                          <FileDown className="w-3 h-3" /> Telecharger PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : screening.documents.loading || screening.inpi.loading ? (
                <div className="flex items-center gap-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-sm text-slate-400">Recuperation des documents INPI...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Aucun document PDF recupere automatiquement</span>
                </div>
              );
            })()}

            {/* Pappers KBIS/RBE links (if available) */}
            {(() => {
              const pappersLinks = (screening.documents.data?.documents ?? []).filter(d =>
                (d.source === "Pappers" || d.source === "pappers") && d.status === "auto" && (d as any).downloadable
              );
              return pappersLinks.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Documents Pappers</Label>
                  {pappersLinks.map((doc, i) => (
                    <div key={`pappers-${i}`} className="flex items-center justify-between p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <div>
                          <p className="text-sm text-slate-200">{doc.label}</p>
                          <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0 mt-0.5">Pappers</Badge>
                        </div>
                      </div>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-2.5 py-1 rounded flex items-center gap-1">
                          <FileDown className="w-3 h-3" /> Telecharger
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* INPI Financial data — Phase 2: multi-year */}
            {screening.inpi.data?.financials && screening.inpi.data.financials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Donnees financieres INPI ({screening.inpi.data.financials.length} exercice(s))</Label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-2 text-slate-500 font-medium">Indicateur</th>
                        {screening.inpi.data.financials.map((f, i) => (
                          <th key={i} className="text-right py-2 text-slate-500 font-medium px-3">{f.dateCloture || `Exercice ${i + 1}`}</th>
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
                          <tr key={row.key} className="border-b border-white/[0.04]">
                            <td className="py-2 text-slate-400">{row.label}</td>
                            {screening.inpi.data!.financials.map((f, i) => {
                              const val = f[row.key];
                              const isNeg = typeof val === "number" && val < 0;
                              return (
                                <td key={i} className={`text-right py-2 px-3 font-mono ${isNeg ? "text-red-400" : "text-slate-200"}`}>
                                  {val != null ? (row.key === "effectif" ? val : `${val.toLocaleString("fr-FR")} EUR`) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Phase 3: Alerts for negative results */}
                {screening.inpi.data.financials.some(f => f.resultat != null && f.resultat < 0) && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-red-400">Resultat net negatif detecte — vigilance recommandee</span>
                  </div>
                )}
                {screening.inpi.data.financials.some(f => f.capitauxPropres != null && f.capitauxPropres < 0) && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-red-400">Capitaux propres negatifs — alerte financiere</span>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: Checklist documentaire */}
            {(() => {
              // Gather all real PDFs for checklist matching
              const allDocs = [
                ...(screening.documents.data?.documents ?? []),
                ...(screening.inpi.data?.documents ?? []),
              ];
              const hasStoredPdf = (types: string[]) => allDocs.some(d =>
                types.some(t => d.type.toUpperCase().includes(t)) &&
                ((d as any).storedInSupabase === true || ((d as any).downloadable && d.status === "auto"))
              );
              const hasUpload = (types: string[]) => documents.some(d =>
                types.some(t => d.type.toUpperCase().includes(t))
              );
              const hasPappersLink = (types: string[]) => allDocs.some(d =>
                types.some(t => d.type.toUpperCase().includes(t)) &&
                (d.source === "Pappers" || d.source === "pappers") && d.status === "auto"
              );

              const checklist = [
                { key: "KBIS", label: "Extrait / Kbis", types: ["KBIS", "ACTE", "ACTES"], manual: false },
                { key: "Statuts", label: "Statuts a jour", types: ["STATUTS"], manual: false },
                { key: "Comptes", label: "Comptes annuels", types: ["COMPTES", "BILAN"], manual: false },
                { key: "CNI", label: "CNI dirigeant", types: ["CNI"], manual: true },
                { key: "RIB", label: "RIB / IBAN", types: ["RIB"], manual: true },
                { key: "Justificatif", label: "Justificatif domicile", types: ["JUSTIFICATIF"], manual: true },
              ];

              const results = checklist.map(c => ({
                ...c,
                hasPdf: hasStoredPdf(c.types),
                hasUpload: hasUpload(c.types),
                hasPappers: hasPappersLink(c.types),
                found: hasStoredPdf(c.types) || hasUpload(c.types) || hasPappersLink(c.types),
              }));
              const foundCount = results.filter(r => r.found).length;
              const pct = Math.round((foundCount / checklist.length) * 100);

              return (
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-300">Checklist documentaire</h3>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="w-24 h-2" />
                      <span className={`text-sm font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {results.map(item => (
                      <div key={item.key} className={`p-3 rounded-lg border text-center ${
                        item.found ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                      }`}>
                        {item.found ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" /> : <X className="w-5 h-5 text-red-400 mx-auto mb-1" />}
                        <p className={`text-xs font-medium ${item.found ? "text-emerald-400" : "text-red-400"}`}>{item.label}</p>
                        {item.hasPdf && <p className="text-[9px] text-emerald-500 mt-0.5">PDF INPI</p>}
                        {item.hasPappers && !item.hasPdf && <p className="text-[9px] text-purple-400 mt-0.5">Pappers</p>}
                        {item.hasUpload && !item.hasPdf && !item.hasPappers && <p className="text-[9px] text-amber-400 mt-0.5">Upload manuel</p>}
                        {!item.found && item.manual && <p className="text-[9px] text-red-400 mt-0.5">Manuel requis</p>}
                        {!item.found && !item.manual && <p className="text-[9px] text-red-400 mt-0.5">Manquant</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* SECTION 3: Upload zones for manual documents */}
            <div className="space-y-3">
              <Label className="text-xs text-slate-400">Documents manuels a fournir</Label>
              {[
                { type: "CNI", label: "CNI du dirigeant", desc: "Carte d'identite ou passeport en cours de validite" },
                { type: "RIB", label: "RIB / IBAN", desc: "Releve d'identite bancaire du compte professionnel" },
                { type: "Justificatif", label: "Justificatif de domicile", desc: "Justificatif de domicile du siege (< 3 mois)" },
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
                      <div className="px-4 pb-3 space-y-1">
                        {uploaded.map((doc, i) => {
                          const docIdx = documents.findIndex(d => d === doc);
                          return (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-emerald-500/5">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-slate-300">{doc.name}</span>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeDocument(docIdx)} className="text-slate-500 hover:text-red-400 h-6 w-6 p-0">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <label className="block px-4 pb-3">
                        <div
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => {
                            e.preventDefault(); e.stopPropagation();
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              const newDocs: UploadedDoc[] = Array.from(files).map(f => ({
                                name: f.name, type: zone.type, file: f,
                              }));
                              setDocuments(prev => [...prev, ...newDocs]);
                            }
                          }}
                          className="border border-dashed border-white/[0.08] hover:border-blue-500/30 rounded-lg p-4 text-center cursor-pointer transition-colors"
                        >
                          <Upload className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                          <p className="text-[10px] text-slate-500">Glissez ou cliquez pour uploader</p>
                          <input type="file" className="hidden" onChange={e => {
                            if (e.target.files) {
                              const newDocs: UploadedDoc[] = Array.from(e.target.files).map(f => ({
                                name: f.name, type: zone.type, file: f,
                              }));
                              setDocuments(prev => [...prev, ...newDocs]);
                            }
                          }} />
                        </div>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Other uploaded documents */}
            {documents.filter(d => !["CNI", "RIB", "JUSTIFICATIF"].some(t => d.type.toUpperCase().includes(t))).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Autres documents uploades</Label>
                {documents.filter(d => !["CNI", "RIB", "JUSTIFICATIF"].some(t => d.type.toUpperCase().includes(t))).map((doc, i) => {
                  const docIdx = documents.findIndex(d => d === doc);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-200">{doc.name}</p>
                          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0 mt-0.5">Upload manuel</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDocument(docIdx)} className="text-slate-500 hover:text-red-400 h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

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
        />
      )}
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", error, placeholder, options, isAuto, required, hint, needsCompletion }: {
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
}) {
  const isEmpty = !value || value === "" || value === 0;
  const showOrange = (required && isEmpty && !error) || needsCompletion;

  if (type === "select" && options) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-slate-500 uppercase">{label}</Label>
          {isAuto && !isEmpty && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
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
        {isAuto && !isEmpty && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
      </div>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-white/[0.03] mt-1 ${error ? "border-red-500/50" : showOrange ? "border-amber-500/50" : "border-white/[0.06]"}`}
      />
      {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
      {needsCompletion && !error && isEmpty && <p className="text-[10px] text-amber-400 mt-0.5">A completer</p>}
      {showOrange && !error && !needsCompletion && isEmpty && <p className="text-[10px] text-amber-400 mt-0.5">A completer manuellement</p>}
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}
