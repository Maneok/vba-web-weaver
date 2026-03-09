import { useInView } from "./useInView";

const badges = [
  "NPLAB 2020",
  "NPMQ 2025",
  "RGPD",
  "Hébergé en France 🇫🇷",
];

export default function SocialProofBar() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-8 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-white/40 mb-4">
          Conforme aux exigences de l'Ordre des experts-comptables
        </p>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          {badges.map((b, i) => (
            <span
              key={b}
              className={`bg-white/[0.05] border border-white/[0.08] text-white/70 text-sm px-4 py-2 rounded-full transition-all duration-500 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: inView ? `${i * 150}ms` : "0ms" }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
