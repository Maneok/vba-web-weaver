import { useMemo } from "react";
import { refActivitesService, type RefActivite } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefActivite>[] = [
  { key: "code", label: "Code" },
  { key: "libelle", label: "Libelle" },
  { key: "score", label: "Risque", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code APE/NAF", required: true, placeholder: "Ex: 6920Z" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Activites comptables" },
  { key: "score", label: "Score de risque (0-100)", type: "number", placeholder: "0" },
];

const defaultValues: Partial<RefActivite> = { code: "", libelle: "", score: 0 };

export default function RefActivitesTab() {
  const service = useMemo(() => refActivitesService, []);
  return (
    <RefTableBase<RefActivite>
      title="Referentiel Activites"
      description="Gestion des codes APE/NAF et leur niveau de risque associe."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
    />
  );
}
