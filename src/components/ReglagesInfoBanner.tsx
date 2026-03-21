import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";

interface Props {
  show: boolean;
  message: string;
  icon?: LucideIcon;
}

export default function ReglagesInfoBanner({ show, message, icon: Icon = Info }: Props) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
      <Icon className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
