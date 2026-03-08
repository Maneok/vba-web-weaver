import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Variable, Search } from "lucide-react";

interface VariableInserterProps {
  onInsert: (variable: string) => void;
}

const VARIABLE_GROUPS: Record<string, { label: string; variables: string[] }> = {
  client: {
    label: "Client",
    variables: [
      "raison_sociale", "siren", "forme_juridique", "dirigeant",
      "adresse", "cp", "ville", "capital", "ape", "domaine",
      "effectif", "tel", "email",
    ],
  },
  mission: {
    label: "Mission",
    variables: [
      "mission", "honoraires", "frequence",
      "date_debut_mission", "date_fin_mission",
    ],
  },
  lcbft: {
    label: "LCB-FT",
    variables: [
      "niv_vigilance", "score_global", "beneficiaires_effectifs",
      "ppe", "pays_risque",
    ],
  },
  paiement: {
    label: "Paiement",
    variables: ["iban", "bic"],
  },
  cabinet: {
    label: "Cabinet",
    variables: [
      "cabinet_nom", "cabinet_adresse", "cabinet_siret", "cabinet_oec",
    ],
  },
  date: {
    label: "Date",
    variables: ["date_jour", "annee", "date_lettre"],
  },
};

export default function VariableInserter({ onInsert }: VariableInserterProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredGroups = Object.entries(VARIABLE_GROUPS)
    .map(([key, group]) => ({
      key,
      label: group.label,
      variables: group.variables.filter((v) =>
        v.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.variables.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Variable className="h-4 w-4" />
          Variables
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une variable..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {filteredGroups.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.variables.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer hover:bg-blue-500/20 hover:text-blue-300 transition-colors text-xs"
                    onClick={() => {
                      onInsert(`{{${v}}}`);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune variable trouvee
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
