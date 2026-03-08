import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function AnnexesPreview({ repartition, onRepartitionChange }: AnnexesPreviewProps) {
  const tpl = LETTRE_MISSION_TEMPLATE;

  const [rows, setRows] = useState<RepartitionRow[]>(
    repartition ??
    tpl.repartitionTravaux.lignes.map((l) => ({
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

  return (
    <Tabs defaultValue="repartition">
      <TabsList className="flex flex-wrap h-auto gap-1 w-fit">
        <TabsTrigger value="repartition" className="text-xs">Repartition travaux</TabsTrigger>
        <TabsTrigger value="travail_dissimule" className="text-xs">Travail dissimule</TabsTrigger>
        <TabsTrigger value="sepa" className="text-xs">SEPA</TabsTrigger>
        <TabsTrigger value="liasse" className="text-xs">Liasse fiscale</TabsTrigger>
        <TabsTrigger value="cgv" className="text-xs">CGV</TabsTrigger>
      </TabsList>

      {/* Repartition travaux - editable checkboxes */}
      <TabsContent value="repartition" className="mt-4">
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-white/10">
                {tpl.repartitionTravaux.colonnes.map((col, i) => (
                  <th key={i} className={`px-3 py-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-center"} ${i > 0 && i < 3 ? "w-20" : ""}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-xs">{row.label}</td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={row.cabinet}
                      onCheckedChange={() => toggleRow(row.id, "cabinet")}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={row.client}
                      onCheckedChange={() => toggleRow(row.id, "client")}
                    />
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.periodicite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* Attestation travail dissimule - read only */}
      <TabsContent value="travail_dissimule" className="mt-4">
        <div className="rounded-lg border border-white/10 bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.attestationTravailDissimule.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {tpl.attestationTravailDissimule.texte}
          </div>
        </div>
      </TabsContent>

      {/* Mandat SEPA - read only */}
      <TabsContent value="sepa" className="mt-4">
        <div className="rounded-lg border border-white/10 bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.mandatSepa.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground mb-4">
            {tpl.mandatSepa.texteAutorisation}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Creancier</p>
            <div className="rounded border border-white/10 p-3 space-y-1">
              {tpl.mandatSepa.champCreancier.map((c) => (
                <div key={c.label} className="flex text-xs">
                  <span className="text-muted-foreground w-48">{c.label} :</span>
                  <span className="font-mono text-blue-300">{`{{${c.variable}}}`}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Debiteur</p>
            <div className="rounded border border-white/10 p-3 space-y-1">
              {tpl.mandatSepa.champDebiteur.map((c) => (
                <div key={c.label} className="flex text-xs">
                  <span className="text-muted-foreground w-48">{c.label} :</span>
                  <span className="font-mono text-blue-300">{`{{${c.variable}}}`}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Type de prelevement : {tpl.mandatSepa.typePrelevement}
            </div>
            <div className="text-xs text-muted-foreground">
              Reference unique de mandat : <span className="font-mono text-blue-300">{tpl.mandatSepa.rum}</span>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Autorisation liasse fiscale - read only */}
      <TabsContent value="liasse" className="mt-4">
        <div className="rounded-lg border border-white/10 bg-card/60 p-6">
          <h3 className="text-sm font-bold mb-4">{tpl.autorisationLiasse.titre}</h3>
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {tpl.autorisationLiasse.texte}
          </div>
        </div>
      </TabsContent>

      {/* Conditions generales - read only */}
      <TabsContent value="cgv" className="mt-4">
        <div className="rounded-lg border border-white/10 bg-card/60 p-6 space-y-6">
          <h3 className="text-sm font-bold">{tpl.conditionsGenerales.titre}</h3>
          {tpl.conditionsGenerales.sections.map((section) => (
            <div key={section.numero}>
              <h4 className="text-xs font-bold mb-2 text-blue-300">
                Article {section.numero} — {section.titre}
              </h4>
              <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {section.texte}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
