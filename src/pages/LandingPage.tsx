/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE « SCREENING SIREN »
   Version de référence avec :
   - InteractiveDemo (test SIREN 831 562 749 + 9 APIs)
   - RadarChart (graphique radar 6 axes)
   - VideoPlayer (section vidéo de démo)
   - Comparaison GRIMY vs Excel
   - Timeline 6 étapes avec scroll progress
   - Témoignages, FAQ, Pricing, Footer légal
   NE PAS REMPLACER — améliorer en place uniquement.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Shield, FileText, Calculator, FileCheck, Check, X, Minus,
  ArrowRight, ClipboardCheck, Search, Monitor, Quote,
  ChevronRight, Menu, X as XIcon, ChevronDown, Sun, Moon,
  Lock, HelpCircle, CreditCard, Database, Globe, Users,
  Sparkles, Play, Zap, Cookie, BarChart3, TrendingUp, Award,
  Star, ArrowUp, Clock, AlertTriangle, FileX, Linkedin,
  Twitter, CalendarClock, SlidersHorizontal, Cpu, Eye,
  MessageCircle, Landmark, Scale, Building2, Gavel,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   #6 — Dark mode persistence via localStorage
   ══════════════════════════════════════════════════════════════ */
function usePersistedTheme() {
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("grimy-theme") === "light"; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setLight((prev) => {
      const next = !prev;
      try { localStorage.setItem("grimy-theme", next ? "light" : "dark"); } catch { /* noop */ }
      return next;
    });
  }, []);
  return { light, toggle };
}

/* ══════════════════════════════════════════════════════════════
   #18 — Cookie consent banner (RGPD)
   ══════════════════════════════════════════════════════════════ */
function useCookieConsent() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem("grimy-cookies"); } catch { return true; }
  });
  const accept = useCallback(() => {
    try { localStorage.setItem("grimy-cookies", "accepted"); } catch { /* noop */ }
    setShow(false);
  }, []);
  const reject = useCallback(() => {
    try { localStorage.setItem("grimy-cookies", "rejected"); } catch { /* noop */ }
    setShow(false);
  }, []);
  return { show, accept, reject };
}

/* ══════════════════════════════════════════════════════════════
   HOOKS
   ══════════════════════════════════════════════════════════════ */

const NAV_HEIGHT = 80;
const REDUCED_MOTION = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED_MOTION()) {
      el.querySelectorAll("[data-reveal]").forEach((c) => {
        c.classList.add("opacity-100", "translate-y-0");
        c.classList.remove("opacity-0", "translate-y-10");
      });
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("opacity-100", "translate-y-0");
          e.target.classList.remove("opacity-0", "translate-y-10");
        }
      }),
      { threshold: 0.08 }
    );
    el.querySelectorAll("[data-reveal]").forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);
  return ref;
}

function useHeroReveal() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return v;
}

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED_MOTION()) { setValue(target); return; }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const step = (now: number) => {
            const p = Math.min((now - t0) / duration, 1);
            setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { ref, value };
}

function useNavScroll() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const h = () => setS(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return s;
}

const SECTIONS = ["fonctionnalites", "demo", "timeline", "comparaison", "tarifs", "temoignages", "faq", "securite", "douleur", "roi"] as const;

function useActiveSection() {
  const [active, setActive] = useState("");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: `-${NAV_HEIGHT}px 0px -60% 0px`, threshold: 0 }
    );
    SECTIONS.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return active;
}

/* #4 — Sticky CTA: detect hero out of view */
function useHeroInView() {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = document.getElementById("hero");
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return inView;
}

/* #15 — Timeline scroll progress */
function useTimelineProgress() {
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight * 0.6;
      if (total <= 0) return;
      const scrolled = -rect.top + window.innerHeight * 0.3;
      setProgress(Math.min(Math.max(scrolled / total, 0), 1));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return { ref, progress };
}

/* ══════════════════════════════════════════════════════════════
   #50 — Scroll progress bar (top of page)
   ══════════════════════════════════════════════════════════════ */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const h = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return progress;
}

/* ══════════════════════════════════════════════════════════════
   SVG LOGOS — Ordres professionnels
   ══════════════════════════════════════════════════════════════ */

function LogoOEC() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="Ordre des Experts-Comptables">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
        <svg viewBox="0 0 40 40" className="h-7 w-7" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6" />
          <path d="M20 6 L20 34 M12 10 Q20 18 28 10 M12 30 Q20 22 28 30" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="20" cy="20" r="4" fill="#3B82F6" opacity="0.3" />
        </svg>
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">OEC</span>
    </div>
  );
}

function LogoCNCC() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="Compagnie Nationale des Commissaires aux Comptes">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
        <Scale className="h-6 w-6 text-indigo-400" />
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">CNCC</span>
    </div>
  );
}

function LogoCSN() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="Conseil Supérieur du Notariat">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
        <Gavel className="h-6 w-6 text-amber-400" />
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">CSN</span>
    </div>
  );
}

function LogoCNB() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="Conseil National des Barreaux">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
        <Landmark className="h-6 w-6 text-purple-400" />
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">CNB</span>
    </div>
  );
}

function LogoTRACFIN() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="TRACFIN — Cellule de renseignement financier">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
        <Shield className="h-6 w-6 text-red-400" />
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">TRACFIN</span>
    </div>
  );
}

function LogoDGCCRF() {
  return (
    <div className="flex flex-col items-center gap-1.5 group" title="DGCCRF — Direction générale de la concurrence">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
        <Building2 className="h-6 w-6 text-emerald-400" />
      </div>
      <span className="text-[9px] font-medium tracking-wide text-[--l-text-5] group-hover:text-[--l-text-3] transition-colors">DGCCRF</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   #21 — Profile switcher (adapts hero content)
   ══════════════════════════════════════════════════════════════ */
const PROFILES = [
  { id: "ec", label: "Expert-comptable", icon: Calculator, authority: "Ordre des EC / H2A", color: "text-blue-400" },
  { id: "cac", label: "Commissaire aux comptes", icon: Scale, authority: "H3C / CNCC", color: "text-indigo-400" },
  { id: "avocat", label: "Avocat", icon: Landmark, authority: "Ordre des avocats / CNB", color: "text-purple-400" },
  { id: "notaire", label: "Notaire", icon: Gavel, authority: "Chambre des notaires", color: "text-amber-400" },
  { id: "immo", label: "Agent immobilier", icon: Building2, authority: "DGCCRF", color: "text-emerald-400" },
] as const;

/* ══════════════════════════════════════════════════════════════
   Hero background illustrations per profession — very subtle SVGs
   ══════════════════════════════════════════════════════════════ */
function HeroBgIllustration({ profileId }: { profileId: string }) {
  const baseClass = "absolute inset-0 w-full h-full transition-opacity duration-1000 pointer-events-none";
  const s = "var(--l-hero-illus)";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Expert-comptable — spreadsheet grid + numbers */}
      <svg className={`${baseClass} ${profileId === "ec" ? "opacity-100" : "opacity-0"}`} viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
        {[200, 400, 600, 800, 1000].map(x => <line key={`v${x}`} x1={x} y1={80} x2={x} y2={720} stroke={s} strokeWidth="0.5" />)}
        {[160, 280, 400, 520, 640].map(y => <line key={`h${y}`} x1={100} y1={y} x2={1100} y2={y} stroke={s} strokeWidth="0.5" />)}
        <text x="150" y="220" fill={s} fontSize="28" fontFamily="serif" opacity="0.7">12 450</text>
        <text x="850" y="340" fill={s} fontSize="24" fontFamily="serif" opacity="0.5">8 920</text>
        <text x="450" y="600" fill={s} fontSize="20" fontFamily="serif" opacity="0.4">3 180</text>
        <text x="720" y="180" fill={s} fontSize="32" fontFamily="serif" opacity="0.6">€</text>
        <text x="250" y="500" fill={s} fontSize="26" fontFamily="serif" opacity="0.5">%</text>
        <rect x="920" y="520" width="140" height="180" rx="16" stroke={s} strokeWidth="1" opacity="0.4" />
        <rect x="940" y="545" width="100" height="30" rx="4" stroke={s} strokeWidth="0.5" opacity="0.3" />
        {[0,1,2].map(r => [0,1,2].map(c => <rect key={`k${r}${c}`} x={940 + c * 35} y={590 + r * 35} width="25" height="25" rx="4" stroke={s} strokeWidth="0.5" opacity="0.25" />))}
      </svg>

      {/* Commissaire aux comptes — audit circles + balance */}
      <svg className={`${baseClass} ${profileId === "cac" ? "opacity-100" : "opacity-0"}`} viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
        {[120, 200, 280, 360].map(r => <circle key={r} cx="200" cy="400" r={r} stroke={s} strokeWidth="0.5" strokeDasharray="8 12" />)}
        {[80, 140, 200, 260].map(r => <circle key={`r${r}`} cx="1000" cy="350" r={r} stroke={s} strokeWidth="0.5" strokeDasharray="4 8" />)}
        <line x1="580" y1="150" x2="620" y2="150" stroke={s} strokeWidth="1.5" opacity="0.5" />
        <line x1="600" y1="150" x2="600" y2="100" stroke={s} strokeWidth="1" opacity="0.5" />
        <line x1="540" y1="100" x2="660" y2="100" stroke={s} strokeWidth="1" opacity="0.5" />
        <path d="M540 100 L520 140 L560 140 Z" stroke={s} strokeWidth="0.8" opacity="0.4" />
        <path d="M660 100 L640 140 L680 140 Z" stroke={s} strokeWidth="0.8" opacity="0.4" />
        <path d="M150 620 l8 8 l16 -16" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <path d="M900 600 l8 8 l16 -16" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <text x="850" y="650" fill={s} fontSize="18" fontFamily="serif" opacity="0.4">AUDIT</text>
      </svg>

      {/* Avocat — pillars + law reference */}
      <svg className={`${baseClass} ${profileId === "avocat" ? "opacity-100" : "opacity-0"}`} viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
        {[100, 160].map(x => (
          <g key={x}>
            <rect x={x} y={200} width={24} height={400} stroke={s} strokeWidth="0.8" opacity="0.3" rx="2" />
            <rect x={x - 8} y={190} width={40} height={12} stroke={s} strokeWidth="0.5" opacity="0.25" rx="2" />
            <rect x={x - 8} y={600} width={40} height={12} stroke={s} strokeWidth="0.5" opacity="0.25" rx="2" />
          </g>
        ))}
        {[1020, 1080].map(x => (
          <g key={x}>
            <rect x={x} y={250} width={24} height={350} stroke={s} strokeWidth="0.8" opacity="0.3" rx="2" />
            <rect x={x - 8} y={240} width={40} height={12} stroke={s} strokeWidth="0.5" opacity="0.25" rx="2" />
            <rect x={x - 8} y={600} width={40} height={12} stroke={s} strokeWidth="0.5" opacity="0.25" rx="2" />
          </g>
        ))}
        {[0,1,2,3,4].map(i => <line key={i} x1={350} y1={580 + i * 18} x2={650 - i * 30} y2={580 + i * 18} stroke={s} strokeWidth="0.5" opacity={0.2 + i * 0.05} />)}
        <text x="380" y="560" fill={s} fontSize="14" fontFamily="serif" opacity="0.35">Art. L.561-2 CMF</text>
        <text x="900" y="200" fill={s} fontSize="64" fontFamily="serif" opacity="0.15">§</text>
      </svg>

      {/* Notaire — seal + quill */}
      <svg className={`${baseClass} ${profileId === "notaire" ? "opacity-100" : "opacity-0"}`} viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
        <circle cx="200" cy="400" r="100" stroke={s} strokeWidth="1" opacity="0.3" />
        <circle cx="200" cy="400" r="80" stroke={s} strokeWidth="0.5" opacity="0.25" />
        <circle cx="200" cy="400" r="60" stroke={s} strokeWidth="0.5" strokeDasharray="3 5" opacity="0.2" />
        <text x="200" y="410" fill={s} fontSize="22" fontFamily="serif" textAnchor="middle" opacity="0.3">ACTE</text>
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <circle key={i} cx={200 + Math.cos(a) * 95} cy={400 + Math.sin(a) * 95} r="5" stroke={s} strokeWidth="0.4" opacity="0.2" />;
        })}
        <path d="M980 180 Q960 300 1020 500" stroke={s} strokeWidth="1" opacity="0.35" />
        <path d="M980 180 Q990 170 1000 180 Q990 190 980 180" stroke={s} strokeWidth="0.8" opacity="0.3" />
        <rect x="800" y="550" width="200" height="180" rx="8" stroke={s} strokeWidth="0.5" opacity="0.2" />
        {[0,1,2,3,4].map(i => <line key={i} x1={820} y1={580 + i * 22} x2={980} y2={580 + i * 22} stroke={s} strokeWidth="0.4" opacity="0.15" />)}
        <path d="M180 500 L200 530 L220 500" stroke={s} strokeWidth="0.8" opacity="0.25" />
      </svg>

      {/* Agent immobilier — buildings + key */}
      <svg className={`${baseClass} ${profileId === "immo" ? "opacity-100" : "opacity-0"}`} viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
        <rect x="80" y="300" width="120" height="400" stroke={s} strokeWidth="0.8" opacity="0.3" rx="4" />
        <rect x="220" y="400" width="80" height="300" stroke={s} strokeWidth="0.6" opacity="0.25" rx="4" />
        {[0,1,2,3].map(r => [0,1].map(c => <rect key={`w${r}${c}`} x={100 + c * 55} y={330 + r * 80} width={30} height={35} rx="3" stroke={s} strokeWidth="0.4" opacity="0.2" />))}
        <rect x="950" y="200" width="140" height="500" stroke={s} strokeWidth="0.8" opacity="0.3" rx="4" />
        <rect x="870" y="350" width="65" height="350" stroke={s} strokeWidth="0.6" opacity="0.2" rx="4" />
        {[0,1,2,3,4].map(r => [0,1].map(c => <rect key={`wr${r}${c}`} x={970 + c * 55} y={230 + r * 80} width={30} height={35} rx="3" stroke={s} strokeWidth="0.4" opacity="0.2" />))}
        <path d="M550 580 L600 530 L650 580 Z" stroke={s} strokeWidth="0.8" opacity="0.25" />
        <rect x="560" y="580" width="80" height="60" stroke={s} strokeWidth="0.6" opacity="0.2" rx="2" />
        <circle cx="600" cy="700" r="12" stroke={s} strokeWidth="0.8" opacity="0.2" />
        <line x1="612" y1="700" x2="645" y2="700" stroke={s} strokeWidth="0.6" opacity="0.2" />
        <line x1="640" y1="695" x2="640" y2="710" stroke={s} strokeWidth="0.5" opacity="0.15" />
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   #16 — ROI Calculator
   ══════════════════════════════════════════════════════════════ */
