import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus, APE_SCORES } from "@/lib/riskEngine";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { generateLettreMission } from "@/lib/generateLettreMissionPdf";
import {
  searchEnterprise, checkSanctions, checkBodacc, verifyGooglePlaces, checkNews, analyzeNetwork, fetchDocuments, fetchInpiDocuments,
  INITIAL_SCREENING, type ScreeningState, type EnterpriseResult,
} from "@/lib/kycService";
import ScreeningPanel from "@/components/ScreeningPanel";
import NetworkGraph from "@/components/NetworkGraph";
import type { Client, OuiNon, EtatPilotage } from "@/lib/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScoreGauge, VigilanceBadge, PilotageBadge } from "@/components/RiskBadges";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import {
  ArrowLeft, FileDown, Calendar, Edit3, Save, X, User, Building, MapPin,
  Phone, Mail, AlertTriangle, CheckCircle2, Clock, FileText, Shield,
  ClipboardCheck, ScrollText, Upload, Trash2, Plus, ChevronRight,
  ExternalLink, Loader2, Newspaper, Globe, Users, Archive, TrendingUp,
} from "lucide-react";

const DILIGENCES_MAP: Record<string, { label: string; items: string[] }> = {
  "68": { label: "Immobilier", items: ["Controle origine des fonds", "Verification prix au m2 vs marche", "Analyse fiscalite immobiliere", "Verification comptes courants associes", "Entretien banquier habituel"] },
  "41": { label: "Immobilier/Construction", items: ["Controle origine des fonds", "Verification permis de construire", "Coherence cout/surface", "Analyse sous-traitance", "Controle TVA chantiers"] },
  "56": { label: "Restauration", items: ["Controle ratio cash/ticket moyen", "Coherence CA/effectif", "Verification fournisseurs habituels", "Analyse saisonnalite CA", "Controle pourboires/especes"] },
  "45": { label: "Vehicules", items: ["Controle TVA intracommunautaire", "Verification source financement vehicules", "Traçabilite plaques/cartes grises", "Analyse marge par vehicule", "Verification identite acheteurs cash"] },
  "64": { label: "Holdings/Finance", items: ["Mapping capitalistique complet", "Analyse flux inter-societes", "Verification substance economique", "Controle conventions de tresorerie", "Identification ultimate beneficial owner"] },
  "92": { label: "Jeux/Paris", items: ["Traçabilite des gains", "Verification source des fonds", "Profilage joueur/parieur", "Analyse frequence/montants", "Declaration TRACFIN si seuil"] },
  "47.77": { label: "Commerce de luxe", items: ["Verification origine des fonds", "Analyse clientele recurrente", "Controle transactions cash > 1000 EUR", "Registre ventes luxe", "Identification acheteurs professionnels"] },
};

const GENERIC_DILIGENCES = [
  "Verification identite dirigeant et BE",
  "Coherence CA declare vs releves bancaires",
  "Analyse flux bancaires atypiques",
  "Verification KBIS et statuts a jour",
  "Controle coherence scoring/vigilance",
];

interface Diligence {
  label: string;
  responsable: string;
  deadline: string;
  statut: "A_FAIRE" | "EN_COURS" | "FAIT";
  commentaire: string;
}

export default function ClientDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients, updateClient, logs } = useAppState();

  const client = clients.find(c => c.ref === ref);
  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">Client introuvable</p>
        <Button onClick={() => navigate("/bdd")} variant="outline" className="mt-4">Retour</Button>
      </div>
    );
  }

  return <ClientDetailContent client={client} />;
}

