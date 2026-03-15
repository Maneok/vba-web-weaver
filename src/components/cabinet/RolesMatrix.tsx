import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Info, RotateCcw } from "lucide-react";

type Permission = "VISIONNER" | "TRAVAILLER" | "AFFECTER" | "VALIDER" | "SUPPRIMER" | "EXPORTER" | "PARAMETRER" | "INVITER";
type Role = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "CONTROLEUR" | "SECRETAIRE" | "STAGIAIRE";

const ALL_PERMISSIONS: Permission[] = ["VISIONNER", "TRAVAILLER", "AFFECTER", "VALIDER", "SUPPRIMER", "EXPORTER", "PARAMETRER", "INVITER"];
const BASIC_PERMISSIONS: Permission[] = ["VISIONNER", "TRAVAILLER", "AFFECTER", "VALIDER", "SUPPRIMER"];
const EXPERT_PERMISSIONS: Permission[] = ["EXPORTER", "PARAMETRER", "INVITER"];
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

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collaborateur",
  CONTROLEUR: "Controleur",
  SECRETAIRE: "Secretaire",
  STAGIAIRE: "Stagiaire",
};

// Default permissions for each role when seeding
const DEFAULT_GRANTS: Record<Role, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  SUPERVISEUR: ["VISIONNER", "TRAVAILLER", "AFFECTER", "VALIDER", "EXPORTER"],
  COLLABORATEUR: ["VISIONNER", "TRAVAILLER"],
  CONTROLEUR: ["VISIONNER", "VALIDER", "EXPORTER"],
  SECRETAIRE: ["VISIONNER", "AFFECTER"],
  STAGIAIRE: ["VISIONNER"],
};

interface RolePermission {
  id: string;
  cabinet_id: string;
  role: string;
  permission: string;
  granted: boolean;
}

