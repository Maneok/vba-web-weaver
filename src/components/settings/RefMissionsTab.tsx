import { useMemo } from "react";
import { refMissionsService, type RefMission } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefMission>[] = [
  { key: "libelle", label: "Libelle" },
  { key: "code", label: "Type" },
  { key: "score", label: "Niveau de risque", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Audit annuel" },
  { key: "code", label: "Type", required: true, placeholder: "Ex: AUDIT" },
  { key: "score", label: "Score de risque (0-100)", type: "number", placeholder: "0" },
];

const defaultValues: Partial<RefMission> = { libelle: "", code: "", score: 0 };

export default function RefMissionsTab() {
  const service = useMemo(() => refMissionsService, []);
  return (
    <RefTableBase<RefMission>
      title="Referentiel Missions"
      description="Gestion des types de missions et leur niveau de risque associe."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
    />
  );
}
