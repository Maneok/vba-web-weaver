import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Shield, FileText } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const LCBFT_TEXT = `Conformement aux dispositions des articles L.561-1 et suivants du Code Monetaire et Financier, nous sommes tenus de proceder a l'identification de notre client et de son beneficiaire effectif, d'exercer une vigilance constante sur la relation d'affaires et de declarer a TRACFIN toute operation ou tentative d'operation portant sur des sommes dont nous savons, soupconnons ou avons de bonnes raisons de soupconner qu'elles proviennent d'une infraction passible d'une peine privative de liberte superieure a un an ou participent au financement du terrorisme.`;

const TD_TEXT = `En application de l'article L.8222-1 du Code du travail, le client s'engage a fournir tous les six mois une attestation de vigilance delivree par l'URSSAF ou la MSA justifiant de la regularite de sa situation au regard des obligations de declaration et de paiement des cotisations sociales.`;

export default function LMWizardStep8Clauses({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Clauses reglementaires</h2>
        <p className="text-sm text-slate-500">Activez les clauses obligatoires et optionnelles</p>
      </div>

      {/* LCB-FT — obligatoire */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">Clause LCB-FT</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 gap-1">
              <Lock className="w-3 h-3" /> Obligatoire
            </Badge>
            <Switch checked={true} disabled />
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{LCBFT_TEXT}</p>
      </div>

      {/* Travail dissimulé — obligatoire */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">Attestation travail dissimule</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 gap-1">
              <Lock className="w-3 h-3" /> Obligatoire
            </Badge>
            <Switch checked={true} disabled />
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{TD_TEXT}</p>
      </div>

      {/* RGPD — optionnel */}
      <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
        data.clause_rgpd ? "border-blue-500/20 bg-blue-500/5" : "border-white/[0.06] bg-white/[0.02]"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Protection des donnees (RGPD)</p>
            <p className="text-xs text-slate-500">Clause relative au traitement des donnees personnelles</p>
          </div>
          <Switch
            checked={data.clause_rgpd}
            onCheckedChange={(v) => onChange({ clause_rgpd: v })}
          />
        </div>
      </div>

      {/* Responsabilité — optionnel */}
      <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
        data.clause_responsabilite ? "border-blue-500/20 bg-blue-500/5" : "border-white/[0.06] bg-white/[0.02]"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Limitation de responsabilite</p>
            <p className="text-xs text-slate-500">Plafonnement contractuel de la responsabilite civile</p>
          </div>
          <Switch
            checked={data.clause_responsabilite}
            onCheckedChange={(v) => onChange({ clause_responsabilite: v })}
          />
        </div>
        {data.clause_responsabilite && (
          <div className="pt-2 border-t border-white/[0.04]">
            <Label className="text-slate-400 text-xs">Plafond de responsabilite (€)</Label>
            <Input
              type="number"
              value={data.plafond_responsabilite || ""}
              onChange={(e) => onChange({ plafond_responsabilite: Number(e.target.value) || 0 })}
              className="bg-white/[0.04] border-white/[0.08] text-white mt-1.5 w-48"
              placeholder="Ex: 100 000"
            />
          </div>
        )}
      </div>

      {/* Clauses supplémentaires */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Clauses supplementaires</Label>
        <Textarea
          value={data.clauses_supplementaires}
          onChange={(e) => onChange({ clauses_supplementaires: e.target.value })}
          className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
          placeholder="Ajoutez des clauses personnalisees..."
        />
      </div>
    </div>
  );
}
