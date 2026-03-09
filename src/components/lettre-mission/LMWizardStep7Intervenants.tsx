import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Users } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMWizardStep7Intervenants({ data, onChange }: Props) {
  const { collaborateurs } = useAppState();

  const associes = useMemo(
    () => collaborateurs.filter((c) => c.fonction === "ASSOCIE SIGNATAIRE" || c.fonction === "SUPERVISEUR"),
    [collaborateurs]
  );

  const allCollabs = useMemo(
    () => collaborateurs.filter((c) => c.fonction !== "ASSOCIE SIGNATAIRE"),
    [collaborateurs]
  );

  const referentLcb = useMemo(
    () => collaborateurs.find((c) => c.referentLcb),
    [collaborateurs]
  );

  const toggleCollaborateur = (nom: string) => {
    const current = data.collaborateurs || [];
    if (current.includes(nom)) {
      onChange({ collaborateurs: current.filter((c) => c !== nom) });
    } else {
      onChange({ collaborateurs: [...current, nom] });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Equipe intervenante</h2>
        <p className="text-sm text-slate-500">Designez les intervenants sur cette mission</p>
      </div>

      {/* Associé signataire */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Associe signataire</Label>
        <Select value={data.associe_signataire} onValueChange={(v) => onChange({ associe_signataire: v })}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-full max-w-md">
            <SelectValue placeholder="Selectionnez l'associe" />
          </SelectTrigger>
          <SelectContent>
            {associes.length > 0
              ? associes.map((c) => (
                  <SelectItem key={c.nom} value={c.nom}>
                    {c.nom} — {c.fonction}
                  </SelectItem>
                ))
              : [
                  <SelectItem key="DIDIER" value="DIDIER">DIDIER</SelectItem>,
                  <SelectItem key="PASCAL" value="PASCAL">PASCAL</SelectItem>,
                  <SelectItem key="KEVIN" value="KEVIN">KEVIN</SelectItem>,
                ]}
          </SelectContent>
        </Select>
      </div>

      {/* Chef de mission */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Chef de mission</Label>
        <Select value={data.chef_mission} onValueChange={(v) => onChange({ chef_mission: v })}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-full max-w-md">
            <SelectValue placeholder="Selectionnez le chef de mission" />
          </SelectTrigger>
          <SelectContent>
            {collaborateurs.length > 0
              ? collaborateurs.map((c) => (
                  <SelectItem key={c.nom} value={c.nom}>
                    {c.nom} — {c.fonction}
                  </SelectItem>
                ))
              : [
                  <SelectItem key="SAMUEL" value="SAMUEL">SAMUEL</SelectItem>,
                  <SelectItem key="BRAYAN" value="BRAYAN">BRAYAN</SelectItem>,
                ]}
          </SelectContent>
        </Select>
      </div>

      {/* Collaborateurs multi-select */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <Label className="text-slate-300 text-sm font-medium">Collaborateurs affectes</Label>
          {data.collaborateurs.length > 0 && (
            <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
              {data.collaborateurs.length}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          {(allCollabs.length > 0 ? allCollabs : [
            { nom: "MAGALIE", fonction: "COLLABORATEUR" },
            { nom: "JULIEN", fonction: "COLLABORATEUR" },
            { nom: "FANNY", fonction: "COLLABORATEUR" },
            { nom: "SERGE", fonction: "COLLABORATEUR" },
            { nom: "JOSE", fonction: "COLLABORATEUR" },
          ]).map((c) => (
            <label
              key={c.nom}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
            >
              <Checkbox
                checked={data.collaborateurs.includes(c.nom)}
                onCheckedChange={() => toggleCollaborateur(c.nom)}
              />
              <div>
                <span className="text-sm text-slate-300">{c.nom}</span>
                <span className="text-xs text-slate-500 ml-2">{c.fonction}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Référent LCB */}
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <Label className="text-amber-300 text-sm font-medium">Referent LCB-FT</Label>
        </div>
        <p className="text-sm text-slate-300">
          {referentLcb ? referentLcb.nom : data.referent_lcb || "Non defini"}
        </p>
        {!referentLcb && (
          <Input
            value={data.referent_lcb}
            onChange={(e) => onChange({ referent_lcb: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white mt-2 max-w-md"
            placeholder="Nom du referent LCB-FT"
          />
        )}
      </div>

      {/* Numéro OEC */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Numero d'inscription a l'Ordre (OEC)</Label>
        <Input
          value={data.numero_oec}
          onChange={(e) => onChange({ numero_oec: e.target.value })}
          className="bg-white/[0.04] border-white/[0.08] text-white max-w-md"
          placeholder="Ex: 2-12345"
        />
      </div>
    </div>
  );
}
