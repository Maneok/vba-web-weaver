import { useState, useCallback } from "react";
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
import RadarScoreChart from "@/components/RadarScoreChart";
import KycBadge from "@/components/KycBadge";
import { calculateKycCompleteness } from "@/lib/dataLoader";
import { fetchPappersData, checkPPE, checkGelAvoirs, mapFormeJuridique, mapEffectif } from "@/lib/pappersService";
import { Search, Loader2, CheckCircle, AlertTriangle, Shield } from "lucide-react";

interface Props { open: boolean; onClose: () => void; }

const MISSIONS: MissionType[] = ["TENUE COMPTABLE", "REVISION / SURVEILLANCE", "SOCIAL / PAIE SEULE", "CONSEIL DE GESTION", "CONSTITUTION / CESSION", "DOMICILIATION", "IRPP"];
const FORMES = ["ENTREPRISE INDIVIDUELLE", "SARL", "EURL", "SAS", "SCI", "SCP", "SELAS", "EARL", "SA", "ASSOCIATION"];
const EFFECTIFS = ["0 SALARIÉ", "1 OU 2 SALARIÉS", "3 À 5 SALARIÉS", "6 À 10 SALARIÉS", "11 À 50 SALARIÉS", "PLUS DE 50"];

export default function NewClientDialog({ open, onClose }: Props) {
  const { clients, addClient } = useAppState();
  const [form, setForm] = useState({
    raisonSociale: "", forme: "SARL", siren: "", capital: 0, ape: "", dirigeant: "",
    domaine: "", effectif: "1 OU 2 SALARIÉS", adresse: "", cp: "", ville: "",
    tel: "", mail: "", dateCreation: "2020-01-01", dateReprise: new Date().toISOString().split("T")[0],
    mission: "TENUE COMPTABLE" as MissionType, honoraires: 0, frequence: "MENSUEL",
    comptable: "MAGALIE", associe: "DIDIER", superviseur: "SAMUEL",
    ppe: false, paysRisque: false, atypique: false, distanciel: false, cash: false, pression: false,
    be: "", iban: "", bic: "",
  });

  const [pappersLoading, setPappersLoading] = useState(false);
  const [pappersStatus, setPappersStatus] = useState<"idle" | "success" | "error">("idle");
  const [ppeDetails, setPpeDetails] = useState("");
  const [gelStatus, setGelStatus] = useState<"CLEAN" | "FLAGGED" | "UNKNOWN">("UNKNOWN");
  const [simMode, setSimMode] = useState(false);
  const [simOverrides, setSimOverrides] = useState<Partial<typeof form>>({});

  const effectiveForm = simMode ? { ...form, ...simOverrides } : form;

  const risk = calculateRiskScore({
    ape: effectiveForm.ape, paysRisque: effectiveForm.paysRisque, mission: effectiveForm.mission,
    dateCreation: effectiveForm.dateCreation, dateReprise: effectiveForm.dateReprise,
    effectif: effectiveForm.effectif, forme: effectiveForm.forme,
    ppe: effectiveForm.ppe, atypique: effectiveForm.atypique, distanciel: effectiveForm.distanciel,
    cash: effectiveForm.cash, pression: effectiveForm.pression,
  });

  const baseRisk = simMode ? calculateRiskScore({
    ape: form.ape, paysRisque: form.paysRisque, mission: form.mission,
    dateCreation: form.dateCreation, dateReprise: form.dateReprise,
    effectif: form.effectif, forme: form.forme,
    ppe: form.ppe, atypique: form.atypique, distanciel: form.distanciel,
    cash: form.cash, pression: form.pression,
  }) : null;

  // Calculate KYC completeness on-the-fly
  const tempClient = { ...form, scoreGlobal: risk.scoreGlobal } as any;
  const kycPct = calculateKycCompleteness(tempClient);

  // PAPPERS AUTO-FILL
  const handlePappersLookup = useCallback(async () => {
    const cleanSiren = form.siren.replace(/\s/g, "");
    if (cleanSiren.length !== 9) return;

    setPappersLoading(true);
    setPappersStatus("idle");

    const result = await fetchPappersData(cleanSiren);
    if (result.success && result.data) {
      const d = result.data;
      const dirigeant = d.dirigeants?.[0] ? `${d.dirigeants[0].nom} ${d.dirigeants[0].prenom}` : "";
      const be = d.beneficiaires_effectifs?.map(b => `${b.nom} ${b.prenom} (${b.pourcentage_parts}%)`).join(" / ") || "";

      setForm(prev => ({
        ...prev,
        raisonSociale: d.denomination || prev.raisonSociale,
        forme: mapFormeJuridique(d.forme_juridique) || prev.forme,
        adresse: d.adresse_ligne_1 || prev.adresse,
        cp: d.code_postal || prev.cp,
        ville: d.ville || prev.ville,
        ape: d.code_naf || prev.ape,
        capital: d.capital ?? prev.capital,
        dirigeant: dirigeant || prev.dirigeant,
        domaine: d.libelle_code_naf || prev.domaine,
        effectif: mapEffectif(d.tranche_effectif || d.effectifs) || prev.effectif,
        dateCreation: d.date_creation || prev.dateCreation,
        be: be || prev.be,
      }));
      setPappersStatus("success");

      // Auto-check PPE
      if (d.dirigeants?.[0]) {
        const ppeResult = await checkPPE(d.dirigeants[0].nom, d.dirigeants[0].prenom);
        if (ppeResult.isPPE) {
          setForm(prev => ({ ...prev, ppe: true }));
          setPpeDetails(ppeResult.details || "PPE détecté");
        }
      }

      // Auto-check gel d'avoirs
      const gel = await checkGelAvoirs(cleanSiren, d.denomination);
      setGelStatus(gel);
    } else {
      setPappersStatus("error");
    }
    setPappersLoading(false);
  }, [form.siren]);

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
      frequence: form.frequence, iban: form.iban, bic: form.bic,
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
      ppeDetails: ppeDetails || undefined,
      gelAvoirs: gelStatus,
      scoreHistory: [{
        date: now, scoreGlobal: risk.scoreGlobal, nivVigilance: risk.nivVigilance,
        motif: "Création du dossier",
        details: { scoreActivite: risk.scoreActivite, scorePays: risk.scorePays, scoreMission: risk.scoreMission, scoreMaturite: risk.scoreMaturite, scoreStructure: risk.scoreStructure, malus: risk.malus },
      }],
    };
    addClient(newClient);
    onClose();
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));
  const setSim = (key: string, val: any) => setSimOverrides(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Nouveau Client
            <KycBadge completeness={kycPct} size="sm" />
          </DialogTitle>
        </DialogHeader>

        {/* Live score + radar preview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score temps réel</span>
              <div className="flex items-center gap-3">
                <ScoreGauge score={risk.scoreGlobal} />
                <VigilanceBadge level={risk.nivVigilance} />
              </div>
            </div>
            {/* Gel d'avoirs status */}
            <div className="flex items-center gap-2 text-xs">
              <Shield className="w-3 h-3" />
              <span>Gel d'avoirs DG Trésor: </span>
              {gelStatus === "CLEAN" && <span className="text-green-600 font-semibold">CLEAN</span>}
              {gelStatus === "FLAGGED" && <span className="text-red-600 font-semibold">SIGNALÉ</span>}
              {gelStatus === "UNKNOWN" && <span className="text-muted-foreground">Non vérifié</span>}
            </div>
            {ppeDetails && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                PPE détecté: {ppeDetails}
              </div>
            )}
            {/* Simulation toggle */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch checked={simMode} onCheckedChange={setSimMode} />
              <Label className="text-xs">Mode Simulation</Label>
            </div>
            {simMode && (
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">Modifiez les paramètres ci-dessous pour simuler l'impact :</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "ppe", label: "PPE" },
                    { key: "paysRisque", label: "Pays risque" },
                    { key: "atypique", label: "Atypique" },
                    { key: "cash", label: "Cash" },
                    { key: "distanciel", label: "Distanciel" },
                    { key: "pression", label: "Pression" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Switch
                        checked={(simOverrides[key as keyof typeof simOverrides] ?? form[key as keyof typeof form]) as boolean}
                        onCheckedChange={v => setSim(key, v)}
                      />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                {baseRisk && (
                  <p className="font-semibold">
                    Score actuel: {baseRisk.scoreGlobal} → Simulé: <span className={risk.scoreGlobal > baseRisk.scoreGlobal ? "text-red-600" : "text-green-600"}>{risk.scoreGlobal}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          <RadarScoreChart
            scores={simMode && baseRisk ? baseRisk : risk}
            compareScores={simMode ? risk : undefined}
            height={220}
          />
        </div>

        {/* SIREN + Pappers auto-fill */}
        <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/10 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Search className="w-4 h-4" />
            Auto-KYC Pappers
          </h3>
          <div className="flex items-center gap-2">
            <Input
              value={form.siren}
              onChange={e => set("siren", e.target.value)}
              placeholder="Saisir le SIREN (9 chiffres)"
              className="flex-1"
            />
            <Button
              onClick={handlePappersLookup}
              disabled={pappersLoading || form.siren.replace(/\s/g, "").length !== 9}
              className="gap-2"
            >
              {pappersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Rechercher
            </Button>
          </div>
          {pappersStatus === "success" && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Données pré-remplies depuis Pappers (Kbis, dirigeant, BE, APE...)
            </p>
          )}
          {pappersStatus === "error" && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Erreur lors de la recherche. Vérifiez le SIREN.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><Label>Raison Sociale *</Label><Input value={form.raisonSociale} onChange={e => set("raisonSociale", e.target.value)} /></div>
            <div><Label>Forme Juridique</Label>
              <Select value={form.forme} onValueChange={v => set("forme", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Code APE</Label><Input value={form.ape} onChange={e => set("ape", e.target.value)} placeholder="ex: 56.10A" /></div>
            <div><Label>Dirigeant</Label><Input value={form.dirigeant} onChange={e => set("dirigeant", e.target.value)} /></div>
            <div><Label>Domaine d'activité</Label><Input value={form.domaine} onChange={e => set("domaine", e.target.value)} /></div>
            <div><Label>Capital (€)</Label><Input type="number" value={form.capital} onChange={e => set("capital", +e.target.value)} /></div>
            <div><Label>Effectif</Label>
              <Select value={form.effectif} onValueChange={v => set("effectif", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EFFECTIFS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-3">
            <div><Label>Mission *</Label>
              <Select value={form.mission} onValueChange={v => set("mission", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MISSIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Honoraires (€)</Label><Input type="number" value={form.honoraires} onChange={e => set("honoraires", +e.target.value)} /></div>
            <div><Label>Comptable</Label><Input value={form.comptable} onChange={e => set("comptable", e.target.value)} /></div>
            <div><Label>Adresse</Label><Input value={form.adresse} onChange={e => set("adresse", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>CP</Label><Input value={form.cp} onChange={e => set("cp", e.target.value)} /></div>
              <div><Label>Ville</Label><Input value={form.ville} onChange={e => set("ville", e.target.value)} /></div>
            </div>
            <div><Label>Date création société</Label><Input type="date" value={form.dateCreation} onChange={e => set("dateCreation", e.target.value)} /></div>
            <div><Label>Date reprise dossier</Label><Input type="date" value={form.dateReprise} onChange={e => set("dateReprise", e.target.value)} /></div>
          </div>
        </div>

        {/* Contact & Bank */}
        <div className="grid grid-cols-4 gap-3">
          <div><Label>Téléphone</Label><Input value={form.tel} onChange={e => set("tel", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.mail} onChange={e => set("mail", e.target.value)} /></div>
          <div><Label>IBAN</Label><Input value={form.iban} onChange={e => set("iban", e.target.value)} /></div>
          <div><Label>BIC</Label><Input value={form.bic} onChange={e => set("bic", e.target.value)} /></div>
        </div>

        {/* Risk flags */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold">Facteurs de Risque</h3>
          <div className="grid grid-cols-3 gap-3">
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

        <div><Label>Bénéficiaires Effectifs</Label><Input value={form.be} onChange={e => set("be", e.target.value)} placeholder="Nom (%) / Nom (%)" /></div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.raisonSociale || !form.siren || form.siren.replace(/\s/g, "").length !== 9}>
            Valider & Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
