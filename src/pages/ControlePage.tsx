import { useMemo } from "react";
import { ClipboardCheck, FileCheck, Shield, Target } from "lucide-react";
import { useAppState } from "@/lib/AppContext";

export default function ControlePage() {
  const { clients } = useAppState();

  const auditable = useMemo(() => {
    if (clients.length <= 5) return clients;

    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth();

    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    return [...clients]
      .map((client, i) => ({
        client,
        weight: client.scoreGlobal * 2 + seededRandom(i) * 30,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((entry) => entry.client);
  }, [clients]);

  const checkpoints = [
    { icon: Shield, title: "Identite & Beneficiaires Effectifs", desc: "Verifier CNI, KBIS, RBE a jour" },
    { icon: Target, title: "Scoring & Risque", desc: "Verifier coherence du score et du niveau de vigilance" },
    { icon: FileCheck, title: "Documents & Contrat", desc: "Lettre de mission, mandat et pieces justificatives" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1300px] mx-auto">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">Controle qualite</p>
        <h1 className="text-xl font-semibold text-slate-100 mt-1">Echantillon mensuel des dossiers a reviser</h1>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">Dossiers tires au sort ce mois</h3>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {auditable.map((c, idx) => (
            <div key={c.ref} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02]">
              <div>
                <p className="text-sm font-medium text-slate-200">{idx + 1}. {c.raisonSociale}</p>
                <p className="text-xs text-slate-500">{c.ref} · {c.siren} · Score {c.scoreGlobal}/100</p>
              </div>
              <span className="text-xs rounded-md px-2 py-1 bg-blue-500/10 text-blue-300">{c.nivVigilance}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Points de controle</h3>
        <div className="space-y-3">
          {checkpoints.map((cp, i) => (
            <div key={cp.title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3">
              <cp.icon className="w-4 h-4 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm text-slate-200 font-medium">{i + 1}. {cp.title}</p>
                <p className="text-xs text-slate-500 mt-1">{cp.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
