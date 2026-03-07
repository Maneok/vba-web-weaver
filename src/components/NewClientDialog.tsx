import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "@/lib/riskEngine";
import type { Client, OuiNon, MissionType, EtatPilotage } from "@/lib/types";
import type { PappersResult } from "@/lib/pappersService";
import { VigilanceBadge, ScoreGauge } from "@/components/RiskBadges";
import PappersSearch from "@/components/PappersSearch";

interface Props { open: boolean; onClose: () => void; }

const FORMES = ["ENTREPRISE INDIVIDUELLE", "SARL", "EURL", "SAS", "SCI", "SCP", "SELAS", "EARL", "SA", "ASSOCIATION"];
const MISSIONS: MissionType[] = ["TENUE COMPTABLE", "REVISION / SURVEILLANCE", "SOCIAL / PAIE SEULE", "CONSEIL DE GESTION", "CONSTITUTION / CESSION", "DOMICILIATION", "IRPP"];

export default function NewClientDialog({ open, onClose }: Props) {
  const { clients, addClient } = useAppState();
  const [form, setForm] = useState({
    raisonSociale: "", forme: "SARL", siren: "", capital: 0, ape: "", dirigeant: "",
    domaine: "", effectif: "1 OU 2 SALARIES", adresse: "", cp: "", ville: "",
    tel: "", mail: "", dateCreation: "2020-01-01", dateReprise: "2020-01-01",
    mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, frequence: "MENSUEL",
    comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
    ppe: false, paysRisque: false, atypique: false, distanciel: false, cash: false, pression: false,
    be: "",
    lienKbis: "", lienStatuts: "", lienCni: "",
  });

  const risk = calculateRiskScore({
    ape: form.ape, paysRisque: form.paysRisque, mission: form.mission,
    dateCreation: form.dateCreation, dateReprise: form.dateReprise,
    effectif: form.effectif, forme: form.forme,
    ppe: form.ppe, atypique: form.atypique, distanciel: form.distanciel,
    cash: form.cash, pression: form.pression,
  });

  const handlePappersSelect = (result: PappersResult) => {
    const formeMatch = FORMES.find(f =>
      f === result.forme_juridique ||
      result.forme_juridique_raw.toUpperCase().includes(f)
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
      be: result.beneficiaires_effectifs || prev.be,
      lienKbis: result.document_urls?.["Extrait Kbis"] || result.document_urls?.["kbis"] || prev.lienKbis,
      lienStatuts: result.document_urls?.["Statuts"] || result.document_urls?.["statuts"] || prev.lienStatuts,
    }));
  };

  const handleSubmit = () => {
    const now = new Date().toISOString().split("T")[0];
    const existingNums = clients.map(c => {
      const match = c.ref.match(/CLI-26-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = Math.max(0, ...existingNums) + 1;
    const ref = `CLI-26-${String(nextNum).padStart(3, "0")}`;
    const dateButoir = calculateNextReviewDate(risk.nivVigilance, now);

    const newClient: Client = {
      ref, etat: "VALIDE", comptable: form.comptable, mission: form.mission,
      raisonSociale: form.raisonSociale, forme: form.forme,
      adresse: form.adresse, cp: form.cp, ville: form.ville, siren: form.siren,
      capital: form.capital, ape: form.ape, dirigeant: form.dirigeant,
      domaine: form.domaine, effectif: form.effectif,
      tel: form.tel, mail: form.mail,
      dateCreation: form.dateCreation, dateReprise: form.dateReprise,
      honoraires: form.honoraires, reprise: 0, juridique: 0,
      frequence: form.frequence, iban: "", bic: "",
      associe: form.associe, superviseur: form.superviseur,
      ppe: (form.ppe ? "OUI" : "NON") as OuiNon,
      paysRisque: (form.paysRisque ? "OUI" : "NON") as OuiNon,
      atypique: (form.atypique ? "OUI" : "NON") as OuiNon,
      distanciel: (form.distanciel ? "OUI" : "NON") as OuiNon,
      cash: (form.cash ? "OUI" : "NON") as OuiNon,
      pression: (form.pression ? "OUI" : "NON") as OuiNon,
      ...risk,
      dateCreationLigne: now, dateDerniereRevue: now,
      dateButoir, etatPilotage: getPilotageStatus(dateButoir) as EtatPilotage,
      dateExpCni: "", statut: "ACTIF", be: form.be,
    };
    addClient(newClient);
    onClose();
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[hsl(217,33%,14%)] border-white/[0.06]">
        <DialogHeader>
          <DialogTitle className="text-white">Nouveau Dossier Client</DialogTitle>
        </DialogHeader>

        {/* Auto-KYC Pappers Search */}
        <PappersSearch onSelect={handlePappersSelect} />

        <Separator className="bg-white/[0.06]" />

        {/* Live score preview */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
          <span className="text-xs text-slate-400 uppercase tracking-widest">Score en direct</span>
          <div className="flex items-center gap-3">
            <ScoreGauge score={risk.scoreGlobal} />
            <VigilanceBadge level={risk.nivVigilance} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><Label className="text-slate-400 text-xs">Raison Sociale *</Label><Input value={form.raisonSociale} onChange={e => set("raisonSociale", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">SIREN *</Label><Input value={form.siren} onChange={e => set("siren", e.target.value)} placeholder="9 chiffres" className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Forme Juridique</Label>
              <Select value={form.forme} onValueChange={v => set("forme", v)}><SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger><SelectContent>{FORMES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-slate-400 text-xs">Dirigeant</Label><Input value={form.dirigeant} onChange={e => set("dirigeant", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">APE</Label><Input value={form.ape} onChange={e => set("ape", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Domaine d'activite</Label><Input value={form.domaine} onChange={e => set("domaine", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Adresse</Label><Input value={form.adresse} onChange={e => set("adresse", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-slate-400 text-xs">CP</Label><Input value={form.cp} onChange={e => set("cp", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
              <div><Label className="text-slate-400 text-xs">Ville</Label><Input value={form.ville} onChange={e => set("ville", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            </div>
          </div>
          <div className="space-y-3">
            <div><Label className="text-slate-400 text-xs">Mission *</Label>
              <Select value={form.mission} onValueChange={v => set("mission", v)}><SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger><SelectContent>{MISSIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-slate-400 text-xs">Honoraires</Label><Input type="number" value={form.honoraires} onChange={e => set("honoraires", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Capital</Label><Input type="number" value={form.capital} onChange={e => set("capital", Number(e.target.value))} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Date de creation</Label><Input type="date" value={form.dateCreation} onChange={e => set("dateCreation", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Date de reprise</Label><Input type="date" value={form.dateReprise} onChange={e => set("dateReprise", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
            <div><Label className="text-slate-400 text-xs">Beneficiaires Effectifs</Label><Input value={form.be} onChange={e => set("be", e.target.value)} className="bg-white/[0.03] border-white/[0.06]" /></div>
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-slate-400 text-xs">Telephone</Label><Input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="0XXXXXXXXX" className="bg-white/[0.03] border-white/[0.06]" /></div>
          <div><Label className="text-slate-400 text-xs">Email</Label><Input value={form.mail} onChange={e => set("mail", e.target.value)} placeholder="email@exemple.fr" className="bg-white/[0.03] border-white/[0.06]" /></div>
        </div>

        {/* Risk flags */}
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">Facteurs de risque</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "ppe", label: "PPE (Personne Politiquement Exposee)" },
              { key: "paysRisque", label: "Pays a risque (GAFI)" },
              { key: "atypique", label: "Montage atypique" },
              { key: "distanciel", label: "Client distanciel" },
              { key: "cash", label: "Activite especes" },
              { key: "pression", label: "Pression comportementale" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2.5">
                <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={v => set(key, v)} />
                <Label className="text-xs text-slate-400">{label}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
            Valider & Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
