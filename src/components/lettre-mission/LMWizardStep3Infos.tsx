import { useState } from "react";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: any) => {
    let error = "";
    if (field === "cp" && value && !/^\d{5}$/.test(value)) error = "Code postal invalide (5 chiffres)";
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Email invalide";
    if (field === "siren" && value && !/^\d{9}$/.test(value.replace(/\s/g, ""))) error = "SIREN invalide (9 chiffres)";
    if (field === "telephone" && value && !/^[\d\s+()-]{10,}$/.test(value)) error = "Telephone invalide";
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const inputCls = "bg-white/[0.04] border-white/[0.08] text-white";
  const errorInputCls = "bg-white/[0.04] border-red-500/40 text-white ring-1 ring-red-500/20";

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Informations du client</h2>
          <p className="text-sm text-slate-500">Verifiez et completez les informations</p>
        </div>
        {data.client_ref && (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1.5 self-start">
            <CheckCircle2 className="w-3 h-3" /> Auto-rempli
          </Badge>
        )}
      </div>

      {/* Dirigeant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Dirigeant *</Label>
          <Input
            value={data.dirigeant}
            onChange={(e) => onChange({ dirigeant: e.target.value })}
            onBlur={(e) => validateField("dirigeant", e.target.value)}
            className={inputCls}
            placeholder="Nom du dirigeant"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Qualite</Label>
          <Select value={data.qualite_dirigeant} onValueChange={(v) => onChange({ qualite_dirigeant: v })}>
            <SelectTrigger className={inputCls}>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Raison sociale *</Label>
          <Input
            value={data.raison_sociale}
            onChange={(e) => onChange({ raison_sociale: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">SIREN</Label>
          <Input
            value={data.siren}
            onChange={(e) => onChange({ siren: e.target.value })}
            onBlur={(e) => validateField("siren", e.target.value)}
            inputMode="numeric"
            className={fieldErrors.siren ? errorInputCls : inputCls}
            maxLength={11}
          />
          {fieldErrors.siren && <p className="text-xs text-red-400 mt-0.5">{fieldErrors.siren}</p>}
        </div>
      </div>

      {/* Adresse */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Adresse *</Label>
        <Input
          value={data.adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
          className={inputCls}
          placeholder="Numero et rue"
          autoComplete="street-address"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Code postal *</Label>
          <Input
            value={data.cp}
            onChange={(e) => onChange({ cp: e.target.value })}
            onBlur={(e) => validateField("cp", e.target.value)}
            inputMode="numeric"
            maxLength={5}
            className={fieldErrors.cp ? errorInputCls : inputCls}
            autoComplete="postal-code"
          />
          {fieldErrors.cp && <p className="text-xs text-red-400 mt-0.5">{fieldErrors.cp}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Ville *</Label>
          <Input
            value={data.ville}
            onChange={(e) => onChange({ ville: e.target.value })}
            className={inputCls}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-slate-400 text-xs">RCS</Label>
          <Input
            value={data.rcs}
            onChange={(e) => onChange({ rcs: e.target.value })}
            className={inputCls}
            placeholder="RCS Ville"
          />
        </div>
      </div>

      {/* Coordonnées */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Email</Label>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={(e) => validateField("email", e.target.value)}
            className={fieldErrors.email ? errorInputCls : inputCls}
          />
          {fieldErrors.email && <p className="text-xs text-red-400 mt-0.5">{fieldErrors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Telephone</Label>
          <Input
            inputMode="tel"
            autoComplete="tel"
            value={data.telephone}
            onChange={(e) => onChange({ telephone: e.target.value })}
            onBlur={(e) => validateField("telephone", e.target.value)}
            className={fieldErrors.telephone ? errorInputCls : inputCls}
          />
          {fieldErrors.telephone && <p className="text-xs text-red-400 mt-0.5">{fieldErrors.telephone}</p>}
        </div>
      </div>

      {/* Capital, APE, Date clôture */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Capital social</Label>
          <Input
            inputMode="numeric"
            value={data.capital}
            onChange={(e) => onChange({ capital: e.target.value })}
            className={inputCls}
            placeholder="Ex: 10 000"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Code APE/NAF</Label>
          <Input
            value={data.ape}
            onChange={(e) => onChange({ ape: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Date de cloture</Label>
          <Input
            type="date"
            value={data.date_cloture}
            onChange={(e) => onChange({ date_cloture: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
