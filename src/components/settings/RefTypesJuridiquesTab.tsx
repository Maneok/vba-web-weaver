import { useMemo } from "react";
import { refTypesJuridiquesService, type RefTypeJuridique } from "@/lib/referentielsService";
import { clearScoringCache } from "@/lib/riskEngine";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<RefTypeJuridique>[] = [
  { key: "code", label: "Code", width: "80px", minWidth: "60px" },
  { key: "libelle", label: "Libelle", minWidth: "150px" },
  {
    key: "type_client",
    label: "Type client",
    width: "160px",
    render: (item) => {
      const val = (item as unknown as Record<string, unknown>).type_client as string;
      if (!val) return <span className="text-slate-300 dark:text-slate-600">—</span>;
      return (
        <Badge variant="outline" className={val === "Personne morale"
          ? "border-cyan-500/30 text-cyan-400 text-xs"
          : "border-pink-500/30 text-pink-400 text-xs"
        }>
          {val}
        </Badge>
      );
    },
    exportFn: (item) => (item as unknown as Record<string, unknown>).type_client as string || "",
  },
  { key: "score", label: "Risque", width: "120px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true, placeholder: "Ex: SARL" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Societe a responsabilite limitee" },
  {
    key: "type_client",
    label: "Type client",
    type: "select",
    options: [
      { value: "Personne morale", label: "Personne morale" },
      { value: "Personne physique", label: "Personne physique" },
    ],
    placeholder: "Selectionner le type",
  },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
];

const defaultValues: Partial<RefTypeJuridique> = { code: "", libelle: "", score: 0 };

export default function RefTypesJuridiquesTab() {
  const service = useMemo(() => refTypesJuridiquesService, []);
  return (
    <RefTableBase<RefTypeJuridique>
      title="Referentiel Types Juridiques"
      description="Gestion des formes juridiques et leur niveau de risque associe."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
      storageKey="ref_types_juridiques"
      hasScore
      searchAllFields={["code", "libelle", "type_client"]}
      onDataChanged={clearScoringCache}
    />
  );
}
