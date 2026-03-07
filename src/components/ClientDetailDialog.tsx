import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Separator } from "@/components/ui/separator";
import type { Client } from "@/lib/types";
import { ExternalLink, User, Building, MapPin, Phone, Mail, Calendar, AlertTriangle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { generateLettreMission } from "@/lib/generateLettreMissionPdf";

interface Props {
  client: Client;
  open: boolean;
  onClose: () => void;
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      {Icon && <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-slate-200 mt-0.5">{value || "---"}</p>
      </div>
    </div>
  );
}

export default function ClientDetailDialog({ client, open, onClose }: Props) {
  const maluses = [
    client.ppe === "OUI" && "PPE",
    client.atypique === "OUI" && "Montage atypique",
    client.paysRisque === "OUI" && "Pays a risque",
    client.cash === "OUI" && "Especes",
    client.pression === "OUI" && "Pression client",
    client.distanciel === "OUI" && "Distanciel",
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[hsl(217,33%,14%)] border-white/[0.06]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg text-white">{client.raisonSociale}</DialogTitle>
              <p className="text-xs text-slate-500 font-mono mt-1">{client.ref} &middot; SIREN {client.siren}</p>
            </div>
            <div className="flex gap-3 items-center">
              <ScoreGauge score={client.scoreGlobal} />
              <VigilanceBadge level={client.nivVigilance} />
            </div>
          </div>
        </DialogHeader>

        {/* Malus flags */}
        {maluses.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex flex-wrap gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
            {maluses.map((m, i) => (
              <span key={i} className="text-[11px] font-semibold bg-red-500/10 text-red-400 px-2.5 py-1 rounded-md">{m}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Identite</h3>
            <InfoRow label="Dirigeant" value={client.dirigeant} icon={User} />
            <InfoRow label="Forme juridique" value={client.forme} icon={Building} />
            <InfoRow label="Activite" value={`${client.domaine} (${client.ape})`} />
            <InfoRow label="Adresse" value={`${client.adresse}, ${client.cp} ${client.ville}`} icon={MapPin} />
            <InfoRow label="Telephone" value={client.tel} icon={Phone} />
            <InfoRow label="Email" value={client.mail} icon={Mail} />
            <InfoRow label="Capital" value={`${client.capital.toLocaleString()} EUR`} />
            <InfoRow label="Effectif" value={client.effectif} />
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Mission & Suivi</h3>
            <InfoRow label="Mission" value={client.mission} />
            <InfoRow label="Comptable" value={client.comptable} />
            <InfoRow label="Associe" value={client.associe} />
            <InfoRow label="Superviseur" value={client.superviseur} />
            <InfoRow label="Honoraires" value={`${client.honoraires.toLocaleString()} EUR`} />
            <InfoRow label="Frequence" value={client.frequence} />
            <InfoRow label="Date reprise" value={client.dateReprise} icon={Calendar} />
            <InfoRow label="IBAN" value={client.iban} />
          </div>
        </div>

        <Separator className="bg-white/[0.06]" />

        {/* Scoring breakdown */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">Decomposition du Score</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Activite", score: client.scoreActivite },
              { label: "Pays", score: client.scorePays },
              { label: "Mission", score: client.scoreMission },
              { label: "Maturite", score: client.scoreMaturite },
              { label: "Structure", score: client.scoreStructure },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <p className="text-[10px] text-slate-500 uppercase">{item.label}</p>
                <p className="text-xl font-bold font-mono text-white mt-1">{item.score}</p>
              </div>
            ))}
          </div>
          {client.malus > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="font-medium text-red-400">Malus total : +{client.malus} points</span>
            </div>
          )}
        </div>

        <Separator className="bg-white/[0.06]" />

        {/* Pilotage */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase">Derniere revue</p>
            <p className="text-sm font-medium text-slate-200 mt-1 font-mono">{client.dateDerniereRevue}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase">Date butoir</p>
            <p className="text-sm font-medium text-slate-200 mt-1 font-mono">{client.dateButoir}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase">Pilotage</p>
            <div className="mt-1"><PilotageBadge status={client.etatPilotage} /></div>
          </div>
        </div>

        {/* BE */}
        {client.be && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Beneficiaires Effectifs</h3>
            <p className="text-sm text-slate-300">{client.be}</p>
          </div>
        )}

        {/* Actions */}

          <Button
            variant="outline"
            className="gap-2 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30"
            onClick={() => generateFicheAcceptation(client)}
          >
            <FileDown className="w-4 h-4" />

          </Button>
          <a
            href={`https://www.pappers.fr/recherche?q=${client.siren.replace(/\s/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Consulter sur Pappers
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
