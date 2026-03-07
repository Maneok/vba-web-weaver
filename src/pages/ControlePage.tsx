import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";

export default function ControlePage() {
  const { clients } = useAppState();

    if (clients.length <= 5) return [...clients];
    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth();
    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };
    const weighted = clients.map((c, i) => ({
      client: c,
      weight: c.scoreGlobal * 2 + seededRandom(i) * 30,
    }));

  const checkpoints = [
    { icon: Shield, title: "Identite & Beneficiaires Effectifs", desc: "Verifier CNI, KBIS, RBE a jour" },
    { icon: Target, title: "Scoring & Risque", desc: "Verifier coherence du score, malus, niveau de vigilance" },
    { icon: FileCheck, title: "Documents & Contrat", desc: "Lettre de mission signee, mandat SEPA, pieces" },
  ];

  return (
>>>>>> main
      </div>

      {/* Drawn files */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-1">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-300">Dossiers tires au sort ce mois</h3>
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {auditable.map((c, idx) => (
            <div key={c.ref} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-[11px] font-bold text-blue-400">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-sm text-slate-200">{c.raisonSociale}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{c.ref} &middot; {c.forme} &middot; {c.siren}</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <ScoreGauge score={c.scoreGlobal} />
                <VigilanceBadge level={c.nivVigilance} />
                <div className="flex gap-1.5">
                  {c.ppe === "OUI" && <FlagBadge label="PPE" />}
                  {c.paysRisque === "OUI" && <FlagBadge label="Pays" />}
                  {c.atypique === "OUI" && <FlagBadge label="Atypique" />}
                  {c.cash === "OUI" && <FlagBadge label="Cash" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkpoints */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-2">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-300">Points de controle</h3>
        </div>
        <div className="p-6 space-y-3">
          {checkpoints.map((cp, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <cp.icon className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 w-5 h-5 rounded flex items-center justify-center">{i + 1}</span>
                  {cp.title}
                </p>
                <p className="text-xs text-slate-500 mt-1">{cp.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlagBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md">
      {label}
    </span>
  );
}
