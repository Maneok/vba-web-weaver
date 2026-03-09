import { LM_STEP_DURATIONS, LM_TOTAL_STEPS } from "@/lib/lmWizardTypes";

interface Props {
  currentStep: number;
}

export default function LMProgressBar({ currentStep }: Props) {
  const progress = ((currentStep + 1) / LM_TOTAL_STEPS) * 100;

  // Remaining time estimate
  const remainingSec = LM_STEP_DURATIONS.slice(currentStep).reduce((a, b) => a + b, 0);
  const remainingMin = Math.ceil(remainingSec / 60);

  return (
    <div className="w-full space-y-1.5">
      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #22c55e, #3b82f6)",
          }}
        />
      </div>
      {/* Time estimate */}
      <p className="text-[11px] text-slate-500 text-center">
        {currentStep < LM_TOTAL_STEPS - 1
          ? `Environ ${remainingMin} min restante${remainingMin > 1 ? "s" : ""}`
          : "Derniere etape"}
      </p>
    </div>
  );
}
