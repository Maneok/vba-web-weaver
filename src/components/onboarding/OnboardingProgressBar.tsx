interface OnboardingProgressBarProps {
  percent: number; // 20, 50, 80, 100
}

export function OnboardingProgressBar({ percent }: OnboardingProgressBarProps) {
  return (
    <div className="w-full max-w-xl mx-auto mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Configuration</span>
        <span className="text-xs font-medium text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
