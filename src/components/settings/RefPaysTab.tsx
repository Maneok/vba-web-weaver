import { useMemo } from "react";
import { refPaysService, type RefPays } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef, type FilterDef, type ExtraStatDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

function FlagsBadges({ item }: { item: Record<string, unknown> }) {
  const flags: { key: string; label: string; color: string }[] = [
    { key: "gafi_noir", label: "GAFI noir", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    { key: "gafi_gris", label: "GAFI gris", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { key: "offshore", label: "Offshore", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    { key: "sanctionne", label: "Sanctionne", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
    { key: "non_cooperatif", label: "Non cooperatif", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  ];
  const active = flags.filter((f) => !!item[f.key]);
  if (active.length === 0) return <span className="text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((f) => (
        <Badge key={f.key} className={`text-[10px] px-1.5 py-0 ${f.color}`}>{f.label}</Badge>
      ))}
    </div>
  );
}

const columns: ColumnDef<RefPays>[] = [
  { key: "code", label: "Code", width: "80px" },
  { key: "libelle", label: "Libelle" },
  { key: "libelle_nationalite", label: "Nationalite" },
  { key: "description", label: "Description" },
  {
    key: "flags",
    label: "Flags",
    sortable: false,
    render: (item) => <FlagsBadges item={item as unknown as Record<string, unknown>} />,
  },
  { key: "score", label: "Risque", width: "120px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

const fields: FieldDef[] = [
  { key: "code", label: "Code pays", required: true, placeholder: "Ex: FR" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: France" },
  { key: "libelle_nationalite", label: "Libelle nationalite", placeholder: "Ex: Francaise" },
  { key: "description", label: "Description (motif GAFI/offshore/sanctions)", type: "textarea", placeholder: "Motif de classification..." },
  {
    key: "flags_group",
    label: "Flags",
    type: "multi-checkbox",
    options: [
      { value: "gafi_noir", label: "GAFI noir" },
      { value: "gafi_gris", label: "GAFI gris" },
      { value: "offshore", label: "Offshore" },
      { value: "sanctionne", label: "Sanctionne" },
      { value: "non_cooperatif", label: "Non cooperatif" },
    ],
  },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
];

const extraFilters: FilterDef[] = [
  {
    key: "flag_type",
    label: "Flags",
    options: [
      { value: "all", label: "Tous flags" },
      { value: "gafi_noir", label: "GAFI noir" },
      { value: "gafi_gris", label: "GAFI gris" },
      { value: "offshore", label: "Offshore" },
      { value: "sanctionne", label: "Sanctionne" },
      { value: "non_cooperatif", label: "Non cooperatif" },
    ],
    filterFn: (item, value) => !!item[value],
  },
];

function computeExtraStats(items: RefPays[]): ExtraStatDef[] {
  let gafiNoir = 0, gafiGris = 0, offshore = 0, sanctionne = 0;
  for (const item of items) {
    const rec = item as unknown as Record<string, unknown>;
    if (rec.gafi_noir) gafiNoir++;
    if (rec.gafi_gris) gafiGris++;
    if (rec.offshore) offshore++;
    if (rec.sanctionne) sanctionne++;
  }
  return [
    { label: "GAFI noir", count: gafiNoir, color: "bg-red-500/20 text-red-400 border-red-500/30" },
    { label: "GAFI gris", count: gafiGris, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { label: "Offshore", count: offshore, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    { label: "Sanctionne", count: sanctionne, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  ];
}

const defaultValues: Partial<RefPays> = { code: "", libelle: "", score: 0 };

export default function RefPaysTab() {
  const service = useMemo(() => ({
    ...refPaysService,
    // Override create to handle flags_group → individual boolean fields
    async create(item: Partial<RefPays>) {
      const cleaned = expandFlags(item as Record<string, unknown>);
      return refPaysService.create(cleaned as Partial<RefPays>);
    },
    async update(id: string, updates: Record<string, unknown>) {
      const cleaned = expandFlags(updates);
      return refPaysService.update(id, cleaned);
    },
  }), []);

  return (
    <RefTableBase<RefPays>
      title="Referentiel Pays"
      description="Gestion des pays et leur niveau de risque pour l'evaluation LCB-FT."
      service={service}
      columns={columns}
      fields={fields}
      defaultValues={defaultValues}
      storageKey="ref_pays"
      hasScore
      extraFilters={extraFilters}
      extraStats={computeExtraStats}
      searchAllFields={["code", "libelle", "libelle_nationalite", "description"]}
    />
  );
}

/** Expand flags_group comma string into individual boolean fields */
function expandFlags(rec: Record<string, unknown>): Record<string, unknown> {
  const result = { ...rec };
  const flagsGroup = String(result.flags_group ?? "");
  const parts = flagsGroup.split(",").map((s) => s.trim()).filter(Boolean);
  result.gafi_noir = parts.includes("gafi_noir");
  result.gafi_gris = parts.includes("gafi_gris");
  result.offshore = parts.includes("offshore");
  result.sanctionne = parts.includes("sanctionne");
  result.non_cooperatif = parts.includes("non_cooperatif");
  delete result.flags_group;
  return result;
}
