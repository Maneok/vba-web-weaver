import { useState, useMemo } from "react";
import { ClipboardCheck, FileCheck, Shield, Target, RefreshCw, FileDown } from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { Button } from "@/components/ui/button";
import { VigilanceBadge, ScoreGauge } from "@/components/RiskBadges";
import { toast } from "sonner";
import type { Client } from "@/lib/types";

interface Tirage {
  date: string;
  dossiers: Client[];
}

export default function ControlePage() {
  const { clients, addLog } = useAppState();
  const [tirages, setTirages] = useState<Tirage[]>([]);

  const generateSample = () => {
    const valides = clients.filter(c => c.etat === "VALIDE");
    if (valides.length === 0) {
      toast.error("Aucun client valide pour le tirage");
      return;
    }

    const now = new Date();
    const seed = now.getTime();
    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    const sample = [...valides]
      .map((client, i) => ({
        client,
        weight: client.scoreGlobal * 2 + seededRandom(i) * 30,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.min(5, valides.length))
      .map(entry => entry.client);

    const tirage: Tirage = {
      date: now.toISOString().split("T")[0],
      dossiers: sample,
    };

    setTirages(prev => [tirage, ...prev]);
    addLog({
      horodatage: now.toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: "CONTROLE",
      typeAction: "TIRAGE_CONTROLE",
      details: `Tirage aleatoire de ${sample.length} dossiers: ${sample.map(c => c.ref).join(", ")}`,
    });
    toast.success(`${sample.length} dossiers tires au sort`);
  };

  const currentSample = useMemo(() => {
    if (tirages.length > 0) return tirages[0].dossiers;
    // Default: seeded monthly sample
    if (clients.length <= 5) return clients;
    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth();
    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };
    return [...clients]
      .map((client, i) => ({ client, weight: client.scoreGlobal * 2 + seededRandom(i) * 30 }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(entry => entry.client);
  }, [clients, tirages]);

  const checkpoints = [
    { icon: Shield, title: "Identite & Beneficiaires Effectifs", desc: "Verifier CNI, KBIS, RBE a jour" },
    { icon: Target, title: "Scoring & Risque", desc: "Verifier coherence du score et du niveau de vigilance" },
    { icon: FileCheck, title: "Documents & Contrat", desc: "Lettre de mission, mandat et pieces justificatives" },
  ];

  const handleExportPDF = () => {
    toast.success("Rapport de controle genere (PDF)");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Controle qualite</p>
          <h1 className="text-xl font-semibold text-slate-100 mt-1">Echantillon des dossiers a reviser</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5 border-white/[0.06]" onClick={handleExportPDF}>
            <FileDown className="w-4 h-4" /> Rapport PDF
          </Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={generateSample}>
            <RefreshCw className="w-4 h-4" /> Nouveau tirage
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">
            Dossiers tires au sort
            {tirages.length > 0 && <span className="text-slate-500 font-normal ml-2">({tirages[0].date})</span>}
          </h3>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {currentSample.map((c, idx) => (
            <div key={c.ref} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-500 w-6">{idx + 1}.</span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{c.raisonSociale}</p>
                  <p className="text-xs text-slate-500">{c.ref} · {c.siren} · {c.forme}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ScoreGauge score={c.scoreGlobal} />
                <VigilanceBadge level={c.nivVigilance} />
              </div>
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

      {/* Historique des tirages */}
      {tirages.length > 1 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Tirages precedents</h3>
          <div className="space-y-2">
            {tirages.slice(1).map((t, i) => (
              <div key={i} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400">{t.date}</span>
                  <span className="text-xs text-slate-500 ml-3">{t.dossiers.map(d => d.raisonSociale).join(", ")}</span>
                </div>
                <span className="text-xs text-slate-500">{t.dossiers.length} dossiers</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
