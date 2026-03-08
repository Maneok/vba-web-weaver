import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { collaborateursService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Users, CheckCircle2, AlertCircle, Key, Mail, UserPlus,
  Pencil, Shield, ChevronDown, GraduationCap, Building2,
} from "lucide-react";
import { toast } from "sonner";

interface ReferentConfig {
  referent_lcb: string;
  date_derniere_formation: string;
  date_signature_manuel: string;
}

function getFormationBadge(dateStr: string) {
  if (!dateStr) return { label: "Non renseigne", color: "bg-slate-500/15 text-slate-400" };
  const diff = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (diff < 1) return { label: "A jour", color: "bg-emerald-500/15 text-emerald-400" };
  if (diff < 2) return { label: "A renouveler", color: "bg-amber-500/15 text-amber-400" };
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

const EMPTY_FORM = { nom: "", fonction: "COLLABORATEUR", email: "", niveau_competence: "JUNIOR", suppleant: "" };

export default function GouvernancePage() {
  const { collaborateurs, isLoading, isOnline, refreshAll } = useAppState();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCollab, setEditingCollab] = useState<typeof collaborateurs[0] | null>(null);
  const [newCollab, setNewCollab] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [referentConfig, setReferentConfig] = useState<ReferentConfig | null>(null);

  // Load referent config from parametres
  useEffect(() => {
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from("parametres")
          .select("value")
          .eq("key", "lcbft_config")
          .maybeSingle();
        if (data?.value) {
          const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          setReferentConfig(val as ReferentConfig);
        }
      } catch (err) {
        console.error("[Gouvernance] Failed to load config:", err);
      }
    }
    loadConfig();
  }, []);

  // Add collaborateur
  const handleAddCollab = useCallback(async () => {
    if (!newCollab.nom) return;
    if (isOnline) {
      await collaborateursService.create({
        nom: newCollab.nom,
        fonction: newCollab.fonction,
        email: newCollab.email,
        referent_lcb: false,
        suppleant: newCollab.suppleant,
        niveau_competence: newCollab.niveau_competence,
        date_signature_manuel: "",
        derniere_formation: "",
        statut_formation: "A FORMER",
      });
      await refreshAll();
    }
    setShowAddDialog(false);
    setNewCollab({ ...EMPTY_FORM });
    toast.success("Collaborateur ajoute");
  }, [newCollab, isOnline, refreshAll]);

  // Edit collaborateur
  const handleOpenEdit = (collab: typeof collaborateurs[0]) => {
    setEditingCollab(collab);
    setEditForm({
      nom: collab.nom,
      fonction: collab.fonction,
      email: collab.email,
      niveau_competence: collab.niveauCompetence || "JUNIOR",
      suppleant: collab.suppleant || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingCollab?.id || !editForm.nom) return;
    if (isOnline) {
      await collaborateursService.update(editingCollab.id, {
        nom: editForm.nom,
        fonction: editForm.fonction,
        email: editForm.email,
        niveau_competence: editForm.niveau_competence,
        suppleant: editForm.suppleant,
      });
      await refreshAll();
    }
    setShowEditDialog(false);
    setEditingCollab(null);
    toast.success("Collaborateur mis a jour");
  }, [editingCollab, editForm, isOnline, refreshAll]);

  // Stats
  const formesOk = collaborateurs.filter(c => c.statutFormation.includes("A JOUR")).length;
  const formesKo = collaborateurs.filter(c => c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")).length;

  const filtered = useMemo(() => {
    if (!search) return collaborateurs;
    return collaborateurs.filter(c =>
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.fonction.toLowerCase().includes(search.toLowerCase())
    );
  }, [collaborateurs, search]);

  // Referent badge
  const referentBadge = referentConfig ? getFormationBadge(referentConfig.date_derniere_formation) : null;

  // Organigramme data
  const referent = collaborateurs.find(c => c.referentLcb);
  const suppleants = collaborateurs.filter(c => c.suppleant && !c.referentLcb);
  const others = collaborateurs.filter(c => !c.referentLcb && !c.suppleant);

  // Relance email
  const handleRelance = (collab: typeof collaborateurs[0]) => {
    if (!collab.email) {
      toast.error(`Email manquant pour ${collab.nom}`);
      return;
    }
    const subject = encodeURIComponent(`Relance formation LCB-FT — ${collab.nom}`);
    const body = encodeURIComponent(
      `Bonjour ${collab.nom},\n\nVotre formation LCB-FT est expiree (derniere formation : ${collab.derniereFormation || "aucune"}).\n\nConformement aux obligations reglementaires (art. L.561-36 CMF), nous vous invitons a regulariser votre situation dans les meilleurs delais.\n\nCordialement,\nLe Referent LCB-FT`
    );
    window.open(`mailto:${collab.email}?subject=${subject}&body=${body}`, "_self");
    toast.success(`Email de relance ouvert pour ${collab.nom}`);
  };

  // Form field renderer
  const renderFormField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { placeholder?: string; type?: "input" | "select"; options?: { value: string; label: string }[] }
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      {opts?.type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.options?.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="bg-white/[0.03] border-white/[0.06] text-slate-200 placeholder:text-slate-600"
          placeholder={opts?.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );

  const fonctionOptions = [
    { value: "ASSOCIE SIGNATAIRE", label: "Associe signataire" },
    { value: "SUPERVISEUR", label: "Superviseur" },
    { value: "COLLABORATEUR", label: "Collaborateur" },
    { value: "STAGIAIRE", label: "Stagiaire" },
    { value: "ALTERNANT", label: "Alternant" },
  ];

  const niveauOptions = [
    { value: "JUNIOR", label: "Junior" },
    { value: "CONFIRME", label: "Confirme" },
    { value: "SENIOR", label: "Senior" },
    { value: "EXPERT", label: "Expert" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Gouvernance LCB-FT</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi de l'equipe et des formations obligatoires</p>
        </div>
        <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="w-4 h-4" /> Ajouter collaborateur
        </Button>
      </div>

      {/* Referent LCB-FT Card */}
      {referentConfig && (
        <div className="glass-card p-6 animate-fade-in-up border border-blue-500/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center border border-blue-500/20">
                <Shield className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-blue-400/70 font-semibold mb-1">Referent LCB-FT designe</p>
                <p className="text-xl font-bold text-white">{referentConfig.referent_lcb}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-slate-400">
                    Signature manuel : <span className="text-slate-300 font-mono">{formatDate(referentConfig.date_signature_manuel)}</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    Derniere formation : <span className="text-slate-300 font-mono">{formatDate(referentConfig.date_derniere_formation)}</span>
                  </span>
                </div>
              </div>
            </div>
            {referentBadge && (
              <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${referentBadge.color}`}>
                <GraduationCap className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                {referentBadge.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up-delay-1">
        <div className="glass-card p-5 kpi-glow-blue">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{collaborateurs.length}</p>
          <p className="text-[12px] text-slate-500 mt-1">Collaborateurs</p>
        </div>
        <div className="glass-card p-5 kpi-glow-green">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formesOk}</p>
          <p className="text-[12px] text-slate-500 mt-1">Formations a jour</p>
        </div>
        <div className="glass-card p-5 kpi-glow-red">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-400">{formesKo}</p>
          <p className="text-[12px] text-slate-500 mt-1">A former / relancer</p>
        </div>
      </div>

      {/* Search */}
      <div className="animate-fade-in-up-delay-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher un collaborateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Collaborateur</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Fonction</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Ref. LCB</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Suppleant</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Niveau</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Derniere Formation</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Statut</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-slate-500 py-12">
                    {isLoading ? "Chargement..." : "Aucun collaborateur"}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c, i) => (
                <TableRow key={c.id || i} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0">
                        {c.nom.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-medium text-sm text-slate-200">{c.nom}</span>
                        {c.email && <p className="text-[11px] text-slate-500">{c.email}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{c.fonction}</TableCell>
                  <TableCell className="text-center">
                    {c.referentLcb && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        <Key className="w-3 h-3" /> REF
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{c.suppleant || "---"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                      c.niveauCompetence === "EXPERT" ? "bg-purple-500/15 text-purple-400"
                      : c.niveauCompetence === "SENIOR" ? "bg-blue-500/15 text-blue-400"
                      : c.niveauCompetence === "CONFIRME" ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-500/15 text-slate-400"
                    }`}>
                      {c.niveauCompetence || "---"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{c.derniereFormation ? formatDate(c.derniereFormation) : "---"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                      c.statutFormation.includes("A JOUR")
                        ? "bg-emerald-500/15 text-emerald-400"
                        : c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {c.statutFormation}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-white/[0.06] text-slate-400 hover:text-blue-400"
                        onClick={() => handleOpenEdit(c)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {(c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs hover:bg-blue-500/10 hover:text-blue-400 text-slate-400"
                          onClick={() => handleRelance(c)}
                        >
                          <Mail className="w-3 h-3" /> Relancer
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Organigramme LCB-FT */}
      <div className="animate-fade-in-up-delay-3">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Organigramme LCB-FT
        </h2>
        <div className="glass-card p-8">
          <div className="flex flex-col items-center gap-0">
            {/* Referent */}
            <div className="flex flex-col items-center">
              <div className="px-6 py-3 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/30 text-center min-w-[200px]">
                <p className="text-[10px] uppercase tracking-wider text-blue-400/70 font-semibold">Referent LCB-FT</p>
                <p className="text-sm font-bold text-white mt-1">
                  {referent?.nom || referentConfig?.referent_lcb || "Non designe"}
                </p>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <ChevronDown className="w-4 h-4 text-white/20 -mt-1 -mb-1" />
            </div>

            {/* Suppleants */}
            {suppleants.length > 0 && (
              <>
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {suppleants.map((s, i) => (
                    <div key={i} className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center min-w-[180px]">
                      <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold">Suppleant</p>
                      <p className="text-sm font-medium text-white mt-1">{s.nom}</p>
                    </div>
                  ))}
                </div>
                <div className="w-px h-6 bg-white/10" />
                <ChevronDown className="w-4 h-4 text-white/20 -mt-1 -mb-1" />
              </>
            )}

            {/* Collaborateurs */}
            {others.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {others.map((o, i) => (
                  <div key={i} className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center min-w-[150px]">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{o.fonction}</p>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">{o.nom}</p>
                  </div>
                ))}
              </div>
            )}

            {collaborateurs.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">Aucun collaborateur enregistre</p>
            )}
          </div>
        </div>
      </div>

      {/* Add collaborator dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Ajouter un collaborateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {renderFormField("Nom", newCollab.nom, v => setNewCollab(p => ({ ...p, nom: v })), { placeholder: "NOM Prenom" })}
            {renderFormField("Email", newCollab.email, v => setNewCollab(p => ({ ...p, email: v })), { placeholder: "email@cabinet.fr" })}
            {renderFormField("Fonction", newCollab.fonction, v => setNewCollab(p => ({ ...p, fonction: v })), {
              type: "select", options: fonctionOptions,
            })}
            {renderFormField("Niveau de competence", newCollab.niveau_competence, v => setNewCollab(p => ({ ...p, niveau_competence: v })), {
              type: "select", options: niveauOptions,
            })}
            {renderFormField("Suppleant de", newCollab.suppleant, v => setNewCollab(p => ({ ...p, suppleant: v })), { placeholder: "Nom du referent (laisser vide si non applicable)" })}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2" onClick={handleAddCollab} disabled={!newCollab.nom}>
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit collaborator dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-400" />
              Modifier le collaborateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {renderFormField("Nom", editForm.nom, v => setEditForm(p => ({ ...p, nom: v })), { placeholder: "NOM Prenom" })}
            {renderFormField("Email", editForm.email, v => setEditForm(p => ({ ...p, email: v })), { placeholder: "email@cabinet.fr" })}
            {renderFormField("Fonction", editForm.fonction, v => setEditForm(p => ({ ...p, fonction: v })), {
              type: "select", options: fonctionOptions,
            })}
            {renderFormField("Niveau de competence", editForm.niveau_competence, v => setEditForm(p => ({ ...p, niveau_competence: v })), {
              type: "select", options: niveauOptions,
            })}
            {renderFormField("Suppleant de", editForm.suppleant, v => setEditForm(p => ({ ...p, suppleant: v })), { placeholder: "Nom du referent (laisser vide si non applicable)" })}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2" onClick={handleSaveEdit} disabled={!editForm.nom}>
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
