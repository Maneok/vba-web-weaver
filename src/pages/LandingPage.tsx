import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
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
  Shield, FileText, Calculator, FileCheck, Check, X, Minus,
  ArrowRight, ClipboardCheck, Search, Monitor, Quote,
  ChevronRight, Menu, X as XIcon, ChevronDown, Sun, Moon,
  Lock, HelpCircle, CreditCard, Database, Globe, Users,
  Sparkles, Play, Zap, Cookie,
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

const SECTIONS = ["fonctionnalites", "demo", "timeline", "comparaison", "tarifs", "temoignages", "faq"] as const;

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
      const scrolled = -rect.top + window.innerHeight * 0.3;
      setProgress(Math.min(Math.max(scrolled / total, 0), 1));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return { ref, progress };
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
            background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, rgba(59,130,246,0.12), transparent 60%)`,
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
    <div className={`w-full overflow-hidden leading-[0] ${flip ? "rotate-180" : ""} ${className}`}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-10 sm:h-14">
        <path
          d="M0,30 C240,55 480,5 720,30 C960,55 1200,5 1440,30 L1440,60 L0,60 Z"
          className="fill-white/[0.02]"
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
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
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

function InteractiveDemo() {
  const [stage, setStage] = useState<"idle" | "running" | "done">("idle");
  const [completed, setCompleted] = useState(0);
  const [score, setScore] = useState(0);
  const timers = useRef<number[]>([]);

  const cleanup = () => timers.current.forEach(clearTimeout);

  const run = () => {
    cleanup();
    setStage("running");
    setCompleted(0);
    setScore(0);
    DEMO_APIS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => {
        setCompleted(i + 1);
        if (i === DEMO_APIS.length - 1) {
          timers.current.push(window.setTimeout(() => {
            setStage("done");
            let s = 0;
            const iv = setInterval(() => { s += 3; setScore(s); if (s >= 72) clearInterval(iv); }, 25);
          }, 500));
        }
      }, 400 * (i + 1)));
    });
  };

  useEffect(() => cleanup, []);

  return (
    <div className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm max-w-lg mx-auto">
      <div className="rounded-xl p-6" style={{ background: "var(--l-mock-bg)" }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-[--l-text-4]">Screening — Démonstration</span>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 rounded-lg bg-white/5 border border-[--l-border] px-4 py-2.5 text-sm font-mono text-[--l-text-2]">
            SIREN : 831 562 749
          </div>
          <button
            onClick={run}
            disabled={stage === "running"}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors btn-press"
          >
            {stage === "idle" ? "Lancer" : stage === "running" ? "En cours..." : "Relancer"}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/5 mb-5">
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
                  done ? "bg-emerald-500/10" : current ? "bg-blue-500/10" : "bg-white/[0.02]"
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

        {/* Score result */}
        {stage === "done" && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center justify-between animate-in fade-in">
            <div>
              <p className="text-sm font-medium text-emerald-400">Screening terminé</p>
              <p className="text-xs text-emerald-400/60">9/9 sources vérifiées — 0 alerte</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-emerald-400 font-serif">{score}</span>
              <span className="text-sm text-emerald-400/70">/100</span>
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
      <div className="absolute inset-0 dot-grid opacity-30" />

      {!playing ? (
        <div className="relative flex flex-col items-center justify-center h-full gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/90 shadow-lg shadow-blue-600/30 group-hover:bg-blue-500 transition-colors pulse-play">
            <Play className="h-7 w-7 text-white ml-1" />
          </div>
          <p className="text-sm font-medium text-[--l-text-3]">Découvrir GRIMY en 60 secondes</p>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center h-full gap-3">
          <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
          <p className="text-sm text-[--l-text-3]">Vidéo de démonstration — bientôt disponible</p>
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
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let c = 0;
        const iv = setInterval(() => { c++; setApiCount(c); if (c >= 9) clearInterval(iv); }, 350);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm">
      <div className="rounded-xl p-5" style={{ background: "var(--l-mock-bg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Nouveau client — Étape 1/6</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 mb-5">
          <div className="h-1.5 w-1/6 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" />
        </div>
        <div className="space-y-2.5">
          {[["SIREN", "831 562 749"], ["Société", "SAS Exemple & Associés"], ["Activité", "6920Z — Comptabilité"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5">
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
              <div key={i} className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${i < apiCount ? (apiCount >= 9 ? "bg-emerald-400" : "bg-blue-400") : "bg-white/10"}`} />
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
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" /><div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Contrôle qualité</span>
        </div>
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm text-[--l-text-3]">{r.label}</span>
                <span className="text-sm font-semibold text-[--l-text]">{r.val}</span>
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

