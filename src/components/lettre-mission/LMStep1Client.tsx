import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import type { LMModele } from "@/lib/lettreMissionModeles";
import { getModeles, validateCnoecCompliance } from "@/lib/lettreMissionModeles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, Building2, User, CheckCircle2, BookOpen, Eye, CheckSquare, X,
  AlertTriangle, ShieldAlert, History, FileText, ShieldCheck, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import MissionTypeSelector from "@/components/lettre-mission/MissionTypeSelector";
import { buildSectionsForMissionType } from "@/lib/lettreMissionModeles";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const TYPES_MISSION = [
  { value: "TENUE", label: "Tenue", description: "Tenue de comptabilite complete", icon: BookOpen },
  { value: "SURVEILLANCE", label: "Surveillance", description: "Surveillance et conseil", icon: Eye },
  { value: "REVISION", label: "Revision", description: "Revision des comptes", icon: CheckSquare },
];

function vigilanceColor(niv: string) {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export default function LMStep1Client({ data, onChange }: Props) {
  const { clients } = useAppState();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [previousLM, setPreviousLM] = useState<{ id: string; wizard_data: Record<string, unknown>; numero: string; statut: string } | null>(null);
  const [screeningStatus, setScreeningStatus] = useState<"ok" | "expired" | "missing" | null>(null);
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [modelesLoading, setModelesLoading] = useState(false);

  // Load modeles when cabinet is available
  useEffect(() => {
    const cabinetId = profile?.cabinet_id;
    if (!cabinetId) return;
    let cancelled = false;
    setModelesLoading(true);
    getModeles(cabinetId)
      .then((m) => {
        if (!cancelled) {
          setModeles(m);
          // Auto-select default modele if none selected
          if (!data.modele_id) {
            const defaultModele = m.find((mod) => mod.is_default);
            if (defaultModele) {
              onChange({ modele_id: defaultModele.id });
            }
          }
        }
      })
      .catch((err) => logger.warn("LM", "Failed to load modeles:", err))
      .finally(() => { if (!cancelled) setModelesLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

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

  const selectedClient = clients.find((c) => c.ref === data.client_id);

  // B) Check for previous signed LM + I) Screening check
  useEffect(() => {
    if (!data.client_id) {
      setPreviousLM(null);
      setScreeningStatus(null);
      return;
    }

    let cancelled = false;

    // B) Previous LM
    supabase
      .from("lettres_mission")
      .select("id, wizard_data, numero, statut")
      .eq("client_ref", data.client_id)
      .eq("statut", "signee")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        if (cancelled) return;
        if (rows && rows.length > 0) setPreviousLM(rows[0]);
        else setPreviousLM(null);
      })
      .catch((e) => { if (!cancelled) logger.warn("LM", "Previous LM check failed:", e); });

    // I) Screening check — look at dateDerniereRevue
    if (selectedClient) {
      if (!selectedClient.dateDerniereRevue) {
        setScreeningStatus("missing");
      } else {
        const revueDate = new Date(selectedClient.dateDerniereRevue);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        setScreeningStatus(revueDate < oneYearAgo ? "expired" : "ok");
      }

      // A) Vigilance renforcee banner
      if (selectedClient.scoreGlobal > 60) {
        toast.warning("Client a vigilance renforcee — envisagez un complement d'honoraires", { duration: 5000 });
      }
    }

    return () => { cancelled = true; };
  }, [data.client_id, selectedClient]);

  const selectClient = (c: Client) => {
    onChange({
      client_id: c.ref,
      client_ref: c.ref,
      raison_sociale: c.raisonSociale,
      siren: c.siren,
      forme_juridique: c.forme,
      dirigeant: c.dirigeant,
      qualite_dirigeant: c.forme === "ENTREPRISE INDIVIDUELLE" ? "Gerant" : "President",
      adresse: c.adresse,
      cp: c.cp,
      ville: c.ville,
      capital: String(c.capital || ""),
      ape: c.ape,
      email: c.mail,
      telephone: c.tel,
      iban: c.iban,
      bic: c.bic,
      type_mission: c.mission?.includes("REVISION") || c.mission?.includes("SURVEILLANCE")
        ? "SURVEILLANCE"
        : "TENUE",
    });
  };

  const clearClient = () => {
    onChange({
      client_id: "", client_ref: "", raison_sociale: "", siren: "",
      forme_juridique: "", dirigeant: "", adresse: "", cp: "", ville: "",
      capital: "", ape: "", email: "", telephone: "", iban: "", bic: "",
    });
    setSearch("");
  };

  // B) Import previous LM data
  const importPreviousLM = () => {
    if (!previousLM?.wizard_data) return;
    const wd = previousLM.wizard_data as Record<string, unknown>;
    onChange({
      type_mission: (wd.type_mission as string) || data.type_mission,
      missions_selected: (wd.missions_selected as unknown[]) || [],
      duree: (wd.duree as string) || data.duree,
      tacite_reconduction: (wd.tacite_reconduction as boolean) ?? true,
      preavis_mois: (wd.preavis_mois as number) || 3,
      honoraires_ht: (wd.honoraires_ht as number) || 0,
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
      {/* ── Client selection ── */}
      {!data.client_id ? (
        <>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Rechercher par nom, SIREN ou reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputMode="search"
              autoComplete="off"
              autoFocus
              className="pl-10 h-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 text-base"
            />
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mx-1 px-1">
            {filtered.map((c) => (
              <button
                key={c.ref}
                onClick={() => selectClient(c)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] active:scale-[0.99] transition-all duration-150 text-left"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  c.forme === "ENTREPRISE INDIVIDUELLE" ? "bg-purple-500/15" : "bg-blue-500/15"
                }`}>
                  {c.forme === "ENTREPRISE INDIVIDUELLE"
                    ? <User className="w-4 h-4 text-purple-400" />
                    : <Building2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.raisonSociale}</p>
                  <p className="text-xs text-slate-500">{c.siren} · {c.forme}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${vigilanceColor(c.nivVigilance)}`}>
                  {c.nivVigilance}
                </Badge>
              </button>
            ))}
            {filtered.length === 0 && search.length >= 2 && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Aucun client trouve pour "{search}"
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 border-dashed border-white/[0.08] text-slate-400 hover:text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/20 h-11"
            onClick={() => navigate("/nouveau-client")}
          >
            <Plus className="w-4 h-4" /> Creer un nouveau client
          </Button>
        </>
      ) : (
        <>
          {/* I) Screening banners */}
          {screeningStatus === "missing" && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Dossier LCB-FT manquant</p>
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
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">Dossier LCB-FT perime</p>
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

          {/* A) Vigilance renforcee */}
          {selectedClient && selectedClient.scoreGlobal > 60 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">
                Client a <strong>vigilance renforcee</strong> (score {selectedClient.scoreGlobal}/100) — envisagez un complement d'honoraires
              </p>
            </div>
          )}

          {/* Selected client card */}
          <div className="relative p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <button
              onClick={clearClient}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-emerald-300">{data.raison_sociale}</p>
                <p className="text-xs text-emerald-400/60 mt-0.5">{data.client_ref} · SIREN {data.siren} · {data.forme_juridique}</p>
              </div>
            </div>
            {selectedClient && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Dirigeant : </span><span className="text-slate-300">{data.dirigeant || "—"}</span></div>
                <div><span className="text-slate-500">Ville : </span><span className="text-slate-300">{data.ville || "—"}</span></div>
                <div><span className="text-slate-500">APE : </span><span className="text-slate-300">{data.ape || "—"}</span></div>
                <div>
                  <span className="text-slate-500">Vigilance : </span>
                  <Badge variant="outline" className={`text-[9px] ml-1 ${vigilanceColor(selectedClient.nivVigilance)}`}>
                    {selectedClient.nivVigilance}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* B) Import previous LM */}
          {previousLM && (
            <button
              onClick={importPreviousLM}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-500/15 bg-blue-500/5 hover:bg-blue-500/10 transition-colors text-left"
            >
              <History className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-300">Reprendre les parametres de la LM precedente</p>
                <p className="text-[10px] text-blue-400/60 mt-0.5">{previousLM.numero} — Signee</p>
              </div>
            </button>
          )}

          {/* Type mission selection — normative OEC types */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Type de mission (référentiel normatif OEC)</p>
            <MissionTypeSelector
              value={(data as any).mission_type_id || "presentation"}
              onValueChange={(val) => {
                const config = getMissionTypeConfig(val);
                onChange({
                  type_mission: config.shortLabel,
                  mission_type_id: val,
                } as any);
              }}
            />
          </div>

          {/* Legacy type mission — comptable */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Mode comptable</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TYPES_MISSION.map(({ value, label, description, icon: Icon }) => {
                const active = data.type_mission === value;
                return (
                  <button
                    key={value}
                    onClick={() => onChange({ type_mission: value })}
                    className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                      active
                        ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                      active ? "bg-blue-500/20" : "bg-white/[0.04]"
                    }`}>
                      <Icon className={`w-5 h-5 ${active ? "text-blue-400" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-blue-300" : "text-slate-300"}`}>{label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
                    </div>
                    {active && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modele selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-300">Modèle de lettre</p>
            </div>
            {modelesLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement des modèles...
              </div>
            ) : modeles.length === 0 ? (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-slate-500">Aucun modèle configuré — le modèle GRIMY par défaut sera utilisé.</p>
              </div>
            ) : (
              <Select
                value={data.modele_id || ""}
                onValueChange={(val) => onChange({ modele_id: val })}
              >
                <SelectTrigger className="h-11 bg-white/[0.04] border-white/[0.08] text-white">
                  <SelectValue placeholder="Choisir un modèle..." />
                </SelectTrigger>
                <SelectContent>
                  {modeles.map((m) => {
                    const cnoec = validateCnoecCompliance(m.sections);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.nom}</span>
                          {m.is_default && (
                            <Badge className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">Défaut</Badge>
                          )}
                          {cnoec.valid ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {data.modele_id && modeles.length > 0 && (() => {
              const selected = modeles.find((m) => m.id === data.modele_id);
              if (!selected) return null;
              const cnoec = validateCnoecCompliance(selected.sections);
              return (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-600">
                    {selected.sections.length} sections · Source: {selected.source === "grimy" ? "GRIMY" : selected.source === "import_docx" ? "Import DOCX" : "Copie"}
                  </span>
                  {cnoec.valid ? (
                    <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400">Conforme CNOEC</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[8px] border-orange-500/30 text-orange-400">{cnoec.warnings.length} alerte{cnoec.warnings.length > 1 ? "s" : ""}</Badge>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
