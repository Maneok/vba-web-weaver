import { LM_STEP_DURATIONS, LM_STEP_LABELS, LM_TOTAL_STEPS } from "@/lib/lmWizardTypes";
import { getCategoryColorClasses } from "@/lib/lettreMissionTypes";
import type { MissionCategory } from "@/lib/lettreMissionTypes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  currentStep: number;
  onStepClick?: (step: number) => void;
  missionCategory?: MissionCategory | null;
  maxClickable?: number;
}

const STEP_DESCRIPTIONS = [
  'Selection du client',
  'Type de mission',
  'Missions complementaires',
  'Modele, duree, responsable',
  'Tarification',
  'Clauses et CGV',
  'Previsualisation',
  'Generation et envoi',
];

export default function LMProgressBar({ currentStep, onStepClick, missionCategory, maxClickable }: Props) {
  const maxClick = maxClickable ?? currentStep;
  const remainingSec = LM_STEP_DURATIONS.slice(currentStep).reduce((a, b) => a + b, 0);
  const remainingMin = Math.ceil(remainingSec / 60);
  const catColors = missionCategory ? getCategoryColorClasses(missionCategory) : null;
  const progress = ((currentStep) / (LM_TOTAL_STEPS - 1)) * 100;

  return (
    <div className="w-full space-y-3">
      {/* Continuous progress bar */}
      <div
        className="relative h-1 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
            catColors ? catColors.bg : "bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 dark:from-blue-500 dark:via-indigo-500 dark:to-blue-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Clickable step pills */}
      <div className="flex items-center justify-between w-full">
        {Array.from({ length: LM_TOTAL_STEPS }, (_, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isReachable = i > currentStep && i <= maxClick;
          const isClickable = i <= maxClick;

          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => isClickable && onStepClick?.(i)}
                    disabled={!isClickable}
                    className={`
                      flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-1 rounded-lg transition-all duration-300
                      ${isCurrent ? 'wizard-step-active bg-white dark:bg-white/[0.06]' : ''}
                      ${isCompleted ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]' : ''}
                      ${isReachable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]' : ''}
                      ${!isClickable ? 'cursor-not-allowed opacity-30' : ''}
                    `}
                    aria-label={`Etape ${i + 1}: ${STEP_DESCRIPTIONS[i]}`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className={`
                      flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300
                      ${isCurrent
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm shadow-blue-500/25'
                        : ''}
                      ${isCompleted
                        ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400'
                        : ''}
                      ${isReachable
                        ? 'bg-transparent border border-blue-300 dark:border-blue-500/30 text-blue-400 dark:text-blue-500'
                        : ''}
                      ${!isClickable ? 'bg-gray-100 dark:bg-white/[0.04] text-gray-300 dark:text-slate-600' : ''}
                    `}>
                      {isCompleted ? (
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={`hidden lg:inline text-[11px] ${
                      isCurrent ? 'text-slate-800 dark:text-white font-medium' :
                      isCompleted ? 'text-slate-500 dark:text-slate-400' :
                      isReachable ? 'text-slate-400 dark:text-slate-500' :
                      'text-slate-300 dark:text-slate-600'
                    }`}>
                      {LM_STEP_LABELS[i]}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  {STEP_DESCRIPTIONS[i]}
                </TooltipContent>
              </Tooltip>

              {/* Connector dot */}
              {i < LM_TOTAL_STEPS - 1 && (
                <div className="hidden sm:block flex-1 mx-0.5">
                  <div className={`h-px rounded-full transition-colors duration-500 ${
                    i < currentStep ? 'bg-blue-200 dark:bg-blue-500/30' : 'bg-gray-100 dark:bg-white/[0.04]'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time estimate */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center tracking-wide">
        {currentStep < LM_TOTAL_STEPS - 1
          ? `~${remainingMin} min restante${remainingMin > 1 ? "s" : ""}`
          : "Derniere etape"}
      </p>
    </div>
  );
}
