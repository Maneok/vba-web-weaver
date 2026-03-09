import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const QUALITES = ["Gerant", "President", "Directeur General", "Co-gerant", "Administrateur", "Associe unique"];

export default function LMWizardStep3Infos({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Informations du client</h2>
          <p className="text-sm text-slate-500">Verifiez et completez les informations</p>
        </div>
        {data.client_ref && (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Donnees auto-remplies depuis la fiche client
          </Badge>
        )}
      </div>

      {/* Dirigeant */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Dirigeant</Label>
          <Input
            value={data.dirigeant}
            onChange={(e) => onChange({ dirigeant: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
            placeholder="Nom du dirigeant"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Qualite</Label>
          <Select value={data.qualite_dirigeant} onValueChange={(v) => onChange({ qualite_dirigeant: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITES.map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Raison sociale + SIREN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Raison sociale</Label>
          <Input
            value={data.raison_sociale}
            onChange={(e) => onChange({ raison_sociale: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">SIREN</Label>
          <Input
            value={data.siren}
            onChange={(e) => onChange({ siren: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
      </div>

      {/* Adresse */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Adresse</Label>
        <Input
          value={data.adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
          className="bg-white/[0.04] border-white/[0.08] text-white"
          placeholder="Numero et rue"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Code postal</Label>
          <Input
            value={data.cp}
            onChange={(e) => onChange({ cp: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Ville</Label>
          <Input
            value={data.ville}
            onChange={(e) => onChange({ ville: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">RCS</Label>
          <Input
            value={data.rcs}
            onChange={(e) => onChange({ rcs: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
            placeholder="RCS Ville"
          />
        </div>
      </div>

      {/* Coordonnées */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Email</Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Telephone</Label>
          <Input
            value={data.telephone}
            onChange={(e) => onChange({ telephone: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
      </div>

      {/* Capital, APE, Date clôture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Capital social</Label>
          <Input
            value={data.capital}
            onChange={(e) => onChange({ capital: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
            placeholder="Ex: 10 000 €"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Code APE/NAF</Label>
          <Input
            value={data.ape}
            onChange={(e) => onChange({ ape: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Date de cloture</Label>
          <Input
            type="date"
            value={data.date_cloture}
            onChange={(e) => onChange({ date_cloture: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
      </div>
    </div>
  );
}
