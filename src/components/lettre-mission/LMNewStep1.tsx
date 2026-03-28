import { useState, useMemo, useEffect, useRef } from "react";
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
  Search, Building2, User, CheckCircle2, X, Plus,
  AlertTriangle, ShieldAlert, Edit3, ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------

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

  // Client search
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

  const selectedClient = useMemo(
    () => clients.find((c) => c.ref === data.client_id),
    [clients, data.client_id]
  );

  // Screening check
  useEffect(() => {
    if (!selectedClient) { setScreeningStatus(null); return; }
    const derniereKyc = (selectedClient as any).derniereKyc || (selectedClient as any).derniere_kyc;
    if (!derniereKyc) { setScreeningStatus("missing"); return; }
    const monthsAgo = (Date.now() - new Date(derniereKyc).getTime()) / (1000 * 60 * 60 * 24 * 365);
    setScreeningStatus(monthsAgo > 1 ? "expired" : "ok");
  }, [selectedClient]);

  // Select client handler
  const selectClient = (c: Client) => {
    onChange({
      client_id: c.ref,
      client_ref: c.ref,
      raison_sociale: c.raisonSociale || "",
      siren: c.siren || "",
      forme_juridique: c.forme || "",
      dirigeant: c.dirigeant || "",
      adresse: c.adresse || "",
      cp: c.cp || "",
      ville: c.ville || "",
      capital: c.capital?.toString() || "",
      ape: c.ape || "",
      email: c.mail || "",
      telephone: c.tel || "",
      civilite: (c as any).civilite || "",
      date_creation: c.dateCreation || "",
      effectif: c.effectif?.toString() || "",
      iban: (c as any).iban || "",
      bic: (c as any).bic || "",
      type_mission: c.typeMission || "Présentation des comptes",
    });
    setSearch("");
    setEditMode(false);
  };

  // Check data completeness
  const missingFields: { key: string; label: string }[] = [];
  if (!data.regime_fiscal) missingFields.push({ key: "regime_fiscal", label: "Régime fiscal" });
  if (!data.date_cloture_exercice) missingFields.push({ key: "date_cloture_exercice", label: "Date clôture exercice" });
  const isComplete = missingFields.length === 0;

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Client ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Client</h3>

        {!data.client_id ? (
          <>
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher par nom, SIREN ou référence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Client list */}
            <div className="max-h-[320px] overflow-y-auto border rounded-lg divide-y">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun client trouvé.
                  <Button variant="link" size="sm" onClick={() => navigate("/nouveau-client")} className="ml-1">
                    <Plus className="w-3 h-3 mr-1" /> Créer un client
                  </Button>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.ref}
                    onClick={() => selectClient(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.raisonSociale}</p>
                      <p className="text-xs text-muted-foreground">{c.siren} · {c.forme} · {c.ref}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Selected client summary */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">{data.raison_sociale}</span>
                  <Badge variant="outline" className="text-xs">{data.forme_juridique}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onChange({ client_id: "", client_ref: "" })}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Type mission */}
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">{data.type_mission || "Présentation des comptes"}</Badge>
              </div>

              {/* Completeness check */}
              {isComplete && !editMode ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Données complètes</span>
                    <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={() => setEditMode(true)}>
                      <Edit3 className="w-3 h-3 mr-1" /> Modifier
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>SIREN : {data.siren}</span>
                    <span>Dirigeant : {data.dirigeant}</span>
                    <span>Régime : {data.regime_fiscal}</span>
                    <span>Clôture : {data.date_cloture_exercice}</span>
                    <span>TVA : {data.assujetti_tva ? "Oui" : "Non"}</span>
                    <span>CAC : {data.cac ? "Oui" : "Non"}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(missingFields.length > 0 || editMode) && (
                    <>
                      {/* Regime fiscal */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Régime fiscal {!data.regime_fiscal && <span className="text-red-400">*</span>}</Label>
                        <Select value={data.regime_fiscal} onValueChange={(v) => onChange({ regime_fiscal: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>
                            {REGIMES_FISCAUX.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Date cloture */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Date clôture exercice {!data.date_cloture_exercice && <span className="text-red-400">*</span>}</Label>
                        <Input
                          type="text"
                          placeholder="31/12/2026"
                          value={data.date_cloture_exercice}
                          onChange={(e) => onChange({ date_cloture_exercice: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      {/* TVA + CAC */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={data.assujetti_tva} onCheckedChange={(v) => onChange({ assujetti_tva: v })} />
                          <Label className="text-xs">Assujetti TVA</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={data.cac} onCheckedChange={(v) => onChange({ cac: v })} />
                          <Label className="text-xs">CAC désigné</Label>
                        </div>
                      </div>
                      {editMode && (
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditMode(false)}>Fermer</Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── SECTION 2: Missions complémentaires ── */}
      {data.client_id && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Missions complémentaires</h3>
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Mission sociale</Label>
              <Switch checked={data.mission_sociale} onCheckedChange={(v) => onChange({ mission_sociale: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Mission juridique annuelle</Label>
              <Switch checked={data.mission_juridique} onCheckedChange={(v) => onChange({ mission_juridique: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Assistance contrôle fiscal</Label>
                <Switch checked={data.mission_controle_fiscal} onCheckedChange={(v) => onChange({ mission_controle_fiscal: v, option_controle_fiscal: v ? "A" : "none" })} />
              </div>
              {data.mission_controle_fiscal && (
                <RadioGroup
                  value={data.option_controle_fiscal}
                  onValueChange={(v) => onChange({ option_controle_fiscal: v as "A" | "B" | "none" })}
                  className="ml-6 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="A" id="cf-a" />
                    <Label htmlFor="cf-a" className="text-xs">Option A — 5 000 € HT/an (25 € HT/mois)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="B" id="cf-b" />
                    <Label htmlFor="cf-b" className="text-xs">Option B — 2 500 € HT/an (10 € HT/mois)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="none" id="cf-none" />
                    <Label htmlFor="cf-none" className="text-xs text-muted-foreground">Renonce à la souscription</Label>
                  </div>
                </RadioGroup>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: Info LCB-FT ── */}
      {data.client_id && selectedClient && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">LCB-FT</h3>
          <div className="border rounded-lg p-3 flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Score : </span>
              <span className="font-medium">{(selectedClient as any).scoreRisque ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vigilance : </span>
              <Badge variant="outline" className={`text-[10px] ${vigilanceColor((selectedClient as any).niveauVigilance)}`}>
                {(selectedClient as any).niveauVigilance || "—"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">PPE : </span>
              <span className="font-medium">{(selectedClient as any).statutPpe || "Non PPE"}</span>
            </div>
            {screeningStatus === "missing" && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                <ShieldAlert className="w-3 h-3 mr-1" /> KYC manquant
              </Badge>
            )}
            {screeningStatus === "expired" && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-1" /> KYC expiré
              </Badge>
            )}
          </div>
          {(selectedClient as any).statutPpe && (selectedClient as any).statutPpe !== "Non PPE" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Client PPE — vigilance renforcée requise
            </div>
          )}
        </div>
      )}
    </div>
  );
}