function AnimatedMockDashboard() {
  const [bars] = useState([65, 82, 45, 90, 70, 55, 78]);
  return (
    <div className="rounded-2xl border border-[--l-border] bg-[--l-surface] p-1.5 backdrop-blur-sm">
      <div className="rounded-xl p-5" style={{ background: "var(--l-mock-bg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" /><div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 text-[11px] text-[--l-text-5]">Dashboard — Vue d'ensemble</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[{ l: "Clients", v: "142", c: "text-blue-400" }, { l: "Alertes", v: "3", c: "text-yellow-400" }, { l: "Échues", v: "2", c: "text-red-400" }].map((k) => (
            <div key={k.l} className="rounded-lg bg-white/5 px-3 py-2.5 text-center">
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
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["grimy", "kanta", "excel"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <span className={`text-[10px] uppercase tracking-wider ${k === "grimy" ? "text-emerald-400 font-semibold" : "text-[--l-text-5]"}`}>
              {k === "grimy" ? "GRIMY" : k === "kanta" ? "Kanta" : "Excel"}
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
  if (value === "yes") return <Check className={`mx-auto h-5 w-5 ${accent ? "text-emerald-400" : "text-gray-400"}`} />;
  if (value === "no") return <X className="mx-auto h-5 w-5 text-red-400/60" />;
  if (value === "partial") return <Minus className="mx-auto h-5 w-5 text-yellow-400/70" />;
  return <span className={`text-sm ${accent ? "text-emerald-400 font-semibold" : "text-[--l-text-3]"}`}>{value}</span>;
}

/* #20 — Social proof ticker */
function SocialTicker() {
  const msgs = [
    "Cabinet Dupont a créé 3 dossiers aujourd'hui",
    "42 screenings lancés cette semaine",
    "Score moyen des cabinets : 78/100",
    "Cabinet Martin — contrôle passé sans observation",
    "12 lettres de mission générées aujourd'hui",
    "Nouveau cabinet inscrit à Marseille",
  ];
  return (
    <div className="overflow-hidden py-3">
      <div className="flex animate-ticker whitespace-nowrap gap-12">
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
  { label: "À propos", id: "temoignages" },
];

const whyCards = [
  { icon: Shield, title: "Screening automatique", desc: "9 APIs vérifiées en 30 secondes : INPI, OpenSanctions, BODACC, DG Trésor, Google Places...", badge: null },
  { icon: FileCheck, title: "Documents récupérés", desc: "Statuts, comptes annuels, Kbis — téléchargés automatiquement depuis l'INPI et stockés dans votre GED.", badge: null },
  { icon: Calculator, title: "Scoring 6 axes", desc: "Activité, pays, mission, maturité, structure + malus. Évaluation objective, traçable et conforme NPLAB.", badge: null },
  { icon: FileText, title: "Lettre de mission", desc: "Modèle réutilisable, remplissage auto des données client, export PDF/DOCX en un clic.", badge: null },
];

const featureShowcase = [
  { title: "Créez un dossier client en 2 minutes", desc: "Entrez un SIREN. GRIMY récupère automatiquement les données INPI, vérifie les sanctions, télécharge les statuts, calcule le score de risque et pré-remplit la lettre de mission.", icon: Search, mock: "step" as const, reverse: false },
  { title: "Prêt pour le contrôle CROEC", desc: "Registre LCB-FT, journal d'audit, contrôle qualité — tout est documenté et traçable. Le contrôleur peut visualiser vos dossiers en autonomie.", icon: ClipboardCheck, mock: "audit" as const, reverse: true },
  { title: "Dashboard de pilotage", desc: "Visualisez en un coup d'œil : clients actifs, alertes en cours, revues échues, score moyen. Diagnostic 360° avec recommandations.", icon: Monitor, mock: "dashboard" as const, reverse: false },
];

const MOCKS = { step: AnimatedMockStep, audit: AnimatedMockAudit, dashboard: AnimatedMockDashboard };

/* #15 — Timeline steps */
const timelineSteps = [
  { title: "Entrez un SIREN", desc: "Une seule donnée suffit pour démarrer tout le processus.", icon: Search },
  { title: "Screening automatique", desc: "9 APIs interrogées en parallèle. Sanctions, PEP, gel des avoirs, BODACC.", icon: Shield },
  { title: "Documents INPI", desc: "Statuts, Kbis, comptes annuels PDF récupérés et archivés dans la GED.", icon: FileCheck },
  { title: "Scoring NPLAB", desc: "6 axes analysés. Score objectif, traçable, conforme aux normes professionnelles.", icon: Calculator },
  { title: "Lettre de mission", desc: "Pré-remplie avec les données client. Export PDF/DOCX en un clic.", icon: FileText },
  { title: "Dossier complet", desc: "Tout est documenté, archivé, prêt pour le contrôle. 2 minutes chrono.", icon: Check },
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

/* #18 — Features with badges */
const allFeatures = [
  { name: "Screening 9 APIs", badge: null },
  { name: "Documents INPI", badge: null },
  { name: "Scoring 6 axes", badge: null },
  { name: "Lettre de mission", badge: null },
  { name: "GED documentaire", badge: null },
  { name: "Registre LCB-FT", badge: null },
  { name: "Contrôle qualité", badge: null },
  { name: "Journal d'audit", badge: null },
  { name: "OCR Cloud Vision", badge: "Nouveau" as const },
  { name: "Diagnostic 360°", badge: null },
  { name: "Gouvernance équipe", badge: null },
  { name: "API publique", badge: "Bientôt" as const },
];

const plans = [
  { name: "Solo", price: 29, desc: "Pour les indépendants", features: ["1 utilisateur", "50 clients", "Screening complet", "Lettre de mission", "GED 5 Go"], cta: "Commencer", popular: false },
  { name: "Cabinet", price: 79, desc: "Pour les cabinets en croissance", features: ["5 utilisateurs", "200 clients", "Tout Solo +", "Contrôle qualité", "Multi-rôles", "Support prioritaire"], cta: "Commencer", popular: true },
  { name: "Enterprise", price: 0, desc: "Pour les grands cabinets", features: ["Utilisateurs illimités", "Clients illimités", "Tout Cabinet +", "SSO", "API", "Formation", "Référent dédié"], cta: "Nous contacter", popular: false },
];

/* #3 — Pricing comparison features */
const pricingFeatures = [
  { name: "Utilisateurs", solo: "1", cabinet: "5", enterprise: "Illimité" },
  { name: "Clients", solo: "50", cabinet: "200", enterprise: "Illimité" },
  { name: "Screening APIs", solo: "yes", cabinet: "yes", enterprise: "yes" },
  { name: "Lettre de mission", solo: "yes", cabinet: "yes", enterprise: "yes" },
  { name: "GED", solo: "5 Go", cabinet: "20 Go", enterprise: "Illimité" },
  { name: "Contrôle qualité", solo: "no", cabinet: "yes", enterprise: "yes" },
  { name: "Multi-rôles", solo: "no", cabinet: "yes", enterprise: "yes" },
  { name: "SSO / SAML", solo: "no", cabinet: "no", enterprise: "yes" },
  { name: "API", solo: "no", cabinet: "no", enterprise: "yes" },
  { name: "Support", solo: "Email", cabinet: "Prioritaire", enterprise: "Dédié" },
];

const testimonials = [
  { quote: "Nous avons passé notre contrôle LAB sans aucune observation grâce à GRIMY.", name: "Marc D.", title: "Expert-comptable", cabinet: "Cabinet marseillais", initials: "MD", color: "bg-blue-500/20 text-blue-400" },
  { quote: "Le screening automatique nous fait gagner 2 heures par nouveau client.", name: "Sophie L.", title: "Collaboratrice", cabinet: "Cabinet 15 personnes", initials: "SL", color: "bg-emerald-500/20 text-emerald-400" },
  { quote: "Enfin un outil conçu par quelqu'un qui comprend nos obligations.", name: "Thomas R.", title: "Associé", cabinet: "Cabinet parisien", initials: "TR", color: "bg-purple-500/20 text-purple-400" },
  { quote: "L'intégration INPI nous a convaincu. Plus besoin de naviguer sur 5 sites différents.", name: "Claire B.", title: "Responsable conformité", cabinet: "Cabinet lyonnais", initials: "CB", color: "bg-amber-500/20 text-amber-400" },
  { quote: "Le scoring 6 axes est redoutable de précision. Nos contrôleurs sont impressionnés.", name: "Philippe M.", title: "Associé signataire", cabinet: "Cabinet 30 personnes", initials: "PM", color: "bg-pink-500/20 text-pink-400" },
];

const faqItems = [
  { q: "Mes données sont-elles sécurisées ?", a: "Toutes les données sont hébergées en France (Supabase EU-West), chiffrées au repos (AES-256) et en transit (TLS 1.3). Les champs sensibles (IBAN, CNI) bénéficient d'un chiffrement applicatif AES-GCM supplémentaire. Nous sommes conformes au RGPD.", icon: Lock },
  { q: "Puis-je migrer depuis Excel ou un autre outil ?", a: "Oui. Importez vos clients existants via un fichier CSV. Les données INPI et le screening sont relancés automatiquement pour enrichir chaque fiche.", icon: Database },
  { q: "Y a-t-il un engagement de durée ?", a: "Aucun engagement. Vous pouvez résilier à tout moment depuis vos paramètres. Vos données restent exportables pendant 30 jours après résiliation.", icon: CreditCard },
  { q: "GRIMY est-il conforme au RGPD ?", a: "Oui. Hébergement en France, DPO désigné, registre de traitements, droit d'accès/suppression/portabilité, et chiffrement bout en bout des données sensibles.", icon: Shield },
  { q: "Comment fonctionne l'essai gratuit ?", a: "14 jours d'essai complet, aucune carte bancaire requise. Vous avez accès à toutes les fonctionnalités du plan Cabinet. À la fin de l'essai, choisissez votre plan ou exportez vos données.", icon: HelpCircle },
  { q: "Le logiciel convient-il à un petit cabinet ?", a: "Absolument. Le plan Solo à 29€/mois couvre 50 clients, largement suffisant pour un indépendant. L'interface est conçue pour être utilisable sans formation.", icon: Users },
];

/* #8 — Footer with working links */
const footerSections = [
  { title: "Produit", links: [{ label: "Fonctionnalités", id: "fonctionnalites" }, { label: "Tarifs", id: "tarifs" }, { label: "Démo", id: "demo" }, { label: "Changelog", id: null }] },
  { title: "Ressources", links: [{ label: "Documentation", id: null }, { label: "Blog", id: null }, { label: "Guide LCB-FT", id: null }, { label: "FAQ", id: "faq" }] },
  { title: "Entreprise", links: [{ label: "À propos", id: "temoignages" }, { label: "Contact", id: null }, { label: "CGV", id: null }, { label: "Mentions légales", id: null }] },
  { title: "Conformité", links: [{ label: "NPLAB", id: null }, { label: "NPMQ", id: null }, { label: "RGPD", id: null }, { label: "Hébergement France", id: null }] },
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const revealRef = useScrollReveal();
  const navScrolled = useNavScroll();
  const activeSection = useActiveSection();
  const heroVisible = useHeroReveal();
  const heroInView = useHeroInView();
  const [annual, setAnnual] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaError, setCtaError] = useState("");
  const [ctaLoading, setCtaLoading] = useState(false);
  const theme = usePersistedTheme();
  const cookies = useCookieConsent();
  const [showPricingTable, setShowPricingTable] = useState(false);
  const navigate = useNavigate();
  const tlProgress = useTimelineProgress();

  /* #11 — Mobile menu scroll lock */
  useEffect(() => {
    document.body.style.overflow = mobileMenu ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenu]);

  const handleNavClick = useCallback((id: string) => { scrollTo(id); setMobileMenu(false); }, []);

  /* #7 — Email validation + #16 loading state + #6 passthrough */
  const handleCtaSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setCtaError("");
    if (ctaEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ctaEmail)) {
      setCtaError("Veuillez entrer un email valide.");
      return;
    }
    setCtaLoading(true);
    navigate(ctaEmail ? `/auth?email=${encodeURIComponent(ctaEmail)}` : "/auth");
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
          --l-border: rgba(255,255,255,0.1);
          --l-text: #ffffff;
          --l-text-2: #d1d5db;
          --l-text-3: #9ca3af;
          --l-text-4: #6b7280;
          --l-text-5: #4b5563;
          --l-mock-bg: #0d0d24;
        }
        .theme-light {
          --l-bg-primary: #fafbfc;
          --l-bg-alt: #f0f2f5;
          --l-surface: rgba(0,0,0,0.03);
          --l-border: rgba(0,0,0,0.1);
          --l-text: #111827;
          --l-text-2: #374151;
          --l-text-3: #4b5563;
          --l-text-4: #6b7280;
          --l-text-5: #9ca3af;
          --l-mock-bg: #f3f4f6;
        }
        .landing-root { color: var(--l-text); }

        /* Gradient background */
        .theme-dark .landing-bg-wrap {
          background: linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #0a0a1a 50%, #1a1a3e 75%, #0a0a1a 100%);
          background-size: 400% 400%;
          animation: gradShift 15s ease infinite;
        }
        .theme-light .landing-bg-wrap {
          background: linear-gradient(135deg, #fafbfc 0%, #eef2ff 50%, #fafbfc 100%);
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
          background-image: radial-gradient(circle, rgba(59,130,246,0.12) 1px, transparent 1px);
        }

        /* Hero glow */
        .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15) 0%, transparent 70%);
        }
        .theme-light .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.08) 0%, transparent 70%);
        }

        /* #9 — Micro-interactions */
        .btn-press { transition: transform 0.15s ease; }
        .btn-press:active { transform: scale(0.97); }
        .table-row-hover { transition: background 0.15s ease; }
        .table-row-hover:hover { background: rgba(59,130,246,0.04); }

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
        .grimy-col { background: rgba(16,185,129,0.04); }
        .theme-light .grimy-col { background: rgba(16,185,129,0.06); }

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

        /* Timeline line fill */
        .timeline-line-fill {
          transition: height 0.1s linear;
        }
      `}</style>

      <div className="landing-bg-wrap">

        {/* ══════ 1. NAVBAR ══════ */}
        <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          navScrolled
            ? "border-b shadow-lg"
            : "bg-transparent"
        }`} style={{
          borderColor: navScrolled ? "var(--l-border)" : "transparent",
          background: navScrolled ? "color-mix(in srgb, var(--l-bg-primary) 80%, transparent)" : "transparent",
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
                className="p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: "var(--l-text-3)" }}
                aria-label={theme.light ? "Passer en mode sombre" : "Passer en mode clair"}
              >
                {theme.light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>

              <Link to="/auth" className="hidden sm:inline-flex">
                <Button variant="ghost" className="btn-press" style={{ color: "var(--l-text-3)" }}>Se connecter</Button>
              </Link>
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 btn-press text-white">Démarrer</Button>
              </Link>

              {/* #2 hamburger */}
              <button className="md:hidden p-2" style={{ color: "var(--l-text-3)" }} onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? "Fermer" : "Menu"}>
                {mobileMenu ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenu && (
            <div className="md:hidden border-t px-6 py-4 space-y-1 backdrop-blur-xl" style={{ borderColor: "var(--l-border)", background: "color-mix(in srgb, var(--l-bg-primary) 95%, transparent)" }}>
              {NAV_LINKS.map((l) => (
                <button key={l.id} onClick={() => handleNavClick(l.id)} className="block w-full text-left py-3 text-sm transition-colors" style={{ color: "var(--l-text-2)" }}>{l.label}</button>
              ))}
              <div className="pt-3 flex gap-3" style={{ borderTop: "1px solid var(--l-border)" }}>
                <Link to="/auth" className="flex-1"><Button variant="outline" className="w-full" style={{ borderColor: "var(--l-border)", color: "var(--l-text-2)" }}>Connexion</Button></Link>
                <Link to="/auth" className="flex-1"><Button className="w-full bg-blue-600 text-white">Démarrer</Button></Link>
              </div>
            </div>
          )}
        </nav>

        {/* ══════ 2. HERO ══════ */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          <div className="hero-glow absolute inset-0" />
          {/* #9 — Dot grid background */}
          <div className="absolute inset-0 dot-grid" />
          {/* Blurred shapes */}
          <div className="absolute top-20 left-[10%] h-72 w-72 rounded-full bg-blue-600/8 blur-3xl" />
          <div className="absolute bottom-20 right-[10%] h-96 w-96 rounded-full bg-indigo-600/6 blur-3xl" />

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div className={`transition-all duration-1000 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Badge className="mb-8 border-blue-500/20 bg-blue-500/10 text-blue-400 px-4 py-1.5 text-sm">Plateforme LCB-FT nouvelle génération</Badge>
            </div>

            <h1 className={`mb-8 font-serif text-4xl font-bold leading-[1.1] tracking-tight transition-all duration-1000 delay-150 sm:text-5xl md:text-[56px] ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              La conformité LCB-FT<br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">n'a jamais été aussi simple</span>
            </h1>

            <p className={`mx-auto mb-10 max-w-2xl text-lg leading-relaxed transition-all duration-1000 delay-300 sm:text-xl ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-3)" }}>
              Automatisez votre dispositif anti-blanchiment. Screening intelligent, documents INPI, lettre de mission.<br className="hidden sm:block" />
              <span style={{ color: "var(--l-text-4)" }}>Conçu par un expert-comptable, pour les experts-comptables.</span>
            </p>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-600/25 btn-press text-white">
                  Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base btn-press" style={{ borderColor: "var(--l-border)", color: "var(--l-text-2)" }} onClick={() => scrollTo("demo")}>
                Voir la démo <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <p className={`mt-6 text-sm transition-all duration-1000 delay-700 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-5)" }}>
              Aucune carte bancaire requise — 14 jours d'essai gratuit
            </p>

            {/* #7 — Onboarding stepper */}
            <div className={`mt-12 flex items-center justify-center gap-2 sm:gap-4 transition-all duration-1000 delay-[900ms] ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              {["Créez votre compte", "Ajoutez un client", "Lancez le screening"].map((step, i) => (
                <div key={step} className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">{i + 1}</div>
                  <span className="text-xs sm:text-sm" style={{ color: "var(--l-text-4)" }}>{step}</span>
                  {i < 2 && <ChevronRight className="h-3 w-3" style={{ color: "var(--l-text-5)" }} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ 3. SOCIAL PROOF + #20 TICKER ══════ */}
        <section className="border-y" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
              <p className="text-sm" style={{ color: "var(--l-text-4)" }}>Conforme NPLAB, NPMQ et ISQM 1</p>
              <div className="flex items-center gap-8">
                {["Ordre des Experts-Comptables", "CNCC", "TRACFIN"].map((n) => (
                  <span key={n} className="text-[10px] font-medium uppercase tracking-widest opacity-50" style={{ color: "var(--l-text-4)" }}>{n}</span>
                ))}
              </div>
            </div>
            <SocialTicker />
          </div>
        </section>

        {/* ══════ 4. POURQUOI GRIMY — #13 glow + #10 tilt ══════ */}
        <section id="fonctionnalites" className="py-28">
          <div className="mx-auto max-w-7xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">
              Tout ce dont votre cabinet a besoin
            </h2>
            <p data-reveal className="mx-auto mb-16 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Une plateforme unique pour piloter votre conformité LCB-FT de bout en bout.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {whyCards.map((c, i) => (
                <TiltCard key={c.title}>
                  <GlowCard className="h-full rounded-2xl border p-8 backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                    <div data-reveal className="opacity-0 translate-y-10 transition-[opacity,transform] duration-700" style={{ transitionDelay: `${i * 100 + 100}ms` }}>
                      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10">
                        <c.icon className="h-7 w-7 text-blue-400" />
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
                    <Badge className={`ml-1 text-[10px] px-1.5 py-0 ${f.badge === "Nouveau" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
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
                <CircleCounter value={0} label="observations contrôle" color="#10B981" />
              </div>
              {/* #5 — Before/after results */}
              <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
                {[
                  { label: "Temps de screening", before: "2 heures", after: "30 secondes" },
                  { label: "Taux de conformité", before: "60%", after: "98%" },
                  { label: "Coût par dossier", before: "45€", after: "3€" },
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
            <div data-reveal className="mt-20 opacity-0 translate-y-10 transition-all duration-700 delay-300">
              <VideoPlayer />
            </div>
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <f.icon className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className="font-serif text-2xl font-bold sm:text-3xl">{f.title}</h3>
                    <p className="text-base leading-relaxed max-w-lg" style={{ color: "var(--l-text-3)" }}>{f.desc}</p>
                    <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      En savoir plus <ChevronRight className="h-4 w-4" />
                    </Link>
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
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">GRIMY vs les alternatives</h2>
            <p data-reveal className="mx-auto mb-14 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Comparez et choisissez la solution la plus complète pour votre cabinet.
            </p>

            {/* Desktop table */}
            <div data-reveal className="hidden md:block overflow-x-auto rounded-2xl border backdrop-blur-sm opacity-0 translate-y-10 transition-all duration-700 delay-200" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--l-border)" }}>
                    <th className="px-6 py-5 text-left text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Fonctionnalité</th>
                    <th className="px-6 py-5 text-center grimy-col rounded-tl-lg">
                      <span className="text-sm font-bold text-emerald-400">GRIMY</span>
                    </th>
                    <th className="px-6 py-5 text-center text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Kanta</th>
                    <th className="px-6 py-5 text-center text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, i) => (
                    <tr key={row.label} className="table-row-hover" style={{ borderBottom: "1px solid color-mix(in srgb, var(--l-border) 50%, transparent)" }}>
                      <td className="px-6 py-4" style={{ color: "var(--l-text-2)" }}>{row.label}</td>
                      <td className="px-6 py-4 text-center grimy-col"><CompCell value={row.grimy} accent /></td>
                      <td className="px-6 py-4 text-center"><CompCell value={row.kanta} /></td>
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

        {/* ══════ TARIFS + #3 pricing table ══════ */}
        <section id="tarifs" className="py-28">
          <div className="mx-auto max-w-6xl px-6">
            <h2 data-reveal className="mb-4 text-center font-serif text-3xl font-bold tracking-tight opacity-0 translate-y-10 transition-all duration-700 sm:text-4xl">Tarifs transparents</h2>
            <p data-reveal className="mx-auto mb-10 max-w-xl text-center opacity-0 translate-y-10 transition-all duration-700 delay-100" style={{ color: "var(--l-text-3)" }}>
              Des plans adaptés à chaque taille de cabinet. Sans engagement.
            </p>

            {/* #5 accessible toggle */}
            <div data-reveal className="mb-14 flex items-center justify-center gap-3 opacity-0 translate-y-10 transition-all duration-700 delay-200">
              <span className="text-sm" style={{ color: !annual ? "var(--l-text)" : "var(--l-text-4)" }}>Mensuel</span>
              <button role="switch" aria-checked={annual} aria-label="Basculer tarification annuelle"
                onClick={() => setAnnual(!annual)}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAnnual(!annual); } }}
                className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${annual ? "bg-blue-600" : "bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${annual ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm" style={{ color: annual ? "var(--l-text)" : "var(--l-text-4)" }}>
                Annuel <Badge className="ml-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">-20%</Badge>
              </span>
            </div>

            {/* Plan cards */}
            <div className="grid gap-8 lg:grid-cols-3">
              {plans.map((plan, i) => {
                const price = plan.price === 0 ? null : annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <TiltCard key={plan.name}>
                    <GlowCard className={`h-full rounded-2xl border backdrop-blur-sm p-8 ${plan.popular ? "ring-1 ring-blue-500/20" : ""}`}
                      style={{ borderColor: plan.popular ? "rgba(59,130,246,0.4)" : "var(--l-border)", background: "var(--l-surface)" }}
                    >
                      <div data-reveal className="opacity-0 translate-y-10 transition-[opacity,transform] duration-700 relative" style={{ transitionDelay: `${i * 120 + 200}ms` }}>
                        {plan.popular && (
                          <div className="absolute -top-11 left-1/2 -translate-x-1/2">
                            <Badge className="bg-blue-600 text-white border-0 px-3">Populaire</Badge>
                          </div>
                        )}
                        <div className="mb-6">
                          <h3 className="text-xl font-bold">{plan.name}</h3>
                          <p className="mt-1 text-sm" style={{ color: "var(--l-text-4)" }}>{plan.desc}</p>
                        </div>
                        <div className="mb-8">
                          {price !== null ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-5xl font-bold font-serif">{price}€</span>
                              <span style={{ color: "var(--l-text-4)" }}>/mois</span>
                            </div>
                          ) : (
                            <span className="text-3xl font-bold font-serif">Sur devis</span>
                          )}
                        </div>
                        <ul className="mb-8 space-y-3">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--l-text-2)" }}>
                              <Check className="h-4 w-4 shrink-0 text-blue-400" />{f}
                            </li>
                          ))}
                        </ul>
                        <Link to="/auth" className="block">
                          <Button className={`w-full h-11 btn-press ${plan.popular ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-600/20 text-white" : "bg-white/10 hover:bg-white/15"}`} style={plan.popular ? {} : { color: "var(--l-text)" }}>
                            {plan.cta}
                          </Button>
                        </Link>
                      </div>
                    </GlowCard>
                  </TiltCard>
                );
              })}
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
                        <th className="px-5 py-4 text-center font-bold text-blue-400 grimy-col">Cabinet</th>
                        <th className="px-5 py-4 text-center font-medium" style={{ color: "var(--l-text-3)" }}>Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingFeatures.map((pf, i) => (
                        <tr key={pf.name} className="table-row-hover" style={{ borderBottom: i < pricingFeatures.length - 1 ? "1px solid color-mix(in srgb, var(--l-border) 50%, transparent)" : "none" }}>
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
              Des cabinets de toutes tailles nous font confiance.
            </p>

            {/* Testimonial grid (5 cards, wraps naturally) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <TiltCard key={t.name}>
                  <GlowCard className="h-full rounded-2xl border p-7 backdrop-blur-sm" style={{ borderColor: "var(--l-border)", background: "var(--l-surface)" }}>
                    <div data-reveal className="opacity-0 translate-y-10 transition-[opacity,transform] duration-700" style={{ transitionDelay: `${i * 100}ms` }}>
                      <Quote className="mb-4 h-7 w-7 text-blue-500/30" />
                      <p className="mb-6 text-base leading-relaxed italic" style={{ color: "var(--l-text-2)" }}>
                        &laquo; {t.quote} &raquo;
                      </p>
                      {/* #13 — Avatar with initials */}
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>{t.initials}</div>
                        <div>
                          <p className="text-sm font-semibold">{t.name}</p>
                          <p className="text-xs" style={{ color: "var(--l-text-4)" }}>{t.title} — {t.cabinet}</p>
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                </TiltCard>
              ))}
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
              <Accordion type="single" collapsible className="space-y-3">
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
          </div>
        </section>

        {/* ══════ CTA FINAL — #6 email + #15 ══════ */}
        <section className="py-28">
          <div data-reveal className="mx-auto max-w-5xl px-6 opacity-0 translate-y-10 transition-all duration-700">
            <div className="rounded-3xl bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-indigo-600/20 border border-blue-500/20 p-12 sm:p-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-20" />
              <div className="relative">
                <h2 className="mb-4 font-serif text-3xl font-bold sm:text-4xl">Prêt à automatiser votre conformité ?</h2>
                <p className="mx-auto mb-8 max-w-lg text-lg" style={{ color: "var(--l-text-3)" }}>Rejoignez les cabinets qui ont choisi l'efficacité.</p>
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
                  <p className="mt-3 text-xs" style={{ color: "var(--l-text-5)" }}>Aucune carte bancaire requise</p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ FOOTER — #8 working links ══════ */}
        <footer className="border-t py-16" style={{ borderColor: "var(--l-border)" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-1">
                <span className="text-lg font-bold font-serif">GRIMY</span>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--l-text-4)" }}>Conformité LCB-FT<br />pour experts-comptables</p>
              </div>
              {footerSections.map((sec) => (
                <div key={sec.title}>
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--l-text-3)" }}>{sec.title}</h4>
                  <ul className="space-y-2.5">
                    {sec.links.map((link) => (
                      <li key={link.label}>
                        {link.id ? (
                          <a href={`#${link.id}`} onClick={(e) => { e.preventDefault(); scrollTo(link.id!); }} className="text-sm transition-colors hover:text-blue-400" style={{ color: "var(--l-text-4)" }}>{link.label}</a>
                        ) : (
                          <span className="text-sm cursor-default opacity-50" style={{ color: "var(--l-text-5)" }}>{link.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row" style={{ borderColor: "var(--l-border)" }}>
              <p className="text-xs" style={{ color: "var(--l-text-5)" }}>&copy; 2026 GRIMY — Conformité LCB-FT pour experts-comptables</p>
              <div className="flex gap-6">
                {["LinkedIn", "Twitter"].map((s) => (
                  <a key={s} href="#" className="text-xs transition-colors hover:text-blue-400" style={{ color: "var(--l-text-5)" }}>{s}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* ══════ #4 — STICKY CTA BAR (appears after hero) ══════ */}
      {!heroInView && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t p-3 backdrop-blur-xl sm:hidden transition-all" style={{ borderColor: "var(--l-border)", background: "color-mix(in srgb, var(--l-bg-primary) 90%, transparent)" }}>
          <Link to="/auth" className="block">
            <Button className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/25 btn-press text-white">
              Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* ══════ #18 — Cookie consent banner (RGPD) ══════ */}
      {cookies.show && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t p-4 backdrop-blur-xl" style={{ borderColor: "var(--l-border)", background: "color-mix(in srgb, var(--l-bg-primary) 95%, transparent)" }}>
          <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed" style={{ color: "var(--l-text-3)" }}>
                Ce site utilise des cookies pour améliorer votre expérience. En continuant, vous acceptez notre{" "}
                <a href="#" className="text-blue-400 underline">politique de confidentialité</a>.
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
