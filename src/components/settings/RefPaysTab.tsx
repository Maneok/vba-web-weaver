import { useMemo } from "react";
import { refPaysService, type RefPays } from "@/lib/referentielsService";
import RefTableBase, { RiskBadge, PiloteBadge, type ColumnDef, type FieldDef, type FilterDef, type ExtraStatDef } from "./RefTableBase";
import { Badge } from "@/components/ui/badge";

/* ---------- Flag definitions ---------- */

const FLAG_DEFS = [
  { key: "gafi_noir", label: "GAFI noir", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { key: "gafi_gris", label: "GAFI gris", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { key: "offshore", label: "Offshore", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "sanctionne", label: "Sanctionne", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  { key: "non_cooperatif", label: "Non cooperatif", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
] as const;

function FlagsBadges({ item }: { item: Record<string, unknown> }) {
  const active = FLAG_DEFS.filter((f) => !!item[f.key]);
  if (active.length === 0) return <span className="text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((f) => (
        <Badge key={f.key} className={`text-[10px] px-1.5 py-0 ${f.color}`}>{f.label}</Badge>
      ))}
    </div>
  );
}

/* ---------- Columns ---------- */

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
    // Export flags as readable text
    exportFn: (item) => {
      const rec = item as unknown as Record<string, unknown>;
      return FLAG_DEFS.filter((f) => !!rec[f.key]).map((f) => f.label).join(", ") || "";
    },
  },
  { key: "score", label: "Risque", width: "120px", render: (item) => <RiskBadge score={item.score} /> },
  { key: "is_default", label: "Pilotes", width: "80px", render: (item) => <PiloteBadge value={item.is_default} /> },
];

/* ---------- Fields ---------- */

const fields: FieldDef[] = [
  { key: "code", label: "Code pays", required: true, placeholder: "Ex: FR" },
  { key: "libelle", label: "Libelle", required: true, placeholder: "Ex: France" },
  { key: "libelle_nationalite", label: "Libelle nationalite", placeholder: "Ex: Francaise" },
  { key: "description", label: "Description (motif GAFI/offshore/sanctions)", type: "textarea", placeholder: "Motif de classification...", maxLength: 500 },
  {
    key: "flags_group",
    label: "Flags",
    type: "multi-checkbox",
    options: FLAG_DEFS.map((f) => ({ value: f.key, label: f.label })),
  },
  { key: "score", label: "Score de risque (0-100)", type: "slider", min: 0, max: 100 },
];

/* ---------- Extra filters ---------- */

const extraFilters: FilterDef[] = [
  {
    key: "flag_type",
    label: "Flags",
    options: [
      { value: "all", label: "Tous flags" },
      ...FLAG_DEFS.map((f) => ({ value: f.key, label: f.label })),
    ],
    filterFn: (item, value) => !!item[value],
  },
];

/* ---------- Extra stats ---------- */

function computeExtraStats(items: RefPays[]): ExtraStatDef[] {
  const counts: Record<string, number> = {};
  for (const f of FLAG_DEFS) counts[f.key] = 0;
  for (const item of items) {
    const rec = item as unknown as Record<string, unknown>;
    for (const f of FLAG_DEFS) { if (rec[f.key]) counts[f.key]++; }
  }
  return FLAG_DEFS.map((f) => ({ label: f.label, count: counts[f.key], color: f.color }));
}

/* ---------- Helpers ---------- */

/** Reconstruct flags_group from individual boolean fields (for edit dialog) */
function reconstructFlagsGroup(rec: Record<string, unknown>): Record<string, unknown> {
  const parts = FLAG_DEFS.filter((f) => !!rec[f.key]).map((f) => f.key);
  return { ...rec, flags_group: parts.join(", ") };
}

/** Expand flags_group comma string into individual boolean fields (for save) */
function expandFlags(rec: Record<string, unknown>): Record<string, unknown> {
  const result = { ...rec };
  const flagsGroup = String(result.flags_group ?? "");
  const parts = flagsGroup.split(",").map((s) => s.trim()).filter(Boolean);
  for (const f of FLAG_DEFS) {
    result[f.key] = parts.includes(f.key);
  }
  delete result.flags_group;
  return result;
}

/* ---------- Default values ---------- */

const defaultValues: Partial<RefPays> = { code: "", libelle: "", score: 0 };

/* ---------- Component ---------- */

export default function RefPaysTab() {
  const service = useMemo(() => ({
    ...refPaysService,
    async create(item: Partial<RefPays>) {
      return refPaysService.create(expandFlags(item as Record<string, unknown>) as Partial<RefPays>);
    },
    async update(id: string, updates: Record<string, unknown>) {
      return refPaysService.update(id, expandFlags(updates));
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
      transformForEdit={reconstructFlagsGroup}
    />
  );
}
