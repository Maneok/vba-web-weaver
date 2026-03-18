import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2, Plus, MapPin, Users, Crown, Pencil, Trash2, Palette, Loader2,
  Mail, Phone, Search, Hash, CalendarDays, Info,
} from "lucide-react";

interface Cabinet {
  id: string;
  nom: string;
  adresse: string | null;
  cp: string | null;
  ville: string | null;
  siret: string | null;
  numero_oec: string | null;
  email: string | null;
  telephone: string | null;
  couleur_primaire: string;
  is_principal: boolean;
  parent_cabinet_id: string | null;
  created_at: string;
  membre_count?: number;
}

interface CabinetForm {
  nom: string;
  ville: string;
  siret: string;
  couleur_primaire: string;
  numero_oec: string;
  email: string;
  telephone: string;
}

const EMPTY_FORM: CabinetForm = { nom: "", ville: "", siret: "", couleur_primaire: "#3b82f6", numero_oec: "", email: "", telephone: "" };

const SIRET_REGEX = /^\d{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s().+-]{7,20}$/;

// #14 – Same 8 color presets as SettingsPage
const COLOR_PRESETS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6366f1", // indigo
];

function validateSiret(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  return digits === "" || SIRET_REGEX.test(digits);
}

function validateEmail(raw: string): string {
  if (!raw.trim()) return "";
  if (!EMAIL_REGEX.test(raw.trim())) return "Format d'email invalide";
  return "";
}

function validatePhone(raw: string): string {
  if (!raw.trim()) return "";
  if (!PHONE_REGEX.test(raw.trim())) return "Format de telephone invalide (7 a 20 caracteres, chiffres et separateurs)";
  return "";
}

// #9 – Format SIRET with spaces: XXX XXX XXX XXXXX
function formatSiret(siret: string | null): string {
  if (!siret) return "";
  const digits = siret.replace(/\s/g, "");
  if (digits.length !== 14) return siret;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}

// #10 – Relative time for created_at
function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Cree aujourd'hui";
  if (diffDays === 1) return "Cree hier";
  if (diffDays < 30) return `Cree il y a ${diffDays} jours`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "Cree il y a 1 mois";
  if (diffMonths < 12) return `Cree il y a ${diffMonths} mois`;
  const diffYears = Math.floor(diffMonths / 12);
  return `Cree il y a ${diffYears} an${diffYears > 1 ? "s" : ""}`;
}

