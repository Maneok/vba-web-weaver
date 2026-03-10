import { useState, useMemo, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { collaborateursService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Users, Shield, Mail, UserPlus, Pencil, Trash2,
  ArrowUpDown, GraduationCap, Building2, AlertTriangle,
  FileText, ClipboardCheck, AlertCircle, X,
} from "lucide-react";
import { toast } from "sonner";
import { FONCTION_OPTIONS, COMPETENCE_LEVELS } from "@/lib/constants";

// Sub-components
import OrganigrammeLCB from "@/components/gouvernance/OrganigrammeLCB";
import InfosCabinet from "@/components/gouvernance/InfosCabinet";
import FormationsPanel from "@/components/gouvernance/FormationsPanel";
import ManuelProcedures from "@/components/gouvernance/ManuelProcedures";
import ControleInterne from "@/components/gouvernance/ControleInterne";
import DeclarationsSoupcon from "@/components/gouvernance/DeclarationsSoupcon";

// ─── Helpers ────────────────────────────────────────────────

function getFormationBadge(dateStr: string) {
  if (!dateStr) return { label: "Non renseigne", color: "bg-slate-500/15 text-slate-400" };
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return { label: "Non renseigne", color: "bg-slate-500/15 text-slate-400" };
  const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365;
  if (diffYears < 1) return { label: "A jour", color: "bg-emerald-500/15 text-emerald-400" };
  if (diffYears < 2) return { label: "A renouveler", color: "bg-amber-500/15 text-amber-400" };
  return { label: "Expiree", color: "bg-red-500/15 text-red-400" };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

type SortField = "nom" | "fonction" | "niveauCompetence" | "derniereFormation" | "statutFormation";
type SortDirection = "asc" | "desc";

const EMPTY_FORM = {
  nom: "", fonction: "COLLABORATEUR", email: "", niveau_competence: "JUNIOR",
  suppleant: "", telephone: "", derniereFormation: "", dateSignatureManuel: "",
  referentLcb: false,
};

// ─── Main Page ──────────────────────────────────────────────

export default function GouvernancePage() {
  const { collaborateurs, isLoading, isOnline, refreshAll } = useAppState();
  const [activeTab, setActiveTab] = useState("organisation");

  useDocumentTitle("Gouvernance");

  // Annuaire state
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingCollab, setEditingCollab] = useState<typeof collaborateurs[0] | null>(null);
  const [deletingCollab, setDeletingCollab] = useState<typeof collaborateurs[0] | null>(null);
  const [newCollab, setNewCollab] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Filtered & sorted collaborateurs
  const filtered = useMemo(() => {
    let result = collaborateurs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.nom.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.fonction?.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const av = (a[sortField] || "").toString().toLowerCase();
      const bv = (b[sortField] || "").toString().toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [collaborateurs, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:text-slate-300" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-blue-400" : "text-slate-600"}`} />
      </span>
    </TableHead>
  );

  // CRUD handlers
  const handleAdd = useCallback(async () => {
    if (!newCollab.nom.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (newCollab.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCollab.email)) {
      toast.error("Email invalide");
      return;
    }
    try {
      if (isOnline) {
        await collaborateursService.create({
          nom: newCollab.nom.trim(),
          fonction: newCollab.fonction,
          email: newCollab.email.trim(),
          niveau_competence: newCollab.niveau_competence,
          suppleant: newCollab.suppleant,
          telephone: newCollab.telephone,
          derniere_formation: newCollab.derniereFormation || null,
          date_signature_manuel: newCollab.dateSignatureManuel || null,
          referent_lcb: newCollab.referentLcb,
          statut_formation: newCollab.derniereFormation ? getFormationBadge(newCollab.derniereFormation).label.toUpperCase() : "JAMAIS FORME",
        });
        await refreshAll();
      }
      setNewCollab({ ...EMPTY_FORM });
      setShowAddDialog(false);
      toast.success("Collaborateur ajoute avec succes");
    } catch (err: unknown) {
      logger.error("Erreur ajout collaborateur", err);
      toast.error("Erreur lors de l'ajout du collaborateur");
    }
  }, [newCollab, isOnline, refreshAll]);

  const handleEdit = useCallback(async () => {
    if (!editingCollab?.id || !editForm.nom.trim()) return;
    try {
      if (isOnline) {
        await collaborateursService.update(editingCollab.id, {
          nom: editForm.nom.trim(),
          fonction: editForm.fonction,
          email: editForm.email.trim(),
          niveau_competence: editForm.niveau_competence,
          suppleant: editForm.suppleant,
          telephone: editForm.telephone,
          derniere_formation: editForm.derniereFormation || null,
          date_signature_manuel: editForm.dateSignatureManuel || null,
          referent_lcb: editForm.referentLcb,
          statut_formation: editForm.derniereFormation ? getFormationBadge(editForm.derniereFormation).label.toUpperCase() : "JAMAIS FORME",
        });
        await refreshAll();
      }
      setShowEditDialog(false);
      setEditingCollab(null);
      toast.success("Collaborateur modifie");
    } catch (err: unknown) {
      logger.error("Erreur modification collaborateur", err);
      toast.error("Erreur lors de la modification du collaborateur");
    }
  }, [editingCollab, editForm, isOnline, refreshAll]);

  const handleDelete = useCallback(async () => {
    if (!deletingCollab?.id) return;
    try {
      if (isOnline) {
        await collaborateursService.delete(deletingCollab.id);
        await refreshAll();
      }
      setShowDeleteDialog(false);
      setDeletingCollab(null);
      toast.success("Collaborateur supprime");
    } catch (err: unknown) {
      logger.error("Erreur suppression collaborateur", err);
      toast.error("Erreur lors de la suppression du collaborateur");
    }
  }, [deletingCollab, isOnline, refreshAll]);

  const openEdit = (collab: typeof collaborateurs[0]) => {
    setEditingCollab(collab);
    setEditForm({
      nom: collab.nom,
      fonction: collab.fonction,
      email: collab.email || "",
      niveau_competence: collab.niveauCompetence || "JUNIOR",
      suppleant: collab.suppleant || "",
      telephone: collab.telephone || "",
      derniereFormation: collab.derniereFormation || "",
      dateSignatureManuel: collab.dateSignatureManuel || "",
      referentLcb: collab.referentLcb || false,
    });
    setShowEditDialog(true);
  };

  const openDelete = (collab: typeof collaborateurs[0]) => {
    setDeletingCollab(collab);
    setShowDeleteDialog(true);
  };

  // Form field renderer
  const renderFormField = (
    label: string,
    value: string | boolean,
    onChange: (v: string) => void,
    opts?: {
      placeholder?: string;
      type?: "input" | "select" | "date" | "checkbox";
      options?: readonly { value: string; label: string }[];
    }
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      {opts?.type === "select" && opts.options ? (
        <Select value={value as string} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {opts.options.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : opts?.type === "date" ? (
        <Input type="date" value={value as string} onChange={e => onChange(e.target.value)} />
      ) : (
        <Input
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder={opts?.placeholder}
        />
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-blue-400" />
              Gouvernance LCB-FT
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Organisation, formation, procedures et controle du dispositif de conformite
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-5 h-auto">
            <TabsTrigger value="organisation" className="gap-1.5 text-xs sm:text-sm py-2">
              <Users className="w-4 h-4 hidden sm:block" />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="formations" className="gap-1.5 text-xs sm:text-sm py-2">
              <GraduationCap className="w-4 h-4 hidden sm:block" />
              Formations
            </TabsTrigger>
            <TabsTrigger value="procedures" className="gap-1.5 text-xs sm:text-sm py-2">
              <FileText className="w-4 h-4 hidden sm:block" />
              Procedures
            </TabsTrigger>
            <TabsTrigger value="controle" className="gap-1.5 text-xs sm:text-sm py-2">
              <ClipboardCheck className="w-4 h-4 hidden sm:block" />
              Controle interne
            </TabsTrigger>
            <TabsTrigger value="tracfin" className="gap-1.5 text-xs sm:text-sm py-2">
              <AlertCircle className="w-4 h-4 hidden sm:block" />
              TRACFIN
            </TabsTrigger>
          </TabsList>

          {/* ─── ONGLET 1 : Organisation ─── */}
          <TabsContent value="organisation" className="space-y-6 mt-6">
            {/* Organigramme */}
            <OrganigrammeLCB />

            {/* Infos cabinet */}
            <InfosCabinet />

            {/* Annuaire */}
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Annuaire des collaborateurs
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const toRelance = collaborateurs.filter(c =>
                        c.email && getFormationBadge(c.derniereFormation).label !== "A jour"
                      );
                      if (toRelance.length === 0) {
                        toast.info("Tous les collaborateurs sont a jour");
                        return;
                      }
                      const emails = toRelance.map(c => c.email).join(",");
                      window.open(`mailto:${emails}?subject=Rappel%20formation%20LCB-FT`);
                      toast.success(`Relance de ${toRelance.length} collaborateur(s)`);
                    }}
                  >
                    <Mail className="w-3.5 h-3.5" /> Relancer
                  </Button>
                  <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Inviter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Rechercher un collaborateur..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 max-w-sm"
                  />
                </div>

                {/* Table */}
                <div className="rounded-md border border-white/[0.06] overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="nom">Nom</SortableHeader>
                        <TableHead>Email</TableHead>
                        <SortableHeader field="fonction">Role GRIMY</SortableHeader>
                        <TableHead>Role LCB</TableHead>
                        <SortableHeader field="niveauCompetence">Statut</SortableHeader>
                        <SortableHeader field="derniereFormation">Derniere formation</SortableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            Chargement...
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            Aucun collaborateur trouve
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map(c => {
                          const badge = getFormationBadge(c.derniereFormation);
                          const compLevel = COMPETENCE_LEVELS.find(l => l.value === c.niveauCompetence);
                          const isExpired = badge.label === "Expiree" || badge.label === "A renouveler";
                          return (
                            <TableRow key={c.id || c.nom}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {c.nom}
                                  {c.referentLcb && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                                      </TooltipTrigger>
                                      <TooltipContent>Referent LCB-FT</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-400">{c.email || "---"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{c.fonction}</Badge>
                              </TableCell>
                              <TableCell>
                                {c.referentLcb ? (
                                  <Badge className="bg-blue-500/15 text-blue-400 text-xs">Referent LCB</Badge>
                                ) : c.suppleant ? (
                                  <Badge className="bg-purple-500/15 text-purple-400 text-xs">Suppleant</Badge>
                                ) : (
                                  <span className="text-xs text-slate-600">---</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {compLevel && (
                                  <Badge className={`text-xs ${compLevel.color}`}>{compLevel.label}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{formatDate(c.derniereFormation)}</span>
                                  {isExpired && (
                                    <Badge className="bg-red-500/15 text-red-400 text-[10px] gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {badge.label}
                                    </Badge>
                                  )}
                                  {badge.label === "A jour" && (
                                    <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">A jour</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Modifier</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => openDelete(c)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Desactiver</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ONGLET 2 : Formations ─── */}
          <TabsContent value="formations" className="mt-6">
            <FormationsPanel />
          </TabsContent>

          {/* ─── ONGLET 3 : Procedures ─── */}
          <TabsContent value="procedures" className="mt-6">
            <ManuelProcedures />
          </TabsContent>

          {/* ─── ONGLET 4 : Controle interne ─── */}
          <TabsContent value="controle" className="mt-6">
            <ControleInterne />
          </TabsContent>

          {/* ─── ONGLET 5 : TRACFIN ─── */}
          <TabsContent value="tracfin" className="mt-6">
            <DeclarationsSoupcon />
          </TabsContent>
        </Tabs>

        {/* ─── Dialogs ─── */}

        {/* Add collaborateur */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Ajouter un collaborateur
              </DialogTitle>
              <DialogDescription>Renseignez les informations du nouveau collaborateur</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Nom *", newCollab.nom, v => setNewCollab(p => ({ ...p, nom: v })), { placeholder: "Nom complet" })}
                {renderFormField("Email", newCollab.email, v => setNewCollab(p => ({ ...p, email: v })), { placeholder: "email@cabinet.fr" })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Fonction", newCollab.fonction, v => setNewCollab(p => ({ ...p, fonction: v })), { type: "select", options: FONCTION_OPTIONS })}
                {renderFormField("Niveau", newCollab.niveau_competence, v => setNewCollab(p => ({ ...p, niveau_competence: v })), { type: "select", options: COMPETENCE_LEVELS })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Telephone", newCollab.telephone, v => setNewCollab(p => ({ ...p, telephone: v })), { placeholder: "06..." })}
                {renderFormField("Suppleant", newCollab.suppleant, v => setNewCollab(p => ({ ...p, suppleant: v })), { placeholder: "Nom du suppleant" })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Derniere formation", newCollab.derniereFormation, v => setNewCollab(p => ({ ...p, derniereFormation: v })), { type: "date" })}
                {renderFormField("Signature manuel", newCollab.dateSignatureManuel, v => setNewCollab(p => ({ ...p, dateSignatureManuel: v })), { type: "date" })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCollab.referentLcb}
                  onChange={e => setNewCollab(p => ({ ...p, referentLcb: e.target.checked }))}
                  className="rounded"
                  id="new-referent"
                />
                <Label htmlFor="new-referent" className="text-sm">Referent LCB-FT</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
                <Button onClick={handleAdd} className="gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Ajouter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit collaborateur */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-400" />
                Modifier le collaborateur
              </DialogTitle>
              <DialogDescription>Modifiez les informations de {editingCollab?.nom}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Nom *", editForm.nom, v => setEditForm(p => ({ ...p, nom: v })))}
                {renderFormField("Email", editForm.email, v => setEditForm(p => ({ ...p, email: v })))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Fonction", editForm.fonction, v => setEditForm(p => ({ ...p, fonction: v })), { type: "select", options: FONCTION_OPTIONS })}
                {renderFormField("Niveau", editForm.niveau_competence, v => setEditForm(p => ({ ...p, niveau_competence: v })), { type: "select", options: COMPETENCE_LEVELS })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Telephone", editForm.telephone, v => setEditForm(p => ({ ...p, telephone: v })))}
                {renderFormField("Suppleant", editForm.suppleant, v => setEditForm(p => ({ ...p, suppleant: v })))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderFormField("Derniere formation", editForm.derniereFormation, v => setEditForm(p => ({ ...p, derniereFormation: v })), { type: "date" })}
                {renderFormField("Signature manuel", editForm.dateSignatureManuel, v => setEditForm(p => ({ ...p, dateSignatureManuel: v })), { type: "date" })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.referentLcb}
                  onChange={e => setEditForm(p => ({ ...p, referentLcb: e.target.checked }))}
                  className="rounded"
                  id="edit-referent"
                />
                <Label htmlFor="edit-referent" className="text-sm">Referent LCB-FT</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annuler</Button>
                <Button onClick={handleEdit} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-5 h-5" />
                Desactiver le collaborateur
              </DialogTitle>
              <DialogDescription>
                Etes-vous sur de vouloir desactiver <strong>{deletingCollab?.nom}</strong> ? Cette action est reversible.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDelete} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Desactiver
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
