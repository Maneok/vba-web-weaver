import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Building2, User, CheckCircle2, BookOpen, Eye, CheckSquare, X,
  AlertTriangle, ShieldAlert, History, TrendingUp, Clock, FileText, Info,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const TYPES_MISSION = [
  { value: "TENUE", label: "Tenue", description: "Tenue de comptabilite complete", detail: "Saisie, rapprochement, bilan, liasse", icon: BookOpen },
  { value: "SURVEILLANCE", label: "Surveillance", description: "Surveillance et conseil", detail: "Controle periodique, conseil strategique", icon: Eye },
  { value: "REVISION", label: "Revision", description: "Revision des comptes", detail: "Audit, verification, certification", icon: CheckSquare },
];

function vigilanceColor(niv: string) {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

// (10) Risk score visual indicator
function RiskIndicator({ score }: { score: number }) {
  const pct = Math.min(100, Math.round((score / 120) * 100));
  const color = score <= 25 ? "bg-emerald-500" : score <= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5" title={`Score ${score}/120`}>
      <div className="w-12 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-slate-500 tabular-nums">{score}</span>
    </div>
  );
}

export default function LMStep1Client({ data, onChange }: Props) {
  const { clients } = useAppState();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [previousLM, setPreviousLM] = useState<{ id: string; wizard_data: any; numero: string; statut: string } | null>(null);
  const [screeningStatus, setScreeningStatus] = useState<"ok" | "expired" | "missing" | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);

  // (9) Recently used clients (stored in sessionStorage)
  const recentClientRefs = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("lm_recent_clients");
      return raw ? JSON.parse(raw) as string[] : [];
    } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    if (!search || search.length < 2) {
      // (9) Show recent clients first, then the rest
      const recent = recentClientRefs
        .map((ref) => clients.find((c) => c.ref === ref))
        .filter(Boolean) as Client[];
      const rest = clients.filter((c) => !recentClientRefs.includes(c.ref));
      return [...recent, ...rest].slice(0, 20);
    }
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.raisonSociale.toLowerCase().includes(q) ||
        c.siren.includes(q) ||
        c.ref.toLowerCase().includes(q) ||
        c.forme.toLowerCase().includes(q)
    );
  }, [clients, search, recentClientRefs]);

  const selectedClient = useMemo(() => clients.find((c) => c.ref === data.client_id), [clients, data.client_id]);
  const vigilanceToastShown = useRef(false);

  // B) Check for previous signed LM + I) Screening check
  useEffect(() => {
    if (!data.client_id) {
      setPreviousLM(null);
      setScreeningStatus(null);
      vigilanceToastShown.current = false;
      return;
    }

    // (9) Track recently used clients
    try {
      const current = JSON.parse(sessionStorage.getItem("lm_recent_clients") || "[]") as string[];
      const updated = [data.client_id, ...current.filter((r) => r !== data.client_id)].slice(0, 5);
      sessionStorage.setItem("lm_recent_clients", JSON.stringify(updated));
    } catch {}

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
      .catch(() => {});

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

      // A) Vigilance renforcee banner (show once per client)
      if (selectedClient.scoreGlobal > 60 && !vigilanceToastShown.current) {
        vigilanceToastShown.current = true;
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
      type_mission: "", rcs: "", date_cloture: "", qualite_dirigeant: "Gerant",
    });
    setSearch("");
    setShowImportPreview(false);
  };

  // B) Import previous LM data
  const importPreviousLM = () => {
    if (!previousLM?.wizard_data) return;
    const wd = previousLM.wizard_data;
    onChange({
      type_mission: wd.type_mission || data.type_mission,
      missions_selected: wd.missions_selected || [],
      duree: wd.duree || data.duree,
      tacite_reconduction: wd.tacite_reconduction ?? true,
      preavis_mois: wd.preavis_mois || 3,
      honoraires_ht: wd.honoraires_ht || 0,
      frequence_facturation: wd.frequence_facturation || "MENSUEL",
      mode_paiement: wd.mode_paiement || "virement",
      taux_horaire_complementaire: wd.taux_horaire_complementaire || 0,
      associe_signataire: wd.associe_signataire || "",
      chef_mission: wd.chef_mission || "",
      clause_rgpd: wd.clause_rgpd ?? true,
    });
    setShowImportPreview(false);
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
              placeholder="Rechercher par nom, SIREN, forme juridique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputMode="search"
              autoComplete="off"
              autoFocus
              aria-label="Rechercher un client"
              className="pl-10 h-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 text-base focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* (16) Client count indicator */}
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span>{filtered.length} client{filtered.length > 1 ? "s" : ""}{search.length >= 2 ? " trouves" : ""}</span>
            {recentClientRefs.length > 0 && !search && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Recents en premier</span>
            )}
          </div>

          <div className="space-y-2 max-h-[50vh] sm:max-h-[360px] overflow-y-auto pr-1 -mx-1 px-1 overscroll-contain" role="listbox" aria-label="Liste des clients">
            {filtered.map((c) => {
              const isRecent = recentClientRefs.includes(c.ref);
              return (
                <button
                  key={c.ref}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectClient(c)}
                  className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border transition-all duration-150 text-left min-h-[56px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none active:bg-white/[0.07] active:scale-[0.99] ${
                    isRecent
                      ? "border-blue-500/15 bg-blue-500/[0.03] hover:bg-blue-500/[0.06] hover:border-blue-500/25"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]"
                  }`}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    c.forme === "ENTREPRISE INDIVIDUELLE" ? "bg-purple-500/15" : "bg-blue-500/15"
                  }`}>
                    {c.forme === "ENTREPRISE INDIVIDUELLE"
                      ? <User className="w-4 h-4 text-purple-400" />
                      : <Building2 className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{c.raisonSociale}</p>
                      {isRecent && <Clock className="w-3 h-3 text-blue-400/60 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.siren} · {c.forme}</p>
                  </div>
                  {/* (10) Risk score indicator */}
                  <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[10px] ${vigilanceColor(c.nivVigilance)}`}>
                      {c.nivVigilance}
                    </Badge>
                    <RiskIndicator score={c.scoreGlobal} />
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && search.length >= 2 && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Aucun client trouve pour cette recherche
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 border-dashed border-white/[0.08] text-slate-400 hover:text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/20 h-12 sm:h-11 text-sm focus:ring-2 focus:ring-blue-500/40"
            onClick={() => navigate("/nouveau-client")}
          >
            <Plus className="w-4 h-4" /> Creer un nouveau client
          </Button>
        </>
      ) : (
        <>
          {/* I) Screening banners — (14) enhanced with icons */}
          {screeningStatus === "missing" && (
            <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-red-300">Dossier LCB-FT manquant</p>
                <p className="text-xs text-red-400/70 mt-0.5 leading-relaxed">Ce client n'a pas de dossier LCB-FT. Completez le parcours client d'abord.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 focus:ring-2 focus:ring-red-500/40"
                  onClick={() => navigate(`/client/${data.client_id}`)}
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Voir la fiche client
                </Button>
              </div>
            </div>
          )}
          {screeningStatus === "expired" && (
            <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-300">Dossier LCB-FT perime</p>
                <p className="text-xs text-amber-400/70 mt-0.5 leading-relaxed">Le dossier LCB-FT de ce client date de plus d'un an. Mettez-le a jour avant de generer la lettre.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/40"
                  onClick={() => navigate(`/client/${data.client_id}`)}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Mettre a jour
                </Button>
              </div>
            </div>
          )}
          {screeningStatus === "ok" && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400/80">Dossier LCB-FT a jour</p>
            </div>
          )}

          {/* A) Vigilance renforcee */}
          {selectedClient && selectedClient.scoreGlobal > 60 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-orange-300">
                  Client a <strong>vigilance renforcee</strong> (score {selectedClient.scoreGlobal}/120) — envisagez un complement d'honoraires
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-orange-400 shrink-0" />
            </div>
          )}

          {/* (13) Selected client card — enhanced with quick info summary */}
          <div className="relative p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <button
              onClick={clearClient}
              aria-label="Changer de client"
              className="absolute top-2 right-2 w-9 h-9 sm:w-7 sm:h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.15] flex items-center justify-center transition-colors focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-emerald-300">{data.raison_sociale}</p>
                <p className="text-xs text-emerald-400/60 mt-0.5">{data.client_ref} · SIREN {data.siren} · {data.forme_juridique}</p>
              </div>
            </div>
            {selectedClient && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03]">
                  <User className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-slate-300 truncate">{data.dirigeant || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03]">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-slate-300 truncate">{data.ville || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03]">
                  <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-slate-300 truncate">APE {data.ape || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] col-span-2 sm:col-span-1">
                  <Badge variant="outline" className={`text-[10px] ${vigilanceColor(selectedClient.nivVigilance)}`}>
                    {selectedClient.nivVigilance}
                  </Badge>
                  <RiskIndicator score={selectedClient.scoreGlobal} />
                </div>
                {selectedClient.effectif && parseInt(selectedClient.effectif) > 0 && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03]">
                    <span className="text-slate-500">Effectif :</span>
                    <span className="text-slate-300 font-medium">{selectedClient.effectif}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* B) Import previous LM — (12) with preview toggle */}
          {previousLM && (
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 overflow-hidden">
              <button
                onClick={() => setShowImportPreview(!showImportPreview)}
                className="w-full flex items-center gap-3 p-3 hover:bg-blue-500/10 transition-colors text-left focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
              >
                <History className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-300">Reprendre les parametres de la LM precedente</p>
                  <p className="text-[10px] text-blue-400/60 mt-0.5">{previousLM.numero} — Signee</p>
                </div>
                <Info className="w-4 h-4 text-blue-400/50 shrink-0" />
              </button>
              {/* (12) Import preview panel */}
              {showImportPreview && previousLM.wizard_data && (
                <div className="px-3 pb-3 border-t border-blue-500/10">
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <span className="text-slate-500 block">Type</span>
                      <span className="text-blue-300 font-medium">{previousLM.wizard_data.type_mission || "—"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <span className="text-slate-500 block">Honoraires</span>
                      <span className="text-blue-300 font-medium">
                        {previousLM.wizard_data.honoraires_ht
                          ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(previousLM.wizard_data.honoraires_ht)
                          : "—"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <span className="text-slate-500 block">Duree</span>
                      <span className="text-blue-300 font-medium">{previousLM.wizard_data.duree || "1"} an{(previousLM.wizard_data.duree || "1") !== "1" ? "s" : ""}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <span className="text-slate-500 block">Missions</span>
                      <span className="text-blue-300 font-medium">
                        {(previousLM.wizard_data.missions_selected || []).filter((m: any) => m.selected).length} selectionnees
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={importPreviousLM}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 h-10 text-sm gap-1.5 focus:ring-2 focus:ring-blue-500/40"
                  >
                    <History className="w-3.5 h-3.5" /> Importer ces parametres
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* (11) Type mission selection — enhanced with detailed tooltips */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Type de mission</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {TYPES_MISSION.map(({ value, label, description, detail, icon: Icon }) => {
                const active = data.type_mission === value;
                return (
                  <button
                    key={value}
                    onClick={() => onChange({ type_mission: value })}
                    title={detail}
                    className={`relative flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-5 rounded-xl border-2 transition-all duration-200 text-center active:scale-[0.98] min-h-[80px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none ${
                      active
                        ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-colors ${
                      active ? "bg-blue-500/20" : "bg-white/[0.04]"
                    }`}>
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${active ? "text-blue-400" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className={`text-xs sm:text-sm font-semibold ${active ? "text-blue-300" : "text-slate-300"}`}>{label}</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 hidden sm:block">{description}</p>
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
        </>
      )}
    </div>
  );
}
