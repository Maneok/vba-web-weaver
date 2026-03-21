import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LETTRE_MISSION_TEMPLATE } from "@/lib/lettreMissionContent";

interface RepartitionRow {
  id: string;
  label: string;
  cabinet: boolean;
  client: boolean;
  periodicite: string;
}

interface AnnexesPreviewProps {
  repartition?: RepartitionRow[];
  onRepartitionChange?: (rows: RepartitionRow[]) => void;
}

const PERIODICITE_COLORS: Record<string, string> = {
  Mensuel: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Trimestriel: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Semestriel: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Annuel: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  NA: "bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400",
};

export default function AnnexesPreview({ repartition, onRepartitionChange }: AnnexesPreviewProps) {
  const tpl = LETTRE_MISSION_TEMPLATE;

  const [rows, setRows] = useState<RepartitionRow[]>(
    repartition ??
    (tpl.repartitionTravaux?.lignes ?? []).map((l) => ({
      id: l.id,
      label: l.label,
      cabinet: l.defautCabinet,
      client: l.defautClient,
      periodicite: l.periodicite,
    }))
  );

  const toggleRow = (id: string, col: "cabinet" | "client") => {
    const updated = rows.map((r) =>
      r.id === id ? { ...r, [col]: !r[col] } : r
    );
    setRows(updated);
    onRepartitionChange?.(updated);
  };

  const cgvSections = tpl.conditionsGenerales?.sections ?? [];

  return (
    <Tabs defaultValue="repartition">
      <TabsList className="flex flex-wrap h-auto gap-1 w-fit">
        <TabsTrigger value="repartition" className="text-xs">
          Répartition travaux
          <span className="ml-1.5 text-[10px] opacity-60">({rows.length})</span>
        </TabsTrigger>
        <TabsTrigger value="travail_dissimule" className="text-xs">Travail dissimulé</TabsTrigger>
        <TabsTrigger value="sepa" className="text-xs">SEPA</TabsTrigger>
        <TabsTrigger value="liasse" className="text-xs">Liasse fiscale</TabsTrigger>
        <TabsTrigger value="cgv" className="text-xs">
          CGV
          <span className="ml-1.5 text-[10px] opacity-60">({cgvSections.length} art.)</span>
        </TabsTrigger>
      </TabsList>

      {/* Répartition travaux - editable */}
      <TabsContent value="repartition" className="mt-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground">Répartition des travaux</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-foreground w-24">Cabinet</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-foreground w-24">Client</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-foreground w-28">Périodicité</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                    idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-xs text-foreground">{row.label}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleRow(row.id, "cabinet")}
                      className="inline-flex"
                    >
                      {row.cabinet ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px] px-2 py-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900/60">
                          Cabinet
                        </Badge>
                      ) : (
                        <span className="inline-block w-16 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleRow(row.id, "client")}
                      className="inline-flex"
                    >
                      {row.client ? (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-[10px] px-2 py-0.5 hover:bg-blue-200 dark:hover:bg-blue-900/60">
                          Client
                        </Badge>
                      ) : (
                        <span className="inline-block w-16 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${PERIODICITE_COLORS[row.periodicite] ?? PERIODICITE_COLORS.NA}`}>
                      {row.periodicite === "NA" ? "—" : row.periodicite}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* Attestation travail dissimulé */}
      <TabsContent value="travail_dissimule" className="mt-4">
        <div className="rounded-lg border border-border bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.attestationTravailDissimule.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {tpl.attestationTravailDissimule.texte}
          </div>
        </div>
      </TabsContent>

      {/* Mandat SEPA */}
      <TabsContent value="sepa" className="mt-4">
        <div className="rounded-lg border border-border bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.mandatSepa.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground mb-4">
            {tpl.mandatSepa.texteAutorisation}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Créancier</p>
            <div className="rounded border border-border p-3 space-y-1">
              {tpl.mandatSepa.champCreancier.map((c) => (
                <div key={c.label} className="flex text-xs">
                  <span className="text-muted-foreground w-48">{c.label} :</span>
                  <span className="font-mono text-blue-500 dark:text-blue-300">{`{{${c.variable}}}`}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Débiteur</p>
            <div className="rounded border border-border p-3 space-y-1">
              {tpl.mandatSepa.champDebiteur.map((c) => (
                <div key={c.label} className="flex text-xs">
                  <span className="text-muted-foreground w-48">{c.label} :</span>
                  <span className="font-mono text-blue-500 dark:text-blue-300">{`{{${c.variable}}}`}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Type de prélèvement : {tpl.mandatSepa.typePrelevement}
            </div>
            <div className="text-xs text-muted-foreground">
              Référence unique de mandat : <span className="font-mono text-blue-500 dark:text-blue-300">{tpl.mandatSepa.rum}</span>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Autorisation liasse fiscale */}
      <TabsContent value="liasse" className="mt-4">
        <div className="rounded-lg border border-border bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.autorisationLiasse.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {tpl.autorisationLiasse.texte}
          </div>
        </div>
      </TabsContent>

      {/* Conditions générales */}
      <TabsContent value="cgv" className="mt-4">
        <div className="rounded-lg border border-border bg-card/60 p-6 space-y-4">
          <h3 className="text-sm font-bold">{tpl.conditionsGenerales.titre}</h3>
          {cgvSections.map((section) => (
            <div key={section.numero} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
              <h4 className="text-xs font-bold mb-2 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                  {section.numero}
                </span>
                <span className="text-foreground">{section.titre}</span>
              </h4>
              <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground pl-7" style={{ textAlign: "justify" }}>
                {section.texte}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
