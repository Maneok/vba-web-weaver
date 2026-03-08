import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Zap, FileText, BarChart3, CheckCircle2, X,
  Users, ClipboardCheck, FolderOpen, Activity, BookOpen,
  ScrollText, Compass, Lock, ArrowRight
} from "lucide-react";

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
            entry.target.classList.remove("opacity-0", "translate-y-8");
          }
        });
      },
      { threshold: 0.1 }
    );
    const children = el.querySelectorAll("[data-reveal]");
    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

const whyCards = [
  { icon: Shield, title: "Conformité NPLAB/NPMQ", desc: "Respectez les normes sans effort" },
  { icon: Zap, title: "Screening automatique", desc: "9 APIs vérifiées en 30 secondes" },
  { icon: FileText, title: "Documents INPI", desc: "Statuts, Kbis, comptes annuels récupérés automatiquement" },
  { icon: BarChart3, title: "Scoring 6 axes", desc: "Évaluation du risque client objective et traçable" },
];

const features = [
  { icon: Users, title: "Parcours client 6 étapes" },
  { icon: ScrollText, title: "Lettre de mission auto" },
  { icon: Activity, title: "Dashboard cockpit" },
  { icon: BookOpen, title: "Registre LCB" },
  { icon: ClipboardCheck, title: "Contrôle qualité" },
  { icon: FolderOpen, title: "GED documentaire" },
  { icon: Compass, title: "Diagnostic 360°" },
  { icon: Lock, title: "Gouvernance équipe" },
  { icon: Shield, title: "Journal d'audit" },
];

const plans = [
  {
    name: "Solo",
    price: "29",
    desc: "Pour les indépendants",
    features: ["1 utilisateur", "50 clients", "Screening automatique", "Documents INPI", "Support email"],
    cta: "Commencer",
    popular: false,
  },
  {
    name: "Cabinet",
    price: "79",
    desc: "Pour les cabinets en croissance",
    features: ["5 utilisateurs", "200 clients", "Scoring 6 axes", "Lettre de mission auto", "Support prioritaire"],
    cta: "Commencer",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    desc: "Pour les grands cabinets",
    features: ["Utilisateurs illimités", "Clients illimités", "Multi-cabinet", "API dédiée", "Account manager"],
    cta: "Nous contacter",
    popular: false,
  },
];

type CompRow = { label: string; grimy: boolean; kanta: boolean; excel: boolean };
const comparison: CompRow[] = [
  { label: "Screening auto", grimy: true, kanta: true, excel: false },
  { label: "Documents INPI", grimy: true, kanta: false, excel: false },
  { label: "Scoring intelligent", grimy: true, kanta: false, excel: false },
  { label: "Lettre de mission", grimy: true, kanta: false, excel: false },
  { label: "Multi-cabinet", grimy: true, kanta: true, excel: false },
  { label: "Prix accessible", grimy: true, kanta: false, excel: true },
];

