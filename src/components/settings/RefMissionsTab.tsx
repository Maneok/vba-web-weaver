import { useMemo } from "react";
import { refMissionsService, type RefMission } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefMission>[] = [
  { key: "code", label: "Type", width: "100px" },
  { key: "libelle", label: "Libelle" },
  { key: "description", label: "Description" },
  { key: "score", label: "Niveau de risque", width: "140px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Type", required: true, placeholder: "Ex: AUDIT" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Audit annuel" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Description de la mission..." },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
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
      storageKey="ref_missions"
      hasScore
      searchAllFields={["code", "libelle", "description"]}
    />
  );
}
