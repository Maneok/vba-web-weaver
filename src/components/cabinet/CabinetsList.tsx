import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, MapPin, Users, Crown, Pencil, Trash2, Palette, Loader2 } from "lucide-react";

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

// #3 – SIRET validation: empty string is only valid if user never typed anything (pristine).
//      We track "dirty" state separately; here we validate the cleaned value.
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

function SkeletonTable() {
  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
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
  // #7 – Track which row action is in progress
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // #1 – Guard against StrictMode double-mount triggering duplicate auto-creation
  const initRef = useRef(false);

  const loadCabinets = useCallback(async () => {
    try {
      // #2 – Fetch cabinets and member counts in a single query using a left join aggregate
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

      // #1 – Auto-create default cabinet only once, guarded by initRef
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

  // #4 – Email validation handler
  const handleEmailChange = (value: string) => {
    setForm((f) => ({ ...f, email: value }));
    setEmailError(validateEmail(value));
  };

  // #5 – Phone validation handler
  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, telephone: value }));
    setPhoneError(validatePhone(value));
  };

  // Check if form has validation errors
  const hasFormErrors = !!siretError || !!emailError || !!phoneError;

  // #3 – Validate SIRET on submit: if user typed then cleared, siretDirty is true and empty is invalid
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

      // Add current user as admin of new cabinet
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

      // #8 – Log all changed fields, not just nom
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

    // #10 – Prevent deleting a cabinet that still has members
    if (deleteTarget.membre_count && deleteTarget.membre_count > 0) {
      toast.error(`Impossible de supprimer : ce cabinet a encore ${deleteTarget.membre_count} membre${deleteTarget.membre_count > 1 ? "s" : ""}. Retirez-les d'abord.`);
      setDeleteTarget(null);
      return;
    }

    setSaving(true);
    setActionInProgress(deleteTarget.id);

    // #6 – Optimistic delete: remove from UI immediately, rollback on error
    const previousCabinets = cabinets;
    setCabinets((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    const deletedCabinet = deleteTarget;
    setDeleteTarget(null);

    try {
      const { error } = await supabase.from("cabinets").delete().eq("id", deletedCabinet.id);
      if (error) throw error;
      await logAudit({ action: "SUPPRESSION_CABINET", table_name: "cabinets", record_id: deletedCabinet.id, old_data: { nom: deletedCabinet.nom } });
      toast.success("Cabinet supprime");
      // Reload to get fresh data from server
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur suppression cabinet", err);
      toast.error("Erreur lors de la suppression");
      // Rollback optimistic update
      setCabinets(previousCabinets);
    } finally {
      setSaving(false);
      setActionInProgress(null);
    }
  };

  const pluralize = (count: number, singular: string, plural: string) => count <= 1 ? singular : plural;

  // Shared form fields renderer
  const renderFormFields = () => (
    <>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cab-oec">Numero OEC</Label>
          <Input id="cab-oec" value={form.numero_oec} onChange={(e) => setForm({ ...form, numero_oec: e.target.value })} placeholder="123456" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cab-couleur">Couleur</Label>
          <div className="flex items-center gap-2">
            <input
              id="cab-couleur"
              type="color"
              value={form.couleur_primaire}
              onChange={(e) => setForm({ ...form, couleur_primaire: e.target.value })}
              className="h-9 w-9 rounded border border-white/10 bg-transparent cursor-pointer"
              aria-label="Couleur du cabinet"
            />
            <Input
              value={form.couleur_primaire}
              onChange={(e) => setForm({ ...form, couleur_primaire: e.target.value })}
              className="flex-1 font-mono text-xs"
              maxLength={7}
            />
          </div>
        </div>
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
      {/* #9 – Show is_principal badge in edit dialog */}
      {editTarget?.is_principal && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-300">Cabinet principal — ne peut pas etre supprime</span>
        </div>
      )}
    </>
  );

  if (loading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Cabinets du reseau</h2>
          <p className="text-sm text-slate-400">{cabinets.length} cabinet{cabinets.length > 1 ? "s" : ""}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetFormState(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" aria-label="Ajouter un nouveau cabinet">
              <Plus className="h-4 w-4" /> Ajouter un cabinet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau cabinet</DialogTitle>
              <DialogDescription>Renseignez les informations du nouveau cabinet a creer.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-2">
              {renderFormFields()}
              <Button type="submit" className="w-full" disabled={saving || hasFormErrors}>
                {saving ? "Ajout..." : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cabinets.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Aucun cabinet configure</p>
            <p className="text-sm text-slate-500 mt-1">Commencez par ajouter votre premier cabinet.</p>
          </div>
        </div>
      ) : (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-white/[0.02]">
                <TableHead className="text-slate-400">Cabinet</TableHead>
                <TableHead className="text-slate-400">Ville</TableHead>
                <TableHead className="text-slate-400">SIRET</TableHead>
                <TableHead className="text-slate-400 text-center">Collaborateurs</TableHead>
                <TableHead className="text-slate-400">Statut</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cabinets.map((c) => (
                <TableRow key={c.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.couleur_primaire + "20" }}>
                        <Building2 className="h-4 w-4" style={{ color: c.couleur_primaire }} />
                      </div>
                      <span className="font-medium text-slate-200">{c.nom}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.ville ? (
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="h-3 w-3" /> {c.ville}
                      </span>
                    ) : (
                      <span className="text-slate-600">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-400 font-mono text-xs">{c.siret || <span className="text-slate-600">&mdash;</span>}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-slate-300 border-slate-700 gap-1">
                      <Users className="h-3 w-3" />
                      {c.membre_count} {pluralize(c.membre_count || 0, "membre", "membres")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_principal ? (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1">
                        <Crown className="h-3 w-3" /> Principal
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 border-slate-700">Secondaire</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* #7 – Loading state on edit button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(c)}
                        disabled={actionInProgress === c.id}
                        aria-label={`Modifier le cabinet ${c.nom}`}
                      >
                        {actionInProgress === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      </Button>
                      {!c.is_principal && (
                        /* #7 – Loading state on delete button */
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetFormState(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le cabinet</DialogTitle>
            <DialogDescription>Modifiez les informations du cabinet "{editTarget?.nom}".</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {renderFormFields()}
            <Button type="submit" className="w-full" disabled={saving || hasFormErrors}>
              {saving ? "Enregistrement..." : "Enregistrer"}
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
          {/* #10 – Warning if cabinet still has members */}
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
