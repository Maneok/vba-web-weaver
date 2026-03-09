import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Building2, User, CheckCircle2, BookOpen, Eye, CheckSquare, X,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const TYPES_MISSION = [
  {
    value: "TENUE",
    label: "Tenue",
    description: "Tenue de comptabilite complete",
    icon: BookOpen,
  },
  {
    value: "SURVEILLANCE",
    label: "Surveillance",
    description: "Surveillance et conseil",
    icon: Eye,
  },
  {
    value: "REVISION",
    label: "Revision",
    description: "Revision des comptes",
    icon: CheckSquare,
  },
];

function vigilanceColor(niv: string) {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export default function LMStep1Client({ data, onChange }: Props) {
  const { clients } = useAppState();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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

  const selectedClient = clients.find((c) => c.ref === data.client_id);

  return (
    <div className="space-y-8">
      {/* ── Client selection ── */}
      {!data.client_id ? (
        <>
          {/* Search */}
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

          {/* Client list */}
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
                    ? <User className="w-4.5 h-4.5 text-purple-400" />
                    : <Building2 className="w-4.5 h-4.5 text-blue-400" />}
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

          {/* Create new */}
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

          {/* ── Type mission selection ── */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Type de mission</p>
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
        </>
      )}
    </div>
  );
}
