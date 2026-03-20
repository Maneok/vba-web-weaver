import { useState, useEffect, useMemo, useRef } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { QUALITES_DIRIGEANT, DUREES } from "@/lib/lmDefaults";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { isClientConsommateur, getSmartMissionText } from "@/lib/lmSmartDefaults";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ChevronDown, FileText, XCircle, Info, AlertTriangle } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMStep3Details({ data, onChange }: Props) {
  const { collaborateurs } = useAppState();
  const { profile } = useAuth();
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [showClauses, setShowClauses] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const referentLcb = collaborateurs.find((c) => c.referentLcb);

  // OPT-9/10: Mission type config
  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  // Auto pre-fill associe and referent LCB on first render only
  const autoFillDone = useRef(false);
  useEffect(() => {
    if (autoFillDone.current) return;
    autoFillDone.current = true;
    const updates: Partial<LMWizardData> = {};
    if (!data.associe_signataire && collaborateurs.length > 0) {
      const admin = collaborateurs.find((c) => c.fonction?.toLowerCase().includes("associ"));
      if (admin) updates.associe_signataire = admin.nom;
    }
    if (!data.referent_lcb && referentLcb) {
      updates.referent_lcb = referentLcb.nom;
    }
    if (Object.keys(updates).length > 0) onChange(updates);
  }, [collaborateurs]);

  const validateField = (field: string, value: any) => {
    let error = "";
    if (field === "cp" && value && !/^\d{5}$/.test(value)) error = "Code postal invalide";
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Email invalide";
    if (field === "telephone" && value && !/^[\d\s+()-]{10,20}$/.test(value)) error = "Telephone invalide";
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const inputCls = "bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white";
  const errorCls = "bg-gray-50/80 dark:bg-white/[0.04] border-red-500/40 text-slate-900 dark:text-white ring-1 ring-red-500/20";

  const clientInfoFilled = data.dirigeant && data.adresse && data.cp && data.ville;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Client info (collapsible) ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClientInfo(!showClientInfo)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:bg-white/[0.02] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 rounded-t-xl"
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Informations client</p>
            {clientInfoFilled && !showClientInfo && (
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showClientInfo && clientInfoFilled && (
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">{data.dirigeant} · {data.ville}</span>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showClientInfo ? "rotate-180" : ""}`} />
          </div>
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${showClientInfo ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Dirigeant *</Label>
                <Input value={data.dirigeant} onChange={(e) => onChange({ dirigeant: e.target.value })} className={inputCls} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Qualite</Label>
                <Select value={data.qualite_dirigeant} onValueChange={(v) => onChange({ qualite_dirigeant: v })}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITES_DIRIGEANT.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Adresse *</Label>
              <Input value={data.adresse} onChange={(e) => onChange({ adresse: e.target.value })} className={inputCls} autoComplete="street-address" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Code postal *</Label>
                <Input
                  value={data.cp} onChange={(e) => onChange({ cp: e.target.value })}
                  onBlur={(e) => validateField("cp", e.target.value)}
                  inputMode="numeric" maxLength={5}
                  className={fieldErrors.cp ? errorCls : inputCls}
                />
                {fieldErrors.cp && <p className="text-xs text-red-400" role="alert">{fieldErrors.cp}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Ville *</Label>
                <Input value={data.ville} onChange={(e) => onChange({ ville: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">RCS</Label>
                <Input value={data.rcs} onChange={(e) => onChange({ rcs: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de cloture</Label>
                <Input
                  type="date"
                  lang="fr"
                  value={data.date_cloture}
                  onChange={(e) => onChange({ date_cloture: e.target.value })}
                  className={`${inputCls} w-48`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Email</Label>
                <Input
                  type="email" inputMode="email" autoComplete="email"
                  value={data.email} onChange={(e) => onChange({ email: e.target.value })}
                  onBlur={(e) => validateField("email", e.target.value)}
                  className={fieldErrors.email ? errorCls : inputCls}
                />
                {fieldErrors.email && <p className="text-xs text-red-400" role="alert">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Telephone</Label>
                <Input
                  inputMode="tel" autoComplete="tel"
                  value={data.telephone} onChange={(e) => onChange({ telephone: e.target.value })}
                  onBlur={(e) => validateField("telephone", e.target.value)}
                  className={fieldErrors.telephone ? errorCls : inputCls}
                />
                {fieldErrors.telephone && <p className="text-xs text-red-400" role="alert">{fieldErrors.telephone}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Durée & renouvellement ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Duree et renouvellement</p>
        <div className="grid grid-cols-3 gap-3">
          {DUREES.map((d) => {
            const active = data.duree === d.value;
            return (
              <button
                key={d.value}
                onClick={() => onChange({ duree: d.value })}
                className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <p className={`text-lg font-bold ${active ? "text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{d.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{d.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Tacite reconduction</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {isClientConsommateur(data.client_type_id || '')
                ? "Client consommateur — obligation d'information (art. L 215-1 Code conso)"
                : "Renouvellement automatique a echeance"}
            </p>
          </div>
          <Switch checked={data.tacite_reconduction} onCheckedChange={(v) => onChange({ tacite_reconduction: v })} />
        </div>

        {/* Consumer notice */}
        {isClientConsommateur(data.client_type_id || '') && data.tacite_reconduction && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-500/[0.04] border border-amber-200/40 dark:border-amber-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Ce client est un consommateur au sens du Code de la consommation. La lettre de mission doit mentionner la possibilite de ne pas reconduire le contrat.
            </p>
          </div>
        )}

        {data.tacite_reconduction && (
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Preavis (mois)</Label>
            <Select value={String(data.preavis_mois)} onValueChange={(v) => onChange({ preavis_mois: Number(v) })}>
              <SelectTrigger className={`${inputCls} w-32`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois</SelectItem>
                <SelectItem value="2">2 mois</SelectItem>
                <SelectItem value="3">3 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de debut</Label>
          <Input
            type="date"
            lang="fr"
            value={data.date_debut}
            onChange={(e) => onChange({ date_debut: e.target.value })}
            className={`${inputCls} w-48`}
          />
        </div>
      </div>

      {/* ── Section 3: Intervenants ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Intervenants</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Associe signataire *</Label>
            <Select value={data.associe_signataire} onValueChange={(v) => onChange({ associe_signataire: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Chef de mission</Label>
            <Select value={data.chef_mission} onValueChange={(v) => onChange({ chef_mission: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Validateur (co-edition)</Label>
            <Select value={data.validateur} onValueChange={(v) => onChange({ validateur: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Aucun validateur" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">Collaborateur qui validera la lettre avant envoi</p>
          </div>
        </div>
        {data.referent_lcb && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">LCB</Badge>
            <span className="text-xs text-slate-400 dark:text-slate-500">Referent : {data.referent_lcb}</span>
          </div>
        )}
      </div>

      {/* ── OPT-9: Mission description & nature/limites ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cadre de la mission — {mtConfig.shortLabel}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">{mtConfig.normeRef}</Badge>
            <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400 dark:text-slate-500">{mtConfig.formeRapport}</Badge>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-4">{mtConfig.missionText.split('\n')[0]}</p>
        </div>

        {mtConfig.natureLimiteText && (
          <div className="p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] space-y-1.5">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nature et limites de la mission</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-3">{mtConfig.natureLimiteText.split('\n')[0]}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Forme du rapport :</span>
          <span className="text-[11px] text-slate-700 dark:text-slate-300">{mtConfig.formeRapport}</span>
        </div>

        {/* Smart mission text enrichment */}
        {data.client_type_id && getSmartMissionText(data.client_type_id) && (
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-500/[0.04] border border-blue-200/40 dark:border-blue-500/10">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                {getSmartMissionText(data.client_type_id)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── OPT-10: Honoraires de succès ── */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06]">
        {mtConfig.honorairesSuccesAutorises ? (
          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Honoraires de succes autorises
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 gap-1">
            <XCircle className="w-3 h-3" /> Honoraires de succes interdits (art. 24 ord. 1945)
          </Badge>
        )}
      </div>

      {/* ── Section 4: Clauses (collapsible) ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClauses(!showClauses)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:bg-white/[0.02] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 rounded-t-xl"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Clauses obligatoires</p>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showClauses ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${showClauses ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-white/[0.04]">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] mt-3">
              <span className="text-sm text-slate-700 dark:text-slate-300">LCB-FT</span>
              <Switch checked={data.clause_lcbft} disabled />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02]">
              <span className="text-sm text-slate-700 dark:text-slate-300">Travail dissimule</span>
              <Switch checked={data.clause_travail_dissimule} disabled />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02]">
              <span className="text-sm text-slate-700 dark:text-slate-300">RGPD</span>
              <Switch checked={data.clause_rgpd} onCheckedChange={(v) => onChange({ clause_rgpd: v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Clauses supplementaires</Label>
              <Textarea
                value={data.clauses_supplementaires}
                onChange={(e) => onChange({ clauses_supplementaires: e.target.value })}
                className={`${inputCls} min-h-[80px]`}
                placeholder="Clauses additionnelles..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
