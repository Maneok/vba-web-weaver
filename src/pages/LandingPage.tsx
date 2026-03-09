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
  Sparkles, Play, Zap, Cookie, BarChart3, TrendingUp, Award,
  Star, ArrowUp,
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
                <p className="text-xs text-emerald-400/60">9/9 sources vérifiées — 0 alerte</p>
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
  if (value === "yes") return <Check className={`mx-auto h-5 w-5 ${accent ? "text-emerald-400" : "text-gray-400"}`} />;
  if (value === "no") return <X className="mx-auto h-5 w-5 text-red-400/60" />;
  if (value === "partial") return <Minus className="mx-auto h-5 w-5 text-yellow-400/70" />;
  return <span className={`text-sm ${accent ? "text-emerald-400 font-semibold" : "text-[--l-text-3]"}`}>{value}</span>;
}

/* #20 — Social proof ticker */
function SocialTicker() {
  const msgs = [
    "Cabinet Dupont a créé 3 fiches clients aujourd'hui",
    "42 screenings lancés cette semaine",
    "Score moyen des utilisateurs : 78/100",
    "Étude Martin — contrôle passé sans observation",
    "12 fiches clients complétées aujourd'hui",
    "Nouveau professionnel inscrit à Marseille",
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
  { label: "À propos", id: "temoignages" },
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
  { label: "Screening automatique 9 APIs", grimy: "yes", excel: "no" },
  { label: "Documents INPI (statuts, comptes PDF)", grimy: "yes", excel: "no" },
  { label: "Scoring multi-critères des risques", grimy: "yes", excel: "Manuel" },
  { label: "Fiche client pré-remplie", grimy: "yes", excel: "no" },
  { label: "OCR Cloud Vision (CNI/RIB)", grimy: "yes", excel: "no" },
  { label: "Gel des avoirs DG Trésor", grimy: "yes", excel: "no" },
  { label: "Diagnostic 360°", grimy: "yes", excel: "no" },
  { label: "Multi-structure / Multi-utilisateur", grimy: "yes", excel: "no" },
  { label: "Journal d'audit certifié", grimy: "yes", excel: "no" },
  { label: "Prix à partir de", grimy: "29€/mois", excel: "Gratuit" },
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
  { name: "API publique", badge: "Bientôt" as const },
];

const plans = [
  { name: "Solo", price: 29, desc: "Pour les indépendants", features: ["1 utilisateur", "50 clients", "Screening complet", "Fiche client complète", "GED 5 Go"], cta: "Commencer", popular: false },
  { name: "Pro", price: 79, desc: "Pour les structures en croissance", features: ["5 utilisateurs", "200 clients", "Tout Solo +", "Contrôle qualité", "Multi-rôles", "Support prioritaire"], cta: "Commencer", popular: true },
  { name: "Enterprise", price: 0, desc: "Pour les grandes structures", features: ["Utilisateurs illimités", "Clients illimités", "Tout Pro +", "SSO", "API", "Formation", "Référent dédié"], cta: "Nous contacter", popular: false },
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
  { quote: "Nous avons passé notre contrôle LAB sans aucune observation grâce à GRIMY.", name: "Marc D.", title: "Expert-comptable", cabinet: "Cabinet EC — Marseille", initials: "MD", color: "bg-blue-500/20 text-blue-400" },
  { quote: "Le screening automatique nous fait gagner 2 heures par nouveau client. Indispensable pour notre étude.", name: "Sophie L.", title: "Notaire associée", cabinet: "Étude notariale — Bordeaux", initials: "SL", color: "bg-emerald-500/20 text-emerald-400" },
  { quote: "Enfin un outil simple qui comprend nos obligations LAB. Fini les tableaux Excel ingérables.", name: "Thomas R.", title: "Avocat", cabinet: "Cabinet d'avocats — Paris", initials: "TR", color: "bg-purple-500/20 text-purple-400" },
  { quote: "En tant qu'agent immobilier, la LAB est une obligation souvent négligée. GRIMY rend ça concret et rapide.", name: "Claire B.", title: "Agent immobilier", cabinet: "Agence — Lyon", initials: "CB", color: "bg-amber-500/20 text-amber-400" },
  { quote: "Le scoring multi-critères est redoutable de précision. Nos contrôleurs ACPR sont impressionnés.", name: "Philippe M.", title: "CIF — Conseiller en investissements", cabinet: "Cabinet de gestion de patrimoine", initials: "PM", color: "bg-pink-500/20 text-pink-400" },
  { quote: "La GED intégrée et le registre LAB automatique nous ont permis de passer sereinement notre audit DGCCRF.", name: "Antoine V.", title: "Société de domiciliation", cabinet: "DomServices — Nantes", initials: "AV", color: "bg-indigo-500/20 text-indigo-400" },
];

const faqItems = [
  { q: "Quels professionnels peuvent utiliser GRIMY ?", a: "Tous les professionnels assujettis aux obligations LAB (art. L.561-2 du Code monétaire) : experts-comptables, commissaires aux comptes, avocats, notaires, commissaires de justice, agents immobiliers, conseillers en investissements financiers (CIF), sociétés de domiciliation, mandataires judiciaires, et plus.", icon: Users },
  { q: "Mes données sont-elles sécurisées ?", a: "Toutes les données sont hébergées en France (Supabase EU-West), chiffrées au repos (AES-256) et en transit (TLS 1.3). Les champs sensibles (IBAN, CNI) bénéficient d'un chiffrement applicatif AES-GCM supplémentaire. Nous sommes conformes au RGPD.", icon: Lock },
  { q: "Puis-je migrer depuis Excel ou un autre outil ?", a: "Oui. Importez vos clients existants via un fichier CSV. Les données INPI et le screening sont relancés automatiquement pour enrichir chaque fiche.", icon: Database },
  { q: "Y a-t-il un engagement de durée ?", a: "Aucun engagement. Vous pouvez résilier à tout moment depuis vos paramètres. Vos données restent exportables pendant 30 jours après résiliation.", icon: CreditCard },
  { q: "GRIMY est-il conforme au RGPD ?", a: "Oui. Hébergement en France, DPO désigné, registre de traitements, droit d'accès/suppression/portabilité, et chiffrement bout en bout des données sensibles.", icon: Shield },
  { q: "Comment fonctionne l'essai gratuit ?", a: "14 jours d'essai complet, aucune carte bancaire requise. Vous avez accès à toutes les fonctionnalités du plan Pro. À la fin de l'essai, choisissez votre plan ou exportez vos données.", icon: HelpCircle },
  { q: "Le logiciel convient-il à un indépendant ?", a: "Absolument. Le plan Solo à 29€/mois couvre 50 clients, largement suffisant pour un professionnel indépendant. L'interface est conçue pour être utilisable sans formation.", icon: Award },
];

/* #8 — Footer with working links */
type FooterLink = { label: string; id?: string; href?: string; mailto?: string };
const footerSections: { title: string; links: FooterLink[] }[] = [
  { title: "Produit", links: [{ label: "Fonctionnalités", id: "fonctionnalites" }, { label: "Tarifs", id: "tarifs" }, { label: "Démo", id: "demo" }, { label: "Comment ça marche", id: "timeline" }] },
  { title: "Ressources", links: [{ label: "FAQ", id: "faq" }, { label: "Comparatif GRIMY vs Excel", id: "comparaison" }, { label: "Sécurité & chiffrement", id: "securite" }, { label: "Témoignages", id: "temoignages" }] },
  { title: "Entreprise", links: [{ label: "À propos", id: "temoignages" }, { label: "Contact", mailto: "contact@grimy.fr" }, { label: "CGV", id: "legal-cgv" }, { label: "Mentions légales", id: "legal-mentions" }] },
  { title: "Conformité", links: [{ label: "Obligations LAB", id: "legal-lab" }, { label: "Politique de confidentialité", id: "legal-rgpd" }, { label: "Hébergement France", id: "securite" }, { label: "RGPD", id: "legal-rgpd" }] },
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
  const [annual, setAnnual] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaError, setCtaError] = useState("");
  const [ctaLoading, setCtaLoading] = useState(false);
  const theme = usePersistedTheme();
  const cookies = useCookieConsent();
  const [showPricingTable, setShowPricingTable] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const navigate = useNavigate();
  const tlProgress = useTimelineProgress();

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

        /* Purple gradient section titles in light mode */
        .theme-light h2.font-serif {
          background: linear-gradient(135deg, #6d28d9, #5b21b6, #4c1d95);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Light mode: darken accent colors for contrast on cream */
        /* Hero gradient text on cream */
        .theme-light .bg-gradient-to-r.from-violet-400.to-purple-300 {
          background: linear-gradient(to right, #6d28d9, #7c3aed) !important;
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

        /* Smooth section anchors offset */
        .landing-root [id] {
          scroll-margin-top: 80px;
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
            <div className="md:hidden border-t px-6 py-4 space-y-1 backdrop-blur-xl" style={{ borderColor: "var(--l-border)", background: "var(--l-bg-blur-heavy)" }}>
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
              <Badge className="mb-8 border-violet-500/20 bg-violet-500/10 text-violet-400 px-4 py-1.5 text-sm">Plateforme LCB-FT — Nouvelle génération</Badge>
            </div>

            <h1 className={`mb-8 font-serif text-4xl font-bold leading-[1.1] tracking-tight transition-all duration-1000 delay-150 sm:text-5xl md:text-[56px] ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              La conformité LCB-FT<br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">n'a jamais été aussi simple</span>
            </h1>

            <p className={`mx-auto mb-10 max-w-2xl text-lg leading-relaxed transition-all duration-1000 delay-300 sm:text-xl ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-3)" }}>
              La base de données client conçue pour votre conformité LAB. Screening automatique, documents INPI, scoring des risques.<br className="hidden sm:block" />
              <span style={{ color: "var(--l-text-4)" }}>Pour tous les professionnels assujettis : avocats, notaires, experts-comptables, agents immobiliers, CIF...</span>
            </p>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-1000 delay-500 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
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
            <p className={`mt-3 text-sm font-medium transition-all duration-1000 delay-[800ms] ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ color: "var(--l-text-4)" }}>
              <TrendingUp className="inline h-3.5 w-3.5 mr-1 text-emerald-400" />+150 professionnels nous font confiance
            </p>

            {/* #7 — Onboarding stepper */}
            <div className={`mt-12 flex items-center justify-center gap-2 sm:gap-4 transition-all duration-1000 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: "900ms" }}>
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
              <p className="text-sm" style={{ color: "var(--l-text-4)" }}>Conforme aux obligations LAB — Art. L.561-2 du Code monétaire</p>
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
                {["TRACFIN", "DGCCRF", "ACPR", "Ordres professionnels"].map((n) => (
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
              Tout ce dont vous avez besoin
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
              Comparez et choisissez la solution la plus complète.
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
                    <th className="px-6 py-5 text-center text-sm font-medium" style={{ color: "var(--l-text-4)" }}>Excel / Manuel</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, i) => (
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
                              {annual && (
                                <span className="ml-2 text-sm line-through" style={{ color: "var(--l-text-5)" }}>{plan.price}€</span>
                              )}
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
                        <div className="space-y-2">
                          {plan.price === 0 ? (
                            <a href="mailto:contact@grimy.fr?subject=Demande Enterprise" className="block">
                              <Button className="w-full h-11 btn-press bg-[--l-surface-raised] hover:opacity-80" style={{ color: "var(--l-text)" }}>
                                {plan.cta}
                              </Button>
                            </a>
                          ) : (
                            <Link to="/auth" className="block">
                              <Button className={`w-full h-11 btn-press ${plan.popular ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-600/20 text-white" : "bg-[--l-surface-raised] hover:opacity-80"}`} style={plan.popular ? {} : { color: "var(--l-text)" }}>
                                {plan.cta}
                              </Button>
                            </Link>
                          )}
                          {plan.price > 0 && (
                            <p className="text-center text-xs" style={{ color: "var(--l-text-5)" }}>14 jours d'essai gratuit</p>
                          )}
                        </div>
                      </div>
                    </GlowCard>
                  </TiltCard>
                );
              })}
            </div>

            <p data-reveal className="mt-8 text-center text-sm opacity-0 translate-y-10 transition-all duration-700 delay-300" style={{ color: "var(--l-text-4)" }}>
              <Shield className="inline h-4 w-4 mr-1 text-emerald-400" />Garantie satisfait ou remboursé 30 jours
            </p>

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
          </div>
        </section>

        {/* ══════ CTA FINAL — #6 email + #15 ══════ */}
        <section className="py-28">
          <div data-reveal className="mx-auto max-w-5xl px-6 opacity-0 translate-y-10 transition-all duration-700">
            <div className="rounded-3xl bg-gradient-to-r from-violet-600/20 via-purple-500/10 to-indigo-600/20 border border-purple-500/20 p-12 sm:p-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-20" />
              <div className="relative">
                <h2 className="mb-4 font-serif text-3xl font-bold sm:text-4xl">Prêt à automatiser votre conformité ?</h2>
                <p className="mx-auto mb-8 max-w-lg text-lg" style={{ color: "var(--l-text-3)" }}>Rejoignez les professionnels qui ont choisi la simplicité.</p>
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
                <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
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
              <p className="text-xs" style={{ color: "var(--l-text-5)" }}>&copy; {new Date().getFullYear()} GRIMY — Conformité LAB pour professionnels assujettis</p>
              <div className="flex items-center gap-6">
                <a href="mailto:contact@grimy.fr" className="text-xs transition-colors hover:text-blue-400" style={{ color: "var(--l-text-5)" }}>Contact</a>
                <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-xs transition-colors hover:text-blue-400 flex items-center gap-1" style={{ color: "var(--l-text-5)" }}>
                  <ArrowUp className="h-3 w-3" />Haut de page
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
          <Link to="/auth" className="block">
            <Button className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/25 btn-press text-white">
              Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
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
