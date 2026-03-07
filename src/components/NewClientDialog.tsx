import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "@/lib/riskEngine";
import type { Client, OuiNon, MissionType, EtatPilotage } from "@/lib/types";
import { VigilanceBadge, ScoreGauge } from "@/components/RiskBadges";
import PappersSearch from "@/components/PappersSearch";

interface Props { open: boolean; onClose: () => void; }

const FORMES = ["ENTREPRISE INDIVIDUELLE", "SARL", "EURL", "SAS", "SCI", "SCP", "SELAS", "EARL", "SA", "ASSOCIATION"];
const MISSIONS: MissionType[] = ["TENUE COMPTABLE", "REVISION / SURVEILLANCE", "SOCIAL / PAIE SEULE", "CONSEIL DE GESTION", "CONSTITUTION / CESSION", "DOMICILIATION", "IRPP"];
const FORMES = ["ENTREPRISE INDIVIDUELLE", "SARL", "EURL", "SAS", "SCI", "SCP", "SELAS", "EARL", "SA"];
const EFFECTIFS = ["0 SALARIÉ", "1 OU 2 SALARIÉS", "3 À 5 SALARIÉS", "6 À 10 SALARIÉS", "11 À 50 SALARIÉS", "PLUS DE 50"];
const FREQUENCES = ["MENSUEL", "TRIMESTRIEL", "ANNUEL"];

export default function NewClientDialog({ open, onClose }: Props) {
  const { clients, addClient } = useAppState();
  const [form, setForm] = useState({
    raisonSociale: "", forme: "SARL", siren: "", capital: 0, ape: "", dirigeant: "",
    domaine: "", effectif: "1 OU 2 SALARIÉS", adresse: "", cp: "", ville: "",
    tel: "", mail: "", dateCreation: "2020-01-01", dateReprise: "2020-01-01",
    mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, frequence: "MENSUEL",
    comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
    ppe: false, paysRisque: false, atypique: false, distanciel: false, cash: false, pression: false,
    be: "",
  });

  const risk = calculateRiskScore({
    ape: form.ape, paysRisque: form.paysRisque, mission: form.mission,
    dateCreation: form.dateCreation, dateReprise: form.dateReprise,
    effectif: form.effectif, forme: form.forme,
    ppe: form.ppe, atypique: form.atypique, distanciel: form.distanciel,
    cash: form.cash, pression: form.pression,
  });

  const handleSubmit = () => {
    const now = new Date().toISOString().split("T")[0];
    // Generate unique ref based on max existing ref number to avoid collisions
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

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
          <div className="flex items-center gap-3">
            <ScoreGauge score={risk.scoreGlobal} />
            <VigilanceBadge level={risk.nivVigilance} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><Label>Raison Sociale *</Label><Input value={form.raisonSociale} onChange={e => set("raisonSociale", e.target.value)} /></div>
            <div><Label>SIREN *</Label><Input value={form.siren} onChange={e => set("siren", e.target.value)} placeholder="9 chiffres" /></div>
            <div><Label>Forme Juridique</Label>
              <Select value={form.forme} onValueChange={v => set("forme", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
            </div>

            </div>
          </div>
          <div className="space-y-3">
            <div><Label>Mission *</Label>
              <Select value={form.mission} onValueChange={v => set("mission", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MISSIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>

            {[
              { key: "ppe", label: "PPE (Personne Politiquement Exposée)" },
              { key: "paysRisque", label: "Pays à risque (GAFI)" },
              { key: "atypique", label: "Montage atypique" },
              { key: "distanciel", label: "Client distanciel" },
              { key: "cash", label: "Activité espèces" },
              { key: "pression", label: "Pression comportementale" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={v => set(key, v)} />
                <Label className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
        </div>


        </div>
      </DialogContent>
    </Dialog>
  );
}
