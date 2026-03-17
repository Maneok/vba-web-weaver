import { useMemo } from "react";
import { refQuestionsService, type RefQuestion } from "@/lib/referentielsService";
import RefTableBase, { PiloteBadge, type ColumnDef, type FieldDef, type FilterDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

const KNOWN_CATEGORIES = ["KYC", "LCB-FT", "PPE", "Sanctions", "Gel d'avoirs", "Atypique", "Structure", "Activite", "Pays"];

const columns: ColumnDef<RefQuestion>[] = [
  { key: "code", label: "Code", width: "80px", minWidth: "60px" },
  { key: "libelle", label: "Libelle", minWidth: "200px" },
  { key: "description", label: "Description", minWidth: "120px" },
  {
    key: "categorie",
    label: "Categories",
    minWidth: "140px",
    render: (item) => {
      const cats = (item.categorie || "").split(",").map((c) => c.trim()).filter(Boolean);
      if (cats.length === 0) return <span className="text-slate-600">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {cats.map((cat) => (
            <Badge key={cat} variant="outline" className="text-xs border-blue-500/30 text-blue-400">
              {cat}
            </Badge>
          ))}
        </div>
      );
    },
    exportFn: (item) => item.categorie || "",
  },
  {
    key: "ponderation",
    label: "Reponse risquee",
    width: "130px",
    render: (item) => (
      <Badge variant="outline" className={item.ponderation > 0
        ? "border-amber-500/30 text-amber-400 text-xs"
        : "border-white/10 text-slate-500 text-xs"
      }>
        {item.ponderation > 0 ? `Oui (+${item.ponderation})` : "Non"}
      </Badge>
    ),
  },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true, placeholder: "Ex: Q01" },
  { key: "libelle", label: "Libelle de la question", required: true, placeholder: "Ex: Le client est-il une PPE ?" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Contexte ou explication de la question...", maxLength: 500 },
  {
    key: "categorie",
    label: "Categories",
    type: "multi-checkbox",
    options: KNOWN_CATEGORIES.map((c) => ({ value: c, label: c })),
  },
  { key: "ponderation", label: "Ponderation (points de risque)", type: "number", placeholder: "0", min: 0, max: 100 },
];

const extraFilters: FilterDef[] = [
  {
    key: "categorie",
    label: "Categorie",
    options: [
      { value: "all", label: "Toutes categories" },
      ...KNOWN_CATEGORIES.map((c) => ({ value: c, label: c })),
    ],
    filterFn: (item, value) => {
      const cats = String(item.categorie || "").toLowerCase();
      return cats.includes(value.toLowerCase());
    },
  },
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
      storageKey="ref_questions"
      hasScore={false}
      extraFilters={extraFilters}
      searchAllFields={["code", "libelle", "description", "categorie"]}
    />
  );
}