function ROICalculator() {
  const [clients, setClients] = useState(50);
  const [hoursPerClient, setHoursPerClient] = useState(0.5);
  const hourlyCost = 80; // €/h expert-comptable
  const grimyTimePerClient = 0.03; // ~2 min
  const timeSavedPerMonth = clients * (hoursPerClient - grimyTimePerClient);
  const moneySaved = Math.round(timeSavedPerMonth * hourlyCost);
  const grimyCost = clients <= 50 ? 29 : clients <= 200 ? 79 : 149;
  const roi = Math.round(((moneySaved - grimyCost) / grimyCost) * 100);

  return (
    <div className="rounded-2xl border p-8 backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h4 className="font-bold text-sm">Calculateur de ROI</h4>
          <p className="text-xs" style={{ color: "var(--l-text-4)" }}>Estimez vos économies avec GRIMY</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm" style={{ color: "var(--l-text-3)" }}>Nombre de clients</label>
            <span className="text-sm font-bold text-blue-400">{clients}</span>
          </div>
          <input type="range" min={10} max={500} step={10} value={clients}
            onChange={(e) => setClients(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
            style={{ background: "var(--l-mock-bar-bg)" }}
          />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--l-text-5)" }}>
            <span>10</span><span>500</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm" style={{ color: "var(--l-text-3)" }}>Heures / client / mois (actuel)</label>
            <span className="text-sm font-bold text-blue-400">{hoursPerClient}h</span>
          </div>
          <input type="range" min={0.25} max={3} step={0.25} value={hoursPerClient}
            onChange={(e) => setHoursPerClient(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
            style={{ background: "var(--l-mock-bar-bg)" }}
          />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--l-text-5)" }}>
            <span>15min</span><span>3h</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--l-border)", background: "var(--l-mock-bg)" }}>
          <div className="text-2xl font-bold text-emerald-400 font-serif">{Math.round(timeSavedPerMonth)}h</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--l-text-5)" }}>Heures économisées/mois</div>
        </div>
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--l-border)", background: "var(--l-mock-bg)" }}>
          <div className="text-2xl font-bold text-emerald-400 font-serif">{moneySaved}€</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--l-text-5)" }}>Économies/mois</div>
        </div>
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--l-border)", background: "var(--l-mock-bg)" }}>
          <div className="text-2xl font-bold text-emerald-400 font-serif">{roi > 0 ? `${roi}%` : "—"}</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--l-text-5)" }}>ROI</div>
        </div>
      </div>

      <p className="text-xs text-center mt-4" style={{ color: "var(--l-text-5)" }}>
        Basé sur un coût horaire de {hourlyCost}€/h et GRIMY à {grimyCost}€/mois
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* #13 — Glow card: radial gradient follows cursor */
function GlowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative overflow-hidden ${className}`}
    >
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, rgba(139,92,246,0.12), transparent 60%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

/* #10 — Tilt card: 3D perspective on hover */
function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (REDUCED_MOTION()) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current!.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) scale(1.02)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "perspective(800px) rotateY(0) rotateX(0) scale(1)";
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/* #17 — Wave separator */
function WaveDivider({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-[0] ${flip ? "rotate-180" : ""} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-10 sm:h-14">
        <path
          d="M0,30 C240,55 480,5 720,30 C960,55 1200,5 1440,30 L1440,60 L0,60 Z"
          className="fill-current opacity-[0.03]" style={{ color: "var(--l-text)" }}
        />
      </svg>
    </div>
  );
}

/* #16 — SVG Circle progress counter */
function CircleCounter({ value, suffix = "", label, color }: {
  value: number; suffix?: string; label: string; color: string;
}) {
  const cu = useCountUp(value, 2000);
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (cu.value / (value || 1)) * circ;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--l-circle-track)" strokeWidth="5" />
          <circle
            cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span
          ref={cu.ref}
          className="absolute inset-0 flex items-center justify-center text-xl font-bold font-serif"
          style={{ color }}
        >
          {cu.value}{suffix}
        </span>
      </div>
      <span className="text-sm text-[--l-text-4]">{label}</span>
    </div>
  );
}

/* #1 — Interactive demo */
const DEMO_APIS = [
  { name: "INPI — Données entreprise", icon: Database },
  { name: "INPI — Statuts PDF", icon: FileText },
  { name: "INPI — Comptes annuels", icon: FileCheck },
  { name: "BODACC — Annonces légales", icon: Globe },
  { name: "OpenSanctions", icon: Shield },
  { name: "DG Trésor — Gel des avoirs", icon: Lock },
  { name: "Bénéficiaires effectifs", icon: Users },
  { name: "Google Places — Adresse", icon: Search },
  { name: "Base nationale PEP", icon: Shield },
];

function RadarChart() {
  const axes = [
    { label: "Activit\u00e9", value: 0.85 },
    { label: "Pays", value: 0.95 },
    { label: "Mission", value: 0.7 },
    { label: "Maturit\u00e9", value: 0.6 },
    { label: "Structure", value: 0.8 },
    { label: "Malus", value: 0.9 },
  ];
  const n = axes.length;
  const cx = 100, cy = 100, R = 70;
  const angleStep = (2 * Math.PI) / n;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const pointAt = (i: number, r: number) => ({
    x: cx + r * Math.sin(i * angleStep),
    y: cy - r * Math.cos(i * angleStep),
  });

  const dataPoints = axes.map((a, i) => pointAt(i, R * a.value));

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon key={level}
          points={Array.from({ length: n }, (_, i) => { const p = pointAt(i, R * level); return `${p.x},${p.y}`; }).join(" ")}
          fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="0.5"
        />
      ))}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const p = pointAt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(139,92,246,0.08)" strokeWidth="0.5" />;
      })}
      {/* Data area */}
      <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(" ")}
        fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="1.5"
        className="animate-in fade-in duration-700"
      />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8b5cf6" />
      ))}
      {/* Labels */}
      {axes.map((a, i) => {
        const p = pointAt(i, R + 18);
        return (
          <text key={a.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            className="text-[8px] fill-[--l-text-4]" style={{ fontSize: "8px" }}
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

function InteractiveDemo() {
  const [stage, setStage] = useState<"idle" | "running" | "done">("idle");
  const [completed, setCompleted] = useState(0);
  const [score, setScore] = useState(0);
  const timers = useRef<number[]>([]);

  const cleanup = useCallback(() => {
    timers.current.forEach((id) => { clearTimeout(id); clearInterval(id); });
    timers.current = [];
  }, []);
  // Note: running ref is reset in run() completion or by Relancer button guard

  const running = useRef(false);
  const run = () => {
    if (running.current) return;
    cleanup();
    running.current = true;
    setStage("running");
    setCompleted(0);
    setScore(0);
    DEMO_APIS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => {
        setCompleted(i + 1);
        if (i === DEMO_APIS.length - 1) {
          timers.current.push(window.setTimeout(() => {
            setStage("done");
            running.current = false;
            let s = 0;
            const iv = window.setInterval(() => { s += 3; setScore(s); if (s >= 72) clearInterval(iv); }, 25);
            timers.current.push(iv);
          }, 500));
        }
      }, 400 * (i + 1)));
    });
  };

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return (
    <div className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm max-w-lg mx-auto">
      <div className="rounded-xl p-6" style={{ background: "var(--l-mock-bg)" }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" aria-hidden="true" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" aria-hidden="true" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-[--l-text-4]">Screening — Démonstration</span>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 rounded-lg border border-[--l-border] px-4 py-2.5 text-sm font-mono text-[--l-text-2]" style={{ background: "var(--l-mock-field)" }}>
            SIREN : 831 562 749
          </div>
          <button
            onClick={run}
            disabled={stage === "running"}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors btn-press"
          >
            {stage === "idle" ? "Lancer" : stage === "running" ? "En cours..." : "Relancer"}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[--l-mock-bar-bg] mb-5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
            style={{ width: `${(completed / 9) * 100}%` }}
          />
        </div>

        {/* API list */}
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
          {DEMO_APIS.map((api, i) => {
            const done = i < completed;
            const current = i === completed && stage === "running";
            return (
              <div
                key={api.name}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ${
                  done ? "bg-emerald-500/10" : current ? "bg-blue-500/10" : "bg-[--l-surface]"
                }`}
              >
                <api.icon className={`h-4 w-4 shrink-0 ${done ? "text-emerald-400" : current ? "text-blue-400 animate-pulse" : "text-[--l-text-5]"}`} />
                <span className={done ? "text-emerald-300" : current ? "text-blue-300" : "text-[--l-text-4]"}>
                  {api.name}
                </span>
                {done && <Check className="h-3.5 w-3.5 ml-auto text-emerald-400" />}
                {current && <div className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />}
              </div>
            );
          })}
        </div>

        {/* Score result + Radar chart */}
        {stage === "done" && (
          <div className="mt-4 space-y-4 animate-in fade-in">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-400">Screening terminé</p>
                <p className="text-xs text-emerald-400/60">9/9 sources vérifiées — 0 alerte — Vigilance standard</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-400 font-serif">{score}</span>
                <span className="text-sm text-emerald-400/70">/100</span>
              </div>
            </div>
            {/* Radar chart */}
            <div className="rounded-lg bg-[--l-surface] border border-[--l-border] p-4">
              <p className="text-[11px] text-[--l-text-5] mb-3 text-center">Scoring des risques — 6 axes</p>
              <RadarChart />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* #2 — Video section */
function VideoPlayer() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative rounded-2xl border border-[--l-border] bg-[--l-surface] overflow-hidden aspect-video max-w-2xl mx-auto group cursor-pointer"
      onClick={() => setPlaying(!playing)}
    >
      {/* Poster gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-[--l-bg-primary]" />
      <div className="absolute inset-0 dot-grid opacity-20" />

      {!playing ? (
        <div className="relative flex flex-col items-center justify-center h-full gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/90 shadow-lg shadow-blue-600/30 group-hover:bg-blue-500 transition-colors pulse-play">
            <Play className="h-7 w-7 text-white ml-1" />
          </div>
          <p className="text-sm font-medium text-[--l-text-3]">Découvrir GRIMY en 60 secondes</p>
          <p className="text-xs text-[--l-text-5]">Cliquez pour lancer la vidéo</p>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center h-full gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20">
            <Sparkles className="h-7 w-7 text-blue-400 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[--l-text-2]">Vidéo de démonstration</p>
            <p className="text-xs text-[--l-text-4] mt-1">Bientôt disponible</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setPlaying(false); }}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

/* #11 — Animated mock: step screen */
function AnimatedMockStep() {
  const [apiCount, setApiCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let c = 0;
        iv = setInterval(() => { c++; setApiCount(c); if (c >= 9) { clearInterval(iv); iv = undefined; } }, 350);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => { obs.disconnect(); if (iv) clearInterval(iv); };
  }, []);

  return (
    <div ref={ref} className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm">
      <div className="rounded-xl p-5" style={{ background: "var(--l-mock-bg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" aria-hidden="true" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" aria-hidden="true" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Nouvelle fiche client — Étape 1/6</span>
        </div>
        <div className="h-1.5 rounded-full bg-[--l-mock-bar-bg] mb-5">
          <div className="h-1.5 w-1/6 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" />
        </div>
        <div className="space-y-2.5">
          {[["SIREN", "831 562 749"], ["Société", "SAS Exemple & Associés"], ["Activité", "6920Z — Comptabilité"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 rounded-lg bg-[--l-mock-bar-bg] px-4 py-2.5">
              <span className="text-[11px] text-[--l-text-5] w-16 shrink-0">{k}</span>
              <span className="text-sm text-[--l-text-2] font-mono">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-blue-500/10 px-4 py-3">
          {apiCount < 9 ? (
            <>
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-sm text-blue-400">Screening... {apiCount}/9 APIs</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">Screening terminé — Score 72/100</span>
            </>
          )}
          <div className="ml-auto flex gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${i < apiCount ? (apiCount >= 9 ? "bg-emerald-400" : "bg-blue-400") : "bg-[--l-surface-raised]"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedMockAudit() {
  const rows = [
    { label: "Dossiers conformes", val: "47/50", pct: 94, color: "bg-emerald-400" },
    { label: "Alertes résolues", val: "12/12", pct: 100, color: "bg-emerald-400" },
    { label: "Revues à jour", val: "45/50", pct: 90, color: "bg-blue-400" },
  ];
  return (
    <div className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm">
      <div className="rounded-xl p-5" style={{ background: "var(--l-mock-bg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" aria-hidden="true" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" aria-hidden="true" /><div className="h-2.5 w-2.5 rounded-full bg-green-400/60" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Contrôle qualité</span>
        </div>
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm text-[--l-text-3]">{r.label}</span>
                <span className="text-sm font-semibold text-[--l-text]">{r.val}</span>
              </div>
              <div className="h-2 rounded-full bg-[--l-mock-bar-bg]">
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

function AnimatedMockDashboard() {
  const [bars] = useState([65, 82, 45, 90, 70, 55, 78]);
  return (
    <div className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm">
      <div className="rounded-xl p-5" style={{ background: "var(--l-mock-bg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" aria-hidden="true" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" aria-hidden="true" /><div className="h-2.5 w-2.5 rounded-full bg-green-400/60" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Dashboard — Vue d'ensemble</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[{ l: "Clients", v: "142", c: "text-blue-400" }, { l: "Alertes", v: "3", c: "text-yellow-400" }, { l: "Échues", v: "2", c: "text-red-400" }].map((k) => (
            <div key={k.l} className="rounded-lg bg-[--l-mock-bar-bg] px-3 py-2.5 text-center">
              <div className={`text-xl font-bold ${k.c} font-serif`}>{k.v}</div>
              <div className="text-[10px] text-[--l-text-5] mt-0.5">{k.l}</div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1.5 h-20">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-600/60 to-blue-400/80" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-blue-500/10 px-4 py-2 text-center text-sm text-blue-400 font-medium">
          Score moyen : 72/100
        </div>
      </div>
    </div>
  );
}

/* #20 — Responsive comparison mobile card */
function CompMobileCard({ row }: { row: CompRow }) {
  return (
    <div className="rounded-xl border border-[--l-border] bg-[--l-surface] p-4 space-y-3">
      <p className="text-sm font-medium text-[--l-text]">{row.label}</p>
      <div className="grid grid-cols-2 gap-2 text-center">
        {(["grimy", "excel"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <span className={`text-[10px] uppercase tracking-wider ${k === "grimy" ? "text-emerald-400 font-semibold" : "text-[--l-text-5]"}`}>
              {k === "grimy" ? "GRIMY" : "Excel"}
            </span>
            <div><CompCell value={row[k]} accent={k === "grimy"} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Comparison cell */
function CompCell({ value, accent }: { value: CompValue; accent?: boolean }) {
  if (value === "yes") return <Check className={`mx-auto h-5 w-5 ${accent ? "text-emerald-400" : "text-emerald-400/70"}`} />;
  if (value === "no") return <X className="mx-auto h-5 w-5 text-red-400/60" />;
  if (value === "partial") return <span className="text-xs font-medium text-amber-400">Partiel</span>;
  return <span className={`text-sm ${accent ? "text-emerald-400 font-semibold" : "text-[--l-text-3]"}`}>{value}</span>;
}

/* #20 — Social proof ticker */
function SocialTicker() {
  const msgs = [
    "Un cabinet a finalisé 3 dossiers clients ce matin",
    "Screening lancé — 9 APIs vérifiées en 28 secondes",
    "Contrôle CROEC passé sans observation — Bordeaux",
    "Nouveau dossier LCB-FT complété en 2 min",
    "Revue annuelle effectuée pour 45 clients",
    "Fiche client exportée en PDF pour le contrôleur",
  ];
  return (
    <div className="overflow-hidden py-3 group/ticker">
      <div className="flex animate-ticker whitespace-nowrap gap-12 group-hover/ticker:[animation-play-state:paused]">
        {[...msgs, ...msgs].map((m, i) => (
          <span key={i} className="flex items-center gap-2 text-sm text-[--l-text-4]">
            <Zap className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "Fonctionnalités", id: "fonctionnalites" },
  { label: "Tarifs", id: "tarifs" },
  { label: "FAQ", id: "faq" },
  { label: "Témoignages", id: "temoignages" },
];

const whyCards = [
  { icon: Shield, title: "Screening automatique", desc: "9 APIs vérifiées en 30 secondes : INPI, OpenSanctions, BODACC, DG Trésor, Google Places... Pour tous les professionnels assujettis.", badge: null, iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
  { icon: FileCheck, title: "Documents récupérés", desc: "Statuts, comptes annuels, Kbis — téléchargés automatiquement depuis l'INPI et stockés dans votre GED sécurisée.", badge: null, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
  { icon: Calculator, title: "Scoring multi-critères", desc: "Activité, pays, relation d'affaires, maturité, structure + malus. Évaluation objective et traçable pour chaque client.", badge: null, iconBg: "bg-violet-500/10", iconColor: "text-violet-400" },
  { icon: FileText, title: "Fiche client complète", desc: "Identification, bénéficiaires effectifs, évaluation des risques, documents justificatifs — tout centralisé et exportable.", badge: null, iconBg: "bg-amber-500/10", iconColor: "text-amber-400" },
];

const featureShowcase = [
  { title: "Créez une fiche client en 2 minutes", desc: "Entrez un SIREN. GRIMY récupère automatiquement les données INPI, vérifie les sanctions, télécharge les statuts et calcule le score de risque.", icon: Search, mock: "step" as const, reverse: false, iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
  { title: "Prêt pour tout contrôle", desc: "Registre LAB, journal d'audit, contrôle qualité — tout est documenté et traçable. Votre autorité de contrôle peut visualiser vos dossiers en autonomie.", icon: ClipboardCheck, mock: "audit" as const, reverse: true, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
  { title: "Dashboard de pilotage", desc: "Visualisez en un coup d'œil : clients actifs, alertes en cours, revues échues, score moyen. Diagnostic 360° avec recommandations.", icon: Monitor, mock: "dashboard" as const, reverse: false, iconBg: "bg-violet-500/10", iconColor: "text-violet-400" },
];

const MOCKS = { step: AnimatedMockStep, audit: AnimatedMockAudit, dashboard: AnimatedMockDashboard };

/* #15 — Timeline steps */
const timelineSteps = [
  { title: "Entrez un SIREN", desc: "Une seule donnée suffit pour démarrer tout le processus d'identification.", icon: Search },
  { title: "Screening automatique", desc: "9 APIs interrogées en parallèle. Sanctions, PEP, gel des avoirs, BODACC.", icon: Shield },
  { title: "Documents INPI", desc: "Statuts, Kbis, comptes annuels PDF récupérés et archivés dans la GED.", icon: FileCheck },
  { title: "Scoring des risques", desc: "6 axes analysés. Score objectif, traçable, conforme aux obligations professionnelles.", icon: Calculator },
  { title: "Fiche client complète", desc: "Identification, bénéficiaires effectifs, évaluation des risques. Export PDF/DOCX.", icon: FileText },
  { title: "Dossier complet", desc: "Tout est documenté, archivé, prêt pour le contrôle. 2 minutes chrono.", icon: Check },
];

type CompValue = "yes" | "no" | "partial" | string;
type CompRow = { label: string; grimy: CompValue; excel: CompValue };
const comparison: CompRow[] = [
  { label: "Screening automatique (9 APIs)", grimy: "yes", excel: "no" },
  { label: "Documents INPI (statuts, comptes PDF)", grimy: "yes", excel: "no" },
  { label: "Scoring multi-critères NPLAB", grimy: "yes", excel: "Manuel" },
  { label: "Lettre de mission auto", grimy: "yes", excel: "no" },
  { label: "OCR Cloud Vision (CNI/RIB)", grimy: "yes", excel: "no" },
  { label: "Gel des avoirs DG Trésor", grimy: "yes", excel: "no" },
  { label: "Gouvernance complète (formations, manuel, contrôle interne)", grimy: "yes", excel: "no" },
  { label: "Mode contrôleur CROEC", grimy: "yes", excel: "no" },
  { label: "Journal d'audit certifié", grimy: "yes", excel: "no" },
  { label: "Prix transparent", grimy: "29€/mois", excel: "Gratuit" },
  { label: "Mise en conformité", grimy: "10 min", excel: "∞" },
];

/* #18 — Features with badges */
const allFeatures = [
  { name: "Screening 9 APIs", badge: null },
  { name: "Documents INPI", badge: null },
  { name: "Scoring des risques", badge: null },
  { name: "Fiche client complète", badge: null },
  { name: "GED documentaire", badge: null },
  { name: "Registre LAB", badge: null },
  { name: "Contrôle qualité", badge: null },
  { name: "Journal d'audit", badge: null },
  { name: "OCR Cloud Vision", badge: "Nouveau" as const },
  { name: "Diagnostic 360°", badge: null },
  { name: "Gouvernance équipe", badge: null },
  { name: "API publique", badge: "Q2 2026" as const },
];

const plans = [
  { name: "Solo", price: 29, desc: "Pour les indépendants", features: ["1 utilisateur", "50 clients", "Screening complet", "Fiche client complète", "GED 5 Go"], cta: "Essai gratuit 14 jours", popular: false },
  { name: "Pro", price: 79, desc: "Pour les structures en croissance", features: ["5 utilisateurs", "200 clients", "Tout Solo +", "Contrôle qualité", "Multi-rôles", "Support prioritaire"], cta: "Essai gratuit 14 jours", popular: true },
  { name: "Enterprise", price: 0, desc: "Pour les grandes structures", features: ["Utilisateurs illimités", "Clients illimités", "Tout Pro +", "SSO / SAML", "API dédiée", "Formation sur site", "Référent dédié"], cta: "Réserver un appel", popular: false },
];

/* #3 — Pricing comparison features */
const pricingFeatures = [
  { name: "Utilisateurs", solo: "1", cabinet: "5", enterprise: "Illimité" },
  { name: "Clients", solo: "50", cabinet: "200", enterprise: "Illimité" },
  { name: "Screening APIs", solo: "yes", cabinet: "yes", enterprise: "yes" },
  { name: "Fiche client complète", solo: "yes", cabinet: "yes", enterprise: "yes" },
  { name: "GED", solo: "5 Go", cabinet: "20 Go", enterprise: "Illimité" },
  { name: "Contrôle qualité", solo: "no", cabinet: "yes", enterprise: "yes" },
  { name: "Multi-rôles", solo: "no", cabinet: "yes", enterprise: "yes" },
  { name: "SSO / SAML", solo: "no", cabinet: "no", enterprise: "yes" },
  { name: "API", solo: "no", cabinet: "no", enterprise: "yes" },
  { name: "Support", solo: "Email", cabinet: "Prioritaire", enterprise: "Dédié" },
];

const testimonials = [
  { quote: "Nous avons passé notre dernier contrôle LAB sans aucune observation. GRIMY avait tout préparé.", name: "Marc D.", title: "Expert-comptable", cabinet: "Cabinet EC — Marseille", detail: "25 collaborateurs · 320 clients", initials: "MD", color: "bg-blue-500/20 text-blue-400" },
  { quote: "Le screening automatique nous fait gagner 2 heures par nouveau client. La lettre de mission se génère en 3 clics.", name: "Sophie L.", title: "Notaire associée", cabinet: "Étude notariale — Bordeaux", detail: "12 personnes · 180 clients", initials: "SL", color: "bg-emerald-500/20 text-emerald-400" },
  { quote: "Enfin un outil pensé par quelqu'un qui comprend nos obligations. Pas un truc générique adapté à la va-vite.", name: "Thomas R.", title: "Avocat", cabinet: "Cabinet d'avocats — Paris", detail: "8 associés · 450 dossiers", initials: "TR", color: "bg-purple-500/20 text-purple-400" },
];

const faqItems = [
  { q: "GRIMY est-il conforme à la NPLAB ?", a: "Oui. GRIMY a été conçu pour répondre exactement aux exigences de la norme NPLAB 2020 et de la NPMQ 2025. Chaque fonctionnalité est mappée sur une obligation réglementaire : identification, évaluation des risques, vigilance continue, traçabilité.", icon: Shield },
  { q: "Quels professionnels peuvent utiliser GRIMY ?", a: "Tous les professionnels assujettis aux obligations LAB (art. L.561-2 du Code monétaire) : experts-comptables, commissaires aux comptes, avocats, notaires, commissaires de justice, agents immobiliers, conseillers en investissements financiers (CIF), sociétés de domiciliation, mandataires judiciaires, et plus.", icon: Users },
  { q: "Combien de temps pour être opérationnel ?", a: "Créez votre compte, importez vos clients par SIREN, et GRIMY fait le reste. La plupart des cabinets sont opérationnels en moins de 10 minutes.", icon: Clock },
  { q: "Puis-je importer mes clients existants ?", a: "Oui. Import par SIREN unitaire ou en masse via CSV. GRIMY récupère automatiquement toutes les données depuis les sources officielles (INPI, INSEE) et relance le screening.", icon: Database },
  { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Chiffrement AES-256 au repos, TLS 1.3 en transit, hébergement en France (Supabase EU-West), conformité RGPD, accès par rôle et journal d'audit complet immutable.", icon: Lock },
  { q: "Y a-t-il un engagement ?", a: "Non. Tous nos plans sont sans engagement. Vous pouvez annuler à tout moment depuis votre espace. Vos données restent exportables 30 jours après résiliation.", icon: CreditCard },
  { q: "Comment se passe un contrôle LAB avec GRIMY ?", a: "GRIMY génère un dossier de conformité complet en un clic : cartographie des risques, registre LCB-FT, historique des diligences, formations. Le mode contrôleur permet au contrôleur CROEC de naviguer en autonomie.", icon: Eye },
  { q: "Le logiciel convient-il à un indépendant ?", a: "Absolument. Le plan Solo à 29€/mois couvre 50 clients, largement suffisant pour un professionnel indépendant. L'interface est conçue pour être utilisable sans formation.", icon: Award },
];

/* #8 — Footer with working links */
type FooterLink = { label: string; id?: string; href?: string; mailto?: string };
const footerSections: { title: string; links: FooterLink[] }[] = [
  { title: "Produit", links: [{ label: "Fonctionnalités", id: "fonctionnalites" }, { label: "Tarifs", id: "tarifs" }, { label: "Démo", id: "demo" }, { label: "FAQ", id: "faq" }] },
  { title: "Entreprise", links: [{ label: "Témoignages", id: "temoignages" }, { label: "Contact", mailto: "contact@grimy.fr" }, { label: "CGV", id: "legal-cgv" }, { label: "Mentions légales", id: "legal-mentions" }] },
  { title: "Conformité", links: [{ label: "Obligations LAB", id: "legal-lab" }, { label: "Politique de confidentialité", id: "legal-rgpd" }, { label: "Sécurité", id: "securite" }] },
];

/* ══════════════════════════════════════════════════════════════
   Scroll-to-top button
   ══════════════════════════════════════════════════════════════ */
function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-[70px] right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition-all hover:scale-110 btn-press sm:bottom-6 sm:z-40"
      style={{ borderColor: "var(--l-border)", background: "var(--l-bg-blur)" }}
      aria-label="Retour en haut"
    >
      <ArrowUp className="h-4 w-4" style={{ color: "var(--l-text-3)" }} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   LEGAL MODAL
   ══════════════════════════════════════════════════════════════ */
type LegalModalType = "legal-cgv" | "legal-mentions" | "legal-lab" | "legal-rgpd" | null;

const LEGAL_CONTENT: Record<Exclude<LegalModalType, null>, { title: string; content: string }> = {
  "legal-cgv": {
    title: "Conditions Générales de Vente",
    content: `Article 1 — Objet\nLes présentes CGV régissent les conditions de souscription et d'utilisation du service GRIMY, plateforme SaaS de conformité LCB-FT.\n\nArticle 2 — Abonnement\nL'abonnement prend effet à la date de souscription. Les plans Solo (29€/mois) et Pro (79€/mois) sont sans engagement. La facturation est mensuelle ou annuelle selon le choix du client.\n\nArticle 3 — Essai gratuit\n14 jours d'essai complet sans carte bancaire. À l'issue de l'essai, le client choisit son plan ou ses données restent exportables 30 jours.\n\nArticle 4 — Résiliation\nRésiliation possible à tout moment depuis les paramètres du compte. Les données restent exportables pendant 30 jours après résiliation. Aucun remboursement au prorata.\n\nArticle 5 — Responsabilité\nGRIMY fournit un outil d'aide à la conformité. Le professionnel reste seul responsable du respect de ses obligations LAB. GRIMY ne se substitue pas au jugement professionnel.\n\nArticle 6 — Disponibilité\nGRIMY s'engage sur une disponibilité de 99,5% hors maintenance programmée. Les maintenances sont notifiées 48h à l'avance.\n\nArticle 7 — Droit applicable\nLes présentes CGV sont soumises au droit français. Tout litige relève de la compétence des tribunaux de Paris.`,
  },
  "legal-mentions": {
    title: "Mentions Légales",
    content: `Éditeur\nGRIMY — Plateforme de conformité LCB-FT\nContact : contact@grimy.fr\n\nHébergement\nSupabase Inc. — Région EU-West (France)\nDonnées hébergées en Union Européenne\n\nDirecteur de la publication\nLe représentant légal de GRIMY\n\nPropriété intellectuelle\nL'ensemble du contenu du site (textes, graphismes, logos, icônes, logiciels) est la propriété de GRIMY et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.\n\nDonnées personnelles\nConformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contact DPO : contact@grimy.fr\n\nCookies\nCe site utilise uniquement des cookies techniques nécessaires au fonctionnement du service (authentification, préférences de thème). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.`,
  },
  "legal-lab": {
    title: "Obligations LAB — Art. L.561-2 CMF",
    content: `Professionnels assujettis\nL'article L.561-2 du Code monétaire et financier liste les professionnels soumis aux obligations de lutte anti-blanchiment :\n\n• Experts-comptables et commissaires aux comptes\n• Avocats (dans le cadre de certaines activités)\n• Notaires\n• Commissaires de justice (ex-huissiers)\n• Agents immobiliers\n• Conseillers en investissements financiers (CIF)\n• Sociétés de domiciliation\n• Mandataires judiciaires\n• Opérateurs de ventes volontaires de meubles aux enchères\n\nObligations principales\n1. Vigilance à l'égard de la clientèle — identification et vérification de l'identité\n2. Déclaration de soupçon à TRACFIN\n3. Conservation des documents (5 ans après la fin de la relation d'affaires)\n4. Mise en place de procédures internes\n5. Formation du personnel\n6. Évaluation et classification des risques\n\nComment GRIMY vous aide\nGRIMY automatise les étapes 1, 3, 4 et 6 en centralisant l'identification client, le screening automatique (9 APIs), le scoring des risques et l'archivage sécurisé des documents justificatifs.`,
  },
  "legal-rgpd": {
    title: "Politique de Confidentialité — RGPD",
    content: `Responsable du traitement\nGRIMY — contact@grimy.fr\n\nDonnées collectées\n• Données d'identification : nom, prénom, email, mot de passe (haché)\n• Données professionnelles : SIREN, raison sociale, adresse\n• Données clients : informations de vos clients dans le cadre de vos obligations LAB\n\nFinalités du traitement\n• Fourniture du service de conformité LCB-FT\n• Gestion de votre compte utilisateur\n• Support client\n\nBase légale\n• Exécution du contrat (art. 6.1.b RGPD)\n• Obligation légale pour les données LAB (art. 6.1.c RGPD)\n\nSécurité des données\n• Hébergement en France (Supabase EU-West)\n• Chiffrement au repos AES-256\n• Chiffrement en transit TLS 1.3\n• Chiffrement applicatif AES-GCM pour les champs sensibles (IBAN, CNI)\n• Audit trail immutable\n\nDurée de conservation\n• Données de compte : durée de la relation + 30 jours\n• Données LAB : 5 ans conformément au Code monétaire\n\nVos droits\nConformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Contactez-nous : contact@grimy.fr\n\nCookies\nSeuls des cookies techniques sont utilisés (authentification, thème). Aucun tracker publicitaire.`,
  },
};

function LegalModal({ type, onClose }: { type: Exclude<LegalModalType, null>; onClose: () => void }) {
  const content = LEGAL_CONTENT[type];
  // Scroll lock handled by parent (LandingPage useEffect on legalModal state)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-8 shadow-2xl"
        style={{ borderColor: "var(--l-border)", background: "var(--l-bg-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: "var(--l-text-3)" }} aria-label="Fermer">
          <XIcon className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold font-serif mb-6" style={{ color: "var(--l-text)" }}>{content.title}</h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>
          {content.content.split("\n\n").map((paragraph, i) => {
            const lines = paragraph.split("\n");
            const firstLine = lines[0];
            const isHeading = firstLine && !firstLine.startsWith("•") && !firstLine.startsWith("-") && lines.length > 1;
            return (
              <div key={i}>
                {isHeading ? (
                  <>
                    <p className="font-semibold mb-1" style={{ color: "var(--l-text-2)" }}>{firstLine}</p>
                    {lines.slice(1).map((line, j) => (
                      <p key={j} className={line.startsWith("•") ? "pl-4" : ""}>{line}</p>
                    ))}
                  </>
                ) : (
                  lines.map((line, j) => (
                    <p key={j} className={line.startsWith("•") ? "pl-4" : ""}>{line}</p>
                  ))
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 pt-4 border-t flex justify-end" style={{ borderColor: "var(--l-border)" }}>
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors btn-press">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const revealRef = useScrollReveal();
  const navScrolled = useNavScroll();
  const activeSection = useActiveSection();
  const heroVisible = useHeroReveal();
  const heroInView = useHeroInView();
  const scrollProgress = useScrollProgress();
  const [annual, setAnnual] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaError, setCtaError] = useState("");
  const [ctaLoading, setCtaLoading] = useState(false);
  const theme = usePersistedTheme();
  const cookies = useCookieConsent();
  const [showPricingTable, setShowPricingTable] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [showUrgencyBanner, setShowUrgencyBanner] = useState(true);
  const navigate = useNavigate();
  const tlProgress = useTimelineProgress();

  useDocumentTitle("GRIMY | Conformite LCB-FT");

  /* SEO — meta description */
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', 'GRIMY - Plateforme de conformité LCB-FT pour professionnels assujettis. Gestion KYC, scoring de risque, lettres de mission.');
    if (!meta.parentElement) document.head.appendChild(meta);
  }, []);

  /* #11 — Scroll lock (mobile menu OR legal modal) */
  useEffect(() => {
    document.body.style.overflow = (mobileMenu || legalModal) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenu, legalModal]);

  const handleNavClick = useCallback((id: string) => { scrollTo(id); setMobileMenu(false); }, []);

  /* #7 — Email validation + #16 loading state + #6 passthrough */
  const handleCtaSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setCtaError("");
    if (ctaEmail && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(ctaEmail)) {
      setCtaError("Veuillez entrer un email valide.");
      return;
    }
    setCtaLoading(true);
    try {
      navigate(ctaEmail ? `/auth?email=${encodeURIComponent(ctaEmail)}` : "/auth");
    } catch {
      setCtaLoading(false);
    }
  }, [ctaEmail, navigate]);

  const themeClass = theme.light ? "theme-light" : "theme-dark";

  return (
    <div ref={revealRef} className={`landing-root ${themeClass} min-h-screen font-sans`}>
      {/* ─── CSS ─── */}
      <style>{`
        /* #12 — Theme variables */
        .theme-dark {
          --l-bg-primary: #0a0a1a;
          --l-bg-alt: #0f0f2e;
          --l-surface: rgba(255,255,255,0.05);
          --l-surface-raised: rgba(255,255,255,0.08);
          --l-border: rgba(255,255,255,0.1);
          --l-border-subtle: rgba(255,255,255,0.05);
          --l-bg-blur: rgba(10,10,26,0.85);
          --l-bg-blur-heavy: rgba(10,10,26,0.95);
          --l-text: #ffffff;
          --l-text-2: #d1d5db;
          --l-text-3: #9ca3af;
          --l-text-4: #6b7280;
          --l-text-5: #4b5563;
          --l-mock-bg: #0d0d24;
          --l-mock-field: rgba(255,255,255,0.05);
          --l-mock-bar-bg: rgba(255,255,255,0.05);
          --l-circle-track: rgba(255,255,255,0.08);
          --l-toggle-off: #374151;
          --l-hero-illus: rgba(59, 130, 246, 0.04);
        }
        .theme-light {
          --l-bg-primary: #f8f6f1;
          --l-bg-alt: #f3efe8;
          --l-surface: rgba(120,80,200,0.04);
          --l-surface-raised: rgba(120,80,200,0.07);
          --l-border: rgba(100,60,180,0.15);
          --l-border-subtle: rgba(100,60,180,0.08);
          --l-bg-blur: rgba(248,246,241,0.9);
          --l-bg-blur-heavy: rgba(248,246,241,0.96);
          --l-text: #1a1520;
          --l-text-2: #2d2535;
          --l-text-3: #4a4255;
          --l-text-4: #6b6278;
          --l-text-5: #9590a0;
          --l-mock-bg: #f0ece5;
          --l-mock-field: rgba(100,60,180,0.06);
          --l-mock-bar-bg: rgba(100,60,180,0.08);
          --l-circle-track: rgba(100,60,180,0.1);
          --l-accent: #7c3aed;
          --l-accent-light: rgba(139,92,246,0.1);
          --l-toggle-off: #c4bfd0;
          --l-hero-illus: rgba(120, 80, 200, 0.05);
        }
        .landing-root { color: var(--l-text); }

        /* Gradient background */
        .theme-dark .landing-bg-wrap {
          background: linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #0a0a1a 50%, #1a1a3e 75%, #0a0a1a 100%);
          background-size: 400% 400%;
          animation: gradShift 15s ease infinite;
        }
        .theme-light .landing-bg-wrap {
          background: linear-gradient(135deg, #f8f6f1 0%, #f3efe8 25%, #ece5dc 50%, #f3efe8 75%, #f8f6f1 100%);
        }
        @keyframes gradShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* #9 — Dot grid */
        .dot-grid {
          background-image: radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .theme-light .dot-grid {
          background-image: radial-gradient(circle, rgba(120,80,200,0.08) 1px, transparent 1px);
        }

        /* Hero glow */
        .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15) 0%, transparent 70%);
        }
        .theme-light .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120,80,200,0.1) 0%, transparent 70%);
        }

        /* #9 — Micro-interactions */
        .btn-press { transition: transform 0.15s ease; }
        .btn-press:active { transform: scale(0.97); }
        .table-row-hover { transition: background 0.15s ease; }
        .table-row-hover:hover { background: rgba(59,130,246,0.06); }
        .theme-light .table-row-hover:hover { background: rgba(120,80,200,0.06); }

        /* #2 — Video play pulse */
        @keyframes playPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(59,130,246,0); }
        }
        .pulse-play { animation: playPulse 2s ease infinite; }

        /* #20 — Ticker */
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker { animation: ticker 40s linear infinite; will-change: transform; }

        /* #14 — GRIMY column highlight */
        .grimy-col { background: rgba(16,185,129,0.06); }
        .theme-light .grimy-col { background: rgba(120,80,200,0.08); }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .landing-bg-wrap, .theme-dark .landing-bg-wrap { animation: none !important; }
          .pulse-play { animation: none !important; }
          .animate-ticker { animation: none !important; }
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Purple gradient section titles in light mode — use color instead of background-clip to avoid violet square bug */
        .theme-light h2.font-serif {
          color: #4c1d95;
        }
        .theme-light h3.font-serif {
          color: #4c1d95;
        }

        /* Light mode: darken accent colors for contrast on cream */
        /* Hero gradient text on cream — keep background-clip but ensure proper display */
        .theme-light .bg-gradient-to-r.from-violet-400.to-purple-300 {
          background: linear-gradient(to right, #6d28d9, #7c3aed) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
        }

        .theme-light .text-emerald-400 { color: #059669 !important; }
        .theme-light .text-emerald-300 { color: #059669 !important; }
        .theme-light .text-blue-400 { color: #2563eb !important; }
        .theme-light .text-blue-300 { color: #2563eb !important; }
        .theme-light .text-violet-400 { color: #7c3aed !important; }
        .theme-light .text-amber-400 { color: #d97706 !important; }
        .theme-light .text-purple-400 { color: #7c3aed !important; }
        .theme-light .text-pink-400 { color: #db2777 !important; }
        .theme-light .text-red-400 { color: #dc2626 !important; }
        .theme-light .text-red-400\\/60 { color: rgba(220,38,38,0.7) !important; }
        .theme-light .text-yellow-400 { color: #b45309 !important; }
        .theme-light .text-gray-400 { color: #6b7280 !important; }
        .theme-light .text-indigo-400 { color: #4f46e5 !important; }
        .theme-light .fill-amber-400 { fill: #d97706 !important; }
        .theme-light .text-amber-400.fill-amber-400 { color: #d97706 !important; }
        .theme-light .text-emerald-400\\/60 { color: rgba(5,150,105,0.7) !important; }
        .theme-light .text-emerald-400\\/70 { color: rgba(5,150,105,0.8) !important; }
        .theme-light .text-blue-400\\/60 { color: rgba(37,99,235,0.7) !important; }
        .theme-light .text-orange-400 { color: #ea580c !important; }

        /* Timeline line fill */
        .timeline-line-fill {
          transition: height 0.1s linear;
        }

        /* Improved mobile safe area for sticky CTA */
        .sticky-cta-safe {
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }

        /* Better focus outlines */
        .landing-root button:focus-visible,
        .landing-root a:focus-visible {
          outline: 2px solid #3B82F6;
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Smooth section anchors offset — account for urgency banner */
        .landing-root [id] {
          scroll-margin-top: 112px;
        }

        /* CTA glow pulse (#42) */
        .cta-glow {
          animation: ctaGlowPulse 3s ease-in-out infinite;
        }
        @keyframes ctaGlowPulse {
          0%, 100% { box-shadow: 0 4px 20px -5px rgba(59, 130, 246, 0.25); }
          50% { box-shadow: 0 4px 30px -5px rgba(59, 130, 246, 0.45); }
        }

        /* Blob animations (#11 #39) */
        @keyframes blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(0.9); }
          66% { transform: translate(20px, -40px) scale(1.1); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, 40px) scale(1.05); }
          66% { transform: translate(-30px, -20px) scale(0.95); }
        }

        /* Range slider thumb (#16 ROI) */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(59,130,246,0.4);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(59,130,246,0.4);
        }

      `}</style>

      <div className="landing-bg-wrap">

        {/* ══════ SCROLL PROGRESS BAR ══════ */}
        <div className="fixed top-0 left-0 right-0 z-[60] h-0.5">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
        </div>

        {/* ══════ URGENCY BANNER ══════ */}
        {showUrgencyBanner && (
          <div className="fixed top-0.5 left-0 right-0 z-[58] bg-gradient-to-r from-amber-600/90 to-orange-600/90 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl flex items-center justify-center gap-3 px-4 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-white shrink-0" />
              <p className="text-xs font-medium text-white">
                <span className="hidden sm:inline">Nouvelle NPMQ 2025 en vigueur — </span>2 500 contrôles LAB prévus par l'Ordre. Êtes-vous prêt ?
              </p>
              <Link to="/auth" className="text-[10px] font-bold text-white underline underline-offset-2 whitespace-nowrap">
                Vérifier ma conformité
              </Link>
              <button onClick={() => setShowUrgencyBanner(false)} className="ml-1 text-white/70 hover:text-white" aria-label="Fermer">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ══════ 1. NAVBAR ══════ */}
        <nav aria-label="Navigation principale" className={`fixed z-50 w-full transition-all duration-300 ${
          navScrolled
            ? "border-b shadow-lg"
            : "bg-transparent"
        }`} style={{
          top: showUrgencyBanner ? "32px" : "2px",
          borderColor: navScrolled ? "var(--l-border)" : "transparent",
          background: navScrolled ? "var(--l-bg-blur)" : "transparent",
          backdropFilter: navScrolled ? "blur(16px)" : "none",
        }}>
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <a href="#hero" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xl font-bold tracking-tight font-serif" style={{ color: "var(--l-text)" }}>
              GRIMY
            </a>

            {/* Desktop links with #3 active state */}
            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((l) => (
                <button key={l.id} onClick={() => handleNavClick(l.id)}
                  className="text-sm transition-colors relative py-1 hover:text-blue-400"
                  style={{ color: activeSection === l.id ? "var(--l-text)" : "var(--l-text-3)" }}
                >
                  {l.label}
                  {activeSection === l.id && <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-blue-500" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* #12 — Theme toggle (persisted) */}
              <button
                onClick={theme.toggle}
                className="p-2 rounded-lg transition-colors hover:opacity-70"
                style={{ color: "var(--l-text-3)" }}
                aria-label={theme.light ? "Passer en mode sombre" : "Passer en mode clair"}
              >
                {theme.light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>

              {/* Réserver une démo */}
              <button onClick={() => scrollTo("demo")} className="hidden md:inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:text-blue-400" style={{ color: "var(--l-text-3)" }}>
                <Play className="h-3.5 w-3.5" /> Démo
              </button>

              <Link to="/auth" className="hidden sm:inline-flex">
                <Button variant="ghost" className="btn-press" style={{ color: "var(--l-text-3)" }}>Se connecter</Button>
              </Link>
              <Link to="/auth" className="hidden sm:inline-flex" aria-label="Demarrer l'essai gratuit">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 btn-press text-white">Démarrer</Button>
              </Link>

              {/* Mobile hamburger — Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="md:hidden p-2" style={{ color: "var(--l-text-3)" }} aria-label="Menu">
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-[--l-bg-primary] border-[--l-border]">
                  <div className="flex flex-col gap-2 mt-8">
                    {NAV_LINKS.map((l) => (
                      <button key={l.id} onClick={() => handleNavClick(l.id)} className="block w-full text-left py-3 px-2 text-sm rounded-lg transition-colors hover:bg-[--l-surface]" style={{ color: "var(--l-text-2)" }}>{l.label}</button>
                    ))}
                    <div className="pt-4 mt-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--l-border)" }}>
                      <Link to="/auth"><Button variant="outline" className="w-full" style={{ borderColor: "var(--l-border)", color: "var(--l-text-2)" }}>Connexion</Button></Link>
                      <Link to="/auth"><Button className="w-full bg-blue-600 text-white">Démarrer gratuitement</Button></Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>

        <main>
        {/* ══════ 2. HERO ══════ */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ paddingTop: showUrgencyBanner ? "5rem" : "4rem" }}>
          <div className="hero-glow absolute inset-0" />
          {/* #9 — Dot grid background */}
          <div className="absolute inset-0 dot-grid" />
          {/* Profession-specific background illustration */}
          <HeroBgIllustration profileId={PROFILES[selectedProfile].id} />
          {/* Animated blob shapes (#11 #39) */}
          <div className="absolute top-20 left-[10%] h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" style={{ animation: "blob1 12s ease-in-out infinite" }} />
          <div className="absolute bottom-20 right-[10%] h-96 w-96 rounded-full bg-indigo-600/8 blur-3xl" style={{ animation: "blob2 15s ease-in-out infinite" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-purple-600/6 blur-3xl" style={{ animation: "blob3 10s ease-in-out infinite" }} />

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            {/* Single clear badge */}
            <div className={`transition-all duration-1000 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Badge className="mb-8 border-blue-500/20 bg-blue-500/10 text-blue-400 px-4 py-1.5 text-sm">Plateforme LCB-FT — Nouvelle génération</Badge>
            </div>

            <h1 className={`mb-8 font-serif text-4xl font-bold leading-[1.1] tracking-tight transition-all duration-1000 delay-150 sm:text-5xl md:text-[56px] ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ letterSpacing: "-0.02em" }}>
              Soyez prêt pour votre<br />contrôle LAB.{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">Toujours.</span>
            </h1>

            <p className={`mx-auto mb-8 max-w-2xl text-lg leading-relaxed transition-all duration-1000 delay-300 sm:text-xl ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-3)" }}>
              Identification, scoring des risques, screening automatique et traçabilité complète — en 2 minutes par client.
            </p>

            {/* #21 — Profile switcher */}
            <div className={`mb-8 transition-all duration-1000 delay-400 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {PROFILES.map((p, i) => (
                  <button key={p.id} onClick={() => setSelectedProfile(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedProfile === i
                        ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                        : "border border-[--l-border] hover:border-blue-500/20 hover:bg-[--l-surface]"
                    }`}
                    style={selectedProfile !== i ? { color: "var(--l-text-4)" } : undefined}
                  >
                    <p.icon className={`h-3 w-3 ${selectedProfile === i ? p.color : ""}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-1000 delay-500 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Link to="/auth" aria-label="Demarrer l'essai gratuit de 14 jours">
                <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/25 btn-press text-white cta-glow">
                  Essai gratuit 14 jours <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base btn-press" style={{ borderColor: "var(--l-border)", color: "var(--l-text-2)" }} onClick={() => scrollTo("demo")} aria-label="Voir la demonstration du produit">
                Voir la démo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className={`mt-6 flex flex-wrap items-center justify-center gap-4 text-sm transition-all duration-1000 delay-700 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-5)" }}>
              <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Sans carte bancaire</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Hébergé en France</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Chiffrement AES-256</span>
            </div>
          </div>
        </section>

        {/* ══════ 3. SOCIAL PROOF + LOGOS ══════ */}
        <section className="border-y py-10" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-center text-sm mb-6" style={{ color: "var(--l-text-4)" }}>
              Utilisé par des cabinets soumis au contrôle de :
            </p>
            {/* Logo bar with stagger animation */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mb-6">
              {[LogoOEC, LogoCNCC, LogoCSN, LogoCNB, LogoTRACFIN, LogoDGCCRF].map((Logo, i) => (
                <div key={i} className="transition-all duration-700" style={{ transitionDelay: `${i * 150}ms` }}>
                  <Logo />
                </div>
              ))}
            </div>
            {/* Compliance badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              {["NPLAB 2020", "NPMQ 2025", "RGPD", "Hébergé en France 🇫🇷"].map((badge, i) => (
                <span key={badge} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-medium uppercase tracking-wider transition-all duration-500" style={{ borderColor: "var(--l-border)", color: "var(--l-text-4)", transitionDelay: `${i * 150 + 900}ms` }}>
                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                  {badge}
                </span>
              ))}
            </div>
            <SocialTicker />
          </div>
        </section>

        {/* ══════ 3b. LA DOULEUR (Pain section) ══════ */}
        <section id="douleur" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Votre conformité LCB-FT repose encore sur Excel ?
            </h2>
            <p data-reveal className="mx-auto mb-14 max-w-2xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Vous n'êtes pas seul. La majorité des cabinets gèrent encore leur LAB avec des tableurs et des dossiers papier. Jusqu'au jour du contrôle.
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { icon: Clock, color: "border-red-500/50", iconColor: "text-red-400", iconBg: "bg-red-500/10", title: "12h par mois perdues", desc: "Collecte manuelle des documents, vérification des listes, mise à jour des dossiers… Le temps que vous ne passez pas à conseiller vos clients." },
                { icon: AlertTriangle, color: "border-orange-500/50", iconColor: "text-orange-400", iconBg: "bg-orange-500/10", title: "Risque de sanctions", desc: "2 500 contrôles LAB prévus par l'Ordre en 2025. Un contrôle défavorable = nouveau contrôle dans 12 mois + risque disciplinaire." },
                { icon: FileX, color: "border-amber-500/50", iconColor: "text-amber-400", iconBg: "bg-amber-500/10", title: "Aucune traçabilité", desc: "Comment prouver vos diligences 3 ans après ? Excel ne conserve pas l'historique de vos vérifications." },
              ].map((card, i) => (
                <div key={card.title} data-reveal className={`rounded-2xl border-l-4 ${card.color} border border-[--l-border] bg-[--l-surface] p-6 backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700`} style={{ transitionDelay: `${i * 120 + 200}ms` }}>
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{card.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>{card.desc}</p>
                </div>
              ))}
            </div>

            <div data-reveal className="mt-12 text-center opacity-0 translate-y-10 transition-all duration-700 delay-500">
              <Link to="/auth">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/20 btn-press text-white h-11 px-6">
                  Découvrir la solution <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ══════ 4. POURQUOI GRIMY — #13 glow + #10 tilt ══════ */}
        <section id="fonctionnalites" className="py-28">
          <div className="mx-auto max-w-7xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Votre conformité LAB, automatisée
            </h2>
            <p data-reveal className="mx-auto mb-16 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Une base de données client simple et intuitive, conçue pour répondre à vos obligations LAB.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {whyCards.map((c, i) => (
                <TiltCard key={c.title}>
                  <GlowCard className="h-full rounded-2xl border p-8 backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                    <div data-reveal className="opacity-0 translate-y-10 transition-[opacity,transform] duration-700" style={{ transitionDelay: `${i * 100 + 100}ms` }}>
                      <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl ${c.iconBg}`}>
                        <c.icon className={`h-7 w-7 ${c.iconColor}`} />
                      </div>
                      <h3 className="mb-3 text-lg font-bold">{c.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>{c.desc}</p>
                    </div>
                  </GlowCard>
                </TiltCard>
              ))}
            </div>

            {/* #18 — Features list with badges */}
            <div data-reveal className="mt-14 flex flex-wrap items-center justify-center gap-3 opacity-0 translate-y-10 transition-all duration-700 delay-500">
              {allFeatures.map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--l-border)", color: "var(--l-text-3)" }}>
                  <Check className="h-3 w-3 text-blue-400" />
                  {f.name}
                  {f.badge && (
                    <Badge className={`ml-1 text-[10px] px-1.5 py-0 ${f.badge === "Nouveau" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                      {f.badge}
                    </Badge>
                  )}
                </span>
              ))}
            </div>

            {/* #16 — SVG Circle counters + #5 before/after + #12 trust metrics */}
            <div data-reveal className="mt-20 opacity-0 translate-y-10 transition-all duration-700 delay-300">
              <p className="text-center text-sm font-medium mb-8" style={{ color: "var(--l-text-4)" }}>Résultats mesurés</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 justify-items-center">
                <CircleCounter value={9} label="APIs vérifiées" color="#3B82F6" />
                <CircleCounter value={30} suffix="s" label="par screening" color="#3B82F6" />
                <CircleCounter value={98} suffix="%" label="taux de conformité" color="#10B981" />
                <CircleCounter value={150} suffix="+" label="cabinets équipés" color="#10B981" />
              </div>
              {/* #5 — Before/after results */}
              <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
                {[
                  { label: "Temps de screening", before: "2 heures", after: "30 secondes" },
                  { label: "Taux de conformité", before: "60%", after: "98%" },
                  { label: "Coût par dossier*", before: "45€", after: "3€" },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--l-text-4)" }}>{r.label}</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm line-through" style={{ color: "var(--l-text-5)" }}>{r.before}</span>
                      <ArrowRight className="h-3 w-3 text-blue-400" />
                      <span className="text-sm font-bold text-emerald-400">{r.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════ Sécurité & Conformité ══════ */}
        <section id="securite" className="py-16 border-y" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-5xl px-6">
            <div data-reveal className="grid grid-cols-2 sm:grid-cols-4 gap-8 opacity-0 translate-y-10 transition-all duration-700">
              {[
                { icon: Shield, label: "Conforme RGPD", desc: "DPO désigné, registre de traitements" },
                { icon: Lock, label: "Chiffrement AES-256", desc: "Données sensibles chiffrées E2E" },
                { icon: Globe, label: "Hébergement France", desc: "Serveurs Supabase EU-West" },
                { icon: BarChart3, label: "SOC 2-ready", desc: "Audit trail certifié, immutable" },
              ].map((item) => (
                <div key={item.label} className="text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                    <item.icon className="h-6 w-6 text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--l-text)" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: "var(--l-text-4)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* ══════ DEMO + VIDEO — #1 + #2 ══════ */}
        <section id="demo" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Essayez par vous-même
            </h2>
            <p data-reveal className="mx-auto mb-16 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Lancez un screening de démonstration et voyez les résultats en temps réel.
            </p>
            <div data-reveal className="opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <InteractiveDemo />
            </div>
            {/* Video section removed — placeholder not professional */}
          </div>
        </section>

        <WaveDivider flip />

        {/* ══════ #15 — TIMELINE ══════ */}
        <section id="timeline" className="py-28">
          <div className="mx-auto max-w-4xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Comment ça marche
            </h2>
            <p data-reveal className="mx-auto mb-16 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              De l'entrée du SIREN au dossier complet, en 6 étapes automatisées.
            </p>

            <div ref={tlProgress.ref} className="relative ml-6 sm:ml-0 sm:max-w-lg sm:mx-auto">
              {/* Background line */}
              <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-0.5 rounded-full" style={{ background: "var(--l-border)" }}>
                <div className="w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-emerald-400 timeline-line-fill" style={{ height: `${tlProgress.progress * 100}%` }} />
              </div>

              <div className="space-y-10">
                {timelineSteps.map((step, i) => {
                  const isActive = tlProgress.progress >= (i / (timelineSteps.length - 1)) - 0.05;
                  return (
                    <div key={step.title} data-reveal className="relative flex gap-5 sm:gap-6 opacity-0 translate-y-10 transition-all duration-700" style={{ transitionDelay: `${i * 80}ms` }}>
                      {/* Dot */}
                      <div className={`relative z-10 flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        isActive
                          ? "border-blue-500 bg-blue-500/20"
                          : "bg-[--l-bg-primary]"
                      }`} style={{ borderColor: isActive ? undefined : "var(--l-border)" }}>
                        <step.icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-500 ${isActive ? "text-blue-400" : ""}`} style={{ color: isActive ? undefined : "var(--l-text-5)" }} />
                      </div>
                      {/* Content */}
                      <div className="pt-1 sm:pt-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base">{step.title}</h4>
                          {i === timelineSteps.length - 1 && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">2 min</Badge>}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* ══════ FEATURE SHOWCASE — #11 animated mocks ══════ */}
        <section className="py-28">
          <div className="mx-auto max-w-6xl px-6 space-y-16 lg:space-y-28">
            {featureShowcase.map((f, i) => {
              const Mock = MOCKS[f.mock];
              return (
                <div key={f.title} data-reveal className={`flex flex-col items-center gap-12 opacity-0 translate-y-10 transition-all duration-700 lg:flex-row ${f.reverse ? "lg:flex-row-reverse" : ""}`} style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="flex-1 space-y-5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.iconBg}`}>
                      <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <h3 className="font-serif text-2xl font-bold sm:text-3xl">{f.title}</h3>
                    <p className="text-base leading-relaxed max-w-lg" style={{ color: "var(--l-text-3)" }}>{f.desc}</p>
                    <button onClick={() => scrollTo("demo")} className="inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      Voir en action <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 w-full max-w-md"><Mock /></div>
                </div>
              );
            })}
          </div>
        </section>

        <WaveDivider flip />

        {/* ══════ COMPARAISON — #14 highlighted column ══════ */}
        <section id="comparaison" className="py-28">
          <div className="mx-auto max-w-5xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">GRIMY vs Excel</h2>
            <p data-reveal className="mx-auto mb-14 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Comparez votre méthode actuelle à une solution dédiée à la conformité LAB.
            </p>

            {/* Desktop table — GRIMY vs Excel */}
            <div data-reveal className="hidden md:block overflow-x-auto rounded-2xl border backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700 delay-200" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--l-border)" }}>
                    <th className="px-6 py-5 text-left text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Fonctionnalité</th>
                    <th className="px-6 py-5 text-center grimy-col rounded-tl-lg">
                      <span className="text-sm font-bold text-emerald-400">GRIMY</span>
                    </th>
                    <th className="px-6 py-5 text-center text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Excel / Manuel</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label} className="table-row-hover" style={{ borderBottom: "1px solid var(--l-border-subtle)" }}>
                      <td className="px-6 py-4" style={{ color: "var(--l-text-2)" }}>{row.label}</td>
                      <td className="px-6 py-4 text-center grimy-col"><CompCell value={row.grimy} accent /></td>
                      <td className="px-6 py-4 text-center"><CompCell value={row.excel} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div data-reveal className="md:hidden space-y-3 opacity-0 translate-y-10 transition-all duration-700 delay-200">
              {comparison.map((row) => <CompMobileCard key={row.label} row={row} />)}
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* ══════ ROI CALCULATOR ══════ */}
        <section id="roi" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Combien vous coûte votre conformité aujourd'hui ?
            </h2>
            <p data-reveal className="mx-auto mb-14 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Déplacez les curseurs pour estimer vos économies avec GRIMY.
            </p>
            <div data-reveal className="max-w-lg mx-auto opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <ROICalculator />
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* ══════ TARIFS + #3 pricing table ══════ */}
        <section id="tarifs" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">Tarifs transparents</h2>
            <p data-reveal className="mx-auto mb-10 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Des plans adaptés à chaque taille de structure. Sans engagement.
            </p>

            {/* #5 accessible toggle */}
            <div data-reveal className="mb-14 flex items-center justify-center gap-3 opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <span className="text-sm" style={{ color: !annual ? "var(--l-text)" : "var(--l-text-4)" }}>Mensuel</span>
              <button role="switch" aria-checked={annual} aria-label="Basculer tarification annuelle"
                onClick={() => setAnnual(!annual)}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAnnual(!annual); } }}
                className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${annual ? "bg-blue-600" : ""}`}
                style={{ background: annual ? undefined : "var(--l-toggle-off)" }}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${annual ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm" style={{ color: annual ? "var(--l-text)" : "var(--l-text-4)" }}>
                Annuel <Badge className="ml-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">-20%</Badge>
              </span>
            </div>

            {/* Plan cards — flex layout for aligned buttons */}
            <div className="grid gap-8 lg:grid-cols-3 items-stretch">
              {plans.map((plan, i) => {
                const price = plan.price === 0 ? null : annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <TiltCard key={plan.name}>
                    <GlowCard className={`h-full rounded-2xl border backdrop-blur-sm ${plan.popular ? "ring-1 ring-blue-500/20" : ""}`}
                      style={{ borderColor: plan.popular ? "rgba(59,130,246,0.4)" : "var(--l-border)", background: "var(--l-surface)" }}
                    >
                      <div data-reveal className="flex flex-col h-full p-8 opacity-0 translate-y-10 transition-[opacity,transform] duration-700" style={{ transitionDelay: `${i * 120 + 200}ms` }}>
                        {/* Populaire badge — inline, not absolute */}
                        {plan.popular ? (
                          <div className="mb-4">
                            <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 px-3 py-1">Le plus populaire</Badge>
                          </div>
                        ) : (
                          <div className="mb-4 h-6" /> /* spacer for alignment */
                        )}

                        <div className="mb-4">
                          <h3 className="text-xl font-bold">{plan.name}</h3>
                          <p className="mt-1 text-sm" style={{ color: "var(--l-text-4)" }}>{plan.desc}</p>
                        </div>

                        {/* Price — fixed height for alignment */}
                        <div className="mb-6 h-16 flex items-end">
                          {price !== null ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-5xl font-bold font-serif">{price}€</span>
                              <span style={{ color: "var(--l-text-4)" }}>/mois</span>
                              {annual && (
                                <span className="ml-2 text-sm line-through" style={{ color: "var(--l-text-5)" }}>{plan.price}€</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-3xl font-bold font-serif">Sur devis</span>
                          )}
                        </div>

                        {/* Features — flex-1 to push button to bottom */}
                        <ul className="space-y-3 flex-1">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--l-text-2)" }}>
                              <Check className="h-4 w-4 shrink-0 text-blue-400" />{f}
                            </li>
                          ))}
                        </ul>

                        {/* CTA — always at bottom */}
                        <div className="mt-8 space-y-2">
                          {plan.price === 0 ? (
                            <a href="mailto:contact@grimy.fr?subject=Demande Enterprise" className="block">
                              <Button className="w-full h-12 btn-press bg-[--l-surface-raised] hover:opacity-80 text-base" style={{ color: "var(--l-text)" }}>
                                {plan.cta}
                              </Button>
                            </a>
                          ) : (
                            <Link to="/auth" className="block">
                              <Button className={`w-full h-12 btn-press text-base ${plan.popular ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/20 text-white" : "bg-[--l-surface-raised] hover:opacity-80"}`} style={plan.popular ? {} : { color: "var(--l-text)" }}>
                                {plan.cta}
                              </Button>
                            </Link>
                          )}
                          <p className="text-center text-xs" style={{ color: "var(--l-text-5)" }}>
                            {plan.price > 0 ? "Sans carte bancaire" : "Démonstration personnalisée"}
                          </p>
                        </div>
                      </div>
                    </GlowCard>
                  </TiltCard>
                );
              })}
            </div>

            <div data-reveal className="mt-10 opacity-0 translate-y-10 transition-all duration-700 delay-300">
              <div className="mx-auto max-w-md rounded-xl border p-4 text-center" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <span className="font-bold text-sm">Garantie satisfait ou remboursé 30 jours</span>
                </div>
                <p className="text-xs" style={{ color: "var(--l-text-4)" }}>
                  Si GRIMY ne vous convient pas, nous vous remboursons intégralement. Sans question. Sans condition.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                {[
                  { icon: Globe, label: "Hébergement France" },
                  { icon: Sparkles, label: "Mises à jour gratuites" },
                  { icon: FileText, label: "Export PDF illimité" },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--l-text-5)" }}>
                    <item.icon className="h-3 w-3" />{item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* #3 — Pricing feature comparison table */}
            <div data-reveal className="mt-14 text-center opacity-0 translate-y-10 transition-all duration-700">
              <button onClick={() => setShowPricingTable(!showPricingTable)} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
                {showPricingTable ? "Masquer" : "Voir"} le comparatif détaillé
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showPricingTable ? "rotate-180" : ""}`} />
              </button>

              {showPricingTable && (
                <div className="mt-6 overflow-x-auto rounded-2xl border backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--l-border)" }}>
                        <th className="px-5 py-4 text-left font-medium" style={{ color: "var(--l-text-4)" }}>Fonctionnalité</th>
                        <th className="px-5 py-4 text-center font-medium" style={{ color: "var(--l-text-3)" }}>Solo</th>
                        <th className="px-5 py-4 text-center font-bold text-blue-400 grimy-col">Pro</th>
                        <th className="px-5 py-4 text-center font-medium" style={{ color: "var(--l-text-3)" }}>Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingFeatures.map((pf, i) => (
                        <tr key={pf.name} className="table-row-hover" style={{ borderBottom: i < pricingFeatures.length - 1 ? "1px solid var(--l-border-subtle)" : "none" }}>
                          <td className="px-5 py-3" style={{ color: "var(--l-text-2)" }}>{pf.name}</td>
                          <td className="px-5 py-3 text-center"><CompCell value={pf.solo} /></td>
                          <td className="px-5 py-3 text-center grimy-col"><CompCell value={pf.cabinet} accent /></td>
                          <td className="px-5 py-3 text-center"><CompCell value={pf.enterprise} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <WaveDivider flip />

        {/* ══════ TÉMOIGNAGES — #20 carousel ══════ */}
        <section id="temoignages" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Ce qu'en disent nos utilisateurs
            </h2>
            <p data-reveal className="mx-auto mb-14 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Des professionnels de toutes tailles nous font confiance.
            </p>

            {/* Testimonial grid (5 cards, wraps naturally) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <TiltCard key={t.name}>
                  <GlowCard className="h-full rounded-2xl border p-7 backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                    <div data-reveal className="opacity-0 translate-y-10 transition-[opacity,transform] duration-700" style={{ transitionDelay: `${i * 100}ms` }}>
                      <div className="flex items-center justify-between mb-4">
                        <Quote className="h-6 w-6 text-blue-500/30" />
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="mb-6 text-base leading-relaxed italic" style={{ color: "var(--l-text-2)" }}>
                        &laquo; {t.quote} &raquo;
                      </p>
                      {/* #13 — Avatar with initials + detail */}
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>{t.initials}</div>
                        <div>
                          <p className="text-sm font-semibold">{t.name}</p>
                          <p className="text-xs" style={{ color: "var(--l-text-4)" }}>{t.title} — {t.cabinet}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--l-text-5)" }}>{t.detail}</p>
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ FOUNDER STORY ══════ */}
        <section className="py-28">
          <div className="mx-auto max-w-4xl px-6">
            <div data-reveal className="rounded-2xl border p-8 sm:p-12 backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700 relative overflow-hidden" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-blue-600/5 blur-3xl" />
              <div className="relative flex flex-col md:flex-row gap-8 items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20">
                  <span className="text-2xl font-bold font-serif text-blue-400">G</span>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold mb-4">Créé par un expert-comptable, pour les experts-comptables</h3>
                  <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>
                    <p>
                      « Quand j'ai subi mon premier contrôle LAB, j'ai passé 3 semaines à reconstituer mes dossiers depuis des tableurs Excel dispersés. J'ai réalisé que le problème n'était pas le manque de bonne volonté, mais le manque d'outils adaptés. »
                    </p>
                    <p>
                      « GRIMY est né de cette frustration. Chaque fonctionnalité répond à une obligation réglementaire précise, mappée sur la NPLAB 2020. Pas de gadgets inutiles — uniquement ce qui vous sera demandé le jour du contrôle. »
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">FB</div>
                    <div>
                      <p className="text-sm font-semibold">Fondateur de GRIMY</p>
                      <p className="text-xs" style={{ color: "var(--l-text-4)" }}>Expert-comptable inscrit · DEC</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ #14 — FAQ styled ══════ */}
        <section id="faq" className="border-t py-28" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-3xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Questions fréquentes
            </h2>
            <p data-reveal className="mx-auto mb-14 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Tout ce que vous devez savoir avant de commencer.
            </p>

            <div data-reveal className="opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <Accordion type="single" collapsible defaultValue="faq-0" className="space-y-3">
                {faqItems.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}
                    className="rounded-xl border px-6 backdrop-blur-sm overflow-hidden transition-colors hover:border-blue-500/20"
                    style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}
                  >
                    <AccordionTrigger className="text-sm font-medium hover:text-blue-400 transition-colors py-5 hover:no-underline [&[data-state=open]>svg]:rotate-180 gap-3">
                      {/* #19 — FAQ icons */}
                      <div className="flex items-center gap-3 text-left">
                        <item.icon className="h-4 w-4 text-blue-400/60 shrink-0" />
                        <span>{item.q}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed pb-5 pl-7" style={{ color: "var(--l-text-3)" }}>
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div data-reveal className="mt-10 text-center opacity-0 translate-y-10 transition-all duration-700 delay-300">
              <p className="text-sm mb-3" style={{ color: "var(--l-text-4)" }}>Vous avez d'autres questions ?</p>
              <a href="mailto:contact@grimy.fr?subject=Question" className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                <MessageCircle className="h-4 w-4" />Écrivez-nous — réponse sous 24h
              </a>
            </div>
          </div>
        </section>

        {/* ══════ CTA FINAL — #6 email + #15 ══════ */}
        <section className="py-28">
          <div data-reveal className="mx-auto max-w-5xl px-6 opacity-0 translate-y-10 transition-all duration-700">
            <div className="rounded-3xl bg-gradient-to-r from-violet-600/20 via-purple-500/10 to-indigo-600/20 border border-purple-500/20 p-12 sm:p-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-20" />
              <div className="relative">
                <h2 className="mb-4 font-serif text-3xl font-bold sm:text-4xl" style={{ letterSpacing: "-0.02em" }}>Prêt à automatiser votre conformité ?</h2>
                <p className="mx-auto mb-8 max-w-lg text-lg" style={{ color: "var(--l-text-3)" }}>Rejoignez les cabinets qui ont choisi la sérénité plutôt que le stress.</p>
                {/* #6 — Email passthrough form + #7 validation + #16 loading */}
                <form onSubmit={handleCtaSubmit} className="mx-auto max-w-md">
                  <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <input
                      type="email"
                      placeholder="votre@email.com"
                      value={ctaEmail}
                      onChange={(e) => { setCtaEmail(e.target.value); setCtaError(""); }}
                      className={`flex-1 h-12 rounded-lg border px-4 text-sm backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${ctaError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500"}`}
                      style={{ borderColor: ctaError ? undefined : "var(--l-border)", background: "var(--l-surface)", color: "var(--l-text)" }}
                      aria-invalid={!!ctaError}
                      aria-describedby={ctaError ? "cta-error" : undefined}
                    />
                    <Button type="submit" disabled={ctaLoading} className="h-12 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25 btn-press whitespace-nowrap text-white disabled:opacity-60">
                      {ctaLoading ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" /> : null}
                      Démarrer — 14 jours gratuits {!ctaLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                  {ctaError && <p id="cta-error" className="mt-2 text-xs text-red-400">{ctaError}</p>}
                </form>
                <p className="mt-4 text-xs" style={{ color: "var(--l-text-5)" }}>Sans carte bancaire · 14 jours gratuits · Annulation en 1 clic</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
                  {[
                    { icon: Shield, label: "RGPD" },
                    { icon: Globe, label: "Hébergement France" },
                    { icon: Lock, label: "Chiffrement AES-256" },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs" style={{ color: "var(--l-text-4)" }}>
                      <b.icon className="h-3.5 w-3.5 text-violet-400/60" />
                      {b.label}
                    </div>
                  ))}
                </div>
                {/* Calendly link */}
                <div className="mt-6">
                  <a href="mailto:contact@grimy.fr?subject=Réserver un appel de 15 min" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <MessageCircle className="h-4 w-4" />
                    Une question ? Réservez un appel de 15 min avec notre équipe
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ FOOTER — #8 working links ══════ */}
        </main>
        <footer aria-label="Pied de page" className="border-t py-16" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <span className="text-lg font-bold font-serif">GRIMY</span>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--l-text-4)" }}>Base de données client<br />et conformité LAB<br />pour professionnels assujettis</p>
              </div>
              {footerSections.map((sec) => (
                <div key={sec.title}>
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--l-text-3)" }}>{sec.title}</h4>
                  <ul className="space-y-2.5">
                    {sec.links.map((link) => (
                      <li key={link.label}>
                        {link.mailto ? (
                          <a href={`mailto:${link.mailto}`} className="text-sm transition-colors hover:text-blue-400" style={{ color: "var(--l-text-4)" }}>{link.label}</a>
                        ) : link.href ? (
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:text-blue-400" style={{ color: "var(--l-text-4)" }}>{link.label}</a>
                        ) : link.id ? (
                          <a href={`#${link.id}`} onClick={(e) => { e.preventDefault(); scrollTo(link.id!); setLegalModal(link.id!.startsWith("legal-") ? link.id! as LegalModalType : null); }} className="text-sm transition-colors hover:text-blue-400" style={{ color: "var(--l-text-4)" }}>{link.label}</a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row" style={{ borderColor: "var(--l-border)" }}>
              <p className="text-xs" style={{ color: "var(--l-text-5)" }}>&copy; {new Date().getFullYear()} GRIMY — Conformité LCB-FT</p>
              <div className="flex items-center gap-4">
                <a href="mailto:contact@grimy.fr" className="text-xs transition-colors hover:text-blue-400" style={{ color: "var(--l-text-5)" }}>Contact</a>
                <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-xs transition-colors hover:text-blue-400 flex items-center gap-1" style={{ color: "var(--l-text-5)" }}>
                  <ArrowUp className="h-3 w-3" />Haut
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <ScrollToTop />

      {/* ══════ #4 — STICKY CTA BAR (appears after hero) ══════ */}
      {!heroInView && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t p-3 backdrop-blur-xl sm:hidden transition-all sticky-cta-safe" style={{ borderColor: "var(--l-border)", background: "var(--l-bg-blur)" }}>
          <Link to="/auth" className="block" aria-label="Demarrer a partir de 29 euros par mois">
            <Button className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25 btn-press text-white cta-glow">
              Démarrer — À partir de 29€/mois <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* ══════ Legal modal ══════ */}
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}

      {/* ══════ #18 — Cookie consent banner (RGPD) ══════ */}
      {cookies.show && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t p-4 backdrop-blur-xl" style={{ borderColor: "var(--l-border)", background: "var(--l-bg-blur-heavy)" }}>
          <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>
                Ce site utilise le stockage local pour mémoriser vos préférences (thème, consentement). Aucun cookie tiers ni tracker publicitaire. Consultez notre{" "}
                <button onClick={() => { cookies.accept(); setLegalModal("legal-rgpd"); }} className="text-blue-400 underline">politique de confidentialité</button>.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={cookies.reject} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ color: "var(--l-text-3)", border: "1px solid var(--l-border)" }}>
                Refuser
              </button>
              <button onClick={cookies.accept} className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors btn-press">
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
