import { LM_STEP_DURATIONS, LM_STEP_LABELS, LM_TOTAL_STEPS } from "@/lib/lmWizardTypes";

interface Props {
  currentStep: number;
}

export default function LMProgressBar({ currentStep }: Props) {
  const progress = ((currentStep + 1) / LM_TOTAL_STEPS) * 100;

  // Remaining time estimate
  const remainingSec = LM_STEP_DURATIONS.slice(currentStep).reduce((a, b) => a + b, 0);
  const remainingMin = Math.ceil(remainingSec / 60);

  return (
    <div className="w-full space-y-2">
      {/* Step dots */}
      <div className="flex items-center justify-between px-1">
        {Array.from({ length: LM_TOTAL_STEPS }, (_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < currentStep
                  ? "bg-emerald-400"
                  : i === currentStep
                  ? "bg-blue-400 ring-2 ring-blue-400/30"
                  : "bg-white/[0.08]"
              }`}
            />
            {i < LM_TOTAL_STEPS - 1 && (
              <div className={`w-full h-px mx-1 transition-colors duration-300 ${i < currentStep ? "bg-emerald-400/40" : "bg-white/[0.06]"}`} style={{ minWidth: "20px" }} />
            )}
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #22c55e, #3b82f6)",
          }}
        />
      </div>
      {/* Time estimate */}
      <p className="text-[10px] text-slate-500 text-center">
        {currentStep < LM_TOTAL_STEPS - 1
          ? `Environ ${remainingMin} min restante${remainingMin > 1 ? "s" : ""}`
          : "Derniere etape"}
      </p>
    </div>
  );
}