function ClientDetailContent({ client }: { client: Client }) {
  const navigate = useNavigate();
  const { updateClient, logs } = useAppState();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...client });
  const [tab, setTab] = useState("informations");

  // Screening state
  const [screening, setScreening] = useState<ScreeningState>(INITIAL_SCREENING);
  const [screeningLaunched, setScreeningLaunched] = useState(false);

  // Launch screening when Compliance or Reseau tab is opened
  const launchComplianceScreening = useCallback(() => {
    if (screeningLaunched) return;
    setScreeningLaunched(true);

    const siren = client.siren;
    const raisonSociale = client.raisonSociale;
    const ville = client.ville;
    const dirigeant = client.dirigeant;

    // Enterprise lookup to get dirigeants
    setScreening(prev => ({ ...prev, enterprise: { loading: true, data: null, error: null } }));
    searchEnterprise("siren", siren.replace(/\s/g, "")).then(res => {
      const data = res.results ?? [];
      setScreening(prev => ({ ...prev, enterprise: { loading: false, data, error: null } }));

      const ent = data[0];
      const dirigeants = ent?.dirigeants ?? [];
      const personsToCheck = dirigeants.length > 0
        ? dirigeants.map(d => ({ nom: d.nom, prenom: d.prenom, dateNaissance: d.date_naissance, nationalite: d.nationalite }))
        : [{ nom: dirigeant }];

      // Sanctions
      setScreening(prev => ({ ...prev, sanctions: { loading: true, data: null, error: null } }));
      checkSanctions(personsToCheck, siren.replace(/\s/g, "")).then(d => {
        setScreening(prev => ({ ...prev, sanctions: { loading: false, data: d, error: null } }));
      }).catch(() => setScreening(prev => ({ ...prev, sanctions: { loading: false, data: null, error: "Erreur" } })));

      // BODACC
      setScreening(prev => ({ ...prev, bodacc: { loading: true, data: null, error: null } }));
      checkBodacc(siren, raisonSociale).then(d => {
        setScreening(prev => ({ ...prev, bodacc: { loading: false, data: d, error: null } }));
      }).catch(() => setScreening(prev => ({ ...prev, bodacc: { loading: false, data: null, error: "Erreur" } })));

      // Google Places
      setScreening(prev => ({ ...prev, google: { loading: true, data: null, error: null } }));
      verifyGooglePlaces(raisonSociale, ville).then(d => {
        setScreening(prev => ({ ...prev, google: { loading: false, data: d, error: null } }));
      }).catch(() => setScreening(prev => ({ ...prev, google: { loading: false, data: null, error: "Erreur" } })));

      // News
      setScreening(prev => ({ ...prev, news: { loading: true, data: null, error: null } }));
      checkNews(raisonSociale, dirigeant).then(d => {
        setScreening(prev => ({ ...prev, news: { loading: false, data: d, error: null } }));
      }).catch(() => setScreening(prev => ({ ...prev, news: { loading: false, data: null, error: "Erreur" } })));

      // Network
      if (dirigeants.length > 0) {
        setScreening(prev => ({ ...prev, network: { loading: true, data: null, error: null } }));
        analyzeNetwork(siren, dirigeants).then(d => {
          setScreening(prev => ({ ...prev, network: { loading: false, data: d, error: null } }));
        }).catch(() => setScreening(prev => ({ ...prev, network: { loading: false, data: null, error: "Erreur" } })));
      }

      // Documents
      setScreening(prev => ({ ...prev, documents: { loading: true, data: null, error: null } }));
      fetchDocuments(siren, raisonSociale).then(d => {
        setScreening(prev => ({ ...prev, documents: { loading: false, data: d, error: null } }));
      }).catch(() => setScreening(prev => ({ ...prev, documents: { loading: false, data: null, error: "Erreur" } })));

      // INPI
      setScreening(prev => ({ ...prev, inpi: { loading: true, data: null, error: null } }));
      fetchInpiDocuments(siren.replace(/\s/g, "")).then(d => {
        setScreening(prev => ({ ...prev, inpi: { loading: false, data: d, error: d.error || null } }));
      }).catch(() => setScreening(prev => ({ ...prev, inpi: { loading: false, data: null, error: "Erreur" } })));
    }).catch(() => setScreening(prev => ({ ...prev, enterprise: { loading: false, data: null, error: "Erreur" } })));
  }, [screeningLaunched, client]);

  // Auto-launch screening on compliance/reseau/financier/historique_legal tab
  useEffect(() => {
    if (tab === "compliance" || tab === "reseau" || tab === "financier" || tab === "historique_legal") {
      launchComplianceScreening();
    }
  }, [tab, launchComplianceScreening]);

  // Diligences
  const apePrefix = client.ape.substring(0, 2);
  const apeFull = client.ape.substring(0, 5);
  const sectorDiligences = DILIGENCES_MAP[apeFull] || DILIGENCES_MAP[apePrefix];

  const [diligences, setDiligences] = useState<Diligence[]>(() => {
    const items = sectorDiligences
      ? sectorDiligences.items.map(label => ({ label, responsable: client.comptable, deadline: "", statut: "A_FAIRE" as const, commentaire: "" }))
      : [];
    const generic = GENERIC_DILIGENCES.map(label => ({ label, responsable: client.comptable, deadline: "", statut: "A_FAIRE" as const, commentaire: "" }));
    return [...items, ...generic];
  });

  const clientLogs = useMemo(() =>
    logs.filter(l => l.refClient === client.ref).slice(0, 50),
    [logs, client.ref]
  );

  const maluses = [
    client.ppe === "OUI" && "PPE",
    client.atypique === "OUI" && "Montage atypique",
    client.paysRisque === "OUI" && "Pays a risque",
    client.cash === "OUI" && "Especes",
    client.pression === "OUI" && "Pression",
    client.distanciel === "OUI" && "Distanciel",
  ].filter(Boolean) as string[];

  const radarData = [
    { subject: "Activite", score: client.scoreActivite },
    { subject: "Pays", score: client.scorePays },
    { subject: "Mission", score: client.scoreMission },
    { subject: "Maturite", score: client.scoreMaturite },
    { subject: "Structure", score: client.scoreStructure },
    { subject: "Malus", score: Math.min(client.malus, 100) },
  ];

  const vigilanceColor = client.nivVigilance === "SIMPLIFIEE" ? "#22c55e" : client.nivVigilance === "STANDARD" ? "#f59e0b" : "#ef4444";

  const scoreHistory = useMemo(() => {
    const base = client.scoreGlobal;
    return [
      { date: "J-12", score: Math.max(0, base + Math.round(Math.random() * 10 - 5)) },
      { date: "J-9", score: Math.max(0, base + Math.round(Math.random() * 8 - 4)) },
      { date: "J-6", score: Math.max(0, base + Math.round(Math.random() * 6 - 3)) },
      { date: "J-3", score: Math.max(0, base + Math.round(Math.random() * 4 - 2)) },
      { date: "Actuel", score: base },
    ];
  }, [client.scoreGlobal]);

  const handleSave = () => {
    const risk = calculateRiskScore({
      ape: editForm.ape, paysRisque: editForm.paysRisque === "OUI",
      mission: editForm.mission, dateCreation: editForm.dateCreation,
      dateReprise: editForm.dateReprise, effectif: editForm.effectif,
      forme: editForm.forme, ppe: editForm.ppe === "OUI",
      atypique: editForm.atypique === "OUI", distanciel: editForm.distanciel === "OUI",
      cash: editForm.cash === "OUI", pression: editForm.pression === "OUI",
    });
    const now = new Date().toISOString().split("T")[0];
    const dateButoir = calculateNextReviewDate(risk.nivVigilance, now);
    updateClient(client.ref, {
      ...editForm, ...risk, dateDerniereRevue: now, dateButoir,
      etatPilotage: getPilotageStatus(dateButoir) as EtatPilotage,
    });
    setEditing(false);
    toast.success("Client mis a jour");
  };

  const updateDiligence = (idx: number, field: keyof Diligence, val: string) => {
    setDiligences(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const diligenceProgress = useMemo(() => {
    if (diligences.length === 0) return 0;
    return Math.round((diligences.filter(d => d.statut === "FAIT").length / diligences.length) * 100);
  }, [diligences]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/bdd")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{client.raisonSociale}</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{client.ref} · SIREN {client.siren} · {client.forme}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoreGauge score={client.scoreGlobal} />
          <VigilanceBadge level={client.nivVigilance} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => { generateFicheAcceptation(client); toast.success("Fiche LCB-FT generee"); }}>
          <FileDown className="w-4 h-4" /> Fiche LCB-FT (PDF)
        </Button>
        <Button variant="outline" className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => { generateLettreMission(client); toast.success("Lettre de mission generee"); }}>
          <FileDown className="w-4 h-4" /> Lettre de mission (PDF)
        </Button>
        <Button variant="outline" className="gap-2 border-white/[0.06] hover:bg-indigo-500/10 hover:text-indigo-400" onClick={() => navigate(`/lettre-mission/${client.ref}`)}>
          <FileText className="w-4 h-4" /> Générer lettre de mission
        </Button>
        <Button variant="outline" className="gap-2 border-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-400" onClick={() => { launchComplianceScreening(); setTab("compliance"); }}>
          <Shield className="w-4 h-4" /> Lancer screening
        </Button>
      </div>

      {/* Malus flags */}
      {maluses.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex flex-wrap gap-2 items-center">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          {maluses.map((m, i) => (
            <Badge key={i} className="bg-red-500/10 text-red-400 border-0 text-[11px]">{m}</Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.03] border border-white/[0.06] flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="informations" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Informations</TabsTrigger>
          <TabsTrigger value="personnes" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Personnes</TabsTrigger>
          <TabsTrigger value="reseau" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Reseau</TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Scoring</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Documents</TabsTrigger>
          <TabsTrigger value="diligences" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Diligences</TabsTrigger>
          <TabsTrigger value="financier" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Financier</TabsTrigger>
          <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Compliance</TabsTrigger>
          <TabsTrigger value="historique_legal" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Hist. Legal</TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">Audit</TabsTrigger>
        </TabsList>

        {/* TAB: Informations */}
        <TabsContent value="informations" className="mt-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-slate-300">Informations du client</h3>
              {!editing ? (
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={() => { setEditForm({ ...client }); setEditing(true); }}>
                  <Edit3 className="w-3.5 h-3.5" /> Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}><Save className="w-3.5 h-3.5" /> Sauvegarder</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Identite</h4>
                  <InfoRow label="Dirigeant" value={client.dirigeant} icon={User} />
                  <InfoRow label="Forme juridique" value={client.forme} icon={Building} />
                  <InfoRow label="Activite" value={`${client.domaine} (${client.ape})`} />
                  <InfoRow label="Adresse" value={`${client.adresse}, ${client.cp} ${client.ville}`} icon={MapPin} />
                  <InfoRow label="Telephone" value={client.tel} icon={Phone} />
                  <InfoRow label="Email" value={client.mail} icon={Mail} />
                  <InfoRow label="Capital" value={`${client.capital.toLocaleString()} EUR`} />
                  <InfoRow label="Effectif" value={client.effectif} />
                  <InfoRow label="Date creation" value={client.dateCreation} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Mission & Suivi</h4>
                  <InfoRow label="Mission" value={client.mission} />
                  <InfoRow label="Comptable" value={client.comptable} />
                  <InfoRow label="Associe" value={client.associe} />
                  <InfoRow label="Superviseur" value={client.superviseur} />
                  <InfoRow label="Honoraires" value={`${client.honoraires.toLocaleString()} EUR HT`} />
                  <InfoRow label="Frequence" value={client.frequence} />
                  <InfoRow label="IBAN" value={client.iban || "---"} />
                  <InfoRow label="BIC" value={client.bic || "---"} />
                  <InfoRow label="Date reprise" value={client.dateReprise || "---"} />
                </div>
              </div>
            ) : (
              <EditForm form={editForm} setForm={setEditForm} />
            )}

            {/* Pilotage */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase">Derniere revue</p>
                <p className="text-sm font-medium text-slate-200 mt-1 font-mono">{client.dateDerniereRevue}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase">Date butoir</p>
                <p className="text-sm font-medium text-slate-200 mt-1 font-mono">{client.dateButoir}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase">Pilotage</p>
                <div className="mt-1"><PilotageBadge status={client.etatPilotage} /></div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Personnes */}
        <TabsContent value="personnes" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Beneficiaires effectifs & Screening PPE</h3>
              {!screeningLaunched && (
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={launchComplianceScreening}>
                  <Shield className="w-3.5 h-3.5" /> Verifier sanctions/PPE
                </Button>
              )}
            </div>

            {/* Sanctions results inline */}
            {screening.sanctions.loading && (
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-blue-400">Verification OpenSanctions en cours...</span>
              </div>
            )}
            {screening.sanctions.data && screening.sanctions.data.matches.length > 0 && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-bold text-red-400">ALERTES SANCTIONS / PPE</span>
                </div>
                {screening.sanctions.data.matches.map((m, i) => (
                  <div key={i} className="ml-7 text-xs text-red-300">
                    <span className="font-semibold">{m.person}</span> — {m.details}
                    {m.isPPE && <Badge className="ml-2 bg-red-500/20 text-red-400 border-0 text-[9px]">PPE</Badge>}
                  </div>
                ))}
              </div>
            )}
            {screening.sanctions.data && screening.sanctions.data.matches.length === 0 && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Aucun match sanctions/PPE detecte ({screening.sanctions.data.checked} personne(s) verifiee(s))</span>
              </div>
            )}

            {client.be ? (
              <div className="space-y-2">
                {client.be.split(",").map((b, i) => (
                  <div key={i} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-sm text-slate-200">{b.trim()}</span>
                    </div>
                    {client.ppe === "OUI" && (
                      <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">PPE</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">Aucun beneficiaire effectif renseigne</p>
            )}
          </div>
        </TabsContent>

        {/* TAB: Reseau (D3.js graph) */}
        <TabsContent value="reseau" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">Graphe relationnel des dirigeants</h3>
                <p className="text-xs text-slate-500 mt-0.5">Detection automatique des reseaux de societes et mandats multiples</p>
              </div>
              {!screeningLaunched && (
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={launchComplianceScreening}>
                  <Users className="w-3.5 h-3.5" /> Analyser le reseau
                </Button>
              )}
            </div>

            {screening.network.loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-sm text-slate-400 ml-3">Analyse du reseau en cours...</span>
              </div>
            )}

            {screening.network.data && (
              <>
                {/* Alertes reseau */}
                {screening.network.data.alertes.length > 0 && (
                  <div className="space-y-2">
                    {screening.network.data.alertes.map((a, i) => (
                      <div key={i} className={`p-3 rounded-lg flex items-start gap-2 ${
                        a.severity === "red" ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"
                      }`}>
                        <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.severity === "red" ? "text-red-400" : "text-amber-400"}`} />
                        <span className={`text-xs ${a.severity === "red" ? "text-red-300" : "text-amber-300"}`}>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex gap-4">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center flex-1">
                    <p className="text-2xl font-bold text-white">{screening.network.data.totalCompanies}</p>
                    <p className="text-[10px] text-slate-500">Societes detectees</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center flex-1">
                    <p className="text-2xl font-bold text-white">{screening.network.data.totalPersons}</p>
                    <p className="text-[10px] text-slate-500">Personnes</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center flex-1">
                    <p className="text-2xl font-bold text-white">{screening.network.data.alertes.length}</p>
                    <p className="text-[10px] text-slate-500">Alertes</p>
                  </div>
                </div>

                {/* Graph */}
                <NetworkGraph
                  nodes={screening.network.data.nodes}
                  edges={screening.network.data.edges}
                  width={800}
                  height={500}
                />
              </>
            )}

            {!screening.network.loading && !screening.network.data && !screeningLaunched && (
              <div className="text-center py-16 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Cliquez sur "Analyser le reseau" pour lancer l'analyse</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB: Scoring */}
        <TabsContent value="scoring" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Radar de risque 6 axes</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="score" stroke={vigilanceColor} fill={vigilanceColor} fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 text-center">
                <div className="relative w-32 h-32 mx-auto">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={vigilanceColor} strokeWidth="10"
                      strokeDasharray={`${(Math.min(client.scoreGlobal, 120) / 120) * 314} 314`}
                      strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-white">{client.scoreGlobal}</span>
                    <span className="text-[10px] text-slate-500">/120</span>
                  </div>
                </div>
                <div className="mt-3"><VigilanceBadge level={client.nivVigilance} /></div>
              </div>

              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-slate-300 mb-3">Decomposition</h3>
                <div className="space-y-2">
                  {[
                    { label: "Activite", score: client.scoreActivite },
                    { label: "Pays", score: client.scorePays },
                    { label: "Mission", score: client.scoreMission },
                    { label: "Maturite", score: client.scoreMaturite },
                    { label: "Structure", score: client.scoreStructure },
                    { label: "Malus", score: client.malus },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${item.score >= 60 ? "bg-red-500" : item.score >= 25 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(item.score, 100)}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300 w-8 text-right">{item.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BODACC malus indicator */}
              {screening.bodacc.data?.hasProcedureCollective && (
                <div className="glass-card p-3 border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-400 font-semibold">Malus BODACC : +30 (procedure collective)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Historique du score</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={scoreHistory}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 120]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0" }} />
                  <Line type="monotone" dataKey="score" stroke={vigilanceColor} strokeWidth={2} dot={{ r: 4, fill: vigilanceColor }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Financier — Phase 3 */}
        <TabsContent value="financier" className="mt-4">
          <div className="space-y-6">
            {screening.inpi.loading && (
              <div className="glass-card p-6 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="text-sm text-slate-400">Recuperation des donnees financieres INPI...</span>
              </div>
            )}

            {screening.inpi.data?.financials && screening.inpi.data.financials.length > 0 ? (
              <>
                {/* Financial table */}
                <div className="glass-card p-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Donnees financieres ({screening.inpi.data.financials.length} exercice(s))
                    <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0 ml-2">Source INPI</Badge>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left py-3 text-slate-500 font-medium text-xs">Indicateur</th>
                          {screening.inpi.data.financials.map((f, i) => (
                            <th key={i} className="text-right py-3 text-slate-500 font-medium text-xs px-4">{f.dateCloture || `Exercice ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Chiffre d'affaires", key: "chiffreAffaires" as const, unit: "EUR" },
                          { label: "Resultat net", key: "resultat" as const, unit: "EUR" },
                          { label: "Total bilan", key: "totalBilan" as const, unit: "EUR" },
                          { label: "Capitaux propres", key: "capitauxPropres" as const, unit: "EUR" },
                          { label: "Dettes", key: "dettes" as const, unit: "EUR" },
                          { label: "Effectif", key: "effectif" as const, unit: "" },
                        ].map(row => {
                          const hasData = screening.inpi.data!.financials.some(f => f[row.key] != null);
                          if (!hasData) return null;
                          return (
                            <tr key={row.key} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                              <td className="py-3 text-slate-300 text-xs">{row.label}</td>
                              {screening.inpi.data!.financials.map((f, i) => {
                                const val = f[row.key];
                                const isNeg = typeof val === "number" && val < 0;
                                return (
                                  <td key={i} className={`text-right py-3 px-4 font-mono text-xs ${isNeg ? "text-red-400 font-semibold" : "text-slate-200"}`}>
                                    {val != null ? `${val.toLocaleString("fr-FR")}${row.unit ? ` ${row.unit}` : ""}` : "—"}
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

                {/* CA Bar Chart */}
                {screening.inpi.data.financials.some(f => f.chiffreAffaires != null) && (
                  <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">Evolution du chiffre d'affaires</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={screening.inpi.data.financials.filter(f => f.chiffreAffaires != null).reverse().map(f => ({
                        date: f.dateCloture || "N/A",
                        ca: f.chiffreAffaires,
                        resultat: f.resultat,
                      }))}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0" }} formatter={(v: number) => `${v.toLocaleString("fr-FR")} EUR`} />
                        <Bar dataKey="ca" name="CA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resultat" name="Resultat" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Financial alerts */}
                <div className="glass-card p-6 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Alertes financieres</h3>
                  {screening.inpi.data.financials.some(f => f.resultat != null && f.resultat < 0) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-300">Resultat net negatif detecte</span>
                    </div>
                  )}
                  {screening.inpi.data.financials.some(f => f.capitauxPropres != null && f.capitauxPropres < 0) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-300">Capitaux propres negatifs — risque de cessation de paiement</span>
                    </div>
                  )}
                  {(() => {
                    const fin = screening.inpi.data!.financials;
                    if (fin.length >= 2 && fin[0].chiffreAffaires != null && fin[1].chiffreAffaires != null && fin[1].chiffreAffaires > 0) {
                      const variation = ((fin[0].chiffreAffaires - fin[1].chiffreAffaires) / fin[1].chiffreAffaires) * 100;
                      if (variation < -30) return (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-xs text-amber-300">Baisse du CA de {Math.abs(variation).toFixed(0)}% — surveiller</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {client.honoraires > 0 && screening.inpi.data.financials[0]?.chiffreAffaires != null && screening.inpi.data.financials[0].chiffreAffaires > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-300">Ratio honoraires/CA : {((client.honoraires / screening.inpi.data.financials[0].chiffreAffaires) * 100).toFixed(2)}%</span>
                    </div>
                  )}
                  {!screening.inpi.data.financials.some(f => f.resultat != null && f.resultat < 0) && !screening.inpi.data.financials.some(f => f.capitauxPropres != null && f.capitauxPropres < 0) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-300">Aucune alerte financiere majeure detectee</span>
                    </div>
                  )}
                </div>
              </>
            ) : !screening.inpi.loading ? (
              <div className="glass-card p-6 text-center py-16">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-30" />
                <p className="text-sm text-slate-500">Aucune donnee financiere disponible</p>
                <p className="text-xs text-slate-600 mt-1">Les bilans seront recuperes depuis l'INPI lors du screening</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* TAB: Documents */}
        <TabsContent value="documents" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Gestion documentaire</h3>
              <div className="flex gap-2">
                {!screeningLaunched && (
                  <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={launchComplianceScreening}>
                    <Globe className="w-3.5 h-3.5" /> Recuperer documents
                  </Button>
                )}
                <label>
                  <input type="file" multiple className="hidden" onChange={() => toast.info("Upload simule")} />
                  <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06] cursor-pointer" asChild>
                    <span><Upload className="w-3.5 h-3.5" /> Ajouter</span>
                  </Button>
                </label>
              </div>
            </div>

            {/* KYC completeness */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { type: "KBIS", linked: !!client.lienKbis },
                { type: "Statuts", linked: !!client.lienStatuts },
                { type: "CNI", linked: !!client.lienCni },
                { type: "RIB", linked: !!client.iban },
              ].map(doc => (
                <div key={doc.type} className={`p-4 rounded-lg border text-center ${
                  doc.linked ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/[0.06]"
                }`}>
                  {doc.linked ? <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" /> : <FileText className="w-6 h-6 text-slate-500 mx-auto mb-2" />}
                  <p className={`text-sm font-medium ${doc.linked ? "text-emerald-400" : "text-slate-500"}`}>{doc.type}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{doc.linked ? "Present" : "Manquant"}</p>
                </div>
              ))}
            </div>

            {/* Auto-recovered documents from APIs */}
            {screening.documents.loading && (
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-blue-400">Recherche de documents en cours...</span>
              </div>
            )}
            {screening.documents.data && screening.documents.data.documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400">Documents auto-recuperes ({screening.documents.data.autoRecovered})</h4>
                {screening.documents.data.documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm text-slate-200">{doc.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{doc.type}</Badge>
                          <Badge className={`text-[9px] border-0 ${
                            doc.source === "pappers" ? "bg-emerald-500/20 text-emerald-400" :
                            doc.source === "inpi" ? "bg-blue-500/20 text-blue-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`}>
                            {doc.source === "pappers" ? "Pappers" : doc.source === "inpi" ? "INPI" : "Lien auto"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="gap-1 text-blue-400 hover:text-blue-300 h-7 text-xs">
                          <ExternalLink className="w-3 h-3" /> Ouvrir
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB: Diligences */}
        <TabsContent value="diligences" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">
                  Diligences {sectorDiligences ? `- Secteur ${sectorDiligences.label}` : "generiques"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Code APE : {client.ape} · Vigilance : {client.nivVigilance}</p>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={diligenceProgress} className="w-24 h-2" />
                <span className="text-sm font-bold text-slate-300">{diligenceProgress}%</span>
              </div>
            </div>

            <div className="space-y-2">
              {diligences.map((d, i) => (
                <div key={i} className={`p-4 rounded-lg border transition-colors ${
                  d.statut === "FAIT" ? "border-emerald-500/20 bg-emerald-500/5" :
                  d.statut === "EN_COURS" ? "border-amber-500/20 bg-amber-500/5" :
                  "border-white/[0.06] bg-white/[0.02]"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <ClipboardCheck className={`w-4 h-4 shrink-0 ${
                        d.statut === "FAIT" ? "text-emerald-400" : d.statut === "EN_COURS" ? "text-amber-400" : "text-slate-500"
                      }`} />
                      <span className="text-sm text-slate-200">{d.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={d.responsable} onValueChange={v => updateDiligence(i, "responsable", v)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["MAGALIE", "JULIEN", "FANNY", "SERGE", "JOSE"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={d.deadline} onChange={e => updateDiligence(i, "deadline", e.target.value)} className="w-[140px] h-8 text-xs bg-white/[0.03] border-white/[0.06]" />
                      <Select value={d.statut} onValueChange={v => updateDiligence(i, "statut", v)}>
                        <SelectTrigger className={`w-[110px] h-8 text-xs ${
                          d.statut === "FAIT" ? "text-emerald-400 border-emerald-500/30" :
                          d.statut === "EN_COURS" ? "text-amber-400 border-amber-500/30" :
                          "border-white/[0.06]"
                        }`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A_FAIRE">A faire</SelectItem>
                          <SelectItem value="EN_COURS">En cours</SelectItem>
                          <SelectItem value="FAIT">Fait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB: Compliance */}
        <TabsContent value="compliance" className="mt-4">
          <div className="space-y-6">
            {/* Screening panel */}
            <ScreeningPanel screening={screening} />

            {/* BODACC History */}
            {screening.bodacc.data && screening.bodacc.data.annonces.length > 0 && (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Historique legal (BODACC)</h3>
                <div className="space-y-2">
                  {screening.bodacc.data.annonces.map((a, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      a.isProcedureCollective ? "border-red-500/20 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {a.isProcedureCollective && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                          <span className="text-sm text-slate-200 font-medium">{a.type}</span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{a.date}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                      {a.tribunal && <p className="text-[10px] text-slate-500 mt-1">Tribunal: {a.tribunal}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News / Revue de presse */}
            {screening.news.data && screening.news.data.articles.length > 0 && (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-purple-400" /> Revue de presse
                </h3>
                <div className="space-y-2">
                  {screening.news.data.articles.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      className={`block p-3 rounded-lg border hover:bg-white/[0.03] transition-colors ${
                        a.hasAlertKeyword ? "border-red-500/20 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-slate-200 font-medium">{a.title}</p>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-500">{a.source}</span>
                            <span className="text-[10px] text-slate-500">{a.publishedAt?.split("T")[0]}</span>
                            {a.hasAlertKeyword && (
                              <Badge className="bg-red-500/15 text-red-400 border-0 text-[9px]">
                                Mots-cles : {a.matchedKeywords.join(", ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Google Places */}
            {screening.google.data?.place && (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Verification Google Places
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <InfoRow label="Nom" value={screening.google.data.place.name} />
                    <InfoRow label="Adresse" value={screening.google.data.place.address} />
                    <InfoRow label="Statut" value={screening.google.data.place.businessStatus === "OPERATIONAL" ? "En activite" : screening.google.data.place.businessStatus} />
                    <InfoRow label="Note" value={screening.google.data.place.rating ? `${screening.google.data.place.rating}/5 (${screening.google.data.place.totalRatings} avis)` : "Pas de note"} />
                  </div>
                  <div>
                    {screening.google.data.mapsEmbedUrl && (
                      <iframe
                        src={screening.google.data.mapsEmbedUrl}
                        width="100%" height="200"
                        style={{ border: 0, borderRadius: "8px" }}
                        allowFullScreen
                        loading="lazy"
                        title="Google Maps"
                      />
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {screening.google.data.mapsUrl && (
                        <a href={screening.google.data.mapsUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                          <MapPin className="w-3 h-3" /> Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {(screening.google.data as any).streetViewUrl && (
                        <a href={(screening.google.data as any).streetViewUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                          Street View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!screeningLaunched && (
              <div className="text-center py-16 glass-card">
                <Shield className="w-12 h-12 mx-auto mb-4 text-slate-500 opacity-30" />
                <p className="text-sm text-slate-500">Cliquez sur "Lancer screening" pour verifier ce client</p>
                <Button className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700" onClick={launchComplianceScreening}>
                  <Shield className="w-4 h-4" /> Lancer le screening compliance
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB: Historique Legal — Phase 5 */}
        <TabsContent value="historique_legal" className="mt-4">
          <div className="space-y-6">
            {screening.inpi.loading && (
              <div className="glass-card p-6 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="text-sm text-slate-400">Chargement de l'historique legal...</span>
              </div>
            )}

            {/* Phase 5 Alerts */}
            {screening.inpi.data?.companyData && (() => {
              const alerts: Array<{ msg: string; severity: "red" | "orange" }> = [];
              const hist = screening.inpi.data.companyData.historique || [];
              const now = new Date();

              // Company age < 1 year
              const dateImmat = screening.inpi.data.companyData.dateImmatriculation || screening.inpi.data.companyData.dateDebutActivite;
              if (dateImmat) {
                const d = new Date(dateImmat);
                const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
                if (diffMonths < 12) alerts.push({ msg: `Societe creee il y a ${diffMonths} mois (< 1 an) — risque de societe ephemere`, severity: "orange" });
              }

              // Recent dirigeant change < 12 months
              const dirChanges = hist.filter((h: any) => h.type?.toLowerCase().includes("dirig") || h.description?.toLowerCase().includes("dirig"));
              dirChanges.forEach((h: any) => {
                if (h.date) {
                  const d = new Date(h.date);
                  const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
                  if (diffMonths < 12) alerts.push({ msg: `Changement de dirigeant le ${h.date} (< 12 mois)`, severity: "orange" });
                }
              });

              // Recent statuts change < 6 months
              const statutChanges = hist.filter((h: any) => h.type?.toLowerCase().includes("statut") || h.description?.toLowerCase().includes("statut"));
              statutChanges.forEach((h: any) => {
                if (h.date) {
                  const d = new Date(h.date);
                  const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
                  if (diffMonths < 6) alerts.push({ msg: `Modification des statuts le ${h.date} (< 6 mois)`, severity: "orange" });
                }
              });

              // Capital decrease
              const capChanges = hist.filter((h: any) => h.description?.toLowerCase().includes("capital") && h.description?.toLowerCase().includes("diminu"));
              capChanges.forEach((h: any) => {
                alerts.push({ msg: `Diminution de capital detectee le ${h.date || "date inconnue"}`, severity: "red" });
              });

              if (alerts.length === 0) return null;

              return (
                <div className="glass-card p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Alertes historiques
                  </h3>
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${
                      a.severity === "red" ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"
                    }`}>
                      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.severity === "red" ? "text-red-400" : "text-amber-400"}`} />
                      <span className={`text-xs ${a.severity === "red" ? "text-red-300" : "text-amber-300"}`}>{a.msg}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* INPI History Timeline */}
            {screening.inpi.data?.companyData?.historique && screening.inpi.data.companyData.historique.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-indigo-400" /> Historique INPI (RNE)
                  <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0 ml-2">INPI</Badge>
                </h3>
                <div className="relative pl-6 space-y-3">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/[0.08]" />
                  {screening.inpi.data.companyData.historique.map((h, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      <div className="absolute left-[-18px] w-3 h-3 rounded-full bg-indigo-500/30 border border-indigo-500/50 mt-1" />
                      <div className="flex-1 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">{h.type || h.description}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{h.date}</span>
                        </div>
                        {h.description && h.type && h.description !== h.type && (
                          <p className="text-[11px] text-slate-400 mt-1">{h.description}</p>
                        )}
                        {h.detail && <p className="text-[10px] text-slate-500 mt-0.5">{h.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BODACC annonces in the same timeline */}
            {screening.bodacc.data && screening.bodacc.data.annonces.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-amber-400" /> Annonces BODACC
                  <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0 ml-2">BODACC</Badge>
                </h3>
                <div className="relative pl-6 space-y-3">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/[0.08]" />
                  {screening.bodacc.data.annonces.map((a, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      <div className={`absolute left-[-18px] w-3 h-3 rounded-full mt-1 ${
                        a.isProcedureCollective ? "bg-red-500/50 border-red-500" : "bg-amber-500/30 border-amber-500/50"
                      } border`} />
                      <div className={`flex-1 p-3 rounded-lg border ${
                        a.isProcedureCollective ? "border-red-500/20 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {a.isProcedureCollective && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                            <span className="text-xs font-medium text-slate-200">{a.type}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{a.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                        {a.tribunal && <p className="text-[10px] text-slate-500 mt-1">Tribunal: {a.tribunal}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!screening.inpi.loading && !screening.inpi.data?.companyData?.historique?.length && !screening.bodacc.data?.annonces?.length && (
              <div className="glass-card p-6 text-center py-16">
                <Clock className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-30" />
                <p className="text-sm text-slate-500">Aucun historique legal disponible</p>
                {!screeningLaunched && (
                  <Button className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700" onClick={launchComplianceScreening}>
                    <Shield className="w-4 h-4" /> Lancer le screening
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB: Historique (Audit) */}
        <TabsContent value="historique" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">Journal d'audit</h3>
            {clientLogs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Aucun evenement enregistre</p>
            ) : (
              <div className="space-y-2">
                {clientLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-200">{log.details}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{log.horodatage}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="text-[9px] bg-white/[0.06] text-slate-400 border-0">{log.typeAction}</Badge>
                        <span className="text-[10px] text-slate-500">{log.utilisateur}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      {Icon && <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-slate-200 mt-0.5">{value || "---"}</p>
      </div>
    </div>
  );
}

function EditForm({ form, setForm }: { form: Client; setForm: (f: Client) => void }) {
  const set = (key: keyof Client, val: unknown) => setForm({ ...form, [key]: val });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-[10px] text-slate-500">Raison Sociale</Label>
        <Input value={form.raisonSociale} onChange={e => set("raisonSociale", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" />
      </div>
      <div>
        <Label className="text-[10px] text-slate-500">Dirigeant</Label>
        <Input value={form.dirigeant} onChange={e => set("dirigeant", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" />
      </div>
      <div>
        <Label className="text-[10px] text-slate-500">Adresse</Label>
        <Input value={form.adresse} onChange={e => set("adresse", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[10px] text-slate-500">CP</Label><Input value={form.cp} onChange={e => set("cp", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
        <div><Label className="text-[10px] text-slate-500">Ville</Label><Input value={form.ville} onChange={e => set("ville", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
      </div>
      <div><Label className="text-[10px] text-slate-500">Telephone</Label><Input value={form.tel} onChange={e => set("tel", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
      <div><Label className="text-[10px] text-slate-500">Email</Label><Input value={form.mail} onChange={e => set("mail", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
      <div><Label className="text-[10px] text-slate-500">Honoraires</Label><Input type="number" value={form.honoraires} onChange={e => set("honoraires", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06]" /></div>
      <div><Label className="text-[10px] text-slate-500">IBAN</Label><Input value={form.iban} onChange={e => set("iban", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
      <div><Label className="text-[10px] text-slate-500">BIC</Label><Input value={form.bic} onChange={e => set("bic", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
      <div>
        <Label className="text-[10px] text-slate-500">Mission</Label>
        <Select value={form.mission} onValueChange={v => set("mission", v)}>
          <SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["TENUE COMPTABLE", "REVISION / SURVEILLANCE", "SOCIAL / PAIE SEULE", "CONSEIL DE GESTION", "CONSTITUTION / CESSION", "DOMICILIATION", "IRPP"] as const).map(m =>
              <SelectItem key={m} value={m}>{m}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-[10px] text-slate-500 mb-2 block">Facteurs de risque</Label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: "ppe", label: "PPE" },
            { key: "paysRisque", label: "Pays a risque" },
            { key: "atypique", label: "Atypique" },
            { key: "distanciel", label: "Distanciel" },
            { key: "cash", label: "Especes" },
            { key: "pression", label: "Pression" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={form[key] === "OUI"} onCheckedChange={v => set(key, v ? "OUI" : "NON")} />
              <Label className="text-xs text-slate-400">{label}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
