import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Building2, User, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMWizardStep1Client({ data, onChange }: Props) {
  const { clients } = useAppState();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return clients.slice(0, 20);
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

  const vigilanceColor = (niv: string) => {
    if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Selectionner le client</h2>
          <p className="text-sm text-slate-500">Recherchez un client existant ou creez-en un nouveau</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/[0.06] text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-200"
          onClick={() => navigate("/nouveau-client")}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Rechercher par nom, SIREN ou reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          autoComplete="off"
          className="pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
        />
      </div>

      {/* Client selected banner */}
      {data.client_ref && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-300">{data.raison_sociale}</p>
            <p className="text-xs text-emerald-400/70">{data.client_ref} — SIREN {data.siren}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400 hover:text-red-400"
            onClick={() => onChange({ client_id: "", client_ref: "", raison_sociale: "", siren: "" })}
          >
            Changer
          </Button>
        </div>
      )}

      {/* Client list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtered.map((c) => (
          <button
            key={c.ref}
            onClick={() => selectClient(c)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left ${
              data.client_ref === c.ref
                ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              c.forme === "ENTREPRISE INDIVIDUELLE" ? "bg-purple-500/20" : "bg-blue-500/20"
            }`}>
              {c.forme === "ENTREPRISE INDIVIDUELLE"
                ? <User className="w-4 h-4 text-purple-400" />
                : <Building2 className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{c.raisonSociale}</p>
              <p className="text-xs text-slate-500">{c.ref} — {c.siren} — {c.forme}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${vigilanceColor(c.nivVigilance)}`}>
              {c.nivVigilance}
            </Badge>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            Aucun client trouve. <button onClick={() => navigate("/nouveau-client")} className="text-blue-400 hover:underline">Creer un client</button>
          </div>
        )}
      </div>
    </div>
  );
}
