import { useState, useEffect, useCallback } from "react";
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
import { Building2, Plus, MapPin, Users, Crown, Pencil, Trash2, Palette } from "lucide-react";

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

function validateSiret(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  return digits === "" || SIRET_REGEX.test(digits);
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

  const loadCabinets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinets")
        .select("*")
        .order("is_principal", { ascending: false });
      if (error) throw error;

      // Count members per cabinet
      const { data: membres } = await supabase
        .from("cabinet_membres")
        .select("cabinet_id");

      const counts: Record<string, number> = {};
      membres?.forEach((m: { cabinet_id: string }) => {
        counts[m.cabinet_id] = (counts[m.cabinet_id] || 0) + 1;
      });

      const list = (data || []).map((c) => ({
        ...c,
        couleur_primaire: c.couleur_primaire || "#3b82f6",
        membre_count: counts[c.id] || 0,
      })) as Cabinet[];

      // Auto-create a default principal cabinet if none exist
      if (list.length === 0 && profile) {
        try {
          const { data: newCab, error: insertErr } = await supabase
            .from("cabinets")
            .insert({ nom: "Cabinet Principal", is_principal: true, couleur_primaire: "#3b82f6" })
            .select()
            .single();
          if (insertErr) throw insertErr;
          if (newCab) {
            await supabase.from("cabinet_membres").insert({
              cabinet_id: newCab.id,
              user_id: profile.id,
              role: "ADMIN",
            });
            await logAudit({ action: "CREATION_CABINET", table_name: "cabinets", record_id: newCab.id, new_data: { nom: "Cabinet Principal" } });
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
    const digits = value.replace(/\s/g, "");
    if (digits && !SIRET_REGEX.test(digits)) {
      setSiretError("Le SIRET doit contenir exactement 14 chiffres");
    } else {
      setSiretError("");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    if (!validateSiret(form.siret)) { setSiretError("Le SIRET doit contenir exactement 14 chiffres"); return; }
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
      setForm(EMPTY_FORM);
      setSiretError("");
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
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !form.nom.trim()) return;
    if (!validateSiret(form.siret)) { setSiretError("Le SIRET doit contenir exactement 14 chiffres"); return; }
    setSaving(true);
    try {
      const siretClean = form.siret.replace(/\s/g, "") || null;
      const { error } = await supabase
        .from("cabinets")
        .update({
          nom: form.nom,
          ville: form.ville || null,
          siret: siretClean,
          couleur_primaire: form.couleur_primaire,
          numero_oec: form.numero_oec || null,
          email: form.email || null,
          telephone: form.telephone || null,
        })
        .eq("id", editTarget.id);
      if (error) throw error;

      await logAudit({ action: "MODIFICATION_CABINET", table_name: "cabinets", record_id: editTarget.id, new_data: { nom: form.nom } });
      toast.success("Cabinet modifie");
      setEditTarget(null);
      setForm(EMPTY_FORM);
      setSiretError("");
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur modification cabinet", err);
      toast.error("Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("cabinets").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({ action: "SUPPRESSION_CABINET", table_name: "cabinets", record_id: deleteTarget.id, old_data: { nom: deleteTarget.nom } });
      toast.success("Cabinet supprime");
      setDeleteTarget(null);
      await loadCabinets();
    } catch (err) {
      logger.error("CabinetsList", "Erreur suppression cabinet", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setSaving(false);
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
          <Input id="cab-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@cabinet.fr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cab-tel">Telephone</Label>
          <Input id="cab-tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="01 23 45 67 89" />
        </div>
      </div>
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
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setForm(EMPTY_FORM); setSiretError(""); } }}>
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
              <Button type="submit" className="w-full" disabled={saving || !!siretError}>
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
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(c)} aria-label={`Modifier le cabinet ${c.nom}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!c.is_principal && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(c)} aria-label={`Supprimer le cabinet ${c.nom}`}>
                          <Trash2 className="h-4 w-4" />
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
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setForm(EMPTY_FORM); setSiretError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le cabinet</DialogTitle>
            <DialogDescription>Modifiez les informations du cabinet "{editTarget?.nom}".</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {renderFormFields()}
            <Button type="submit" className="w-full" disabled={saving || !!siretError}>
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
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
