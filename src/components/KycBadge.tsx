interface Props {
  completeness: number;
  size?: "sm" | "md";
}

export default function KycBadge({ completeness, size = "sm" }: Props) {
  const color = completeness >= 90 ? "bg-green-500" : completeness >= 70 ? "bg-amber-500" : "bg-red-500";
  const textColor = completeness >= 90 ? "text-green-700" : completeness >= 70 ? "text-amber-700" : "text-red-700";
  const bgColor = completeness >= 90 ? "bg-green-50" : completeness >= 70 ? "bg-amber-50" : "bg-red-50";
  const label = completeness >= 90 ? "KYC Complet" : completeness >= 70 ? "KYC Partiel" : "KYC Incomplet";

  if (size === "sm") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${bgColor} ${textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        {completeness}%
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgColor}`}>
      <div className="relative w-8 h-8">
        <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${completeness * 0.88} 88`}
            className={textColor}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold ${textColor}`}>{completeness}</span>
      </div>
      <div>
        <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{completeness}% des champs renseignés</p>
      </div>
    </div>
  );
}
