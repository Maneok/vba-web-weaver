import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { CabinetData } from "./OnboardingStep1Cabinet";

interface CompleteProps {
  cabinetName: string;
  responsableName: string;
  cabinetData: CabinetData;
}

export function OnboardingComplete({ cabinetName, responsableName, cabinetData }: CompleteProps) {
  // Use window.location for a full page reload — ensures ProtectedRoute re-checks onboarding flag
  const goTo = (path: string) => { window.location.href = path; };

  return (
    <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Animated checkmark */}
      <div className="flex items-center justify-center">
        <div className="relative w-20 h-20">
          {/* Circle animation */}
          <svg className="w-20 h-20" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-emerald-500/20"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="226"
              strokeDashoffset="0"
              strokeLinecap="round"
              className="text-emerald-500 animate-[draw-circle_0.6s_ease-out_forwards]"
              style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
            />
          </svg>
          {/* Checkmark */}
          <svg
            className="absolute inset-0 w-20 h-20 animate-[check-pop_0.3s_ease-out_0.5s_both]"
            viewBox="0 0 80 80"
          >
            <polyline
              points="26,42 36,52 54,32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
              strokeDasharray="40"
              strokeDashoffset="0"
              style={{ animation: "draw-check 0.4s ease-out 0.6s both" }}
            />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">Votre cabinet est pret !</h2>
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2">
          {cabinetName || "Votre espace"} est configure. Vous pouvez commencer a travailler.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/[0.08] rounded-xl p-4 text-left max-w-sm mx-auto space-y-2">
        {cabinetName && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Cabinet</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{cabinetName}</span>
          </div>
        )}
        {cabinetData.siret && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">SIRET</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono text-xs">{cabinetData.siret}</span>
          </div>
        )}
        {responsableName && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Referent LCB-FT</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{responsableName}</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <Button
          size="lg"
          onClick={() => goTo("/")}
          className="px-8 text-base"
        >
          Acceder a mon dashboard
        </Button>
        <Button
          variant="ghost"
          onClick={() => goTo("/nouveau-client")}
          className="text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter mon premier client
        </Button>
      </div>

      {/* Keyframe animations (scoped CSS) */}
      <style>{`
        @keyframes draw-circle {
          from { stroke-dashoffset: 226; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes check-pop {
          0% { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
