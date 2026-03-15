import { useMemo } from "react";
import { refQuestionsService, type RefQuestion } from "@/lib/referentielsService";
import RefTableBase, { PiloteBadge, type ColumnDef, type FieldDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<RefQuestion>[] = [
  { key: "libelle", label: "Libelle" },
  {
    key: "categorie",
    label: "Categories",
    render: (item) => (
      <div className="flex flex-wrap gap-1">
        {(item.categorie || "").split(",").filter(Boolean).map((cat) => (
          <Badge key={cat.trim()} variant="outline" className="text-xs border-blue-500/30 text-blue-400">
            {cat.trim()}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "ponderation",
    label: "Reponse risquee",
    render: (item) => <span className="text-slate-300">{item.ponderation > 0 ? "Oui" : "Non"}</span>,
  },
  { key: "is_default", label: "Pilotes", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "libelle", label: "Libelle de la question", required: true, placeholder: "Ex: Le client est-il une PPE ?" },
  { key: "code", label: "Code", required: true, placeholder: "Ex: Q01" },
  { key: "categorie", label: "Categories (separees par des virgules)", placeholder: "Ex: KYC, LCB-FT" },
  { key: "ponderation", label: "Ponderation (points de risque)", type: "number", placeholder: "0" },
];

const defaultValues: Partial<RefQuestion> = { libelle: "", code: "", categorie: "", ponderation: 0 };

export default function RefQuestionsTab() {
  const service = useMemo(() => refQuestionsService, []);
  return (
    <RefTableBase<RefQuestion>
      title="Referentiel Questions"
      description="Gestion des questions de diagnostic et leur ponderation de risque."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
    />
  );
}
