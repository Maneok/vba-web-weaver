import { Upload, Cpu, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useInView } from "./useInView";

const steps = [
  {
    num: "1",
    icon: Upload,
    title: "Importez vos clients",
    desc: "Entrez un SIREN ou importez votre portefeuille. GRIMY récupère automatiquement toutes les données INPI.",
  },
  {
    num: "2",
    icon: Cpu,
    title: "GRIMY analyse tout",
    desc: "Screening 9 APIs, scoring 6 axes, téléchargement des documents, cartographie des risques. En automatique.",
  },
  {
    num: "3",
    icon: CheckCircle,
    title: "Vous êtes conforme",
    desc: "Dashboard de pilotage, registre LCB-FT, lettre de mission. Prêt pour le contrôle à tout moment.",
  },
];

export default function HowItWorks() {
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
            Conforme en 10 minutes. Littéralement.
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8 md:gap-12">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] border-t-2 border-dashed border-white/10" />
          <div className="md:hidden absolute top-0 bottom-0 left-6 border-l-2 border-dashed border-white/10" />

          {steps.map((s, i) => (
            <div
              key={s.num}
              className={`relative text-center md:text-center transition-all duration-600 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? `${i * 150}ms` : "0ms" }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg mb-4 relative z-10">
                {s.num}
              </div>
              <s.icon className="mx-auto text-white/40 mb-3" size={28} />
              <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link
            to="/auth"
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02]"
          >
            Essayer maintenant — c'est gratuit
          </Link>
        </div>
      </div>
    </section>
  );
}
