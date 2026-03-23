import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Plus, Trash2, Wrench, Building2, GitBranch, UserPlus, Shield, History, Database, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDateTimeFr } from "@/lib/dateUtils";

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  type: "number" | "text" | "email";
}

interface SuperAdmin {
  id: string;
  email: string;
  full_name: string;
}

interface ConfigChange {
  id: string;
  action: string;
  user_email: string | null;
  created_at: string;
  old_data: unknown;
  new_data: unknown;
}

const CONFIG_LABELS: Record<string, { label: string; type: "number" | "text" | "email" }> = {
  trial_duration_days: { label: "Duree trial (jours)", type: "number" },
  grace_period_monthly: { label: "Jours de grace mensuel", type: "number" },
  grace_period_annual: { label: "Jours de grace annuel", type: "number" },
  days_before_purge: { label: "Jours avant purge", type: "number" },
  support_email: { label: "Email support", type: "email" },
  billing_email: { label: "Email facturation", type: "email" },
  default_plan: { label: "Plan par defaut", type: "text" },
  maintenance_mode: { label: "Mode maintenance", type: "text" },
};

export default function AdminSettings() {
  const { profile } = useAuth();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, string>>({});
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [removeAdminDialog, setRemoveAdminDialog] = useState<string | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<string | null>(null);
  const [createCabinetDialog, setCreateCabinetDialog] = useState(false);
  const [newCabinetName, setNewCabinetName] = useState("");
  const [newCabinetSiren, setNewCabinetSiren] = useState("");
  const [newCabinetPlan, setNewCabinetPlan] = useState("solo");

  // 37. Config changelog
  const [configChanges, setConfigChanges] = useState<ConfigChange[]>([]);
  // 39. Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [configRes, adminsRes, changelogRes] = await Promise.all([
        supabase.rpc("admin_get_config"),
        supabase.from("profiles").select("id, email, full_name").eq("is_super_admin", true),
        // 37. Fetch config changes
        supabase
          .from("audit_trail")
          .select("id, action, user_email, created_at, old_data, new_data")
          .eq("action", "config_change")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (configRes.data) {
        const data = configRes.data as unknown as Record<string, string>;
        const items: ConfigItem[] = Object.entries(data).map(([key, value]) => ({
          key,
          value: String(value),
          label: CONFIG_LABELS[key]?.label ?? key,
          type: CONFIG_LABELS[key]?.type ?? "text",
        }));
        setConfigs(items);
        setOriginalConfigs(data);
        // 39. Check maintenance mode
        setMaintenanceMode(data.maintenance_mode === "true" || data.maintenance_mode === "1");
      }

      if (adminsRes.data) {
        setSuperAdmins(adminsRes.data as unknown as SuperAdmin[]);
      }

      if (changelogRes.data) {
        setConfigChanges(changelogRes.data as unknown as ConfigChange[]);
      }
    } catch (err) {
      console.error("[AdminSettings] Load error:", err);
      toast.error("Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changed = configs.filter((c) => originalConfigs[c.key] !== c.value);
      for (const item of changed) {
        const { error } = await supabase.rpc("admin_set_config", { p_key: item.key, p_value: item.value });
        if (error) throw error;
      }
      toast.success(`${changed.length} parametre(s) sauvegarde(s)`);
      setOriginalConfigs(Object.fromEntries(configs.map((c) => [c.key, c.value])));
      loadAll(); // Refresh changelog
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSuperAdmin() {
    if (!newAdminEmail.trim()) return;
    try {
      const { error } = await supabase.rpc("admin_set_super_admin", { p_email: newAdminEmail, p_is_super: true });
      if (error) throw error;
      toast.success("Super-admin ajoute");
      setAddAdminDialog(false);
      setNewAdminEmail("");
      loadAll();
    } catch (err) {
      toast.error("Erreur lors de l'ajout du super-admin");
    }
  }

  async function handleRemoveSuperAdmin(adminId: string) {
    try {
      const admin = superAdmins.find((a) => a.id === adminId);
      if (!admin) return;
      const { error } = await supabase.rpc("admin_set_super_admin", { p_email: admin.email, p_is_super: false });
      if (error) throw error;
      toast.success("Super-admin retire");
      setRemoveAdminDialog(null);
      loadAll();
    } catch (err) {
      toast.error("Erreur lors du retrait du super-admin");
    }
  }

  async function handleMaintenance() {
    try {
      const { data, error } = await supabase.functions.invoke("daily-maintenance");
      if (error) throw error;
      setMaintenanceResult(JSON.stringify(data, null, 2));
      toast.success("Maintenance lancee avec succes");
    } catch (err) {
      toast.error("Erreur lors du lancement de la maintenance");
    }
  }

  // 38. Backup manual
  async function handleBackup() {
    try {
      const { data, error } = await supabase.rpc("admin_create_backup");
      if (error) throw error;
      toast.success("Snapshot cree avec succes");
      if (data) {
        setMaintenanceResult(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      toast.error("Erreur lors de la creation du snapshot");
    }
  }

  // 39. Toggle maintenance mode
  async function toggleMaintenanceMode() {
    const newVal = !maintenanceMode;
    try {
      const { error } = await supabase.rpc("admin_set_config", {
        p_key: "maintenance_mode",
        p_value: newVal ? "true" : "false",
      });
      if (error) throw error;
      setMaintenanceMode(newVal);
      toast.success(newVal ? "Mode maintenance active" : "Mode maintenance desactive");
      // Update local config
      setConfigs((prev) =>
        prev.map((c) => (c.key === "maintenance_mode" ? { ...c, value: newVal ? "true" : "false" } : c))
      );
      loadAll(); // Refresh changelog
    } catch (err) {
      toast.error("Erreur lors du changement de mode");
    }
  }

  async function handleCreateCabinet() {
    if (!newCabinetName.trim()) return;
    try {
      const { error } = await supabase.rpc("admin_create_cabinet", {
        p_name: newCabinetName,
        p_siren: newCabinetSiren || null,
        p_plan: newCabinetPlan,
      });
      if (error) throw error;
      toast.success("Cabinet cree avec succes");
      setCreateCabinetDialog(false);
      setNewCabinetName("");
      setNewCabinetSiren("");
    } catch (err) {
      toast.error("Erreur lors de la creation du cabinet");
    }
  }

  function updateConfigValue(key: string, value: string) {
    setConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  const hasChanges = configs.some((c) => originalConfigs[c.key] !== c.value);

  return (
    <div className="space-y-6">
      {/* 39. Maintenance mode banner */}
      {maintenanceMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Mode maintenance actif</p>
            <p className="text-xs text-amber-400/70">Un bandeau de maintenance est affiche a tous les utilisateurs.</p>
          </div>
          <button
            onClick={toggleMaintenanceMode}
            className="ml-auto px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            Desactiver
          </button>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Configuration GRIMY</h3>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg disabled:opacity-45 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.filter((c) => c.key !== "maintenance_mode").map((c) => (
            <div key={c.key}>
              <label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-1 block">{c.label}</label>
              <input
                type={c.type}
                value={c.value}
                onChange={(e) => updateConfigValue(c.key, e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 37. Config changelog */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" /> Historique des modifications
        </h3>
        {configChanges.length > 0 ? (
          <div className="space-y-2">
            {configChanges.map((ch) => {
              const oldStr = ch.old_data ? JSON.stringify(ch.old_data) : "—";
              const newStr = ch.new_data ? JSON.stringify(ch.new_data) : "—";
              return (
                <div key={ch.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-500">{formatDateTimeFr(ch.created_at)}</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-300">{ch.user_email ?? "Systeme"}</span>
                  <span className="text-slate-600">:</span>
                  <span className="text-red-400/60 text-xs line-through truncate max-w-[150px]">{oldStr}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-emerald-400 text-xs truncate max-w-[150px]">{newStr}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune modification enregistree</p>
        )}
      </div>

      {/* Super-admins */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" /> Super-admins
          </h3>
          <button
            onClick={() => setAddAdminDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            <UserPlus className="h-3 w-3" /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {superAdmins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm text-slate-800 dark:text-slate-200">{admin.full_name || admin.email}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{admin.email}</p>
              </div>
              {admin.id !== profile?.id && (
                <button
                  onClick={() => setRemoveAdminDialog(admin.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
          {superAdmins.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucun super-admin</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleMaintenance}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <Wrench className="h-4 w-4" /> Lancer maintenance
          </button>
          {/* 38. Backup button */}
          <button
            onClick={handleBackup}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-cyan-500/20 text-cyan-300 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            <Database className="h-4 w-4" /> Creer un snapshot
          </button>
          {/* 39. Maintenance mode toggle */}
          <button
            onClick={toggleMaintenanceMode}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
              maintenanceMode
                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-500/20 text-slate-700 dark:text-slate-300 hover:bg-slate-500/30"
            }`}
          >
            <AlertTriangle className="h-4 w-4" /> {maintenanceMode ? "Desactiver maintenance" : "Activer maintenance"}
          </button>
          <button
            onClick={() => setCreateCabinetDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors"
          >
            <Building2 className="h-4 w-4" /> Creer un cabinet
          </button>
          <button
            onClick={() => toast.info("Fonctionnalite informative uniquement")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-slate-500/20 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-500/30 transition-colors"
          >
            <GitBranch className="h-4 w-4" /> Nettoyer les branches GitHub
          </button>
        </div>

        {maintenanceResult && (
          <div className="mt-4 bg-black/30 border border-white/5 rounded-lg p-4 overflow-x-auto">
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-2">Resultat :</p>
            <pre className="text-xs text-emerald-300 whitespace-pre-wrap">{maintenanceResult}</pre>
          </div>
        )}
      </div>

      {/* Add Super Admin Dialog */}
      <Dialog open={addAdminDialog} onOpenChange={setAddAdminDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un super-admin</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Email du nouvel admin :</label>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setAddAdminDialog(false)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button
              onClick={handleAddSuperAdmin}
              disabled={!newAdminEmail.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg disabled:opacity-45"
            >
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Super Admin Dialog */}
      <AlertDialog open={!!removeAdminDialog} onOpenChange={() => setRemoveAdminDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le super-admin</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir retirer les droits super-admin de cet utilisateur ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeAdminDialog && handleRemoveSuperAdmin(removeAdminDialog)} className="bg-red-600 hover:bg-red-700">
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Cabinet Dialog */}
      <Dialog open={createCabinetDialog} onOpenChange={setCreateCabinetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creer un cabinet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">Nom du cabinet :</label>
              <input
                type="text"
                value={newCabinetName}
                onChange={(e) => setNewCabinetName(e.target.value)}
                placeholder="Cabinet Dupont"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">SIREN (optionnel) :</label>
              <input
                type="text"
                value={newCabinetSiren}
                onChange={(e) => setNewCabinetSiren(e.target.value)}
                placeholder="123456789"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">Plan :</label>
              <select
                value={newCabinetPlan}
                onChange={(e) => setNewCabinetPlan(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 mt-1"
              >
                <option value="solo">Solo</option>
                <option value="cabinet">Cabinet</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateCabinetDialog(false)} className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">Annuler</button>
            <button
              onClick={handleCreateCabinet}
              disabled={!newCabinetName.trim()}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white rounded-lg disabled:opacity-45"
            >
              Creer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
