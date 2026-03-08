import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, FileText, Calculator, FileCheck, Check, X, Minus,
  ArrowRight, Users, BarChart3, ClipboardCheck, FolderOpen,
  Search, Monitor, Quote, ChevronRight
} from "lucide-react";

/* ─── Scroll reveal hook ─── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.08 }
    );
    const children = el.querySelectorAll("[data-reveal]");
    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Count-up hook ─── */
function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, value };
}

/* ─── Navbar scroll blur ─── */
function useNavScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrolled;
}

/* ─── Smooth scroll to section ─── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ─── Data ─── */
const whyCards = [
  {
    icon: Shield,
    title: "Screening automatique",
    desc: "9 APIs vérifiées en 30 secondes : INPI, OpenSanctions, BODACC, DG Trésor, Google Places...",
  },
  {
    icon: FileCheck,
    title: "Documents récupérés",
    desc: "Statuts, comptes annuels, Kbis — téléchargés automatiquement depuis l'INPI et stockés dans votre GED.",
  },
  {
    icon: Calculator,
    title: "Scoring 6 axes",
    desc: "Activité, pays, mission, maturité, structure + malus. Évaluation objective, traçable et conforme NPLAB.",
  },
  {
    icon: FileText,
    title: "Lettre de mission",
    desc: "Modèle réutilisable, remplissage auto des données client, export PDF/DOCX en un clic.",
  },
];

const featureShowcase = [
  {
    title: "Créez un dossier client en 2 minutes",
    desc: "Entrez un SIREN. GRIMY récupère automatiquement les données INPI, vérifie les sanctions, télécharge les statuts, calcule le score de risque et pré-remplit la lettre de mission.",
    icon: Search,
    mockup: {
      label: "Nouveau client — Étape 1/6",
      fields: ["SIREN : 123 456 789", "Raison sociale : SAS Exemple", "Activité : 6920Z — Comptabilité"],
      status: "Screening en cours... 7/9 APIs",
    },
    reverse: false,
  },
  {
    title: "Prêt pour le contrôle CROEC",
    desc: "Registre LCB-FT, journal d'audit, contrôle qualité — tout est documenté et traçable. Le contrôleur peut visualiser vos dossiers en autonomie.",
    icon: ClipboardCheck,
    mockup: {
      label: "Contrôle qualité",
      fields: ["Dossiers conformes : 47/50", "Alertes résolues : 12/12", "Dernière revue : 03/03/2026"],
      status: "Score global : 94%",
    },
    reverse: true,
  },
  {
    title: "Dashboard de pilotage",
    desc: "Visualisez en un coup d'œil : clients actifs, alertes en cours, revues échues, score moyen. Diagnostic 360° avec recommandations.",
    icon: Monitor,
    mockup: {
      label: "Dashboard — Vue d'ensemble",
      fields: ["Clients actifs : 142", "Alertes : 3 en attente", "Revues échues : 2"],
      status: "Score moyen : 72/100",
    },
    reverse: false,
  },
];

type CompValue = "yes" | "no" | "partial" | string;
type CompRow = { label: string; grimy: CompValue; kanta: CompValue; excel: CompValue };
const comparison: CompRow[] = [
  { label: "Screening automatique 9 APIs", grimy: "yes", kanta: "partial", excel: "no" },
  { label: "Documents INPI (statuts, comptes PDF)", grimy: "yes", kanta: "no", excel: "no" },
  { label: "Scoring multi-critères NPLAB", grimy: "yes", kanta: "yes", excel: "Manuel" },
  { label: "Lettre de mission auto", grimy: "yes", kanta: "yes", excel: "no" },
  { label: "OCR Cloud Vision (CNI/RIB)", grimy: "yes", kanta: "no", excel: "no" },
  { label: "Gel des avoirs DG Trésor", grimy: "yes", kanta: "no", excel: "no" },
  { label: "Diagnostic 360°", grimy: "yes", kanta: "partial", excel: "no" },
  { label: "Multi-cabinet / Multi-utilisateur", grimy: "yes", kanta: "yes", excel: "no" },
  { label: "API publique", grimy: "Bientôt", kanta: "yes", excel: "no" },
  { label: "Prix à partir de", grimy: "29€/mois", kanta: "Sur devis", excel: "Gratuit" },
];

const plans = [
  {
    name: "Solo",
    price: 29,
    desc: "Pour les indépendants",
    features: ["1 utilisateur", "50 clients", "Screening complet", "Lettre de mission", "GED 5 Go"],
    cta: "Commencer",
    popular: false,
  },
  {
    name: "Cabinet",
    price: 79,
    desc: "Pour les cabinets en croissance",
    features: ["5 utilisateurs", "200 clients", "Tout Solo +", "Contrôle qualité", "Multi-rôles", "Support prioritaire"],
    cta: "Commencer",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 0,
    desc: "Pour les grands cabinets",
    features: ["Utilisateurs illimités", "Clients illimités", "Tout Cabinet +", "SSO", "API", "Formation", "Référent dédié"],
    cta: "Nous contacter",
    popular: false,
  },
];

