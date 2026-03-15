import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ShieldCheck, Info } from "lucide-react";

type Permission = "VISIONNER" | "TRAVAILLER" | "AFFECTER" | "VALIDER" | "SUPPRIMER" | "EXPORTER" | "PARAMETRER" | "INVITER";
type Role = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "CONTROLEUR" | "SECRETAIRE" | "STAGIAIRE";

const ALL_PERMISSIONS: Permission[] = ["VISIONNER", "TRAVAILLER", "AFFECTER", "VALIDER", "SUPPRIMER", "EXPORTER", "PARAMETRER", "INVITER"];
const BASIC_PERMISSIONS: Permission[] = ["VISIONNER", "TRAVAILLER", "AFFECTER", "VALIDER", "SUPPRIMER"];
const ALL_ROLES: Role[] = ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "CONTROLEUR", "SECRETAIRE", "STAGIAIRE"];

const PERMISSION_LABELS: Record<Permission, string> = {
  VISIONNER: "Visionner",
  TRAVAILLER: "Travailler",
  AFFECTER: "Affecter",
  VALIDER: "Valider",
  SUPPRIMER: "Supprimer",
  EXPORTER: "Exporter",
  PARAMETRER: "Parametrer",
  INVITER: "Inviter",
};

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  VISIONNER: "Consulter les dossiers, fiches clients et documents",
  TRAVAILLER: "Modifier les dossiers, saisir des informations, ajouter des documents",
  AFFECTER: "Assigner des dossiers a des collaborateurs",
  VALIDER: "Valider les dossiers et les demandes de validation",
  SUPPRIMER: "Supprimer des dossiers, clients et documents",
  EXPORTER: "Exporter les donnees en CSV, PDF ou DOCX",
  PARAMETRER: "Modifier les reglages du cabinet et la configuration",
  INVITER: "Inviter de nouveaux collaborateurs et gerer les acces",
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "text-blue-300",
  SUPERVISEUR: "text-amber-300",
  COLLABORATEUR: "text-emerald-300",
  CONTROLEUR: "text-purple-300",
  SECRETAIRE: "text-pink-300",
  STAGIAIRE: "text-slate-400",
};

interface RolePermission {
  id: string;
  cabinet_id: string;
  role: string;
  permission: string;
  granted: boolean;
}

export default function RolesMatrix() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expertMode, setExpertMode] = useState(false);

  const loadPermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_roles")
        .select("*")
        .order("role");
      if (error) throw error;
      setPermissions((data || []) as RolePermission[]);
    } catch {
      toast.error("Erreur lors du chargement de la matrice");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const isGranted = (role: string, permission: string) => {
    return permissions.find((p) => p.role === role && p.permission === permission)?.granted || false;
  };

  const togglePermission = async (role: string, permission: string) => {
    const existing = permissions.find((p) => p.role === role && p.permission === permission);
    if (!existing) return;

    const newGranted = !existing.granted;
    // Optimistic update
    setPermissions((prev) =>
      prev.map((p) => p.id === existing.id ? { ...p, granted: newGranted } : p)
    );

    const { error } = await supabase
      .from("cabinet_roles")
      .update({ granted: newGranted })
      .eq("id", existing.id);

    if (error) {
      // Revert
      setPermissions((prev) =>
        prev.map((p) => p.id === existing.id ? { ...p, granted: !newGranted } : p)
      );
      toast.error("Erreur lors de la mise a jour");
      return;
    }

    toast.success(`${permission} ${newGranted ? "accorde" : "retire"} pour ${role}`);
  };

  const visiblePermissions = expertMode ? ALL_PERMISSIONS : BASIC_PERMISSIONS;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" /> Matrice des permissions
          </h2>
          <p className="text-sm text-slate-400">Definissez les droits de chaque role. Les modifications sont sauvegardees automatiquement.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="expert-mode" className="text-sm text-slate-400">Mode expert</Label>
          <Switch id="expert-mode" checked={expertMode} onCheckedChange={setExpertMode} />
        </div>
      </div>

      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 min-w-[180px]">Permission</th>
                {ALL_ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${ROLE_COLORS[role]}`}>{role}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePermissions.map((perm) => (
                <tr key={perm} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{PERMISSION_LABELS[perm]}</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          {PERMISSION_DESCRIPTIONS[perm]}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  {ALL_ROLES.map((role) => {
                    const granted = isGranted(role, perm);
                    return (
                      <td key={role} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={granted}
                            onCheckedChange={() => togglePermission(role, perm)}
                            className={granted
                              ? "border-emerald-500 bg-emerald-500/20 data-[state=checked]:bg-emerald-500/30 data-[state=checked]:border-emerald-400"
                              : "border-slate-700 bg-transparent"
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="rgb(52, 211, 153)" strokeWidth="1.5" /></svg>
          </div>
          <span>Permission accordee</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-slate-700" />
          <span>Permission refusee</span>
        </div>
      </div>
    </div>
  );
}
