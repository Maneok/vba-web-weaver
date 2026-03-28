import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { vigilanceColor } from "@/lib/lmUtils";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Search, Building2, CheckCircle2, X, Plus,
  AlertTriangle, ShieldAlert, Edit3, Briefcase, Scale, Shield,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const REGIMES_FISCAUX = [
  "IS Réel Simplifié", "IS Réel Normal", "IR BIC Réel Simplifié",
  "IR BIC Réel Normal", "IR BNC Déclaration Contrôlée", "Micro-BIC",
  "Micro-BNC", "IR Revenus fonciers",
];

export default function LMNewStep1({ data, onChange }: Props) {
  const { clients } = useAppState();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [screeningStatus, setScreeningStatus] = useState<"ok" | "expired" | "missing" | null>(null);

  const filtered = useMemo(() => {
    if (!search || search.length < 2) return clients.slice(0, 15);
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.raisonSociale.toLowerCase().includes(q) || c.siren.includes(q) || c.ref.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const selectedClient = useMemo(() => clients.find((c) => c.ref === data.client_id), [clients, data.client_id]);

  useEffect(() => {
    if (!selectedClient) { setScreeningStatus(null); return; }
    const derniereKyc = (selectedClient as any).derniereKyc || (selectedClient as any).derniere_kyc;
    if (!derniereKyc) { setScreeningStatus("missing"); return; }
    const yearsAgo = (Date.now() - new Date(derniereKyc).getTime()) / (1000 * 60 * 60 * 24 * 365);
    setScreeningStatus(yearsAgo > 1 ? "expired" : "ok");
  }, [selectedClient]);

  const selectClient = useCallback((c: Client) => {
    onChange({
      client_id: c.ref, client_ref: c.ref,
      raison_sociale: c.raisonSociale || "", siren: c.siren || "",
      forme_juridique: c.forme || "", dirigeant: c.dirigeant || "",
      adresse: c.adresse || "", cp: c.cp || "", ville: c.ville || "",
      capital: c.capital?.toString() || "", ape: c.ape || "",
      email: c.mail || "", telephone: c.tel || "",
      civilite: (c as any).civilite || "", date_creation: c.dateCreation || "",
      effectif: c.effectif?.toString() || "",
      iban: (c as any).iban || "", bic: (c as any).bic || "",
      type_mission: c.typeMission || "Présentation des comptes",
    });
    setSearch("");
    setEditMode(false);
  }, [onChange]);

  const dateCloture = data.date_cloture_exercice || (data as any).date_cloture || "";
  const assujettiTva = data.assujetti_tva ?? (data as any).tva_assujetti ?? true;
  // These fields are loaded async from DB — don't mark as "missing" immediately
  const hasFiscalInfo = !!data.regime_fiscal && !!dateCloture;
  const isComplete = hasFiscalInfo;

  return (
    <div className="space-y-6">
      {/* ── CLIENT SELECTION ── */}
      {!data.client_id ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10"><Building2 className="w-4 h-4 text-blue-400" /></div>
            <div>
              <h3 className="text-sm font-semibold">Sélection du client</h3>
              <p className="text-[11px] text-muted-foreground">Les données de la fiche client seront automatiquement reprises</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher par nom, SIREN ou référence..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white/50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10"
              autoFocus
            />
          </div>

          <div className="max-h-[340px] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/[0.06]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
                <Button variant="link" size="sm" onClick={() => navigate("/nouveau-client")} className="mt-1">
                  <Plus className="w-3 h-3 mr-1" /> Créer un client
                </Button>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.ref} onClick={() => selectClient(c)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.raisonSociale}</p>
                    <p className="text-[11px] text-muted-foreground">{c.siren} · {c.forme} · {c.ref}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">Sélectionner</Badge>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── SELECTED CLIENT CARD ── */}
          <div className="rounded-xl border border-blue-200/60 dark:border-blue-500/20 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 dark:from-blue-500/5 dark:to-indigo-500/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-blue-500/20">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{data.raison_sociale}</p>
                  <p className="text-[11px] text-muted-foreground">{data.siren} · {data.forme_juridique} · {data.dirigeant}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-red-500/10 hover:text-red-400"
                onClick={() => onChange({ client_id: "", client_ref: "" })}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Type mission - read-only from fiche client */}
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs font-medium px-2.5 py-0.5">
                <Briefcase className="w-3 h-3 mr-1.5" />
                {data.type_mission || "Présentation des comptes"}
              </Badge>
              {screeningStatus === "ok" && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> KYC valide
                </Badge>
              )}
            </div>

            {/* Compact client info — always show summary, expand to edit */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                {isComplete ? (
                  <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Données complètes
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    Chargement des données...
                  </span>
                )}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5" onClick={() => setEditMode(!editMode)}>
                  <Edit3 className="w-3 h-3 mr-1" /> {editMode ? "Fermer" : "Modifier"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Régime : <span className="text-foreground font-medium">{data.regime_fiscal || "—"}</span></span>
                <span className="text-muted-foreground">Clôture : <span className="text-foreground font-medium">{dateCloture || "—"}</span></span>
                <span className="text-muted-foreground">TVA : <span className="text-foreground font-medium">{assujettiTva ? "Oui" : "Non"}</span></span>
              </div>
            </div>

            {/* Edit mode — only visible when user clicks Modifier */}
            {editMode && (
              <div className="pt-2 space-y-3 border-t border-blue-200/40 dark:border-blue-500/10">
                <div className="space-y-1">
                  <Label className="text-xs">Régime fiscal</Label>
                  <Select value={data.regime_fiscal} onValueChange={(v) => onChange({ regime_fiscal: v })}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-white/[0.03]"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {REGIMES_FISCAUX.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date clôture exercice</Label>
                  <Input type="text" placeholder="31/12/2026" value={dateCloture}
                    onChange={(e) => onChange({ date_cloture_exercice: e.target.value })}
                    className="h-8 text-xs bg-white dark:bg-white/[0.03]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={assujettiTva} onCheckedChange={(v) => onChange({ assujetti_tva: v })} />
                    <Label className="text-xs">Assujetti TVA</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={data.cac} onCheckedChange={(v) => onChange({ cac: v })} />
                    <Label className="text-xs">CAC désigné</Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MISSIONS COMPLÉMENTAIRES ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10"><Briefcase className="w-4 h-4 text-indigo-400" /></div>
              <h3 className="text-sm font-semibold">Missions complémentaires</h3>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/[0.06] overflow-hidden">
              {/* Sociale */}
              <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.mission_sociale ? "bg-emerald-500/10" : "bg-slate-500/5"}`}>
                    <Scale className={`w-4 h-4 ${data.mission_sociale ? "text-emerald-500" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Mission sociale</p>
                    <p className="text-[11px] text-muted-foreground">Bulletins de paie, déclarations sociales</p>
                  </div>
                </div>
                <Switch checked={data.mission_sociale} onCheckedChange={(v) => onChange({ mission_sociale: v })} />
              </div>

              {/* Juridique */}
              <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.mission_juridique ? "bg-purple-500/10" : "bg-slate-500/5"}`}>
                    <Briefcase className={`w-4 h-4 ${data.mission_juridique ? "text-purple-500" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Mission juridique annuelle</p>
                    <p className="text-[11px] text-muted-foreground">Secrétariat juridique, AG, PV</p>
                  </div>
                </div>
                <Switch checked={data.mission_juridique} onCheckedChange={(v) => onChange({ mission_juridique: v })} />
              </div>

              {/* Contrôle fiscal */}
              <div className="px-4 py-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.mission_controle_fiscal ? "bg-amber-500/10" : "bg-slate-500/5"}`}>
                      <Shield className={`w-4 h-4 ${data.mission_controle_fiscal ? "text-amber-500" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Assistance contrôle fiscal</p>
                      <p className="text-[11px] text-muted-foreground">Protection en cas de vérification</p>
                    </div>
                  </div>
                  <Switch checked={data.mission_controle_fiscal} onCheckedChange={(v) => onChange({ mission_controle_fiscal: v, option_controle_fiscal: v ? "A" : "none" })} />
                </div>
                {data.mission_controle_fiscal && (
                  <RadioGroup value={data.option_controle_fiscal}
                    onValueChange={(v) => onChange({ option_controle_fiscal: v as "A" | "B" | "none" })}
                    className="ml-11 space-y-1.5 pb-1">
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                      <RadioGroupItem value="A" id="cf-a" />
                      <div className="flex-1"><span className="text-xs font-medium">Option A</span><span className="text-[11px] text-muted-foreground ml-2">5 000 € HT/an</span></div>
                    </label>
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                      <RadioGroupItem value="B" id="cf-b" />
                      <div className="flex-1"><span className="text-xs font-medium">Option B</span><span className="text-[11px] text-muted-foreground ml-2">2 500 € HT/an</span></div>
                    </label>
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                      <RadioGroupItem value="none" id="cf-none" />
                      <span className="text-xs text-muted-foreground">Renonce à la souscription</span>
                    </label>
                  </RadioGroup>
                )}
              </div>
            </div>
          </div>

          {/* ── LCB-FT COMPACT ── */}
          {selectedClient && (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3.5 flex items-center gap-4">
              <div className="p-1.5 rounded-lg bg-slate-500/10"><ShieldAlert className="w-3.5 h-3.5 text-slate-400" /></div>
              <div className="flex items-center gap-4 text-[11px] flex-1 min-w-0">
                <span className="text-muted-foreground">Score <span className="text-foreground font-semibold ml-0.5">{(selectedClient as any).scoreRisque ?? "—"}</span></span>
                <Badge variant="outline" className={`text-[10px] py-0 ${vigilanceColor((selectedClient as any).niveauVigilance)}`}>
                  {(selectedClient as any).niveauVigilance || "—"}
                </Badge>
                <span className="text-muted-foreground">PPE <span className="text-foreground font-medium ml-0.5">{(selectedClient as any).statutPpe || "Non"}</span></span>
                {screeningStatus === "missing" && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] ml-auto">
                    <ShieldAlert className="w-3 h-3 mr-1" /> KYC manquant
                  </Badge>
                )}
                {screeningStatus === "expired" && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] ml-auto">
                    <AlertTriangle className="w-3 h-3 mr-1" /> KYC expiré
                  </Badge>
                )}
              </div>
            </div>
          )}
          {(selectedClient as any)?.statutPpe && (selectedClient as any).statutPpe !== "Non PPE" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Client PPE — vigilance renforcée requise
            </div>
          )}
        </>
      )}
    </div>
  );
}