export default function LandingPage() {
  const revealRef = useScrollReveal();

  return (
    <div ref={revealRef} className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight">GRIMY</span>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                Connexion
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-blue-600 hover:bg-blue-700">Démarrer gratuitement</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 via-gray-950 to-gray-950" />
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-32 text-center">
          <Badge className="mb-6 border-blue-500/30 bg-blue-500/10 text-blue-400">
            Plateforme LCB-FT nouvelle génération
          </Badge>
          <h1
            data-reveal
            className="mb-6 text-5xl font-bold leading-tight tracking-tight opacity-0 translate-y-8 transition-all duration-700 md:text-6xl"
          >
            GRIMY — Conformité LCB-FT
            <br />
            <span className="text-blue-400">pour experts-comptables</span>
          </h1>
          <p
            data-reveal
            className="mb-10 max-w-2xl text-lg text-gray-400 opacity-0 translate-y-8 transition-all duration-700 delay-200"
          >
            Automatisez votre dispositif anti-blanchiment. Scoring intelligent,
            documents INPI, lettre de mission.
          </p>
          <div
            data-reveal
            className="flex flex-wrap items-center justify-center gap-4 opacity-0 translate-y-8 transition-all duration-700 delay-300"
          >
            <Link to="/auth">
              <Button size="lg" className="bg-blue-600 px-8 text-base hover:bg-blue-700">
                Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-gray-700 px-8 text-base text-gray-300 hover:bg-gray-800">
              Voir la démo
            </Button>
          </div>
        </div>
      </section>

      {/* Pourquoi GRIMY */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2
          data-reveal
          className="mb-4 text-center text-3xl font-bold opacity-0 translate-y-8 transition-all duration-700"
        >
          Pourquoi GRIMY
        </h2>
        <p
          data-reveal
          className="mx-auto mb-12 max-w-2xl text-center text-gray-400 opacity-0 translate-y-8 transition-all duration-700 delay-100"
        >
          Tout ce dont votre cabinet a besoin pour être conforme, en un seul outil.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyCards.map((c, i) => (
            <Card
              key={c.title}
              data-reveal
              className={`border-gray-800 bg-gray-900/50 opacity-0 translate-y-8 transition-all duration-700`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/10">
                  <c.icon className="h-6 w-6 text-blue-400" />
                </div>
                <CardTitle className="text-lg text-white">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="border-y border-gray-800 bg-gray-900/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2
            data-reveal
            className="mb-4 text-center text-3xl font-bold opacity-0 translate-y-8 transition-all duration-700"
          >
            Fonctionnalités
          </h2>
          <p
            data-reveal
            className="mx-auto mb-12 max-w-2xl text-center text-gray-400 opacity-0 translate-y-8 transition-all duration-700 delay-100"
          >
            Une suite complète pour piloter votre conformité de bout en bout.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 opacity-0 translate-y-8 transition-all duration-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10">
                  <f.icon className="h-5 w-5 text-blue-400" />
                </div>
                <span className="font-medium text-white">{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2
          data-reveal
          className="mb-4 text-center text-3xl font-bold opacity-0 translate-y-8 transition-all duration-700"
        >
          Tarifs
        </h2>
        <p
          data-reveal
          className="mx-auto mb-12 max-w-2xl text-center text-gray-400 opacity-0 translate-y-8 transition-all duration-700 delay-100"
        >
          Des plans adaptés à chaque taille de cabinet.
        </p>
        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Card
              key={plan.name}
              data-reveal
              className={`relative border-gray-800 bg-gray-900/50 opacity-0 translate-y-8 transition-all duration-700 ${
                plan.popular ? "border-blue-500/50 ring-1 ring-blue-500/20" : ""
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white">Populaire</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                <CardDescription className="text-gray-400">{plan.desc}</CardDescription>
                <div className="mt-4">
                  {plan.price === "Sur devis" ? (
                    <span className="text-3xl font-bold text-white">Sur devis</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-white">{plan.price}€</span>
                      <span className="text-gray-400">/mois</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link to="/auth" className="w-full">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparaison */}
      <section className="border-t border-gray-800 bg-gray-900/30 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2
            data-reveal
            className="mb-4 text-center text-3xl font-bold opacity-0 translate-y-8 transition-all duration-700"
          >
            GRIMY vs Alternatives
          </h2>
          <p
            data-reveal
            className="mx-auto mb-12 max-w-2xl text-center text-gray-400 opacity-0 translate-y-8 transition-all duration-700 delay-100"
          >
            Comparez et choisissez la solution la plus complète.
          </p>
          <div
            data-reveal
            className="overflow-hidden rounded-xl border border-gray-800 opacity-0 translate-y-8 transition-all duration-700 delay-200"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="px-6 py-4 text-left font-medium text-gray-400">Fonctionnalité</th>
                  <th className="px-6 py-4 text-center font-bold text-blue-400">GRIMY</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">KANTA</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">Excel</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.label} className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}>
                    <td className="px-6 py-3 text-gray-300">{row.label}</td>
                    <td className="px-6 py-3 text-center">
                      {row.grimy ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-green-400" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-600" />
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {row.kanta ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-gray-400" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-600" />
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {row.excel ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-gray-400" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="text-2xl font-bold">GRIMY</span>
            <p className="text-gray-400">
              Par des experts-comptables, pour des experts-comptables
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link to="/auth" className="hover:text-white transition-colors">Connexion</Link>
              <a href="#" className="hover:text-white transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} GRIMY. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
