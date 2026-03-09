import { Lock, Server, Shield, Key } from "lucide-react";
import { useInView } from "./useInView";

const items = [
  {
    icon: Lock,
    title: "Chiffrement AES-256",
    desc: "Toutes les données sont chiffrées au repos et en transit.",
  },
  {
    icon: Server,
    title: "Hébergé en France",
    desc: "Infrastructure Supabase hébergée en Europe. Vos données ne quittent jamais l'UE.",
  },
  {
    icon: Shield,
    title: "Conforme RGPD",
    desc: "Traitement des données conforme au règlement européen. DPO désigné.",
  },
  {
    icon: Key,
    title: "Accès par rôle",
    desc: "Permissions granulaires : admin, superviseur, collaborateur, stagiaire. Chaque action est tracée.",
  },
];

export default function SecuritySection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-24 md:py-32 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-16 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            Vos données méritent le plus haut niveau de protection
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {items.map((item, i) => (
            <div
              key={item.title}
              className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 transition-all duration-600 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? `${i * 100}ms` : "0ms" }}
            >
              <item.icon className="text-blue-400 mb-3" size={24} />
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
