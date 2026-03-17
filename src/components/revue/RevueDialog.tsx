import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { RevueMaintien } from "@/lib/revueMaintien";
import { completeRevue } from "@/lib/revueMaintien";
import { toast } from "sonner";

interface RevueDialogProps {
  revue: RevueMaintien | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

export default function RevueDialog({ revue, open, onOpenChange, onCompleted }: RevueDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Vérifications
  const [kycVerifie, setKycVerifie] = useState(false);
  const [beVerifie, setBeVerifie] = useState(false);
  const [documentsAJour, setDocumentsAJour] = useState(false);
  const [pasDeChanagement, setPasDeChangement] = useState(false);

  // Step 2 — Évaluation risque
  const [scoreCorrect, setScoreCorrect] = useState("oui");
  const [nouveauScore, setNouveauScore] = useState("");
  const [nouvelleVigilance, setNouvelleVigilance] = useState("normale");

  // Step 3 — Décision
  const [decision, setDecision] = useState("maintien");
  const [decisionMotif, setDecisionMotif] = useState("");
  const [observations, setObservations] = useState("");

  const scoreActuel = revue?.score_risque_avant ?? revue?.client_score ?? 0;
  const scoreFinal = scoreCorrect === "oui" ? scoreActuel : (parseInt(nouveauScore) || scoreActuel);
  const isRisqueEleve = scoreFinal >= 70;

  const resetForm = () => {
    setStep(1);
    setKycVerifie(false);
    setBeVerifie(false);
    setDocumentsAJour(false);
    setPasDeChangement(false);
    setScoreCorrect("oui");
    setNouveauScore("");
    setNouvelleVigilance("normale");
    setDecision("maintien");
    setDecisionMotif("");
    setObservations("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleSubmit = async () => {
    if (!revue) return;
    setLoading(true);
    try {
      await completeRevue(revue.id, {
        score_apres: scoreFinal,
        vigilance_apres: nouvelleVigilance,
        maintien: decision === 'maintien' || decision === 'vigilance_renforcee',
        observations,
        decision,
        decision_motif: decision === 'fin_relation' ? decisionMotif : undefined,
        kyc_verifie: kycVerifie,
        be_verifie: beVerifie,
        documents_a_jour: documentsAJour,
        needs_validation: isRisqueEleve,
      });
      toast.success(isRisqueEleve ? "Revue soumise a validation associe" : "Revue completee avec succes");
      handleOpenChange(false);
      onCompleted();
    } catch (err: any) {
      toast.error("Erreur lors de la validation : " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!revue) return null;

  const typeLabels: Record<string, string> = {
    annuelle: "Annuelle",
    risque_eleve: "Risque eleve",
    kyc_expiration: "KYC expire",
    changement_situation: "Changement de situation",
    controle_qualite: "Controle qualite",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Revue — {revue.client_nom || "Client"}
            <Badge variant="outline" className="ml-2">{typeLabels[revue.type] || revue.type}</Badge>
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Ref : {revue.client_ref}</span>
            <span>·</span>
            <span>Score actuel : {scoreActuel}</span>
            <span>·</span>
            <span>Etape {step}/4</span>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Vérifications */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Verifications reglementaires</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={kycVerifie} onCheckedChange={(v) => setKycVerifie(!!v)} />
                <span className="text-sm">L'identite du client / beneficiaire effectif a ete verifiee</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={documentsAJour} onCheckedChange={(v) => setDocumentsAJour(!!v)} />
                <span className="text-sm">Les documents KYC sont a jour (CNI/passeport, KBis, RBE)</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={beVerifie} onCheckedChange={(v) => setBeVerifie(!!v)} />
                <span className="text-sm">Les beneficiaires effectifs ont ete re-verifies</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={pasDeChanagement} onCheckedChange={(v) => setPasDeChangement(!!v)} />
                <span className="text-sm">Aucun changement de situation significatif n'a ete identifie</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2 — Évaluation risque */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Evaluation du risque</h3>
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Score de risque actuel :</span>
              <span className={`ml-2 font-bold text-lg ${
                scoreActuel >= 70 ? 'text-red-500' : scoreActuel >= 50 ? 'text-orange-500' : 'text-green-500'
              }`}>
                {scoreActuel}
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Le score de risque est-il toujours correct ?</Label>
              <RadioGroup value={scoreCorrect} onValueChange={setScoreCorrect}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="oui" id="score-oui" />
                  <Label htmlFor="score-oui">Oui</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="non" id="score-non" />
                  <Label htmlFor="score-non">Non, recalculer</Label>
                </div>
              </RadioGroup>
            </div>

            {scoreCorrect === "non" && (
              <div className="space-y-2">
                <Label htmlFor="nouveau-score">Nouveau score de risque</Label>
                <Input
                  id="nouveau-score"
                  type="number"
                  min={0}
                  max={120}
                  value={nouveauScore}
                  onChange={(e) => setNouveauScore(e.target.value)}
                  placeholder="0-120"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Nouveau niveau de vigilance</Label>
              <Select value={nouvelleVigilance} onValueChange={setNouvelleVigilance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simplifiee">Simplifiee</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="renforcee">Renforcee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 3 — Décision */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Decision</h3>

            <RadioGroup value={decision} onValueChange={setDecision}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="maintien" id="d-maintien" />
                <Label htmlFor="d-maintien">Maintien de la mission</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vigilance_renforcee" id="d-vigilance" />
                <Label htmlFor="d-vigilance">Vigilance renforcee requise</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fin_relation" id="d-fin" />
                <Label htmlFor="d-fin">Fin de la relation d'affaires</Label>
              </div>
            </RadioGroup>

            {decision === 'fin_relation' && (
              <div className="space-y-2">
                <Label htmlFor="motif">Motif de la fin de relation</Label>
                <Textarea
                  id="motif"
                  value={decisionMotif}
                  onChange={(e) => setDecisionMotif(e.target.value)}
                  placeholder="Indiquer le motif..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observations">Observations</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observations complementaires..."
                rows={4}
              />
            </div>

            {isRisqueEleve && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Cette revue doit etre validee par un associe (score &ge; 70)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Validation / Résumé */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Resume de la revue</h3>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50">
                <div>
                  <span className="text-muted-foreground">Identite verifiee :</span>
                  <span className="ml-1 font-medium">{kycVerifie ? "Oui" : "Non"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">KYC a jour :</span>
                  <span className="ml-1 font-medium">{documentsAJour ? "Oui" : "Non"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">BE verifies :</span>
                  <span className="ml-1 font-medium">{beVerifie ? "Oui" : "Non"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Score risque :</span>
                  <span className={`ml-1 font-bold ${
                    scoreFinal >= 70 ? 'text-red-500' : scoreFinal >= 50 ? 'text-orange-500' : 'text-green-500'
                  }`}>{scoreActuel} → {scoreFinal}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Vigilance :</span>
                  <span className="ml-1 font-medium capitalize">{nouvelleVigilance}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Decision :</span>
                  <span className="ml-1 font-medium">
                    {decision === 'maintien' && "Maintien"}
                    {decision === 'vigilance_renforcee' && "Vigilance renforcee"}
                    {decision === 'fin_relation' && "Fin de relation"}
                  </span>
                </div>
              </div>

              {observations && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Observations :</span>
                  <p className="mt-1">{observations}</p>
                </div>
              )}

              {decision === 'fin_relation' && decisionMotif && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-muted-foreground">Motif fin de relation :</span>
                  <p className="mt-1">{decisionMotif}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Precedent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
            {step < 4 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "En cours..." : isRisqueEleve ? (
                  <>Soumettre a validation associe</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-1" /> Valider la revue</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