function SkeletonMatrix() {
  return (
    <div className="border border-white/[0.06] rounded-lg p-6 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={j} className="h-5 w-5 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function RolesMatrix() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expertMode, setExpertMode] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadPermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_roles")
        .select("*")
        .order("role");
      if (error) throw error;

      const list = (data || []) as RolePermission[];

      // Auto-seed if empty
      if (list.length === 0) {
        await seedDefaults();
        return;
      }

      setPermissions(list);
    } catch (err) {
      logger.error("RolesMatrix", "Erreur chargement", err);
      toast.error("Erreur lors du chargement de la matrice");
    } finally {
      setLoading(false);
    }
  }, []);

  const seedDefaults = async () => {
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) { setLoading(false); return; }

      const rows: { cabinet_id: string; role: string; permission: string; granted: boolean }[] = [];
      for (const role of ALL_ROLES) {
        for (const perm of ALL_PERMISSIONS) {
          rows.push({
            cabinet_id: cab.id,
            role,
            permission: perm,
            granted: DEFAULT_GRANTS[role].includes(perm),
          });
        }
      }

      const { error } = await supabase.from("cabinet_roles").insert(rows);
      if (error) throw error;

      await logAudit({ action: "INITIALISATION_PERMISSIONS", table_name: "cabinet_roles" });
      toast.success("Matrice de permissions initialisee");

      // Reload
      const { data: fresh } = await supabase.from("cabinet_roles").select("*").order("role");
      setPermissions((fresh || []) as RolePermission[]);
    } catch (err) {
      logger.error("RolesMatrix", "Erreur seed permissions", err);
      toast.error("Erreur lors de l'initialisation des permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const isGranted = (role: string, permission: string) => {
    if (role === "ADMIN") return true; // ADMIN always has all
    return permissions.find((p) => p.role === role && p.permission === permission)?.granted || false;
  };

  const togglePermission = async (role: string, permission: string) => {
    if (role === "ADMIN") return; // ADMIN is read-only

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
      setPermissions((prev) =>
        prev.map((p) => p.id === existing.id ? { ...p, granted: !newGranted } : p)
      );
      toast.error("Erreur lors de la mise a jour");
      return;
    }

    toast.success(`${PERMISSION_LABELS[permission as Permission]} ${newGranted ? "accorde" : "retire"} pour ${ROLE_LABELS[role as Role] || role}`);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      // Get cabinet id
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) throw new Error("Cabinet non trouve");

      // Delete existing
      await supabase.from("cabinet_roles").delete().eq("cabinet_id", cab.id);

      // Re-seed
      const rows: { cabinet_id: string; role: string; permission: string; granted: boolean }[] = [];
      for (const role of ALL_ROLES) {
        for (const perm of ALL_PERMISSIONS) {
          rows.push({
            cabinet_id: cab.id,
            role,
            permission: perm,
            granted: DEFAULT_GRANTS[role].includes(perm),
          });
        }
      }
      const { error } = await supabase.from("cabinet_roles").insert(rows);
      if (error) throw error;

      await logAudit({ action: "REINITIALISATION_PERMISSIONS", table_name: "cabinet_roles" });

      // Reload
      const { data: fresh } = await supabase.from("cabinet_roles").select("*").order("role");
      setPermissions((fresh || []) as RolePermission[]);

      toast.success("Permissions reinitialisees aux valeurs par defaut");
      setResetOpen(false);
    } catch (err) {
      logger.error("RolesMatrix", "Erreur reinitialisation", err);
      toast.error("Erreur lors de la reinitialisation");
    } finally {
      setResetting(false);
    }
  };

  // Count granted permissions per role
  const grantedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of ALL_ROLES) {
      if (role === "ADMIN") {
        counts[role] = ALL_PERMISSIONS.length;
      } else {
        counts[role] = permissions.filter((p) => p.role === role && p.granted).length;
      }
    }
    return counts;
  }, [permissions]);

  const visiblePermissions = expertMode ? ALL_PERMISSIONS : BASIC_PERMISSIONS;

  if (loading) return <SkeletonMatrix />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" /> Matrice des permissions
          </h2>
          <p className="text-sm text-slate-400">Definissez les droits de chaque role. Les modifications sont sauvegardees automatiquement.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            className="gap-2 border-white/10 text-slate-300 hover:bg-white/[0.04]"
            aria-label="Reinitialiser les permissions"
          >
            <RotateCcw className="h-4 w-4" /> Reinitialiser
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="expert-mode" className="text-sm text-slate-400">Mode expert</Label>
            <Switch id="expert-mode" checked={expertMode} onCheckedChange={setExpertMode} />
          </div>
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
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-semibold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700 px-1.5">
                        {grantedCounts[role]}/{ALL_PERMISSIONS.length}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePermissions.map((perm) => {
                const isExpert = EXPERT_PERMISSIONS.includes(perm);
                return (
                  <tr
                    key={perm}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${isExpert ? "bg-purple-500/[0.03]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{PERMISSION_LABELS[perm]}</span>
                        {isExpert && (
                          <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-500/30 border-dashed px-1">expert</Badge>
                        )}
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
                      const isAdmin = role === "ADMIN";
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={granted}
                              onCheckedChange={() => togglePermission(role, perm)}
                              disabled={isAdmin}
                              aria-label={`${PERMISSION_LABELS[perm]} pour ${ROLE_LABELS[role]}`}
                              className={
                                isAdmin
                                  ? "border-blue-500/50 bg-blue-500/20 data-[state=checked]:bg-blue-500/30 data-[state=checked]:border-blue-400 opacity-70 cursor-not-allowed"
                                  : granted
                                    ? "border-emerald-500 bg-emerald-500/20 data-[state=checked]:bg-emerald-500/30 data-[state=checked]:border-emerald-400"
                                    : "border-slate-700 bg-transparent"
                              }
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500 flex-wrap">
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
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-blue-500/50 bg-blue-500/20 opacity-70 flex items-center justify-center">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="rgb(96, 165, 250)" strokeWidth="1.5" /></svg>
          </div>
          <span>Administrateur (non modifiable)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-500/30 border-dashed px-1">expert</Badge>
          <span>Permission avancee (mode expert)</span>
        </div>
      </div>

      {/* Reset confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinitialiser les permissions</DialogTitle>
            <DialogDescription>
              Voulez-vous reinitialiser toutes les permissions aux valeurs par defaut ? Les personnalisations actuelles seront perdues.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? "Reinitialisation..." : "Reinitialiser"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