const testimonials = [
  {
    quote: "Nous avons passé notre contrôle LAB sans aucune observation grâce à GRIMY.",
    name: "Marc D.",
    title: "Expert-comptable",
    cabinet: "Cabinet marseillais",
  },
  {
    quote: "Le screening automatique nous fait gagner 2 heures par nouveau client.",
    name: "Sophie L.",
    title: "Collaboratrice",
    cabinet: "Cabinet 15 personnes",
  },
  {
    quote: "Enfin un outil conçu par quelqu'un qui comprend nos obligations.",
    name: "Thomas R.",
    title: "Associé",
    cabinet: "Cabinet parisien",
  },
];

const footerLinks = {
  Produit: ["Fonctionnalités", "Tarifs", "Démo", "Changelog"],
  Ressources: ["Documentation", "Blog", "Guide LCB-FT", "FAQ"],
  Entreprise: ["À propos", "Contact", "CGV", "Mentions légales"],
  Conformité: ["NPLAB", "NPMQ", "RGPD", "Hébergement France"],
};

/* ─── Cell renderer for comparison table ─── */
function CompCell({ value, accent }: { value: CompValue; accent?: boolean }) {
  if (value === "yes")
    return <Check className={`mx-auto h-5 w-5 ${accent ? "text-emerald-400" : "text-gray-400"}`} />;
  if (value === "no") return <X className="mx-auto h-5 w-5 text-red-400/60" />;
  if (value === "partial") return <Minus className="mx-auto h-5 w-5 text-yellow-400/70" />;
  return <span className={`text-sm ${accent ? "text-emerald-400 font-semibold" : "text-gray-400"}`}>{value}</span>;
}

