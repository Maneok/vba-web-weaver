import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserPlus, AlertTriangle, FileText, Plus, X } from "lucide-react";

interface QuickActionsProps {
  notificationCount?: number;
}

export function QuickActionsBar({ notificationCount = 0 }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-8 gap-1.5 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/30 transition-all duration-200"
        onClick={() => navigate("/nouveau-client")}
        title="Nouveau client (raccourci : N)"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Client
        <kbd className="ml-1 text-[9px] text-slate-500 border border-white/10 rounded px-1">N</kbd>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-8 gap-1.5 hover:bg-orange-500/10 hover:text-orange-300 hover:border-orange-500/30 transition-all duration-200"
        onClick={() => navigate("/registre")}
        title="Nouvelle alerte (raccourci : A)"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Alerte
        <kbd className="ml-1 text-[9px] text-slate-500 border border-white/10 rounded px-1">A</kbd>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-8 gap-1.5 hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/30 transition-all duration-200"
        onClick={() => navigate("/lettre-mission")}
      >
        <FileText className="w-3.5 h-3.5" />
        LM
      </Button>
    </div>
  );
}

const FAB_ACTIONS = [
  { label: "Nouveau client", icon: UserPlus, path: "/nouveau-client", color: "bg-blue-500" },
  { label: "Nouvelle alerte", icon: AlertTriangle, path: "/registre", color: "bg-orange-500" },
  { label: "Lettre de mission", icon: FileText, path: "/lettre-mission", color: "bg-violet-500" },
] as const;

export function QuickActionsFAB() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-6 right-6 z-50 print:hidden">
      {open && (
        <div className="absolute bottom-14 right-0 flex flex-col gap-2 items-end">
          {FAB_ACTIONS.map((a) => (
            <button
              key={a.path}
              className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-2 py-1.5 shadow-lg hover:shadow-xl transition-all text-sm"
              onClick={() => { setOpen(false); navigate(a.path); }}
            >
              <span className="text-xs font-medium">{a.label}</span>
              <div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center`}>
                <a.icon className="w-4 h-4 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}
      <button
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer les actions rapides" : "Ouvrir les actions rapides"}
        aria-expanded={open}
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}