// #6 – Get 2-letter initials from cabinet name
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CabinetsList() {
  const { profile } = useAuth();
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cabinet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cabinet | null>(null);
  const [form, setForm] = useState<CabinetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [siretError, setSiretError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [siretDirty, setSiretDirty] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  // #12 – Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const initRef = useRef(false);

  // #12 – Filtered cabinets
  const filteredCabinets = useMemo(() => {
    if (!searchQuery.trim()) return cabinets;
    const q = searchQuery.toLowerCase();
    return cabinets.filter((c) =>
      c.nom.toLowerCase().includes(q) ||
      c.ville?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [cabinets, searchQuery]);

  // #11 – Stats
  const totalMembres = useMemo(() => cabinets.reduce((sum, c) => sum + (c.membre_count || 0), 0), [cabinets]);

  const loadCabinets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinets")
        .select("*, cabinet_membres(count)")
        .order("is_principal", { ascending: false });
      if (error) throw error;

      const list = (data || []).map((c: any) => ({
        ...c,
        couleur_primaire: c.couleur_primaire || "#3b82f6",
        membre_count: c.cabinet_membres?.[0]?.count ?? 0,
        cabinet_membres: undefined,
      })) as Cabinet[];

      if (list.length === 0 && profile && !initRef.current) {
        initRef.current = true;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const cabinetName = user?.user_metadata?.cabinet_name || profile.full_name?.split(" ").pop() || "Cabinet Principal";
          const { data: newCab, error: insertErr } = await supabase
            .from("cabinets")
            .insert({
              nom: `Cabinet ${cabinetName}`,
              is_principal: true,
              couleur_primaire: "#3b82f6",
              email: profile.email || null,
            })
            .select()
            .single();
          if (insertErr) throw insertErr;
          if (newCab) {
            await supabase.from("cabinet_membres").insert({
              cabinet_id: newCab.id,
              user_id: profile.id,
              role: "ADMIN",
            });
            await logAudit({ action: "CREATION_CABINET", table_name: "cabinets", record_id: newCab.id, new_data: { nom: `Cabinet ${cabinetName}` } });
            setCabinets([{ ...newCab, couleur_primaire: newCab.couleur_primaire || "#3b82f6", membre_count: 1 } as Cabinet]);
            return;
          }
        } catch (err) {
          logger.error("CabinetsList", "Erreur creation cabinet par defaut", err);
        }
      }

      setCabinets(list);
    } catch (err) {
      logger.error("CabinetsList", "Erreur chargement", err);
      toast.error("Erreur lors du chargement des cabinets");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadCabinets(); }, [loadCabinets]);

  const handleSiretChange = (value: string) => {
    setForm((f) => ({ ...f, siret: value }));
    setSiretDirty(true);
    const digits = value.replace(/\s/g, "");
    if (digits && !SIRET_REGEX.test(digits)) {
      setSiretError("Le SIRET doit contenir exactement 14 chiffres");
    } else {
      setSiretError("");
    }
  };

  const handleEmailChange = (value: string) => {
    setForm((f) => ({ ...f, email: value }));
    setEmailError(validateEmail(value));
  };

  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, telephone: value }));
    setPhoneError(validatePhone(value));
  };

  const hasFormErrors = !!siretError || !!emailError || !!phoneError;

  const validateFormOnSubmit = (): boolean => {
    let valid = true;
    const siretDigits = form.siret.replace(/\s/g, "");
    if (siretDirty && siretDigits === "") {
      setSiretError("Le SIRET doit contenir exactement 14 chiffres");
      valid = false;
    } else if (!validateSiret(form.siret)) {
      setSiretError("Le SIRET doit contenir exactement 14 chiffres");
      valid = false;
    }
    const eErr = validateEmail(form.email);
    if (eErr) { setEmailError(eErr); valid = false; }
    const pErr = validatePhone(form.telephone);
    if (pErr) { setPhoneError(pErr); valid = false; }
    return valid;
  };

  const resetFormState = () => {
    setForm(EMPTY_FORM);
    setSiretError("");
    setEmailError("");
    setPhoneError("");
    setSiretDirty(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    if (!validateFormOnSubmit()) return;
    setSaving(true);
    try {
      const parentId = cabinets.find((c) => c.is_principal)?.id;
      const siretClean = form.siret.replace(/\s/g, "") || null;

      const { data: newCab, error } = await supabase
        .from("cabinets")
        .insert({
          nom: form.nom,
          ville: form.ville || null,
          siret: siretClean,
          couleur_primaire: form.couleur_primaire,
          numero_oec: form.numero_oec || null,
          email: form.email || null,
          telephone: form.telephone || null,
          is_principal: false,
          parent_cabinet_id: parentId || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (newCab && profile) {
        await supabase.from("cabinet_membres").insert({
          cabinet_id: newCab.id,
          user_id: profile.id,
          role: "ADMIN",
        });
      }

      await logAudit({ action: "CREATION_CABINET", table_name: "cabinets", record_id: newCab?.id, new_data: { nom: form.nom } });
      toast.success("Cabinet ajoute avec succes");
      setAddOpen(false);
      resetFormState();
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur ajout cabinet", err);
      toast.error("Erreur lors de l'ajout du cabinet");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Cabinet) => {
    setEditTarget(c);
    setForm({
      nom: c.nom,
      ville: c.ville || "",
      siret: c.siret || "",
      couleur_primaire: c.couleur_primaire,
      numero_oec: c.numero_oec || "",
      email: c.email || "",
      telephone: c.telephone || "",
    });
    setSiretError("");
    setEmailError("");
    setPhoneError("");
    setSiretDirty(!!c.siret);
  };

  // #15 – Sync principal cabinet edits to parametres table
  const syncToParametres = async (formData: CabinetForm) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch existing cabinet_info to merge
      const { data: existing } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("user_id", user.id)
        .eq("cle", "cabinet_info")
        .maybeSingle();

      const existingVal = (existing?.valeur as Record<string, unknown>) || {};
      const siretClean = formData.siret.replace(/\s/g, "") || "";

      const updated = {
        ...existingVal,
        nom: formData.nom,
        ville: formData.ville,
        siret: siretClean,
        numeroOEC: formData.numero_oec,
        email: formData.email,
        telephone: formData.telephone,
        couleurPrimaire: formData.couleur_primaire,
      };

      await supabase.from("parametres").upsert(
        {
          user_id: user.id,
          cabinet_id: profile?.cabinet_id || null,
          cle: "cabinet_info",
          valeur: updated as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,cle" }
      );
    } catch (err) {
      logger.error("CabinetsList", "Erreur sync parametres cabinet_info", err);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !form.nom.trim()) return;
    if (!validateFormOnSubmit()) return;
    setSaving(true);
    setActionInProgress(editTarget.id);
    try {
      const siretClean = form.siret.replace(/\s/g, "") || null;
      const updatePayload = {
        nom: form.nom,
        ville: form.ville || null,
        siret: siretClean,
        couleur_primaire: form.couleur_primaire,
        numero_oec: form.numero_oec || null,
        email: form.email || null,
        telephone: form.telephone || null,
      };
      const { error } = await supabase
        .from("cabinets")
        .update(updatePayload)
        .eq("id", editTarget.id);
      if (error) throw error;

      // #15 – Sync to parametres if principal cabinet
      if (editTarget.is_principal) {
        await syncToParametres(form);
      }

      const changedFields: Record<string, { old: any; new: any }> = {};
      const fieldMap: Record<string, keyof Cabinet> = {
        nom: "nom",
        ville: "ville",
        siret: "siret",
        couleur_primaire: "couleur_primaire",
        numero_oec: "numero_oec",
        email: "email",
        telephone: "telephone",
      };
      for (const [formKey, cabKey] of Object.entries(fieldMap)) {
        const oldVal = editTarget[cabKey] ?? null;
        const newVal = (updatePayload as any)[formKey] ?? null;
        if (oldVal !== newVal) {
          changedFields[formKey] = { old: oldVal, new: newVal };
        }
      }
      await logAudit({
        action: "MODIFICATION_CABINET",
        table_name: "cabinets",
        record_id: editTarget.id,
        old_data: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.old])),
        new_data: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.new])),
      });

      toast.success("Cabinet modifie");
      setEditTarget(null);
      resetFormState();
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur modification cabinet", err);
      toast.error("Erreur lors de la modification");
    } finally {
      setSaving(false);
      setActionInProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.membre_count && deleteTarget.membre_count > 0) {
      toast.error(`Impossible de supprimer : ce cabinet a encore ${deleteTarget.membre_count} membre${deleteTarget.membre_count > 1 ? "s" : ""}. Retirez-les d'abord.`);
      setDeleteTarget(null);
      return;
    }

    setSaving(true);
    setActionInProgress(deleteTarget.id);

    const previousCabinets = cabinets;
    setCabinets((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    const deletedCabinet = deleteTarget;
    setDeleteTarget(null);

    try {
      const { error } = await supabase.from("cabinets").delete().eq("id", deletedCabinet.id);
      if (error) throw error;
      await logAudit({ action: "SUPPRESSION_CABINET", table_name: "cabinets", record_id: deletedCabinet.id, old_data: { nom: deletedCabinet.nom } });
      toast.success("Cabinet supprime");
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur suppression cabinet", err);
      toast.error("Erreur lors de la suppression");
      setCabinets(previousCabinets);
    } finally {
      setSaving(false);
      setActionInProgress(null);
    }
  };

  const pluralize = (count: number, singular: string, plural: string) => count <= 1 ? singular : plural;

  // #13 – Improved form fields with section headers and icons
  const renderFormFields = () => (
    <>
      {/* Section: Identite */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Building2 className="h-4 w-4 text-blue-400" />
          <span>Identite du cabinet</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cab-nom">Nom du cabinet *</Label>
          <Input id="cab-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Cabinet Lyon" required aria-required="true" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cab-ville">Ville</Label>
            <Input id="cab-ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Lyon" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cab-siret">SIRET</Label>
            <Input
              id="cab-siret"
              value={form.siret}
              onChange={(e) => handleSiretChange(e.target.value)}
              placeholder="12345678900012"
              maxLength={17}
              aria-invalid={!!siretError}
              aria-describedby={siretError ? "siret-error" : undefined}
            />
            {siretError && <p id="siret-error" className="text-xs text-red-400">{siretError}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cab-oec">Numero OEC</Label>
          <Input id="cab-oec" value={form.numero_oec} onChange={(e) => setForm({ ...form, numero_oec: e.target.value })} placeholder="123456" />
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 dark:border-white/[0.06]" />

      {/* Section: Contact */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Mail className="h-4 w-4 text-emerald-400" />
          <span>Coordonnees</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cab-email">Email</Label>
            <Input
              id="cab-email"
              type="email"
              value={form.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="contact@cabinet.fr"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError && <p id="email-error" className="text-xs text-red-400">{emailError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cab-tel">Telephone</Label>
            <Input
              id="cab-tel"
              value={form.telephone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="01 23 45 67 89"
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? "phone-error" : undefined}
            />
            {phoneError && <p id="phone-error" className="text-xs text-red-400">{phoneError}</p>}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 dark:border-white/[0.06]" />

      {/* Section: Apparence */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Palette className="h-4 w-4 text-violet-400" />
          <span>Apparence</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cab-couleur">Couleur primaire</Label>
          {/* #14 – Color preset swatches */}
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-7 w-7 rounded-full border-2 transition-all hover:scale-110 ${
                  form.couleur_primaire === color ? "border-white scale-110 ring-2 ring-white/20" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setForm({ ...form, couleur_primaire: color })}
                aria-label={`Couleur ${color}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              id="cab-couleur"
              type="color"
              value={form.couleur_primaire}
              onChange={(e) => setForm({ ...form, couleur_primaire: e.target.value })}
              className="h-9 w-9 rounded border border-white/10 bg-transparent cursor-pointer"
              aria-label="Couleur personnalisee du cabinet"
            />
            <Input
              value={form.couleur_primaire}
              onChange={(e) => setForm({ ...form, couleur_primaire: e.target.value })}
              className="flex-1 font-mono text-xs"
              maxLength={7}
            />
            <div className="w-8 h-8 rounded-md border border-white/10" style={{ backgroundColor: form.couleur_primaire }} />
          </div>
        </div>
      </div>

      {editTarget?.is_principal && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-300">Cabinet principal — ne peut pas etre supprime</span>
        </div>
      )}
    </>
  );

  if (loading) return <SkeletonCards />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Cabinets du reseau</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{cabinets.length} cabinet{cabinets.length > 1 ? "s" : ""} configures</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetFormState(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" aria-label="Ajouter un nouveau cabinet">
              <Plus className="h-4 w-4" /> Ajouter un cabinet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-400" />
                Nouveau cabinet
              </DialogTitle>
              <DialogDescription>Renseignez les informations du nouveau cabinet a creer.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-2">
              {renderFormFields()}
              <Button type="submit" className="w-full" disabled={saving || hasFormErrors}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Ajout...</> : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* #11 – Stats summary bar */}
      {cabinets.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{cabinets.length}</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">{pluralize(cabinets.length, "cabinet", "cabinets")}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
            <Users className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{totalMembres}</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">{pluralize(totalMembres, "collaborateur", "collaborateurs")}</span>
          </div>
          {/* #12 – Search input */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Rechercher un cabinet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-56 bg-gray-50/80 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] text-sm"
            />
          </div>
        </div>
      )}

      {/* #1 – Card-based grid layout */}
      {cabinets.length === 0 ? (
        // #5 – Better empty state
        <div className="text-center py-20 space-y-5">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Building2 className="h-10 w-10 text-blue-400 animate-pulse" />
          </div>
          <div>
            <p className="text-lg text-slate-700 dark:text-slate-300 font-medium">Aucun cabinet configure</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Commencez par ajouter votre premier cabinet pour organiser votre reseau professionnel.
            </p>
          </div>
          <Button size="sm" className="gap-2 mt-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Creer un cabinet
          </Button>
        </div>
      ) : filteredCabinets.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Aucun cabinet ne correspond a "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCabinets.map((c) => (
            <Card
              key={c.id}
              className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] ${
                c.is_principal ? "ring-1 ring-amber-500/20" : ""
              }`}
            >
              {/* #2 – Colored top border */}
              <div className="h-1 w-full" style={{ backgroundColor: c.couleur_primaire }} />

              {/* #3 – Golden gradient glow for principal */}
              {c.is_principal && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-amber-500/[0.02] pointer-events-none" />
              )}

              <div className="p-5 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* #6 – Avatar with initials */}
                    <div
                      className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        backgroundColor: c.couleur_primaire + "20",
                        color: c.couleur_primaire,
                      }}
                    >
                      {getInitials(c.nom)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.nom}</h3>
                        {c.is_principal && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1 shrink-0 text-xs">
                            <Crown className="h-3 w-3" /> Principal
                          </Badge>
                        )}
                      </div>
                      {c.ville && (
                        <span className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                          <MapPin className="h-3 w-3" /> {c.ville}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                      onClick={() => openEdit(c)}
                      disabled={actionInProgress === c.id}
                      aria-label={`Modifier le cabinet ${c.nom}`}
                    >
                      {actionInProgress === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                    {!c.is_principal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        onClick={() => setDeleteTarget(c)}
                        disabled={actionInProgress === c.id}
                        aria-label={`Supprimer le cabinet ${c.nom}`}
                      >
                        {actionInProgress === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Card details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {/* #7 – Email on card */}
                  {c.email && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400 col-span-2 sm:col-span-1 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {/* #7 – Telephone on card */}
                  {c.telephone && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400 col-span-2 sm:col-span-1">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span>{c.telephone}</span>
                    </div>
                  )}
                  {/* #9 – SIRET formatted */}
                  {c.siret && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="font-mono text-xs">{formatSiret(c.siret)}</span>
                    </div>
                  )}
                  {/* OEC */}
                  {c.numero_oec && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      <Info className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-xs">OEC {c.numero_oec}</span>
                    </div>
                  )}
                </div>

                {/* Footer: members + date */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/[0.04]">
                  {/* #8 – Member count */}
                  <Badge variant="outline" className="text-slate-400 dark:text-slate-500 dark:text-slate-400 border-slate-700/60 gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {c.membre_count} {pluralize(c.membre_count || 0, "membre", "membres")}
                  </Badge>
                  {/* #10 – Relative time */}
                  <span className="flex items-center gap-1 text-xs text-slate-300 dark:text-slate-600">
                    <CalendarDays className="h-3 w-3" />
                    {relativeTime(c.created_at)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetFormState(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-400" />
              Modifier le cabinet
            </DialogTitle>
            <DialogDescription>Modifiez les informations du cabinet "{editTarget?.nom}".</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {renderFormFields()}
            <Button type="submit" className="w-full" disabled={saving || hasFormErrors}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement...</> : "Enregistrer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le cabinet</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer le cabinet <strong>{deleteTarget?.nom}</strong> ? Cette action est irreversible et supprimera toutes les donnees associees.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (deleteTarget.membre_count ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Users className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-300">
                Ce cabinet a encore {deleteTarget.membre_count} membre{(deleteTarget.membre_count ?? 0) > 1 ? "s" : ""}. Retirez-les avant de supprimer.
              </span>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || (deleteTarget?.membre_count ?? 0) > 0}
            >
              {saving ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
