import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { recommendClientType, getClientTypeConfig } from "@/lib/lettreMissionTypes";
import { getModeles, getModelesForClientType } from "@/lib/lettreMissionModeles";
import type { LMModele } from "@/lib/lettreMissionModeles";
import { generateSmartDefaults, getSmartMissionSelections, detectRegimeBenefices } from "@/lib/lmSmartDefaults";
import { getMissionsForClientType } from "@/lib/lmClientMissions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Building2, User, X, Plus, ChevronDown, Layers,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const FORME_ICONS: Record<string, string> = {
  SAS: "SAS", SASU: "SASU", SARL: "SARL", EURL: "EURL", SCI: "SCI",
  SA: "SA", SNC: "SNC", ASSOCIATION: "ASSO", ASSO: "ASSO",
};

function formatSiren(siren: string): string {
  if (!siren) return "";
  const clean = siren.replace(/\s/g, "");
  return clean.replace(/(\d{3})(?=\d)/g, "$1 ");
}

export default function LMStepClientModele({ data, onChange }: Props) {
  const { clients } = useAppState();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [showModeleDropdown, setShowModeleDropdown] = useState(false);
  const [loadingModeles, setLoadingModeles] = useState(false);

  // Load modeles from cabinet
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    let cancelled = false;
    setLoadingModeles(true);
    getModeles(profile.cabinet_id)
      .then((m) => { if (!cancelled) setModeles(m); })
      .catch((e) => logger.warn("LM", "Failed to load modeles", e))
      .finally(() => { if (!cancelled) setLoadingModeles(false); });
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

  const selectedClient = useMemo(
    () => clients.find((c) => c.ref === data.client_id),
    [clients, data.client_id]
  );

  // Auto-matched modele
  const selectedModele = useMemo(
    () => modeles.find((m) => m.id === data.modele_id),
    [modeles, data.modele_id]
  );

  const availableModeles = useMemo(
    () => data.client_type_id ? getModelesForClientType(modeles, data.client_type_id) : modeles,
    [modeles, data.client_type_id]
  );

  const selectClient = (c: Client) => {
    const { recommended } = recommendClientType(c.forme);
    const ctConfig = getClientTypeConfig(recommended);

    // Auto-select modele
    const matchedModeles = getModelesForClientType(modeles, recommended);
    const bestModele = matchedModeles.find((m) => m.is_default) || matchedModeles[0];

    // Generate smart defaults
    const smartDefaults = generateSmartDefaults(recommended, c);

    // Generate smart missions
    const missions = getMissionsForClientType(recommended);
    const smartMissions = getSmartMissionSelections(recommended, c, missions);

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
        const map: Record<string, string> = {
          SARL: "Gerant", EURL: "Gerant", SCI: "Gerant",
          SAS: "President", SASU: "President", SA: "Directeur general",
          SNC: "Gerant", ASSOCIATION: "President", ASSO: "President",
        };
        return map[c.forme] || "Dirigeant";
      })(),
      adresse: c.adresse,
      cp: c.cp,
      ville: c.ville,
      capital: String(c.capital || ""),
      ape: c.ape,
      email: c.mail,
      telephone: c.tel,
      iban: c.iban,
      bic: c.bic,
      type_mission: ctConfig?.defaultModeComptable ||
        (c.mission?.includes("REVISION") || c.mission?.includes("SURVEILLANCE") ? "SURVEILLANCE" : "TENUE"),
      regime_benefices: detectRegimeBenefices(c.ape) || undefined,
      modele_id: bestModele?.id || "",
      missions_selected: smartMissions,
      ...smartDefaults,
    });
  };

  const clearClient = () => {
    onChange({
      client_id: "", client_ref: "", raison_sociale: "", siren: "",
      forme_juridique: "", dirigeant: "", adresse: "", cp: "", ville: "",
      capital: "", ape: "", email: "", telephone: "", iban: "", bic: "",
      qualite_dirigeant: "", type_mission: "", mission_type_id: "", client_type_id: "",
      missions_selected: [], honoraires_detail: {}, modele_id: "",
    });
    setSearch("");
  };

  const selectModele = (m: LMModele) => {
    onChange({ modele_id: m.id });
    setShowModeleDropdown(false);
  };

  const ctConfig = data.client_type_id ? getClientTypeConfig(data.client_type_id) : null;
  const formeAbbr = FORME_ICONS[data.forme_juridique] || data.forme_juridique?.slice(0, 4);

  // Count sections in modele
  const sectionCount = selectedModele?.sections?.length || 0;
  const cgvCount = selectedModele?.cgv_content ? selectedModele.cgv_content.split(/\n(?=Article\s)/i).length : 0;

  return (
    <div className="space-y-6">
      {!data.client_id ? (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Rechercher par nom, SIREN ou reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputMode="search"
              autoComplete="off"
              autoFocus
              className="pl-11 h-12 rounded-2xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06] text-base"
            />
          </div>

          {/* Client list */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mx-1 px-1">
            {filtered.map((c) => (
              <button
                key={c.ref}
                onClick={() => selectClient(c)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] hover:border-blue-200 dark:hover:border-blue-500/20 hover:bg-blue-50/30 dark:hover:bg-blue-500/[0.04] transition-all duration-200 text-left group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  c.forme === "ENTREPRISE INDIVIDUELLE" ? "bg-purple-50 dark:bg-purple-500/10" : "bg-blue-50 dark:bg-blue-500/10"
                }`}>
                  {c.forme === "ENTREPRISE INDIVIDUELLE"
                    ? <User className="w-4 h-4 text-purple-400" />
                    : <Building2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.raisonSociale}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatSiren(c.siren)} · {c.forme}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && search.length >= 2 && (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                Aucun client trouve pour "{search}"
              </div>
            )}
          </div>

          {/* Create new */}
          <button
            onClick={() => navigate("/nouveau-client")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] text-slate-400 hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 hover:border-blue-200 dark:hover:border-blue-500/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> Creer un nouveau client
          </button>
        </>
      ) : (
        <>
          {/* ── Selected client card ── */}
          <div className="relative p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button
              onClick={clearClient}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] flex items-center justify-center transition-all duration-200"
            >
              <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>

            <div className="flex items-start gap-4">
              {/* Forme juridique badge */}
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{formeAbbr}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.raison_sociale}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{formatSiren(data.siren)}</span>
                  <Badge variant="outline" className="text-[10px] border-gray-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                    {data.forme_juridique}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {data.dirigeant && (
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-xs">Dirigeant</span>
                  <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5">{data.dirigeant}</p>
                </div>
              )}
              {data.ville && (
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-xs">Adresse</span>
                  <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5">{data.cp} {data.ville}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Auto-selected modele card ── */}
          <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  {selectedModele ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedModele.nom}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {sectionCount} section{sectionCount > 1 ? "s" : ""}
                        {cgvCount > 0 && ` · ${cgvCount} article${cgvCount > 1 ? "s" : ""} CGV`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Modele par defaut GRIMY</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {ctConfig ? ctConfig.label : "Standard"} · Lettre de mission automatique
                      </p>
                    </>
                  )}
                </div>
              </div>

              {availableModeles.length > 1 && (
                <button
                  onClick={() => setShowModeleDropdown(!showModeleDropdown)}
                  className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors flex items-center gap-1 shrink-0"
                >
                  Modifier
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showModeleDropdown ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {/* Modele dropdown */}
            <div className={`overflow-hidden transition-all duration-200 ${showModeleDropdown ? "max-h-[300px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {availableModeles.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectModele(m)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                      m.id === data.modele_id
                        ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/[0.06]"
                        : "border-gray-100 dark:border-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.1] bg-white dark:bg-white/[0.02]"
                    }`}
                  >
                    <Layers className={`w-4 h-4 shrink-0 ${m.id === data.modele_id ? "text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${m.id === data.modele_id ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                        {m.nom}
                      </p>
                      {m.description && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{m.description}</p>
                      )}
                    </div>
                    {m.is_default && (
                      <Badge variant="outline" className="text-[9px] shrink-0 border-indigo-200 dark:border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
                        Defaut
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
