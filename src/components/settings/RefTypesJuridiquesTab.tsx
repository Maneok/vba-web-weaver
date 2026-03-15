import { useMemo } from "react";
import { refTypesJuridiquesService, type RefTypeJuridique } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";

const columns: ColumnDef<RefTypeJuridique>[] = [
  { key: "code", label: "Code" },
  { key: "libelle", label: "Libelle" },
  { key: "score", label: "Risque", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true, placeholder: "Ex: SARL" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: Societe a responsabilite limitee" },
  { key: "score", label: "Score de risque (0-100)", type: "number", placeholder: "0" },
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
    />
  );
}