/* ─── Mock UI screenshot ─── */
function MockScreen({ label, fields, status }: { label: string; fields: string[]; status: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
      <div className="rounded-xl bg-[#0d0d24] p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-400/60" />
          <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
          <div className="h-3 w-3 rounded-full bg-green-400/60" />
          <span className="ml-3 text-xs text-gray-500">{label}</span>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f} className="rounded-lg bg-white/5 px-4 py-2.5 text-sm text-gray-300 font-mono">
              {f}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-blue-500/10 px-4 py-2.5 text-sm text-blue-400 font-medium">
          {status}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function LandingPage() {
  const revealRef = useScrollReveal();
  const navScrolled = useNavScroll();
  const [annual, setAnnual] = useState(false);

  const apis = useCountUp(9, 1500);
  const seconds = useCountUp(30, 2000);

  const scrollToSection = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollTo(id);
  }, []);

  return (
    <div ref={revealRef} className="min-h-screen text-white" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* CSS for animated gradient background */}
      <style>{`
        .landing-bg {
          background: linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #0a0a1a 50%, #1a1a3e 75%, #0a0a1a 100%);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15) 0%, transparent 70%);
        }
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: scale(1.02);
          box-shadow: 0 20px 60px -15px rgba(59, 130, 246, 0.15);
        }
      `}</style>

      <div className="landing-bg">
        {/* ─── 1. Navbar ─── */}
        <nav
          className={`fixed top-0 z-50 w-full transition-all duration-300 ${
            navScrolled
              ? "border-b border-white/10 bg-[#0a0a1a]/80 backdrop-blur-xl"
              : "bg-transparent"
          }`}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              GRIMY
            </span>
            <div className="hidden items-center gap-8 md:flex">
              <button onClick={scrollToSection("fonctionnalites")} className="text-sm text-gray-400 hover:text-white transition-colors">
                Fonctionnalités
              </button>
              <button onClick={scrollToSection("tarifs")} className="text-sm text-gray-400 hover:text-white transition-colors">
                Tarifs
              </button>
              <button onClick={scrollToSection("temoignages")} className="text-sm text-gray-400 hover:text-white transition-colors">
                À propos
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  Se connecter
                </Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20">
                  Démarrer
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── 2. Hero ─── */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          <div className="hero-glow absolute inset-0" />
          {/* Geometric blurred shapes */}
          <div className="absolute top-20 left-[10%] h-72 w-72 rounded-full bg-blue-600/8 blur-3xl" />
          <div className="absolute bottom-20 right-[10%] h-96 w-96 rounded-full bg-indigo-600/6 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-500/5 blur-3xl" />

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div
              data-reveal
              className="opacity-0 translate-y-10 transition-all duration-1000"
            >
              <Badge className="mb-8 border-blue-500/20 bg-blue-500/10 text-blue-400 px-4 py-1.5 text-sm">
                Plateforme LCB-FT nouvelle génération
              </Badge>
            </div>

            <h1
              data-reveal
              className="mb-8 text-4xl font-bold leading-[1.15] tracking-tight opacity-0 translate-y-10 transition-all duration-1000 delay-100 sm:text-5xl md:text-[56px]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              La conformité LCB-FT
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                n'a jamais été aussi simple
              </span>
            </h1>

            <p
              data-reveal
              className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400 opacity-0 translate-y-10 transition-all duration-1000 delay-200 sm:text-xl"
            >
              Automatisez votre dispositif anti-blanchiment. Screening intelligent,
              documents INPI, lettre de mission.
              <br className="hidden sm:block" />
              <span className="text-gray-500">Conçu par un expert-comptable, pour les experts-comptables.</span>
            </p>

            <div
              data-reveal
              className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 translate-y-10 transition-all duration-1000 delay-300"
            >
              <Link to="/auth">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25"
                >
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base border-white/20 text-gray-300 hover:bg-white/5 hover:border-white/30"
              >
                Voir la démo
              </Button>
            </div>

            <p
              data-reveal
              className="mt-6 text-sm text-gray-600 opacity-0 translate-y-10 transition-all duration-1000 delay-500"
            >
              Aucune carte bancaire requise — 14 jours d'essai gratuit
            </p>
          </div>
        </section>

        {/* ─── 3. Social Proof ─── */}
        <section className="border-y border-white/5 py-8">
          <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <p className="text-sm text-gray-500">Conforme aux normes NPLAB, NPMQ et ISQM 1</p>
            <div className="flex items-center gap-8">
              {["Ordre des Experts-Comptables", "CNCC", "TRACFIN"].map((name) => (
                <span key={name} className="text-xs font-medium text-gray-600 uppercase tracking-wider opacity-50">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 4. Pourquoi GRIMY ─── */}
        <section id="fonctionnalites" className="py-28">
          <div className="mx-auto max-w-7xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Tout ce dont votre cabinet a besoin
            </h2>
            <p
              data-reveal
              className="mx-auto mb-16 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Une plateforme unique pour piloter votre conformité LCB-FT de bout en bout.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {whyCards.map((c, i) => (
                <div
                  key={c.title}
                  data-reveal
                  className="card-hover rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm opacity-0 translate-y-10 transition-[opacity,transform] duration-700"
                  style={{ transitionDelay: `${i * 100 + 100}ms` }}
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10">
                    <c.icon className="h-7 w-7 text-blue-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Count-up stats */}
            <div
              data-reveal
              className="mt-16 flex flex-wrap items-center justify-center gap-12 opacity-0 translate-y-10 transition-all duration-700 delay-500"
            >
              <div className="text-center">
                <span ref={apis.ref} className="text-4xl font-bold text-blue-400" style={{ fontFamily: "Georgia, serif" }}>
                  {apis.value}
                </span>
                <p className="mt-1 text-sm text-gray-500">APIs vérifiées</p>
              </div>
              <div className="text-center">
                <span ref={seconds.ref} className="text-4xl font-bold text-blue-400" style={{ fontFamily: "Georgia, serif" }}>
                  {seconds.value}s
                </span>
                <p className="mt-1 text-sm text-gray-500">par screening</p>
              </div>
              <div className="text-center">
                <span className="text-4xl font-bold text-blue-400" style={{ fontFamily: "Georgia, serif" }}>6</span>
                <p className="mt-1 text-sm text-gray-500">axes de scoring</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 5. Feature Showcase ─── */}
        <section className="border-y border-white/5 py-28">
          <div className="mx-auto max-w-6xl px-6 space-y-28">
            {featureShowcase.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className={`flex flex-col items-center gap-12 opacity-0 translate-y-10 transition-all duration-700 lg:flex-row ${
                  f.reverse ? "lg:flex-row-reverse" : ""
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Text */}
                <div className="flex-1 space-y-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <f.icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3
                    className="text-2xl font-bold sm:text-3xl"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-base leading-relaxed text-gray-400">{f.desc}</p>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    En savoir plus <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {/* Mock screenshot */}
                <div className="flex-1 w-full max-w-md">
                  <MockScreen {...f.mockup} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 6. Comparaison ─── */}
        <section className="py-28">
          <div className="mx-auto max-w-5xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              GRIMY vs les alternatives
            </h2>
            <p
              data-reveal
              className="mx-auto mb-14 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Comparez et choisissez la solution la plus complète pour votre cabinet.
            </p>

            <div
              data-reveal
              className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700 delay-200"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-5 text-left text-sm font-medium text-gray-500">Fonctionnalité</th>
                    <th className="px-6 py-5 text-center">
                      <span className="text-sm font-bold text-emerald-400">GRIMY</span>
                    </th>
                    <th className="px-6 py-5 text-center text-sm font-medium text-gray-500">Kanta</th>
                    <th className="px-6 py-5 text-center text-sm font-medium text-gray-500">Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-6 py-4 text-gray-300">{row.label}</td>
                      <td className="px-6 py-4 text-center">
                        <CompCell value={row.grimy} accent />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CompCell value={row.kanta} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CompCell value={row.excel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── 7. Tarifs ─── */}
        <section id="tarifs" className="border-y border-white/5 py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Tarifs
            </h2>
            <p
              data-reveal
              className="mx-auto mb-10 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Des plans adaptés à chaque taille de cabinet. Sans engagement.
            </p>

            {/* Toggle mensuel / annuel */}
            <div
              data-reveal
              className="mb-14 flex items-center justify-center gap-3 opacity-0 translate-y-10 transition-all duration-700 delay-200"
            >
              <span className={`text-sm ${!annual ? "text-white" : "text-gray-500"}`}>Mensuel</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  annual ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                    annual ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className={`text-sm ${annual ? "text-white" : "text-gray-500"}`}>
                Annuel
                <Badge className="ml-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                  -20%
                </Badge>
              </span>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {plans.map((plan, i) => {
                const displayPrice = plan.price === 0
                  ? null
                  : annual
                    ? Math.round(plan.price * 0.8)
                    : plan.price;

                return (
                  <div
                    key={plan.name}
                    data-reveal
                    className={`card-hover relative rounded-2xl border bg-white/5 backdrop-blur-sm p-8 opacity-0 translate-y-10 transition-[opacity,transform] duration-700 ${
                      plan.popular
                        ? "border-blue-500/40 ring-1 ring-blue-500/20"
                        : "border-white/10"
                    }`}
                    style={{ transitionDelay: `${i * 120 + 200}ms` }}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white border-0 px-3">Populaire</Badge>
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">{plan.desc}</p>
                    </div>

                    <div className="mb-8">
                      {displayPrice !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-5xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>
                            {displayPrice}€
                          </span>
                          <span className="text-gray-500">/mois</span>
                        </div>
                      ) : (
                        <span className="text-3xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>
                          Sur devis
                        </span>
                      )}
                    </div>

                    <ul className="mb-8 space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                          <Check className="h-4 w-4 shrink-0 text-blue-400" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link to="/auth" className="block">
                      <Button
                        className={`w-full h-11 ${
                          plan.popular
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-600/20"
                            : "bg-white/10 text-white hover:bg-white/15"
                        }`}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── 8. Témoignages ─── */}
        <section id="temoignages" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Ce qu'en disent nos utilisateurs
            </h2>
            <p
              data-reveal
              className="mx-auto mb-14 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Des cabinets de toutes tailles nous font confiance.
            </p>

            <div className="grid gap-8 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <div
                  key={t.name}
                  data-reveal
                  className="card-hover rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm opacity-0 translate-y-10 transition-[opacity,transform] duration-700"
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <Quote className="mb-4 h-8 w-8 text-blue-500/30" />
                  <p className="mb-6 text-base leading-relaxed text-gray-300 italic">
                    "{t.quote}"
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-sm text-gray-500">
                      {t.title} — {t.cabinet}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 9. CTA Final ─── */}
        <section className="py-28">
          <div
            data-reveal
            className="mx-auto max-w-5xl px-6 opacity-0 translate-y-10 transition-all duration-700"
          >
            <div className="rounded-3xl bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-indigo-600/20 border border-blue-500/20 p-12 sm:p-16 text-center">
              <h2
                className="mb-4 text-3xl font-bold sm:text-4xl"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Prêt à automatiser votre conformité ?
              </h2>
              <p className="mx-auto mb-8 max-w-lg text-lg text-gray-400">
                Rejoignez les cabinets qui ont choisi l'efficacité.
              </p>
              <Link to="/auth">
                <Button
                  size="lg"
                  className="h-13 px-10 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25"
                >
                  Démarrer gratuitement — 14 jours d'essai
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── 10. Footer ─── */}
        <footer className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              {/* Brand */}
              <div className="lg:col-span-1">
                <span className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>
                  GRIMY
                </span>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  Conformité LCB-FT
                  <br />
                  pour experts-comptables
                </p>
              </div>
              {/* Link columns */}
              {Object.entries(footerLinks).map(([title, links]) => (
                <div key={title}>
                  <h4 className="mb-4 text-sm font-semibold text-gray-400">{title}</h4>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link}>
                        <a href="#" className="text-sm text-gray-600 hover:text-white transition-colors">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
              <p className="text-xs text-gray-600">
                &copy; 2026 GRIMY — Conformité LCB-FT pour experts-comptables
              </p>
              <div className="flex gap-6">
                {["LinkedIn", "Twitter"].map((s) => (
                  <a key={s} href="#" className="text-xs text-gray-600 hover:text-white transition-colors">
                    {s}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
