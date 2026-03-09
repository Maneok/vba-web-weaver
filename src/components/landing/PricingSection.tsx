import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useInView } from "./useInView";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function CountUp({ target, inView }: { target: number; inView: boolean }) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const duration = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return <>{value}</>;
}

const plans = [
  {
    name: "SOLO",
    monthly: 29,
    annual: 23,
    badge: null,
    featured: false,
    features: [
      "1 utilisateur",
      "50 clients",
      "Screening complet",
      "Scoring 6 axes",
      "Lettre de mission",
      "GED 5 Go",
      "Support email",
    ],
    cta: "Commencer",
    link: "/auth",
  },
  {
    name: "CABINET",
    monthly: 79,
    annual: 63,
    badge: "Le plus populaire",
    featured: true,
    features: [
      "5 utilisateurs",
      "200 clients",
      "Tout Solo +",
      "Contrôle qualité",
      "Gouvernance",
      "Multi-rôles",
      "Support prioritaire",
    ],
    cta: "Commencer",
    link: "/auth",
  },
  {
    name: "ENTERPRISE",
    monthly: null,
    annual: null,
    badge: null,
    featured: false,
    features: [
      "Illimité",
      "Tout Cabinet +",
      "SSO",
      "API",
      "Formation sur site",
      "Référent dédié",
      "SLA garanti",
    ],
    cta: "Nous contacter",
    link: "#",
  },
];

const miniFaq = [
  {
    q: "Puis-je changer de plan ?",
    a: "Oui, vous pouvez upgrader ou downgrader à tout moment depuis votre espace. Le changement est immédiat.",
  },
  {
    q: "Y a-t-il un engagement ?",
    a: "Non. Tous nos plans sont sans engagement. Vous pouvez annuler à tout moment.",
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const { ref, inView } = useInView();

  return (
    <section id="tarifs" ref={ref} className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-12 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            Des tarifs transparents. Sans surprise.
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mt-4">
            Contrairement aux solutions qui cachent leurs prix derrière un
            formulaire de contact.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm ${!annual ? "text-white" : "text-white/40"}`}>Mensuel</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              annual ? "bg-blue-600" : "bg-white/20"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                annual ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={`text-sm ${annual ? "text-white" : "text-white/40"}`}>
            Annuel
          </span>
          {annual && (
            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">
              Économisez 20%
            </span>
          )}
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white/[0.03] backdrop-blur-sm border rounded-2xl p-6 transition-all duration-500 ${
                plan.featured
                  ? "border-blue-500/30 md:scale-105 shadow-lg shadow-blue-500/10"
                  : "border-white/[0.06]"
              } ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
              <div className="mb-6">
                {plan.monthly !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      <CountUp target={annual ? plan.annual! : plan.monthly} inView={inView} />€
                    </span>
                    <span className="text-white/40 text-sm">/mois</span>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-white">Sur devis</div>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="text-green-400 shrink-0 mt-0.5" size={14} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.link}
                className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.featured
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                    : "border border-white/20 text-white hover:bg-white/5"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-white/40 text-sm mt-8">
          Tous les plans incluent : hébergement France, mises à jour gratuites,
          export PDF illimité
        </p>

        {/* Mini FAQ */}
        <div className="max-w-xl mx-auto mt-12">
          <Accordion type="single" collapsible>
            {miniFaq.map((f, i) => (
              <AccordionItem key={i} value={`pf-${i}`} className="border-white/[0.06]">
                <AccordionTrigger className="text-white/70 text-sm hover:text-white hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-white/50 text-sm">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
