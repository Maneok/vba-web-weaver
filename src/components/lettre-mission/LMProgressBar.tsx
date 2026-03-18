import { LM_STEP_DURATIONS, LM_STEP_LABELS, LM_TOTAL_STEPS } from "@/lib/lmWizardTypes";
import { getCategoryColorClasses } from "@/lib/lettreMissionTypes";
import type { MissionCategory } from "@/lib/lettreMissionTypes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  currentStep: number;
  onStepClick?: (step: number) => void;
  missionCategory?: MissionCategory | null;
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

export default function LMProgressBar({ currentStep, onStepClick, missionCategory }: Props) {
  const remainingSec = LM_STEP_DURATIONS.slice(currentStep).reduce((a, b) => a + b, 0);
  const remainingMin = Math.ceil(remainingSec / 60);

  // Category accent color
  const catColors = missionCategory ? getCategoryColorClasses(missionCategory) : null;

  return (
    <div className="w-full space-y-2">
      {/* Clickable step bar */}
      <div className="flex items-center w-full">
        {Array.from({ length: LM_TOTAL_STEPS }, (_, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isClickable = i <= currentStep;

          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => isClickable && onStepClick?.(i)}
                    disabled={!isClickable}
                    className={`
                      flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1.5 rounded-lg transition-all duration-200
                      ${isCurrent ? (catColors ? `${catColors.bg} ${catColors.border} border` : 'bg-blue-500/15 border border-blue-500/30') : ''}
                      ${isCompleted ? 'cursor-pointer hover:bg-gray-100 dark:bg-white/[0.06]' : ''}
                      ${!isClickable ? 'cursor-not-allowed opacity-40' : ''}
                    `}
                    aria-label={`Étape ${i + 1}: ${STEP_DESCRIPTIONS[i]}`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className={`
                      flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs font-medium border-2 transition-all duration-200
                      ${isCurrent
                        ? (catColors ? `${catColors.border} ${catColors.text}` : 'border-blue-400 text-blue-400 bg-blue-500/10')
                        : ''}
                      ${isCompleted
                        ? (catColors ? `border-transparent ${catColors.badge}` : 'border-transparent bg-emerald-500/20 text-emerald-400')
                        : ''}
                      ${!isClickable ? 'border-gray-300 dark:border-white/[0.08] text-slate-300 dark:text-slate-600' : ''}
                    `}>
                      {isCompleted ? (
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={`hidden sm:inline text-xs ${
                      isCurrent ? (catColors ? catColors.text : 'text-blue-300 font-medium') :
                      isCompleted ? 'text-slate-400 dark:text-slate-500 dark:text-slate-400' :
                      'text-slate-300 dark:text-slate-600'
                    }`}>
                      {LM_STEP_LABELS[i]}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Étape {i + 1} : {STEP_DESCRIPTIONS[i]}
                </TooltipContent>
              </Tooltip>

              {/* Connector */}
              {i < LM_TOTAL_STEPS - 1 && (
                <div className={`
                  hidden sm:block flex-1 h-0.5 mx-1 rounded-full transition-colors duration-300
                  ${i < currentStep
                    ? (catColors ? catColors.badge.split(' ')[0] : 'bg-emerald-400/40')
                    : 'bg-gray-100 dark:bg-white/[0.06]'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Time estimate */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
        {currentStep < LM_TOTAL_STEPS - 1
          ? `Environ ${remainingMin} min restante${remainingMin > 1 ? "s" : ""}`
          : "Dernière étape"}
      </p>
    </div>
  );
}
