import { useMemo } from "react";
import { refPaysService, type RefPays } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefPays>[] = [
  { key: "code", label: "Code" },
  { key: "libelle", label: "Libelle" },
  { key: "score", label: "Risque", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code pays", required: true, placeholder: "Ex: FR" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: France" },
  { key: "score", label: "Score de risque (0-100)", type: "number", placeholder: "0" },
];

const defaultValues: Partial<RefPays> = { code: "", libelle: "", score: 0 };

export default function RefPaysTab() {
  const service = useMemo(() => refPaysService, []);
  return (
    <RefTableBase<RefPays>
      title="Referentiel Pays"
      description="Gestion des pays et leur niveau de risque pour l'evaluation LCB-FT."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
    />
  );
}
