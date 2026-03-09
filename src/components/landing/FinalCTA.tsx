import { Link } from "react-router-dom";
import { useInView } from "./useInView";

export default function FinalCTA() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`relative bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-white/10 rounded-3xl py-16 md:py-24 px-8 text-center transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white font-serif">
            Prêt à automatiser votre conformité ?
          </h2>
          <p className="text-lg text-white/60 mt-4 max-w-xl mx-auto">
            Rejoignez les cabinets qui ont choisi la sérénité plutôt que le
            stress.
          </p>
          <div className="mt-10">
            <Link
              to="/auth"
              className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-5 rounded-xl text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02] animate-[ctaGlow_3s_ease-in-out_infinite]"
            >
              Démarrer mon essai gratuit
            </Link>
          </div>
          <p className="text-sm text-white/40 mt-4">
            Sans carte bancaire · 14 jours gratuits · Annulation en 1 clic
          </p>
          <p className="text-sm text-white/50 mt-6">
            Une question ? Réservez un appel de 15 min avec notre équipe
          </p>
        </div>
      </div>
    </section>
  );
}
