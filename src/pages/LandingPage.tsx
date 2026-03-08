import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield, FileText, Calculator, FileCheck, Check, X, Minus,
  ArrowRight, BarChart3, ClipboardCheck,
  Search, Monitor, Quote, ChevronRight, Menu, X as XIcon,
  ChevronDown,
} from "lucide-react";

/* ═══════════════════════════════════════════
   #1 — Smooth scroll with navbar offset
   ═══════════════════════════════════════════ */
const NAV_HEIGHT = 80;

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top: y, behavior: "smooth" });
}

/* ═══════════════════════════════════════════
   Scroll reveal (sections fade-in)
   #8 — Hero uses mount animation, not IO
   ═══════════════════════════════════════════ */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // #10 — skip animations for reduced-motion users
      el.querySelectorAll("[data-reveal]").forEach((child) => {
        child.classList.add("opacity-100", "translate-y-0");
        child.classList.remove("opacity-0", "translate-y-10");
      });
      return;
    }
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
    el.querySelectorAll("[data-reveal]").forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ═══════════════════════════════════════════
   #8 — Hero mount animation (immediate)
   ═══════════════════════════════════════════ */
function useHeroReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return visible;
}

/* ═══════════════════════════════════════════
   Count-up animation
   ═══════════════════════════════════════════ */
function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) { setValue(target); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
            if (p < 1) requestAnimationFrame(step);
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

/* ═══════════════════════════════════════════
   #3 — Active section tracking in navbar
   ═══════════════════════════════════════════ */
const SECTIONS = ["fonctionnalites", "comparaison", "tarifs", "temoignages"] as const;

function useActiveSection() {
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: `-${NAV_HEIGHT}px 0px -60% 0px`, threshold: 0 }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

/* ═══════════════════════════════════════════
   Navbar scroll detection
   ═══════════════════════════════════════════ */
function useNavScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return scrolled;
}

/* ═══════════════════════════════════════════
   Data
   ═══════════════════════════════════════════ */
const NAV_LINKS = [
  { label: "Fonctionnalités", id: "fonctionnalites" },
  { label: "Tarifs", id: "tarifs" },
  { label: "À propos", id: "temoignages" },
] as const;

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
    mockup: "step",
    reverse: false,
  },
  {
    title: "Prêt pour le contrôle CROEC",
    desc: "Registre LCB-FT, journal d'audit, contrôle qualité — tout est documenté et traçable. Le contrôleur peut visualiser vos dossiers en autonomie.",
    icon: ClipboardCheck,
    mockup: "audit",
    reverse: true,
  },
  {
    title: "Dashboard de pilotage",
    desc: "Visualisez en un coup d'œil : clients actifs, alertes en cours, revues échues, score moyen. Diagnostic 360° avec recommandations.",
    icon: Monitor,
    mockup: "dashboard",
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
    initials: "MD",
    color: "bg-blue-500/20 text-blue-400",
  },
  {
    quote: "Le screening automatique nous fait gagner 2 heures par nouveau client.",
    name: "Sophie L.",
    title: "Collaboratrice",
    cabinet: "Cabinet 15 personnes",
    initials: "SL",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  {
    quote: "Enfin un outil conçu par quelqu'un qui comprend nos obligations.",
    name: "Thomas R.",
    title: "Associé",
    cabinet: "Cabinet parisien",
    initials: "TR",
    color: "bg-purple-500/20 text-purple-400",
  },
];

const faqItems = [
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Toutes les données sont hébergées en France (Supabase EU-West), chiffrées au repos (AES-256) et en transit (TLS 1.3). Les champs sensibles (IBAN, CNI) bénéficient d'un chiffrement applicatif AES-GCM supplémentaire. Nous sommes conformes au RGPD.",
  },
  {
    q: "Puis-je migrer depuis Excel ou un autre outil ?",
    a: "Oui. Importez vos clients existants via un fichier CSV. Les données INPI et le screening sont relancés automatiquement pour enrichir chaque fiche.",
  },
  {
    q: "Y a-t-il un engagement de durée ?",
    a: "Aucun engagement. Vous pouvez résilier à tout moment depuis vos paramètres. Vos données restent exportables pendant 30 jours après résiliation.",
  },
  {
    q: "GRIMY est-il conforme au RGPD ?",
    a: "Oui. Hébergement en France, DPO désigné, registre de traitements, droit d'accès/suppression/portabilité, et chiffrement bout en bout des données sensibles.",
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "14 jours d'essai complet, aucune carte bancaire requise. Vous avez accès à toutes les fonctionnalités du plan Cabinet. À la fin de l'essai, choisissez votre plan ou exportez vos données.",
  },
  {
    q: "Le logiciel convient-il à un petit cabinet ?",
    a: "Absolument. Le plan Solo à 29€/mois couvre 50 clients, largement suffisant pour un indépendant. L'interface est conçue pour être utilisable sans formation.",
  },
];

