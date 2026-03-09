import { Star } from "lucide-react";
import { useInView } from "./useInView";

const testimonials = [
  {
    text: "Nous avons passé notre dernier contrôle LAB sans aucune observation. GRIMY avait tout préparé.",
    name: "Pierre M.",
    role: "Expert-comptable, Cabinet 25 collaborateurs, Marseille",
    initials: "PM",
  },
  {
    text: "Le screening automatique nous fait gagner 2 heures par nouveau client. Et la lettre de mission se génère en 3 clics.",
    name: "Sophie L.",
    role: "Collaboratrice, Cabinet 12 personnes, Lyon",
    initials: "SL",
  },
  {
    text: "Enfin un outil pensé par quelqu'un qui comprend nos obligations. Pas un truc générique adapté à la va-vite.",
    name: "Marc D.",
    role: "Associé signataire, Cabinet parisien",
    initials: "MD",
  },
];

export default function TestimonialsSection() {
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
            Ce qu'en disent les experts-comptables
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 transition-all duration-600 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? `${i * 100}ms` : "0ms" }}
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="text-amber-400 fill-amber-400" size={16} />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed mb-6 italic">
                "{t.text}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-white/40 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-white/40 mt-12">
          Rejoignez les cabinets qui ont choisi la sérénité
        </p>
      </div>
    </section>
  );
}
