import { Clock, AlertTriangle, FileX } from "lucide-react";
import { useInView } from "./useInView";

const pains = [
  {
    icon: Clock,
    title: "12h par mois perdues",
    desc: "Collecte manuelle des documents, vérification des listes, mise à jour des dossiers… Le temps que vous ne passez pas à conseiller vos clients.",
    color: "border-red-500/60",
  },
  {
    icon: AlertTriangle,
    title: "Risque de sanctions",
    desc: "2 500 contrôles LAB prévus par l'Ordre. Un contrôle défavorable = nouveau contrôle dans 12 mois + risque disciplinaire.",
    color: "border-orange-500/60",
  },
  {
    icon: FileX,
    title: "Aucune traçabilité",
    desc: "Comment prouver vos diligences 3 ans après ? Excel ne conserve pas l'historique de vos vérifications.",
    color: "border-red-500/60",
  },
];

export default function PainSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-16 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            Votre conformité LCB-FT repose encore sur Excel&nbsp;?
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mt-4">
            Vous n'êtes pas seul. 80% des cabinets gèrent encore leur LAB avec
            des tableurs, des dossiers papier et beaucoup de bonne volonté.
            Jusqu'au jour du contrôle.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pains.map((p, i) => (
            <div
              key={p.title}
              className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 border-l-4 ${p.color} transition-all duration-600 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? `${i * 100}ms` : "0ms" }}
            >
              <p.icon className="text-white/60 mb-4" size={28} />
              <h3 className="text-xl font-semibold text-white mb-2">{p.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-white/60 italic mt-12">
          Il existe une meilleure façon de faire.
        </p>
      </div>
    </section>
  );
}
