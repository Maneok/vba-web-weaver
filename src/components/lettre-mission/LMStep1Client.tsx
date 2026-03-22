import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { recommendClientType, getClientTypeConfig } from "@/lib/lettreMissionTypes";
import { detectRegimeBenefices } from "@/lib/lmSmartDefaults";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Search, Plus, Building2, User, CheckCircle2, X,
  AlertTriangle, ShieldAlert, History, FileText, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { vigilanceColor } from "@/lib/lmUtils";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMStep1Client({ data, onChange }: Props) {
  const { clients } = useAppState();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [previousLM, setPreviousLM] = useState<{ id: string; wizard_data: Record<string, unknown>; numero: string; status: string } | null>(null);
  const [screeningStatus, setScreeningStatus] = useState<"ok" | "expired" | "missing" | null>(null);

  const filtered = useMemo(() => {
    if (!search || search.length < 2) return clients.slice(0, 15);
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.raisonSociale.toLowerCase().includes(q) ||
        c.siren.includes(q) ||
        c.ref.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const selectedClient = useMemo(() => clients.find((c) => c.ref === data.client_id), [clients, data.client_id]);
  const riskToastShown = useRef(false);

  // Check for previous signed LM + Screening check
  useEffect(() => {
    if (!data.client_id) {
      setPreviousLM(null);
      setScreeningStatus(null);
      return;
    }

    let cancelled = false;

    // Previous LM
    supabase
      .from("lettres_mission")
      .select("id, wizard_data, numero, status")
      .eq("client_ref", data.client_id)
      .in("status", ["signee", "envoyee"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        if (cancelled) return;
        if (rows && rows.length > 0) setPreviousLM(rows[0]);
        else setPreviousLM(null);
      })
      .catch((e) => { if (!cancelled) logger.warn("LM", "Previous LM check failed:", e); });

    // Screening check
    if (selectedClient) {
      if (!selectedClient.dateDerniereRevue) {
        setScreeningStatus("missing");
      } else {
        const revueDate = new Date(selectedClient.dateDerniereRevue);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        setScreeningStatus(revueDate < oneYearAgo ? "expired" : "ok");
      }

      if (selectedClient.scoreGlobal > 60 && !riskToastShown.current) {
        riskToastShown.current = true;
        toast.warning("Client a vigilance renforcee — envisagez un complement d'honoraires", { duration: 5000 });
      }
    }

    return () => { cancelled = true; };
  }, [data.client_id, selectedClient]);

  const selectClient = (c: Client) => {
    const { recommended } = recommendClientType(c.forme);
    const ctConfig = getClientTypeConfig(recommended);
    onChange({
      client_id: c.ref,
      client_ref: c.ref,
      raison_sociale: c.raisonSociale,
      siren: c.siren,
      forme_juridique: c.forme,
      client_type_id: recommended,
      mission_type_id: ctConfig?.defaultMissionType || "presentation",
      dirigeant: c.dirigeant,
      qualite_dirigeant: (() => {
        const qualiteMap: Record<string, string> = { "SARL": "Gérant", "EURL": "Gérant", "SCI": "Gérant", "SAS": "Président", "SASU": "Président", "SA": "Directeur général", "SNC": "Gérant", "ASSOCIATION": "Président", "ASSO": "Président" };
        return qualiteMap[c.forme] || "Dirigeant";
      })(),
      adresse: c.adresse,
      cp: c.cp,
      ville: c.ville,
      capital: String(c.capital || ""),
      date_creation: c.dateCreation || "",
      effectif: c.effectif || "",
      regime_fiscal: (() => {
        const formeUpper = c.forme?.toUpperCase() || "";
        if (formeUpper.includes("SAS") || formeUpper.includes("SA ") || formeUpper === "SA") return "IS Réel Normal";
        if (formeUpper.includes("SARL") || formeUpper.includes("EURL")) return "IS Réel Simplifié";
        if (formeUpper.includes("SCI")) return "IR";
        if (formeUpper.includes("EI") || formeUpper.includes("MICRO")) return "IR Micro-BIC";
        return "";
      })(),
      tva_assujetti: true,
      cac: false,
      volume_comptable: "",
      exercice_debut: `01/01/${new Date().getFullYear()}`,
      ape: c.ape,
      email: c.mail,
      telephone: c.tel,
      iban: c.iban,
      bic: c.bic,
      type_mission: ctConfig?.defaultModeComptable ||
        (c.mission?.includes("REVISION") || c.mission?.includes("SURVEILLANCE") ? "SURVEILLANCE" : "TENUE"),
      regime_benefices: detectRegimeBenefices(c.ape) || undefined,
    });
  };

  // OPT-50: clear also missions_selected and honoraires_detail
  const clearClient = () => {
    onChange({
      client_id: "", client_ref: "", raison_sociale: "", siren: "",
      forme_juridique: "", dirigeant: "", adresse: "", cp: "", ville: "",
      capital: "", ape: "", email: "", telephone: "", iban: "", bic: "",
      qualite_dirigeant: "", type_mission: "", mission_type_id: "", client_type_id: "",
      date_creation: "", effectif: "", regime_fiscal: "", tva_assujetti: true, cac: false,
      volume_comptable: "", exercice_debut: "",
      missions_selected: [], honoraires_detail: {},
    });
    riskToastShown.current = false;
    setSearch("");
  };

  // OPT-49: also import client_type_id and honoraires_detail
  const importPreviousLM = () => {
    if (!previousLM?.wizard_data) return;
    const wd = previousLM.wizard_data as Record<string, unknown>;
    onChange({
      type_mission: (wd.type_mission as string) || data.type_mission,
      mission_type_id: (wd.mission_type_id as string) || data.mission_type_id,
      client_type_id: (wd.client_type_id as string) || data.client_type_id,
      missions_selected: (wd.missions_selected as unknown[]) || [],
      duree: (wd.duree as string) || data.duree,
      tacite_reconduction: (wd.tacite_reconduction as boolean) ?? true,
      preavis_mois: (wd.preavis_mois as number) || 3,
      honoraires_ht: (wd.honoraires_ht as number) || 0,
      honoraires_detail: (wd.honoraires_detail as Record<string, string>) || {},
      frequence_facturation: (wd.frequence_facturation as string) || "MENSUEL",
      mode_paiement: (wd.mode_paiement as string) || "virement",
      taux_horaire_complementaire: (wd.taux_horaire_complementaire as number) || 0,
      associe_signataire: (wd.associe_signataire as string) || "",
      chef_mission: (wd.chef_mission as string) || "",
      clause_rgpd: (wd.clause_rgpd as boolean) ?? true,
    });
    toast.success("Parametres de la LM precedente importes");
  };

  return (
    <div className="space-y-6">
      {/* Client selection */}
      {!data.client_id ? (
        <>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Rechercher par nom, SIREN ou reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputMode="search"
              autoComplete="off"
              autoFocus
              className="pl-10 h-12 wizard-input text-base"
            />
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mx-1 px-1">
            {filtered.map((c) => (
              <button
                key={c.ref}
                onClick={() => selectClient(c)}
                aria-label={`Selectionner ${c.raisonSociale}`}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl wizard-card active:scale-[0.995] text-left group/client"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  c.forme === "ENTREPRISE INDIVIDUELLE" ? "bg-purple-50 dark:bg-purple-500/10" : "bg-blue-50 dark:bg-blue-500/10"
                }`}>
                  {c.forme === "ENTREPRISE INDIVIDUELLE"
                    ? <User className="w-4 h-4 text-purple-400" />
                    : <Building2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate" title={c.raisonSociale}>{c.raisonSociale}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.siren} · {c.forme}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 wizard-badge ${vigilanceColor(c.nivVigilance)}`}>
                  {c.nivVigilance}
                </Badge>
              </button>
            ))}
            {filtered.length === 0 && search.length >= 2 && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                Aucun client trouve pour "{search}"
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 border-dashed border-gray-200 dark:border-white/[0.06] text-slate-400 hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 hover:border-blue-200 dark:hover:border-blue-500/20 h-11"
            onClick={() => navigate("/nouveau-client")}
            aria-label="Creer un nouveau client"
          >
            <Plus className="w-4 h-4" /> Creer un nouveau client
          </Button>
        </>
      ) : (
        <>
          {/* Screening banners */}
          {screeningStatus === "missing" && (
            <div className="flex items-start gap-3 p-3 rounded-xl wizard-alert bg-red-50/80 dark:bg-red-500/[0.06] border border-red-200/60 dark:border-red-500/15" role="alert">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Dossier LCB-FT manquant</p>
                <p className="text-xs text-red-400/70 mt-0.5">Ce client n'a pas de dossier LCB-FT. Completez le parcours client d'abord.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                  onClick={() => navigate(`/client/${data.client_id}`)}
                >
                  Voir la fiche client
                </Button>
              </div>
            </div>
          )}
          {screeningStatus === "expired" && (
            <div className="flex items-start gap-3 p-3 rounded-xl wizard-alert bg-amber-50/80 dark:bg-amber-500/[0.06] border border-amber-200/60 dark:border-amber-500/15" role="alert">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Dossier LCB-FT perime</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Le dossier LCB-FT de ce client date de plus d'un an. Mettez-le a jour avant de generer la lettre.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => navigate(`/client/${data.client_id}`)}
                >
                  Mettre a jour
                </Button>
              </div>
            </div>
          )}

          {/* Risk alerts */}
          {selectedClient && selectedClient.scoreGlobal >= 70 && (
            <div className="flex items-start gap-3 p-4 rounded-xl wizard-alert bg-red-50/80 dark:bg-red-500/[0.06] border border-red-200/60 dark:border-red-500/15" role="alert">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Attention — Ce client presente un risque eleve (score {selectedClient.scoreGlobal}/100)
                </p>
                <p className="text-xs text-red-400/80">
                  Conformement a la NPLAB, des mesures de vigilance renforcee doivent etre appliquees.
                </p>
                <ul className="text-xs text-red-400/70 space-y-0.5 list-disc list-inside">
                  <li>L'identite du beneficiaire effectif a ete verifiee</li>
                  <li>Les documents KYC sont a jour</li>
                  <li>L'analyse de risque a ete validee par un associe</li>
                  <li>La decision d'acceptation de mission est documentee</li>
                </ul>
              </div>
            </div>
          )}

          {selectedClient && selectedClient.scoreGlobal >= 50 && selectedClient.scoreGlobal < 60 && (
            <div className="flex items-center gap-3 p-3 rounded-xl wizard-alert bg-amber-50/80 dark:bg-amber-500/[0.06] border border-amber-200/60 dark:border-amber-500/15" role="alert">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Ce client presente un risque moyen (score {selectedClient.scoreGlobal}/100). Revue des diligences de vigilance recommandee.
              </p>
            </div>
          )}

          {selectedClient && selectedClient.scoreGlobal >= 60 && selectedClient.scoreGlobal < 70 && (
            <div className="flex items-center gap-3 p-3 rounded-xl wizard-alert bg-orange-50/80 dark:bg-orange-500/[0.06] border border-orange-200/60 dark:border-orange-500/15">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Client a <strong>vigilance renforcee</strong> — envisagez un complement d'honoraires
              </p>
            </div>
          )}

          {/* Selected client card */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-emerald-50/40 dark:from-emerald-500/[0.06] dark:to-emerald-500/[0.02] border border-emerald-200/60 dark:border-emerald-500/15" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.03)' }}>
            <button
              onClick={clearClient}
              aria-label="Deselectionner le client"
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{data.raison_sociale}</p>
                <p className="text-xs text-emerald-400/60 mt-0.5">{data.client_ref} · SIREN {data.siren} · {data.forme_juridique}</p>
              </div>
            </div>
            {selectedClient && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400 dark:text-slate-500">Dirigeant : </span><span className="text-slate-700 dark:text-slate-300">{data.dirigeant || "—"}</span></div>
                <div><span className="text-slate-400 dark:text-slate-500">Ville : </span><span className="text-slate-700 dark:text-slate-300">{data.ville || "—"}</span></div>
                <div><span className="text-slate-400 dark:text-slate-500">APE : </span><span className="text-slate-700 dark:text-slate-300">{data.ape || "—"}</span></div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Vigilance : </span>
                  <Badge variant="outline" className={`text-[9px] ml-1 ${vigilanceColor(selectedClient.nivVigilance)}`}>
                    {selectedClient.nivVigilance}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Détails entité — collapsible */}
          {selectedClient && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-xl border border-gray-200/60 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-sm font-medium text-slate-600 dark:text-slate-300">
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform [[data-state=open]>&]:rotate-180" />
                Détails pour la lettre de mission
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Régime fiscal */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Régime fiscal</Label>
                    <Select
                      value={data.regime_fiscal}
                      onValueChange={(v) => onChange({ regime_fiscal: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IS Réel Simplifié">IS Réel Simplifié</SelectItem>
                        <SelectItem value="IS Réel Normal">IS Réel Normal</SelectItem>
                        <SelectItem value="IR BIC Réel">IR BIC Réel</SelectItem>
                        <SelectItem value="IR BNC">IR BNC</SelectItem>
                        <SelectItem value="IR Micro-BIC">IR Micro-BIC</SelectItem>
                        <SelectItem value="IR Micro-BNC">IR Micro-BNC</SelectItem>
                        <SelectItem value="IR">IR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Effectif */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Effectif</Label>
                    <Input
                      type="number"
                      min={0}
                      value={data.effectif}
                      onChange={(e) => onChange({ effectif: e.target.value })}
                      placeholder="0"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* TVA */}
                  <div className="flex items-center justify-between col-span-1">
                    <Label className="text-xs text-slate-500">Assujetti TVA</Label>
                    <Switch
                      checked={data.tva_assujetti}
                      onCheckedChange={(v) => onChange({ tva_assujetti: v })}
                    />
                  </div>

                  {/* CAC */}
                  <div className="flex items-center justify-between col-span-1">
                    <Label className="text-xs text-slate-500">CAC désigné</Label>
                    <Switch
                      checked={data.cac}
                      onCheckedChange={(v) => onChange({ cac: v })}
                    />
                  </div>

                  {/* Volume comptable */}
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-slate-500">Volume comptable</Label>
                    <Input
                      value={data.volume_comptable}
                      onChange={(e) => onChange({ volume_comptable: e.target.value })}
                      placeholder="Ex: 50 factures d'achats et de ventes par mois"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Date de création */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Date de création</Label>
                    <Input
                      type="date"
                      value={data.date_creation}
                      onChange={(e) => onChange({ date_creation: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Exercice début */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Début exercice</Label>
                    <Input
                      value={data.exercice_debut}
                      onChange={(e) => onChange({ exercice_debut: e.target.value })}
                      placeholder="01/01/2026"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Active LM warning + import */}
          {previousLM && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-xl wizard-alert bg-amber-50/80 dark:bg-amber-500/[0.06] border border-amber-200/60 dark:border-amber-500/15" role="alert">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Ce client a deja une lettre de mission active</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    {previousLM.numero} — {previousLM.status === "signee" ? "Signee" : "Envoyee"}. Souhaitez-vous creer un avenant plutot qu'une nouvelle LM ?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10 gap-1"
                    onClick={() => navigate("/lettre-mission")}
                  >
                    <FileText className="w-3 h-3" /> Creer un avenant
                  </Button>
                </div>
              </div>
              <button
                onClick={importPreviousLM}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-100 dark:border-blue-500/15 bg-blue-50/60 dark:bg-blue-500/[0.04] hover:bg-blue-50 dark:hover:bg-blue-500/[0.08] transition-colors text-left"
              >
                <History className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Reprendre les parametres de la LM precedente</p>
                  <p className="text-[10px] text-blue-400/60 mt-0.5">{previousLM.numero} — {previousLM.status === "signee" ? "Signee" : "Envoyee"}</p>
                </div>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
