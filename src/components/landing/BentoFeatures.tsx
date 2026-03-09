import { FileCheck, BarChart3, Shield, Eye } from "lucide-react";
import { useInView } from "./useInView";

function MiniScreening() {
  return (
    <div className="mt-4 bg-white/[0.03] border border-white/[0.04] rounded-xl p-3 text-xs">
      <div className="flex items-center gap-2 mb-2 text-white/40">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        Screening en cours…
      </div>
      {["INPI", "OpenSanctions", "BODACC", "DG Trésor", "Google Places"].map(
        (s, i) => (
          <div key={s} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
            <span className="text-white/50">{s}</span>
            <span className="text-green-400">✓</span>
          </div>
        )
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-white/60 font-medium">Score de risque</span>
        <span className="text-blue-400 font-bold">32/120</span>
      </div>
    </div>
  );
}

function MiniLettre() {
  return (
    <div className="mt-4 bg-white/[0.03] border border-white/[0.04] rounded-xl p-3 text-xs">
      <div className="flex items-center gap-2 mb-2 text-white/40">
        <div className="w-2 h-2 rounded-full bg-indigo-400" />
        Aperçu lettre de mission
      </div>
      <div className="space-y-1 text-white/40">
        <div className="h-2 bg-white/[0.06] rounded w-3/4" />
        <div className="h-2 bg-white/[0.06] rounded w-full" />
        <div className="h-2 bg-white/[0.06] rounded w-5/6" />
        <div className="h-2 bg-white/[0.06] rounded w-2/3" />
      </div>
      <div className="flex gap-2 mt-3">
        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px]">PDF</span>
        <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px]">DOCX</span>
      </div>
    </div>
  );
}

const smallCards = [
  {
    icon: FileCheck,
    title: "Documents INPI",
    desc: "Statuts, comptes annuels, Kbis téléchargés automatiquement et stockés dans votre GED.",
  },
  {
    icon: BarChart3,
    title: "Scoring 6 axes",
    desc: "Activité, pays, mission, maturité, structure + malus. Conforme à la grille NPLAB.",
  },
  {
    icon: Shield,
    title: "Gouvernance complète",
    desc: "Organigramme, formations, manuel de procédures, contrôle interne, registre TRACFIN.",
  },
  {
    icon: Eye,
    title: "Prêt pour le contrôle",
    desc: "Export PDF du dossier complet en 1 clic. Mode contrôleur en lecture seule.",
  },
];

export default function BentoFeatures() {
  const { ref, inView } = useInView();

  return (
    <section id="fonctionnalites" ref={ref} className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-16 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            Tout ce dont votre cabinet a besoin. Rien de plus.
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mt-4">
            GRIMY couvre l'intégralité du dispositif LCB-FT exigé par la NPLAB,
            dans une interface simple et moderne.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Big card 1 */}
          <div
            className={`lg:col-span-2 lg:row-span-2 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 hover:border-blue-500/20 transition-all duration-500 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: inView ? "0ms" : "0ms" }}
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              Screening automatique en 30 secondes
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Entrez un SIREN. GRIMY interroge 9 sources en temps réel&nbsp;: INPI,
              OpenSanctions, BODACC, DG Trésor, Google Places, gel des avoirs…
              Score de risque et niveau de vigilance calculés automatiquement.
            </p>
            <MiniScreening />
          </div>

          {/* Big card 2 */}
          <div
            className={`lg:col-span-2 lg:row-span-2 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 hover:border-indigo-500/20 transition-all duration-500 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: inView ? "100ms" : "0ms" }}
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              Lettre de mission en 3 minutes
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Sélectionnez un client, cochez les missions, validez les honoraires.
              GRIMY génère une lettre conforme NPLAB en PDF et DOCX, pré-remplie
              avec toutes les données.
            </p>
            <MiniLettre />
          </div>

          {/* Small cards */}
          {smallCards.map((c, i) => (
            <div
              key={c.title}
              className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 hover:border-blue-500/15 transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? `${(i + 2) * 100}ms` : "0ms" }}
            >
              <c.icon className="text-blue-400 mb-3" size={22} />
              <h3 className="text-base font-semibold text-white mb-1">{c.title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