const footerLinks = {
  Produit: ["Fonctionnalités", "Tarifs", "Démo", "Changelog"],
  Ressources: ["Documentation", "Blog", "Guide LCB-FT", "FAQ"],
  Entreprise: ["À propos", "Contact", "CGV", "Mentions légales"],
  Conformité: ["NPLAB", "NPMQ", "RGPD", "Hébergement France"],
};

/* ═══════════════════════════════════════════
   Comparison cell renderer
   ═══════════════════════════════════════════ */
function CompCell({ value, accent }: { value: CompValue; accent?: boolean }) {
  if (value === "yes")
    return <Check className={`mx-auto h-5 w-5 ${accent ? "text-emerald-400" : "text-gray-400"}`} />;
  if (value === "no") return <X className="mx-auto h-5 w-5 text-red-400/60" />;
  if (value === "partial") return <Minus className="mx-auto h-5 w-5 text-yellow-400/70" />;
  return <span className={`text-sm ${accent ? "text-emerald-400 font-semibold" : "text-gray-400"}`}>{value}</span>;
}

/* ═══════════════════════════════════════════
   #7 — Rich mock screenshots (not just text)
   ═══════════════════════════════════════════ */
function MockStepScreen() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
      <div className="rounded-xl bg-[#0d0d24] p-5">
        {/* Window chrome */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-gray-600">Nouveau client — Étape 1/6</span>
        </div>
        {/* Progress bar */}
        <div className="mb-5 h-1.5 rounded-full bg-white/5">
          <div className="h-1.5 w-1/6 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
        </div>
        {/* Fields */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5">
            <span className="text-[11px] text-gray-500 w-20 shrink-0">SIREN</span>
            <span className="text-sm text-white font-mono">123 456 789</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5">
            <span className="text-[11px] text-gray-500 w-20 shrink-0">Société</span>
            <span className="text-sm text-gray-300">SAS Exemple & Associés</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5">
            <span className="text-[11px] text-gray-500 w-20 shrink-0">Activité</span>
            <span className="text-sm text-gray-300">6920Z — Comptabilité</span>
          </div>
        </div>
        {/* Screening status */}
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-blue-500/10 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm text-blue-400">Screening en cours... 7/9 APIs</span>
          <div className="ml-auto flex gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-1.5 w-3 rounded-full ${i < 7 ? "bg-blue-400" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockAuditScreen() {
  const rows = [
    { label: "Dossiers conformes", val: "47/50", pct: 94, color: "bg-emerald-400" },
    { label: "Alertes résolues", val: "12/12", pct: 100, color: "bg-emerald-400" },
    { label: "Revues à jour", val: "45/50", pct: 90, color: "bg-blue-400" },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
      <div className="rounded-xl bg-[#0d0d24] p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-gray-600">Contrôle qualité</span>
        </div>
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-400">{r.label}</span>
                <span className="text-sm font-semibold text-white">{r.val}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div className={`h-2 rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-center">
          <span className="text-2xl font-bold text-emerald-400 font-serif">94%</span>
          <span className="ml-2 text-sm text-emerald-400/70">Score global</span>
        </div>
      </div>
    </div>
  );
}

function MockDashboardScreen() {
  const bars = [65, 82, 45, 90, 70, 55, 78];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
      <div className="rounded-xl bg-[#0d0d24] p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-gray-600">Dashboard — Vue d'ensemble</span>
        </div>
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Clients", val: "142", color: "text-blue-400" },
            { label: "Alertes", val: "3", color: "text-yellow-400" },
            { label: "Échues", val: "2", color: "text-red-400" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg bg-white/5 px-3 py-2.5 text-center">
              <div className={`text-xl font-bold ${k.color} font-serif`}>{k.val}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
        {/* Mini bar chart */}
        <div className="flex items-end gap-1.5 h-20">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-blue-600/60 to-blue-400/80"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-blue-500/10 px-4 py-2 text-center text-sm text-blue-400 font-medium">
          Score moyen : 72/100
        </div>
      </div>
    </div>
  );
}

const MOCK_COMPONENTS: Record<string, () => JSX.Element> = {
  step: MockStepScreen,
  audit: MockAuditScreen,
  dashboard: MockDashboardScreen,
};

/* ═══════════════════════════════════════════
   #20 — Responsive comparison card (mobile)
   ═══════════════════════════════════════════ */
function ComparisonMobileCard({ row }: { row: CompRow }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <p className="text-sm font-medium text-white">{row.label}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["grimy", "kanta", "excel"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <span className={`text-[10px] uppercase tracking-wider ${key === "grimy" ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
              {key === "grimy" ? "GRIMY" : key === "kanta" ? "Kanta" : "Excel"}
            </span>
            <div><CompCell value={row[key]} accent={key === "grimy"} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  const revealRef = useScrollReveal();
  const navScrolled = useNavScroll();
  const activeSection = useActiveSection();
  const heroVisible = useHeroReveal();
  const [annual, setAnnual] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");

  const apis = useCountUp(9, 1500);
  const seconds = useCountUp(30, 2000);
  const cabinets = useCountUp(142, 2200);

  const handleNavClick = useCallback((id: string) => {
    scrollTo(id);
    setMobileMenu(false);
  }, []);

  return (
    <div ref={revealRef} className="min-h-screen text-white font-sans">
      {/* ─── Global styles ─── */}
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
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .card-hover:hover {
          transform: scale(1.02);
          box-shadow: 0 20px 60px -15px rgba(59, 130, 246, 0.15);
        }
        /* #9 — Button press micro-interaction */
        .btn-press:active {
          transform: scale(0.97);
        }
        /* #9 — Table row hover */
        .table-row-hover:hover {
          background: rgba(255,255,255,0.04);
        }
        /* #10 — Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .landing-bg { animation: none; }
          .card-hover:hover { transform: none; }
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="landing-bg">

        {/* ═══ 1. NAVBAR ═══ */}
        <nav
          className={`fixed top-0 z-50 w-full transition-all duration-300 ${
            navScrolled
              ? "border-b border-white/10 bg-[#0a0a1a]/80 backdrop-blur-xl shadow-lg shadow-black/20"
              : "bg-transparent"
          }`}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            {/* Logo */}
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-xl font-bold tracking-tight font-serif">
              GRIMY
            </button>

            {/* #3 — Desktop links with active state */}
            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleNavClick(l.id)}
                  className={`text-sm transition-colors relative py-1 ${
                    activeSection === l.id
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {l.label}
                  {activeSection === l.id && (
                    <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Right buttons */}
            <div className="flex items-center gap-3">
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button variant="ghost" className="text-gray-400 hover:text-white btn-press">
                  Se connecter
                </Button>
              </Link>
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 btn-press">
                  Démarrer
                </Button>
              </Link>

              {/* #2 — Mobile hamburger */}
              <button
                className="md:hidden p-2 text-gray-400 hover:text-white"
                onClick={() => setMobileMenu(!mobileMenu)}
                aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {mobileMenu ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* #2 — Mobile menu panel */}
          {mobileMenu && (
            <div className="md:hidden border-t border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl px-6 py-4 space-y-1">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleNavClick(l.id)}
                  className="block w-full text-left py-3 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-3 border-t border-white/10 flex gap-3">
                <Link to="/auth" className="flex-1">
                  <Button variant="outline" className="w-full border-white/20 text-gray-300">
                    Se connecter
                  </Button>
                </Link>
                <Link to="/auth" className="flex-1">
                  <Button className="w-full bg-blue-600">Démarrer</Button>
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ═══ 2. HERO ═══ */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          <div className="hero-glow absolute inset-0" />
          <div className="absolute top-20 left-[10%] h-72 w-72 rounded-full bg-blue-600/8 blur-3xl" />
          <div className="absolute bottom-20 right-[10%] h-96 w-96 rounded-full bg-indigo-600/6 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-500/5 blur-3xl" />

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            {/* #8 — Mount-based sequential fade-in */}
            <div className={`transition-all duration-1000 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Badge className="mb-8 border-blue-500/20 bg-blue-500/10 text-blue-400 px-4 py-1.5 text-sm">
                Plateforme LCB-FT nouvelle génération
              </Badge>
            </div>

            <h1
              className={`mb-8 font-serif text-4xl font-bold leading-[1.1] tracking-tight transition-all duration-1000 delay-150 sm:text-5xl md:text-[56px] ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              La conformité LCB-FT
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                n'a jamais été aussi simple
              </span>
            </h1>

            <p
              className={`mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400 transition-all duration-1000 delay-300 sm:text-xl ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              Automatisez votre dispositif anti-blanchiment. Screening intelligent,
              documents INPI, lettre de mission.
              <br className="hidden sm:block" />
              <span className="text-gray-500">Conçu par un expert-comptable, pour les experts-comptables.</span>
            </p>

            <div
              className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <Link to="/auth">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25 btn-press"
                >
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              {/* #4 — "Voir la démo" scrolls to feature showcase */}
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base border-white/20 text-gray-300 hover:bg-white/5 hover:border-white/30 btn-press"
                onClick={() => scrollTo("showcase")}
              >
                Voir la démo
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <p
              className={`mt-6 text-sm text-gray-600 transition-all duration-1000 delay-700 ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              Aucune carte bancaire requise — 14 jours d'essai gratuit
            </p>
          </div>
        </section>

        {/* ═══ 3. SOCIAL PROOF ═══ */}
        <section className="border-y border-white/5 py-8">
          <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <p className="text-sm text-gray-500">Conforme aux normes NPLAB, NPMQ et ISQM 1</p>
            <div className="flex items-center gap-8">
              {["Ordre des Experts-Comptables", "CNCC", "TRACFIN"].map((name) => (
                <span key={name} className="text-[10px] font-medium text-gray-600 uppercase tracking-widest opacity-50">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 4. POURQUOI GRIMY + #12 trust metrics ═══ */}
        <section id="fonctionnalites" className="py-28">
          <div className="mx-auto max-w-7xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
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
                  <h3 className="mb-3 text-lg font-bold text-white">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* #12 — Trust metrics with count-up */}
            <div
              data-reveal
              className="mt-20 grid grid-cols-2 gap-8 sm:grid-cols-4 opacity-0 translate-y-10 transition-all duration-700 delay-500"
            >
              <div className="text-center">
                <span ref={apis.ref} className="text-4xl font-bold text-blue-400 font-serif">
                  {apis.value}
                </span>
                <p className="mt-1.5 text-sm text-gray-500">APIs vérifiées</p>
              </div>
              <div className="text-center">
                <span ref={seconds.ref} className="text-4xl font-bold text-blue-400 font-serif">
                  {seconds.value}s
                </span>
                <p className="mt-1.5 text-sm text-gray-500">par screening</p>
              </div>
              <div className="text-center">
                <span ref={cabinets.ref} className="text-4xl font-bold text-blue-400 font-serif">
                  {cabinets.value}
                </span>
                <p className="mt-1.5 text-sm text-gray-500">cabinets utilisateurs</p>
              </div>
              <div className="text-center">
                <span className="text-4xl font-bold text-emerald-400 font-serif">0</span>
                <p className="mt-1.5 text-sm text-gray-500">observations au contrôle</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 5. FEATURE SHOWCASE ═══ */}
        <section id="showcase" className="border-y border-white/5 py-28">
          <div className="mx-auto max-w-6xl px-6 space-y-28">
            {featureShowcase.map((f, i) => {
              const MockComp = MOCK_COMPONENTS[f.mockup];
              return (
                <div
                  key={f.title}
                  data-reveal
                  className={`flex flex-col items-center gap-12 opacity-0 translate-y-10 transition-all duration-700 lg:flex-row ${
                    f.reverse ? "lg:flex-row-reverse" : ""
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="flex-1 space-y-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <f.icon className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className="font-serif text-2xl font-bold sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="text-base leading-relaxed text-gray-400 max-w-lg">{f.desc}</p>
                    <Link
                      to="/auth"
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      En savoir plus <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="flex-1 w-full max-w-md">
                    <MockComp />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ 6. COMPARAISON ═══ */}
        <section id="comparaison" className="py-28">
          <div className="mx-auto max-w-5xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
            >
              GRIMY vs les alternatives
            </h2>
            <p
              data-reveal
              className="mx-auto mb-14 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Comparez et choisissez la solution la plus complète pour votre cabinet.
            </p>

            {/* Desktop table */}
            <div
              data-reveal
              className="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700 delay-200"
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
                      className={`border-b border-white/5 table-row-hover transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
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

            {/* #20 — Mobile cards */}
            <div
              data-reveal
              className="md:hidden space-y-3 opacity-0 translate-y-10 transition-all duration-700 delay-200"
            >
              {comparison.map((row) => (
                <ComparisonMobileCard key={row.label} row={row} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 7. TARIFS ═══ */}
        <section id="tarifs" className="border-y border-white/5 py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
            >
              Tarifs transparents
            </h2>
            <p
              data-reveal
              className="mx-auto mb-10 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Des plans adaptés à chaque taille de cabinet. Sans engagement.
            </p>

            {/* #5 — Accessible toggle */}
            <div
              data-reveal
              className="mb-14 flex items-center justify-center gap-3 opacity-0 translate-y-10 transition-all duration-700 delay-200"
            >
              <span className={`text-sm transition-colors ${!annual ? "text-white font-medium" : "text-gray-500"}`}>Mensuel</span>
              <button
                role="switch"
                aria-checked={annual}
                aria-label="Basculer entre tarification mensuelle et annuelle"
                tabIndex={0}
                onClick={() => setAnnual(!annual)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAnnual(!annual); } }}
                className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a1a] ${
                  annual ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    annual ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className={`text-sm transition-colors ${annual ? "text-white font-medium" : "text-gray-500"}`}>
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
                          <span className="text-5xl font-bold text-white font-serif">
                            {displayPrice}€
                          </span>
                          <span className="text-gray-500">/mois</span>
                        </div>
                      ) : (
                        <span className="text-3xl font-bold text-white font-serif">
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
                        className={`w-full h-11 btn-press ${
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

        {/* ═══ 8. TÉMOIGNAGES ═══ */}
        <section id="temoignages" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
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
                    &laquo; {t.quote} &raquo;
                  </p>
                  {/* #13 — Avatar with initials */}
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.title} — {t.cabinet}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ #14 — FAQ ═══ */}
        <section className="border-t border-white/5 py-28">
          <div className="mx-auto max-w-3xl px-6">
            <h2
              data-reveal
              className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl"
            >
              Questions fréquentes
            </h2>
            <p
              data-reveal
              className="mx-auto mb-14 max-w-xl text-center text-gray-400 opacity-0 translate-y-10 transition-all duration-700 delay-100"
            >
              Tout ce que vous devez savoir avant de commencer.
            </p>

            <div data-reveal className="opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-6 backdrop-blur-sm overflow-hidden"
                  >
                    <AccordionTrigger className="text-sm font-medium text-white hover:text-blue-400 transition-colors py-5 [&[data-state=open]>svg]:rotate-180">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-gray-400 pb-5">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* ═══ 9. CTA FINAL — #15 email input ═══ */}
        <section className="py-28">
          <div
            data-reveal
            className="mx-auto max-w-5xl px-6 opacity-0 translate-y-10 transition-all duration-700"
          >
            <div className="rounded-3xl bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-indigo-600/20 border border-blue-500/20 p-12 sm:p-16 text-center">
              <h2 className="mb-4 font-serif text-3xl font-bold sm:text-4xl">
                Prêt à automatiser votre conformité ?
              </h2>
              <p className="mx-auto mb-8 max-w-lg text-lg text-gray-400">
                Rejoignez les cabinets qui ont choisi l'efficacité.
              </p>

              {/* #15 — Email inline CTA */}
              <form
                onSubmit={(e) => { e.preventDefault(); window.location.href = "/auth"; }}
                className="mx-auto flex max-w-md flex-col sm:flex-row items-stretch gap-3"
              >
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={ctaEmail}
                  onChange={(e) => setCtaEmail(e.target.value)}
                  className="flex-1 h-12 rounded-lg border border-white/20 bg-white/5 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 backdrop-blur-sm"
                />
                <Button
                  type="submit"
                  className="h-12 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25 btn-press whitespace-nowrap"
                >
                  Démarrer — 14 jours gratuits
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <p className="mt-4 text-xs text-gray-600">Aucune carte bancaire requise</p>
            </div>
          </div>
        </section>

        {/* ═══ 10. FOOTER ═══ */}
        <footer className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-1">
                <span className="text-lg font-bold font-serif">GRIMY</span>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  Conformité LCB-FT
                  <br />
                  pour experts-comptables
                </p>
              </div>
              {Object.entries(footerLinks).map(([title, links]) => (
                <div key={title}>
                  <h4 className="mb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h4>
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
