import { LM_STEP_DURATIONS, LM_STEP_LABELS, LM_TOTAL_STEPS } from "@/lib/lmWizardTypes";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getStepCompletion } from "@/lib/lmWizardTypes";
import { CheckCircle2 } from "lucide-react";

interface Props {
  currentStep: number;
  data?: LMWizardData;
}

export default function LMProgressBar({ currentStep, data }: Props) {
  // (F42) Guard against division by zero
  const totalSteps = LM_TOTAL_STEPS || 6;
  const safeStep = Math.max(0, Math.min(currentStep, totalSteps - 1));
  const progress = ((safeStep + 1) / totalSteps) * 100;

  // (F43) Remaining time estimate with bounds check
  const remainingSec = safeStep + 1 < LM_STEP_DURATIONS.length
    ? LM_STEP_DURATIONS.slice(safeStep + 1).reduce((a, b) => a + b, 0)
    : 0;
  const remainingMin = Math.max(0, Math.ceil(remainingSec / 60));

  // (48) Step completion checkmarks
  const completion = data ? getStepCompletion(data) : [];

  return (
    <div className="w-full space-y-2">
      {/* (48) Step indicators with checkmarks */}
      <div className="flex items-center justify-between px-1">
        {LM_STEP_LABELS.map((label, i) => {
          const isCurrent = i === safeStep;
          const isComplete = completion[i] ?? false;
          const isPast = i < safeStep;
          return (
            <div key={label} className="flex flex-col items-center gap-1" title={label}>
              <div className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300 ${
                isCurrent
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-110"
                  : isComplete
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isPast
                  ? "bg-white/[0.08] text-slate-400"
                  : "bg-white/[0.04] text-slate-600"
              }`}>
                {isComplete && !isCurrent ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-[9px] sm:text-[8px] hidden sm:block transition-colors ${
                isCurrent ? "text-blue-400 font-medium" : "text-slate-600"
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bar */}
      <div
        className="h-2 sm:h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden"
        role="progressbar"
        aria-valuenow={safeStep + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Etape ${safeStep + 1} sur ${totalSteps}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out will-change-[width]"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #22c55e, #3b82f6)",
          }}
        />
      </div>
      {/* Time estimate */}
      <p className="text-xs sm:text-[11px] text-slate-500 text-center">
        {safeStep < totalSteps - 1
          ? `Environ ${remainingMin} min restante${remainingMin > 1 ? "s" : ""}`
          : "Derniere etape"}
      </p>
    </div>
  );
}
