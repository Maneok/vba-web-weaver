import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DashboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

const sections: ShortcutSection[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "N"], description: "Nouveau client" },
      { keys: ["Ctrl", "Shift", "A"], description: "Registre alertes" },
      { keys: ["/"], description: "Rechercher" },
      { keys: ["?"], description: "Aide raccourcis" },
      { keys: ["R"], description: "Rafraîchir" },
    ],
  },
  {
    title: "Dashboard",
    shortcuts: [
      { keys: ["1-9"], description: "Aller au widget N" },
      { keys: ["D"], description: "Mode drag" },
      { keys: ["P"], description: "Imprimer" },
    ],
  },
  {
    title: "Général",
    shortcuts: [
      { keys: ["Escape"], description: "Fermer" },
    ],
  },
];

const Kbd = ({ children }: { children: string }) => (
  <kbd className="bg-muted rounded px-2 py-0.5 text-xs font-mono border border-border">
    {children}
  </kbd>
);

export default function DashboardShortcutsHelp({
  open,
  onOpenChange,
}: DashboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>
            Liste des raccourcis clavier disponibles sur le tableau de bord.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.description}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </span>
                    <span className="text-muted-foreground">{shortcut.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
