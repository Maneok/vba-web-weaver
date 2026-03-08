import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import {
  generateFromClient,
  renderToPdf,
  renderToDocx,
  validateLettreMission,
} from "@/lib/lettreMissionEngine";
import type { CabinetConfig, LettreMissionOptions } from "@/types/lettreMission";
import { DEFAULT_LM_OPTIONS } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const DEFAULT_CABINET: CabinetConfig = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
  couleurPrimaire: "#1E3A5F",
  couleurSecondaire: "#3B82F6",
  police: "system-ui",
};

export default function LettreMissionPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();

  const [selectedRef, setSelectedRef] = useState<string>(ref ?? "");
  const [options] = useState<LettreMissionOptions>(DEFAULT_LM_OPTIONS);

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? (ref ? clients.find((c) => c.ref === ref) : undefined),
    [clients, selectedRef, ref]
  );

  const validation = useMemo(
    () => client ? validateLettreMission(client, DEFAULT_CABINET) : null,
    [client]
  );

  const handleExportPdf = () => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    const lm = generateFromClient(client, DEFAULT_CABINET, options);
    renderToPdf(lm);
    toast.success("PDF généré avec succès");
  };

  const handleExportDocx = async () => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    const lm = generateFromClient(client, DEFAULT_CABINET, options);
    await renderToDocx(lm);
    toast.success("DOCX généré avec succès");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(client ? `/client/${client.ref}` : "/bdd")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            disabled={!client}
            className="gap-1"
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportDocx}
            disabled={!client}
            className="gap-1"
          >
            <FileText className="h-4 w-4" /> DOCX
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Client selector */}
        <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Sélectionner un client
          </label>
          <Select value={selectedRef} onValueChange={setSelectedRef}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choisir un client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.ref} value={c.ref}>
                  {c.ref} — {c.raisonSociale} ({c.forme})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Validation status */}
        {client && validation && (
          <div
            className={`rounded-lg p-4 border ${
              validation.valid
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {validation.valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">
                    Dossier complet — prêt pour génération
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">
                    Champs manquants ({validation.champsManquants.length})
                  </span>
                </>
              )}
            </div>
            {!validation.valid && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {validation.champsManquants.map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-xs border-amber-500/30 text-amber-300"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview card */}
        {client && (
          <PreviewCard client={client} />
        )}

        {!client && !ref && (
          <div className="text-center text-slate-500 py-20">
            Sélectionnez un client pour générer une lettre de mission
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCard({ client }: { client: Client }) {
  const total = (client.honoraires ?? 0) + (client.reprise ?? 0) + (client.juridique ?? 0);

  return (
    <div className="bg-slate-800/50 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-800 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">Aperçu de la lettre</h2>
      </div>
      <div className="p-4 space-y-4 text-sm">
        {/* Identification */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase mb-2">Identification</div>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div><span className="text-slate-500">Raison sociale :</span> {client.raisonSociale}</div>
            <div><span className="text-slate-500">Forme :</span> {client.forme}</div>
            <div><span className="text-slate-500">SIREN :</span> {client.siren}</div>
            <div><span className="text-slate-500">Dirigeant :</span> {client.dirigeant}</div>
            <div><span className="text-slate-500">Adresse :</span> {client.adresse}, {client.cp} {client.ville}</div>
            <div><span className="text-slate-500">APE :</span> {client.ape} — {client.domaine}</div>
          </div>
        </div>

        {/* Mission */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase mb-2">Mission</div>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div><span className="text-slate-500">Type :</span> {client.mission}</div>
            <div><span className="text-slate-500">Associé :</span> {client.associe}</div>
            <div><span className="text-slate-500">Fréquence :</span> {client.frequence}</div>
            <div><span className="text-slate-500">Comptable :</span> {client.comptable}</div>
          </div>
        </div>

        {/* Honoraires */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase mb-2">Honoraires</div>
          <div className="grid grid-cols-3 gap-2 text-slate-300">
            <div><span className="text-slate-500">Comptable :</span> {client.honoraires?.toLocaleString("fr-FR")} €</div>
            <div><span className="text-slate-500">Juridique :</span> {client.juridique?.toLocaleString("fr-FR")} €</div>
            <div className="font-semibold text-white">Total : {total.toLocaleString("fr-FR")} € HT</div>
          </div>
        </div>

        {/* LCB-FT */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase mb-2">LCB-FT</div>
          <div className="flex items-center gap-3 text-slate-300">
            <Badge
              variant="outline"
              className={
                client.nivVigilance === "SIMPLIFIEE" ? "border-green-500/50 text-green-400" :
                client.nivVigilance === "RENFORCEE" ? "border-red-500/50 text-red-400" :
                "border-amber-500/50 text-amber-400"
              }
            >
              {client.nivVigilance}
            </Badge>
            <span>Score : {client.scoreGlobal}/100</span>
            <span>PPE : {client.ppe}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
