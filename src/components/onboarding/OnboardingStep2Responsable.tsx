import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, ArrowLeft } from "lucide-react";

export interface ResponsableData {
  nom: string;
  email: string;
  telephone: string;
  fonction: string;
}

interface Step2Props {
  data: ResponsableData;
  onChange: (data: ResponsableData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const FONCTIONS = [
  "Expert-comptable",
  "Associe signataire",
  "Directeur de mission",
  "Responsable conformite",
  "Collaborateur senior",
];

export function OnboardingStep2Responsable({ data, onChange, onNext, onBack, onSkip }: Step2Props) {
  const canContinue = data.nom.trim().length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-2">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-6 h-6 text-violet-400" />
        </div>
        <h2 className="text-2xl font-semibold">Responsable LCB-FT</h2>
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">
          Le referent conformite de votre cabinet
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="resp-nom" className="text-sm text-slate-700 dark:text-slate-300">
            Nom complet
          </Label>
          <Input
            id="resp-nom"
            value={data.nom}
            onChange={(e) => onChange({ ...data, nom: e.target.value })}
            placeholder="Prenom Nom"
            className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="resp-email" className="text-sm text-slate-700 dark:text-slate-300">
            Email professionnel
          </Label>
          <Input
            id="resp-email"
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="nom@cabinet.fr"
            className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="resp-tel" className="text-sm text-slate-700 dark:text-slate-300">
            Telephone <span className="text-slate-300 dark:text-slate-600">(optionnel)</span>
          </Label>
          <Input
            id="resp-tel"
            type="tel"
            value={data.telephone}
            onChange={(e) => onChange({ ...data, telephone: e.target.value })}
            placeholder="01 23 45 67 89"
            className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">Fonction</Label>
          <Select
            value={data.fonction}
            onValueChange={(v) => onChange({ ...data, fonction: v })}
          >
            <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]">
              <SelectValue placeholder="Selectionnez une fonction" />
            </SelectTrigger>
            <SelectContent>
              {FONCTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
          <button
            onClick={onSkip}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
          >
            Passer
          </button>
        </div>
        <Button onClick={onNext} disabled={!canContinue} className="px-6">
          Continuer
        </Button>
      </div>
    </div>
  );
}
