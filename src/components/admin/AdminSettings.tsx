import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Wrench, Building2, GitBranch, UserPlus, Shield, RefreshCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";

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

const CONFIG_KEYS: Array<{ key: string; label: string; type: "number" | "text" | "email"; defaultValue: string }> = [
  { key: "trial_duration_days", label: "Duree trial (jours)", type: "number", defaultValue: "14" },
  { key: "grace_period_monthly", label: "Jours de grace mensuel", type: "number", defaultValue: "7" },
  { key: "grace_period_annual", label: "Jours de grace annuel", type: "number", defaultValue: "14" },
  { key: "days_before_purge", label: "Jours avant purge", type: "number", defaultValue: "90" },
  { key: "support_email", label: "Email support", type: "email", defaultValue: "support@grimy.fr" },
  { key: "billing_email", label: "Email facturation", type: "email", defaultValue: "facturation@grimy.fr" },
  { key: "default_plan", label: "Plan par defaut", type: "text", defaultValue: "essentiel" },
];

export default function AdminSettings() {
  const { profile } = useAuth();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [removeAdminDialog, setRemoveAdminDialog] = useState<string | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<string | null>(null);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [createCabinetDialog, setCreateCabinetDialog] = useState(false);
  const [newCabinetName, setNewCabinetName] = useState("");
  const [newCabinetSiren, setNewCabinetSiren] = useState("");
  const [newCabinetPlan, setNewCabinetPlan] = useState("essentiel");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Load config from parametres table (where cabinet_id IS NULL = global config)
      const { data: paramData } = await supabase
        .from("parametres")
        .select("cle, valeur")
        .is("cabinet_id", null);

      const paramMap = new Map((paramData ?? []).map((p) => [p.cle, typeof p.valeur === "string" ? p.valeur : JSON.stringify(p.valeur)]));

      const items: ConfigItem[] = CONFIG_KEYS.map((ck) => ({
        key: ck.key,
        value: paramMap.get(ck.key) ?? ck.defaultValue,
        label: ck.label,
        type: ck.type,
      }));
      setConfigs(items);
      setOriginalValues(Object.fromEntries(items.map((c) => [c.key, c.value])));

      // Load super admins
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("is_super_admin", true);
      setSuperAdmins((admins ?? []) as SuperAdmin[]);
    } catch (err) {
      console.error("[AdminSettings] Load error:", err);
      toast.error("Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSave() {
    setSaving(true);
    try {
      const changed = configs.filter((c) => originalValues[c.key] !== c.value);
      for (const item of changed) {
        // Upsert into parametres table
        const { error } = await supabase
          .from("parametres")
          .upsert({
            cle: item.key,
            valeur: item.type === "number" ? Number(item.value) : item.value,
            cabinet_id: null,
            user_id: null,
          }, { onConflict: "cle" });
        if (error) throw error;
      }
      toast.success(`${changed.length} parametre(s) sauvegarde(s)`);
      setOriginalValues(Object.fromEntries(configs.map((c) => [c.key, c.value])));
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSuperAdmin() {
    if (!newAdminEmail.trim()) return;
    try {
      // Find profile by email and set is_super_admin
      const { data: found, error: findErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newAdminEmail.trim())
        .single();
      if (findErr || !found) {
        toast.error("Utilisateur non trouve avec cet email");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ is_super_admin: true })
        .eq("id", found.id);
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
      const { error } = await supabase
        .from("profiles")
        .update({ is_super_admin: false })
        .eq("id", adminId);
      if (error) throw error;
      toast.success("Super-admin retire");
      setRemoveAdminDialog(null);
      loadAll();
    } catch (err) {
      toast.error("Erreur lors du retrait du super-admin");
    }
  }

  async function handleMaintenance() {
    setMaintenanceRunning(true);
    try {
      const { data, error } = await supabase.rpc("daily_full_maintenance");
      if (error) throw error;
      setMaintenanceResult(JSON.stringify(data, null, 2));
      toast.success("Maintenance lancee avec succes");
    } catch (err) {
      toast.error("Erreur lors du lancement de la maintenance");
      setMaintenanceResult("Erreur: " + String(err));
    } finally {
      setMaintenanceRunning(false);
    }
  }

  async function handleCreateCabinet() {
    if (!newCabinetName.trim()) return;
    try {
      // Create cabinet
      const { data: cab, error: cabErr } = await supabase
        .from("cabinets")
        .insert({ nom: newCabinetName, siren: newCabinetSiren || null })
        .select("id")
        .single();
      if (cabErr) throw cabErr;

      // Create subscription for the new cabinet
      const { error: subErr } = await supabase
        .from("cabinet_subscriptions")
        .insert({
          cabinet_id: cab.id,
          plan: newCabinetPlan,
          status: "trialing",
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          max_seats: newCabinetPlan === "cabinet" ? 10 : 1,
          max_clients: newCabinetPlan === "cabinet" ? 500 : 50,
        });
      if (subErr) throw subErr;

      toast.success(`Cabinet "${newCabinetName}" cree avec succes`);
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

  const hasChanges = configs.some((c) => originalValues[c.key] !== c.value);

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Configuration GRIMY</h3>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((c) => (
            <div key={c.key}>
              <label className="text-xs text-slate-400 mb-1 block">{c.label}</label>
              <input
                type={c.type}
                value={c.value}
                onChange={(e) => updateConfigValue(c.key, e.target.value)}
                className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  originalValues[c.key] !== c.value ? "border-blue-500/50" : "border-white/10"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Super-admins */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
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
                <p className="text-sm text-slate-200">{admin.full_name || admin.email}</p>
                <p className="text-xs text-slate-500">{admin.email}</p>
              </div>
              {admin.id !== profile?.id && (
                <button
                  onClick={() => setRemoveAdminDialog(admin.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Retirer
                </button>
              )}
            </div>
          ))}
          {superAdmins.length === 0 && <p className="text-sm text-slate-500">Aucun super-admin configure</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Actions systeme</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleMaintenance}
            disabled={maintenanceRunning}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            <Wrench className={`h-4 w-4 ${maintenanceRunning ? "animate-spin" : ""}`} />
            {maintenanceRunning ? "En cours..." : "Lancer maintenance"}
          </button>
          <button
            onClick={() => setCreateCabinetDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors"
          >
            <Building2 className="h-4 w-4" /> Creer un cabinet
          </button>
          <button
            onClick={() => toast.info("Fonctionnalite informative uniquement — nettoyage des branches GitHub non implemente cote frontend.")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-slate-500/20 text-slate-300 rounded-lg hover:bg-slate-500/30 transition-colors"
          >
            <GitBranch className="h-4 w-4" /> Nettoyer les branches GitHub
          </button>
        </div>

        {maintenanceResult && (
          <div className="mt-4 bg-black/30 border border-white/5 rounded-lg p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">Resultat de la maintenance :</p>
              <button onClick={() => setMaintenanceResult(null)} className="text-xs text-slate-500 hover:text-slate-300">Fermer</button>
            </div>
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
            <label className="text-sm text-slate-300">Email de l'utilisateur existant :</label>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
            />
            <p className="text-xs text-slate-500 mt-2">L'utilisateur doit deja avoir un compte GRIMY.</p>
          </div>
          <DialogFooter>
            <button onClick={() => setAddAdminDialog(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button
              onClick={handleAddSuperAdmin}
              disabled={!newAdminEmail.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
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
              <label className="text-sm text-slate-300">Nom du cabinet :</label>
              <input
                type="text"
                value={newCabinetName}
                onChange={(e) => setNewCabinetName(e.target.value)}
                placeholder="Cabinet Dupont"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">SIREN (optionnel) :</label>
              <input
                type="text"
                value={newCabinetSiren}
                onChange={(e) => setNewCabinetSiren(e.target.value)}
                placeholder="123456789"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Plan :</label>
              <select
                value={newCabinetPlan}
                onChange={(e) => setNewCabinetPlan(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
              >
                <option value="essentiel">Essentiel</option>
                <option value="pro">Pro</option>
                <option value="cabinet">Cabinet</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateCabinetDialog(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button
              onClick={handleCreateCabinet}
              disabled={!newCabinetName.trim()}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
            >
              Creer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
