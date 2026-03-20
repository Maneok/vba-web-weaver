import { useState, useMemo, useCallback, useRef } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { FREQUENCES, MODES_PAIEMENT } from "@/lib/lmDefaults";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, CreditCard, FileText, ArrowRight, Trophy, Calculator,
  ChevronDown, Scale, Landmark, Users, ShieldCheck, Lightbulb,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

function formatMontant(value: string): string {
  const num = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const [intPart, decPart] = num.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
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

// OPT-30: mission icon map for detail breakdown
const MISSION_ICONS: Record<string, React.ReactNode> = {
  comptabilite: <Calculator className="w-4 h-4 text-blue-400" />,
  fiscal: <Landmark className="w-4 h-4 text-purple-400" />,
  social: <Users className="w-4 h-4 text-teal-400" />,
  juridique: <Scale className="w-4 h-4 text-amber-400" />,
  conseil: <Lightbulb className="w-4 h-4 text-pink-400" />,
  lcbft: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
};

export default function LMStep4Honoraires({ data, onChange }: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDetail, setShowDetail] = useState(false);
  const syncRef = useRef(false);

  // OPT-28: Stable detail total (no useEffect infinite loop)
  const detailTotal = useMemo(() => {
    if (!data.honoraires_detail) return 0;
    return Object.values(data.honoraires_detail).reduce((sum, v) => sum + (parseFloat(v as string) || 0), 0);
  }, [data.honoraires_detail]);

  // OPT-28: Sync total on detail input blur instead of useEffect
  const syncDetailTotal = useCallback(() => {
    if (detailTotal > 0 && detailTotal !== data.honoraires_ht) {
      onChange({ honoraires_ht: detailTotal });
    }
  }, [detailTotal, data.honoraires_ht, onChange]);

  // OPT-35: single filtered list (no duplicate computation)
  const selectedMissions = useMemo(
    () => (data.missions_selected || []).filter(m => m.selected && !m.locked),
    [data.missions_selected]
  );

  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = useMemo(() => Math.round((data.honoraires_ht + tva) * 100) / 100, [data.honoraires_ht, tva]);

  const periodLabel = data.frequence_facturation === "MENSUEL" ? "mois" : data.frequence_facturation === "TRIMESTRIEL" ? "trimestre" : "an";
  const divisor = data.frequence_facturation === "MENSUEL" ? 12 : data.frequence_facturation === "TRIMESTRIEL" ? 4 : 1;
  const perPeriod = data.honoraires_ht > 0 ? Math.round(ttc / divisor * 100) / 100 : 0;

  const validateField = (field: string, value: string | number) => {
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

  const inputCls = "wizard-input";
  const errorCls = "wizard-input border-red-400/60 dark:border-red-400/40 ring-1 ring-red-400/20";

  return (
    <div className="space-y-8">
      {/* ── Grand input montant ── */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
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
            className={`${fieldErrors.honoraires_ht ? errorCls : inputCls} text-center text-4xl font-bold h-16 rounded-2xl`}
            placeholder="0"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 font-medium">€ HT / an</span>
        </div>
        {fieldErrors.honoraires_ht && (
          <p className="text-xs text-red-400 animate-shake" role="alert">{fieldErrors.honoraires_ht}</p>
        )}

        {/* TVA + TTC */}
        <div className="flex items-center justify-center gap-6 text-sm">
          {data.taux_tva > 0 ? (
            <>
              <div>
                <span className="text-slate-400 dark:text-slate-500">TVA {data.taux_tva}% : </span>
                <span className="text-slate-700 dark:text-slate-300">{formatEur(tva)}</span>
              </div>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/[0.1]" />
              <div>
                <span className="text-slate-400 dark:text-slate-500">TTC : </span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">{formatEur(ttc)}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">TVA exoneree — TTC = <span className="text-slate-900 dark:text-white font-bold">{formatEur(data.honoraires_ht)}</span></span>
          )}
        </div>
      </div>

      {/* ── Slider optionnel ── */}
      <div className="px-2">
        {(() => { const sliderMax = Math.max(50000, data.honoraires_ht || 0); return (<>
        <Slider
          value={[data.honoraires_ht]}
          onValueChange={([v]) => onChange({ honoraires_ht: v })}
          min={0}
          max={sliderMax}
          step={100}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-slate-300 dark:text-slate-600 mt-1">
          <span>0 €</span>
          <span>{sliderMax.toLocaleString("fr-FR")} €</span>
        </div>
        </>); })()}
      </div>

      {/* ── Détail par mission ── */}
      {selectedMissions.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showDetail ? "rotate-180" : ""}`} />
            Ventiler par prestation
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({selectedMissions.length} prestations)</span>
          </button>

          {/* OPT-34: smooth expand */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetail ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="space-y-2 pt-1">
              {selectedMissions.map((m) => {
                const subCount = m.sous_options.filter(s => s.selected).length;
                const icon = MISSION_ICONS[m.section_id];
                return (
                  <div key={m.section_id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {icon && <div className="shrink-0">{icon}</div>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {subCount} sous-option{subCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        className="w-24 h-8 text-right text-sm bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]"
                        value={(data.honoraires_detail || {})[m.section_id] || ''}
                        onChange={(e) => onChange({
                          honoraires_detail: { ...(data.honoraires_detail || {}), [m.section_id]: e.target.value }
                        })}
                        onBlur={syncDetailTotal}
                      />
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-10">€ HT</span>
                    </div>
                  </div>
                );
              })}

              {/* OPT-31: Repartir equitablement */}
              {data.honoraires_ht > 0 && selectedMissions.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const perMission = Math.floor(data.honoraires_ht / selectedMissions.length);
                    const remainder = data.honoraires_ht - perMission * selectedMissions.length;
                    const detail: Record<string, string> = {};
                    selectedMissions.forEach((m, i) => {
                      detail[m.section_id] = String(perMission + (i === 0 ? remainder : 0));
                    });
                    onChange({ honoraires_detail: detail });
                  }}
                  className="w-full text-center text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 py-1.5 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors"
                >
                  Repartir equitablement ({formatEur(Math.floor(data.honoraires_ht / selectedMissions.length))} / prestation)
                </button>
              )}

              {/* Auto-sum */}
              {detailTotal > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/60 dark:bg-blue-500/[0.04] border border-blue-200/40 dark:border-blue-500/15 mt-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Total ventile</p>
                  <div className="text-right">
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                      {formatEur(detailTotal)}
                    </p>
                    {detailTotal !== data.honoraires_ht && data.honoraires_ht > 0 && (
                      <p className="text-[10px] text-amber-500">
                        Ecart : {formatEur(data.honoraires_ht - detailTotal)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Taux TVA ── */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 dark:text-slate-500 text-xs">Taux de TVA (%)</Label>
        <div className="flex gap-2">
          {[0, 5.5, 10, 20].map((rate) => {
            const active = data.taux_tva === rate;
            return (
              <button
                key={rate}
                onClick={() => onChange({ taux_tva: rate })}
                className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  active
                    ? "wizard-select-card wizard-select-active text-blue-600 dark:text-blue-400"
                    : "wizard-select-card text-slate-500 dark:text-slate-400"
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
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Frequence de facturation</p>
        <div className="grid grid-cols-3 gap-3">
          {FREQUENCES.map((f) => {
            const active = data.frequence_facturation === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onChange({ frequence_facturation: f.value })}
                className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                  active
                    ? "wizard-select-card wizard-select-active"
                    : "wizard-select-card"
                }`}
              >
                <p className={`text-sm font-semibold ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>{f.label}</p>
              </button>
            );
          })}
        </div>
        {data.honoraires_ht > 0 && data.frequence_facturation !== "ANNUEL" && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Soit {formatEur(perPeriod)} TTC / {periodLabel}
          </p>
        )}
      </div>

      {/* ── Mode de paiement ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Mode de paiement</p>
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
                    ? "wizard-select-card wizard-select-active"
                    : "wizard-select-card"
                }`}
              >
                <div className={`${active ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{icon}</div>
                <p className={`text-xs font-medium ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEPA fields ── */}
      {data.mode_paiement === "prelevement" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl wizard-card">
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">IBAN</Label>
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
            <Label className="text-slate-400 dark:text-slate-500 text-xs">BIC</Label>
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
        <Label className="text-slate-400 dark:text-slate-500 text-xs">Echeance de paiement (jours)</Label>
        <div className="flex gap-2">
          {[15, 30, 45, 60].map((d) => {
            const active = data.echeance_jours === d;
            return (
              <button
                key={d}
                onClick={() => onChange({ echeance_jours: d })}
                className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  active
                    ? "wizard-select-card wizard-select-active text-blue-600 dark:text-blue-400"
                    : "wizard-select-card text-slate-500 dark:text-slate-400"
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
        <Label className="text-slate-400 dark:text-slate-500 text-xs">Taux horaire complementaire</Label>
        <div className="relative w-40">
          <Input
            inputMode="decimal"
            value={data.taux_horaire_complementaire || ""}
            onChange={(e) => onChange({ taux_horaire_complementaire: Number(e.target.value) || 0 })}
            className={`${inputCls} pr-16`}
            placeholder="150"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">€ HT/h</span>
        </div>
        <p className="text-[10px] text-slate-300 dark:text-slate-600">Pour toute prestation hors perimetre</p>
      </div>

      {/* ── OPT-11: Honoraires de succès ── */}
      {mtConfig.honorairesSuccesAutorises && (
        <div className="space-y-3 p-4 rounded-xl wizard-card">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Honoraires complementaires de succes</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={data.honoraires_succes_prevu || false}
              onCheckedChange={(v) => onChange({ honoraires_succes_prevu: !!v })}
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Prevoir des honoraires de succes</span>
          </label>
          {data.honoraires_succes_prevu && (
            <div className="space-y-3 ml-7">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Conditions de declenchement</Label>
                <Input
                  value={data.honoraires_succes_conditions || ""}
                  onChange={(e) => onChange({ honoraires_succes_conditions: e.target.value })}
                  className={inputCls}
                  placeholder="Ex : obtention du financement, signature du bail..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Montant ou pourcentage</Label>
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
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-blue-500/[0.06] dark:to-indigo-500/[0.04] border border-blue-200/40 dark:border-blue-500/15">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-800 dark:text-slate-200">Total honoraires annuels estimes</span>
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">{formatEur(data.honoraires_ht)} HT</span>
        </div>
      )}
    </div>
  );
}
