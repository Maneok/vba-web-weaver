import { useMemo } from "react";
import { refMissionsService, type RefMission } from "@/lib/referentielsService";
import { clearScoringCache } from "@/lib/riskEngine";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<RefMission>[] = [
  { key: "code", label: "Code", width: "100px" },
  {
    key: "type_mission",
    label: "Type",
    width: "160px",
    render: (item) => {
      const val = item.type_mission;
      if (!val) return <span className="text-slate-300 dark:text-slate-600">\u2014</span>;
      return <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-400 dark:text-slate-500 dark:text-slate-400 whitespace-nowrap">{val}</Badge>;
    },
  },
  { key: "libelle", label: "Libelle", minWidth: "120px" },
  { key: "score", label: "Risque", width: "100px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

// #23 - Add type_mission field to the form
const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true, placeholder: "Ex: AUDIT_PE" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Audit PE" },
  {
    key: "type_mission",
    label: "Type de mission",
    type: "select",
    options: [
      { value: "Mission d'assurance sur les comptes complets historiques", label: "Assurance comptes historiques" },
      { value: "Autres missions d'assurance", label: "Autres missions d'assurance" },
      { value: "Missions legales", label: "Missions legales" },
      { value: "Autres prestations", label: "Autres prestations" },
      { value: "Missions sans assurance", label: "Missions sans assurance" },
      { value: "Commissaire au compte", label: "Commissaire au compte" },
    ],
    placeholder: "Selectionner le type",
  },
  { key: "description", label: "Description", type: "textarea", placeholder: "Description de la mission...", maxLength: 500 },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
];

const defaultValues: Partial<RefMission> = { libelle: "", code: "", score: 0, type_mission: "" };

export default function RefMissionsTab() {
  const service = useMemo(() => refMissionsService, []);
  return (
    <RefTableBase<RefMission>
      title="Referentiel Missions"
      description="Gestion des types de missions et leur niveau de risque associe. Les modifications impactent le calcul de risque des clients."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
      storageKey="ref_missions"
      hasScore
      searchAllFields={["code", "libelle", "description", "type_mission"]}
      onDataChanged={clearScoringCache}
    />
  );
}
