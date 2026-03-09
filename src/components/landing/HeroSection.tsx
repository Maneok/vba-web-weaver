import { Link } from "react-router-dom";
import { TrendingUp, Users, Shield, FileCheck } from "lucide-react";

function DashboardMockup() {
  const stats = [
    { label: "Clients conformes", value: "94%", icon: Users, color: "text-green-400" },
    { label: "Risque moyen", value: "32/120", icon: TrendingUp, color: "text-blue-400" },
    { label: "Alertes actives", value: "3", icon: Shield, color: "text-amber-400" },
    { label: "Lettres générées", value: "127", icon: FileCheck, color: "text-indigo-400" },
  ];

  return (
    <div className="mt-16 hidden md:block perspective-[1200px]">
      <div className="relative mx-auto max-w-4xl transform transition-transform duration-500 hover:rotate-x-0 [transform:rotateX(5deg)]">
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-blue-500/5">
          {/* Title bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
            <span className="ml-3 text-xs text-white/30">GRIMY — Tableau de bord</span>
          </div>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4"
              >
                <s.icon className={`${s.color} mb-2`} size={20} />
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Fake chart */}
          <div className="mt-4 bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 h-32 flex items-end gap-1">
            {[40, 55, 35, 65, 50, 70, 45, 80, 60, 75, 90, 85].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-blue-600/40 to-indigo-500/20 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] animate-[blob1_8s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] animate-[blob2_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 left-1/3 w-[450px] h-[450px] rounded-full bg-violet-600/8 blur-[120px] animate-[blob3_8s_ease-in-out_infinite]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        {/* Badge */}
        <div className="inline-flex items-center bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full mb-6">
          Conforme NPLAB 2020 · NPMQ 2025
        </div>

        {/* H1 */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold font-serif tracking-tight leading-tight text-white max-w-5xl mx-auto">
          Soyez prêt pour votre contrôle&nbsp;LAB.{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Toujours.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mt-6">
          GRIMY automatise votre conformité LCB-FT de A à Z&nbsp;: identification
          des risques, classification NPLAB, vigilance continue et traçabilité
          complète. Créé par un expert-comptable, pour les experts-comptables.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            to="/auth"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02] animate-[ctaGlow_3s_ease-in-out_infinite]"
          >
            Démarrer mon essai gratuit
          </Link>
          <button
            onClick={() =>
              document
                .querySelector("#fonctionnalites")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="border border-white/20 text-white hover:bg-white/5 px-8 py-4 rounded-xl text-lg transition-all"
          >
            Voir la démo
          </button>
        </div>

        {/* Micro-copy */}
        <p className="text-sm text-white/40 mt-4">
          Sans carte bancaire · 14 jours gratuits · Données hébergées en France
        </p>

        {/* Dashboard mockup */}
        <DashboardMockup />
      </div>
    </section>
  );
}
