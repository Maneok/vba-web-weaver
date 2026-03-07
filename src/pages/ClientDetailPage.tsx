import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus, APE_SCORES } from "@/lib/riskEngine";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { generateLettreMission } from "@/lib/generateLettreMissionPdf";
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
} from "recharts";
import {
  ArrowLeft, FileDown, Calendar, Edit3, Save, X, User, Building, MapPin,
  Phone, Mail, AlertTriangle, CheckCircle2, Clock, FileText, Shield,
  ClipboardCheck, ScrollText, Upload, Trash2, Plus, ChevronRight,
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
  const { clients, updateClient, logs, collaborateurs } = useAppState();

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
  const { updateClient, logs, collaborateurs } = useAppState();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...client });
  const [tab, setTab] = useState("informations");

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

  // Score history (simulated based on current score)
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
        <Button variant="outline" className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400" onClick={() => toast.info("Revision planifiee")}>
          <Calendar className="w-4 h-4" /> Planifier revision
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
        <TabsList className="bg-white/[0.03] border border-white/[0.06]">
          <TabsTrigger value="informations" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Informations</TabsTrigger>
          <TabsTrigger value="personnes" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Personnes</TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Scoring</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Documents</TabsTrigger>
          <TabsTrigger value="diligences" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Diligences</TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">Historique</TabsTrigger>
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
            <h3 className="text-sm font-semibold text-slate-300">Beneficiaires effectifs</h3>
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

        {/* TAB: Scoring */}
        <TabsContent value="scoring" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
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

            {/* Score breakdown + gauge */}
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
            </div>

            {/* Score history */}
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

        {/* TAB: Documents */}
        <TabsContent value="documents" className="mt-4">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Gestion documentaire</h3>
              <label>
                <input type="file" multiple className="hidden" onChange={() => toast.info("Upload simule")} />
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06] cursor-pointer" asChild>
                  <span><Upload className="w-3.5 h-3.5" /> Ajouter</span>
                </Button>
              </label>
            </div>

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
                      <Input
                        type="date" value={d.deadline}
                        onChange={e => updateDiligence(i, "deadline", e.target.value)}
                        className="w-[140px] h-8 text-xs bg-white/[0.03] border-white/[0.06]"
                      />
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

        {/* TAB: Historique */}
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
