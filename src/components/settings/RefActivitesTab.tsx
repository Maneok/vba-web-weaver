import { useMemo } from "react";
import { refActivitesService, type RefActivite } from "@/lib/referentielsService";
import { clearScoringCache } from "@/lib/riskEngine";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefActivite>[] = [
  { key: "code", label: "Code", width: "80px", minWidth: "60px" },
  { key: "libelle", label: "Libelle", minWidth: "150px" },
  { key: "description", label: "Description", minWidth: "120px" },
  { key: "score", label: "Risque", width: "120px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code APE/NAF", required: true, placeholder: "Ex: 6920Z" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Activites comptables" },
  { key: "description", label: "Description (categorie risque)", type: "textarea", placeholder: "Description de la categorie de risque...", maxLength: 500 },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
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
      storageKey="ref_activites"
      hasScore
      searchAllFields={["code", "libelle", "description"]}
      onDataChanged={clearScoringCache}
    />
  );
}
