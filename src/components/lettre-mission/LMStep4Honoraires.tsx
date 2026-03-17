import { useState, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { FREQUENCES, MODES_PAIEMENT } from "@/lib/lmDefaults";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CreditCard, FileText, ArrowRight, Trophy, Calculator } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

function formatMontant(value: string): string {
  const num = value.replace(/[^\d]/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatIBAN(value: string): string {
  return value.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

const PAIEMENT_ICONS: Record<string, React.ReactNode> = {
  virement: <ArrowRight className="w-4 h-4" />,
  prelevement: <CreditCard className="w-4 h-4" />,
  cheque: <FileText className="w-4 h-4" />,
};

export default function LMStep4Honoraires({ data, onChange }: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = useMemo(() => Math.round((data.honoraires_ht + tva) * 100) / 100, [data.honoraires_ht, tva]);

  const periodLabel = data.frequence_facturation === "MENSUEL" ? "mois" : data.frequence_facturation === "TRIMESTRIEL" ? "trimestre" : "an";
  const divisor = data.frequence_facturation === "MENSUEL" ? 12 : data.frequence_facturation === "TRIMESTRIEL" ? 4 : 1;
  const perPeriod = data.honoraires_ht > 0 ? Math.round(ttc / divisor * 100) / 100 : 0;

  const validateField = (field: string, value: any) => {
    let error = "";
    if (field === "honoraires_ht" && (!value || value <= 0)) error = "Montant requis";
    if (field === "honoraires_ht" && value > 500000) error = "Montant anormalement eleve";
    if (field === "iban" && value) {
      const clean = String(value).replace(/\s/g, "");
      if (clean.length > 0 && (!/^FR\d{2}/.test(clean) || clean.length !== 27)) {
        error = "IBAN francais invalide (27 car., prefixe FR)";
      }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const inputCls = "bg-white/[0.04] border-white/[0.08] text-white";
  const errorCls = "bg-white/[0.04] border-red-500/40 text-white ring-1 ring-red-500/20";

  return (
    <div className="space-y-8">
      {/* ── Grand input montant ── */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <DollarSign className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium">Honoraires annuels HT</span>
        </div>
        <div className="relative max-w-xs mx-auto">
          <Input
            inputMode="decimal"
            value={data.honoraires_ht ? formatMontant(String(data.honoraires_ht)) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\s/g, "");
              onChange({ honoraires_ht: Number(raw) || 0 });
            }}
            onBlur={() => validateField("honoraires_ht", data.honoraires_ht)}
            className={`${fieldErrors.honoraires_ht ? errorCls : inputCls} text-center text-4xl font-bold h-16`}
            placeholder="0"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">€ HT / an</span>
        </div>
        {fieldErrors.honoraires_ht && (
          <p className="text-xs text-red-400 animate-shake" role="alert">{fieldErrors.honoraires_ht}</p>
        )}

        {/* TVA + TTC */}
        <div className="flex items-center justify-center gap-6 text-sm">
          {data.taux_tva > 0 ? (
            <>
              <div>
                <span className="text-slate-500">TVA {data.taux_tva}% : </span>
                <span className="text-slate-300">{formatEur(tva)}</span>
              </div>
              <div className="w-px h-4 bg-white/[0.1]" />
              <div>
                <span className="text-slate-500">TTC : </span>
                <span className="text-xl font-bold text-white">{formatEur(ttc)}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-500">TVA exoneree — TTC = <span className="text-white font-bold">{formatEur(data.honoraires_ht)}</span></span>
          )}
        </div>
      </div>

      {/* ── Slider optionnel ── */}
      <div className="px-2">
        <Slider
          value={[Math.min(data.honoraires_ht, 50000)]}
          onValueChange={([v]) => onChange({ honoraires_ht: v })}
          min={0}
          max={50000}
          step={100}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>0 €</span>
          <span>50 000 €</span>
        </div>
      </div>

      {/* ── Taux TVA ── */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Taux de TVA (%)</Label>
        <div className="flex gap-2">
          {[0, 5.5, 10, 20].map((rate) => {
            const active = data.taux_tva === rate;
            return (
              <button
                key={rate}
                onClick={() => onChange({ taux_tva: rate })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  active
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]"
                }`}
              >
                {rate === 0 ? "Exonere" : `${rate}%`}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fréquence facturation ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Frequence de facturation</p>
        <div className="grid grid-cols-3 gap-3">
          {FREQUENCES.map((f) => {
            const active = data.frequence_facturation === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onChange({ frequence_facturation: f.value })}
                className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <p className={`text-sm font-semibold ${active ? "text-blue-300" : "text-slate-300"}`}>{f.label}</p>
              </button>
            );
          })}
        </div>
        {data.honoraires_ht > 0 && data.frequence_facturation !== "ANNUEL" && (
          <p className="text-xs text-slate-500 text-center">
            Soit {formatEur(perPeriod)} TTC / {periodLabel}
          </p>
        )}
      </div>

      {/* ── Mode de paiement ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Mode de paiement</p>
        <div className="grid grid-cols-3 gap-3">
          {MODES_PAIEMENT.map(({ value, label }) => {
            const active = data.mode_paiement === value;
            const icon = PAIEMENT_ICONS[value];
            return (
              <button
                key={value}
                onClick={() => onChange({ mode_paiement: value })}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <div className={`${active ? "text-blue-400" : "text-slate-500"}`}>{icon}</div>
                <p className={`text-xs font-medium ${active ? "text-blue-300" : "text-slate-400"}`}>{label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEPA fields ── */}
      {data.mode_paiement === "prelevement" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">IBAN</Label>
            <Input
              value={formatIBAN(data.iban)}
              onChange={(e) => onChange({ iban: e.target.value.replace(/\s/g, "") })}
              onBlur={() => validateField("iban", data.iban)}
              className={`${fieldErrors.iban ? errorCls : inputCls} font-mono text-sm`}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              autoComplete="off"
            />
            {fieldErrors.iban && <p className="text-xs text-red-400" role="alert">{fieldErrors.iban}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">BIC</Label>
            <Input
              value={data.bic}
              onChange={(e) => onChange({ bic: e.target.value.toUpperCase() })}
              className={`${inputCls} font-mono text-sm`}
              placeholder="BNPAFRPPXXX"
              autoComplete="off"
            />
          </div>
        </div>
      )}

      {/* ── Echeance paiement ── */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Echeance de paiement (jours)</Label>
        <div className="flex gap-2">
          {[15, 30, 45, 60].map((d) => {
            const active = data.echeance_jours === d;
            return (
              <button
                key={d}
                onClick={() => onChange({ echeance_jours: d })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  active
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]"
                }`}
              >
                {d}j
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Taux horaire complémentaire ── */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Taux horaire complementaire (EUR/h HT)</Label>
        <Input
          inputMode="decimal"
          value={data.taux_horaire_complementaire || ""}
          onChange={(e) => onChange({ taux_horaire_complementaire: Number(e.target.value) || 0 })}
          className={`${inputCls} w-32`}
          placeholder="150"
        />
        <p className="text-[10px] text-slate-600">Pour toute prestation hors perimetre</p>
      </div>

      {/* ── OPT-11: Honoraires de succès ── */}
      {mtConfig.honorairesSuccesAutorises && (
        <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-slate-300">Honoraires complementaires de succes</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={data.honoraires_succes_prevu || false}
              onCheckedChange={(v) => onChange({ honoraires_succes_prevu: !!v })}
            />
            <span className="text-sm text-slate-300">Prevoir des honoraires de succes</span>
          </label>
          {data.honoraires_succes_prevu && (
            <div className="space-y-3 ml-7">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Conditions de declenchement</Label>
                <Input
                  value={data.honoraires_succes_conditions || ""}
                  onChange={(e) => onChange({ honoraires_succes_conditions: e.target.value })}
                  className={inputCls}
                  placeholder="Ex : obtention du financement, signature du bail..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Montant ou pourcentage</Label>
                <Input
                  value={data.honoraires_succes_montant || ""}
                  onChange={(e) => onChange({ honoraires_succes_montant: e.target.value })}
                  className={`${inputCls} w-48`}
                  placeholder="Ex : 2 000 € HT ou 5% du montant"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OPT-12: Récapitulatif total ── */}
      {data.honoraires_ht > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">Total honoraires annuels estimes</span>
          </div>
          <span className="text-lg font-bold text-white">{formatEur(data.honoraires_ht)} HT</span>
        </div>
      )}
    </div>
  );
}
