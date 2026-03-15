import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  UserPlus, Search, Download, ChevronUp, ChevronDown,
  UserX, UserCheck, MailPlus, Trash2, MoreHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type CabinetRole = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "CONTROLEUR" | "SECRETAIRE" | "STAGIAIRE";

const ROLE_COLORS: Record<CabinetRole, string> = {
  ADMIN: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  SUPERVISEUR: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  COLLABORATEUR: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CONTROLEUR: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  SECRETAIRE: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  STAGIAIRE: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const ROLE_LABELS: Record<CabinetRole, string> = {
  ADMIN: "Administrateur",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collaborateur",
  CONTROLEUR: "Controleur",
  SECRETAIRE: "Secretaire",
  STAGIAIRE: "Stagiaire",
};

const ROLE_DESCRIPTIONS: Record<CabinetRole, string> = {
  ADMIN: "Acces total : lecture, ecriture, suppression, gestion",
  SUPERVISEUR: "Lecture, ecriture, affectation, export",
  COLLABORATEUR: "Lecture et travail sur dossiers assignes",
  CONTROLEUR: "Lecture et controle qualite",
  SECRETAIRE: "Lecture et affectation des dossiers",
  STAGIAIRE: "Consultation uniquement",
};

const AVATAR_COLORS = [
  "bg-blue-500/30 text-blue-300",
  "bg-emerald-500/30 text-emerald-300",
  "bg-purple-500/30 text-purple-300",
  "bg-amber-500/30 text-amber-300",
  "bg-pink-500/30 text-pink-300",
  "bg-cyan-500/30 text-cyan-300",
];

interface Membre {
  id: string;
  cabinet_id: string;
  user_id: string;
  role: CabinetRole;
  is_active: boolean;
  date_ajout: string;
  // joined from profiles
  email?: string;
  full_name?: string;
  updated_at?: string;
}

interface CabinetOption {
  id: string;
  nom: string;
}

const PAGE_SIZE = 15;

export default function CollaborateursList() {
  const { profile } = useAuth();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [cabinets, setCabinets] = useState<CabinetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", nom: "", role: "COLLABORATEUR" as CabinetRole, cabinet_id: "" });
  const [inviting, setInviting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Membre | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current); }; }, []);

  const loadData = useCallback(async () => {
    try {
      // Load cabinets
      const { data: cabData } = await supabase.from("cabinets").select("id, nom").order("is_principal", { ascending: false });
      setCabinets(cabData || []);

      // Load members
      const { data: memData, error } = await supabase
        .from("cabinet_membres")
        .select("*")
        .order("date_ajout", { ascending: true });
      if (error) throw error;

      // Load profiles for email/name
      const userIds = (memData || []).map((m: Membre) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, updated_at")
        .in("id", userIds);

      const profileMap: Record<string, { email: string; full_name: string; updated_at: string }> = {};
      profiles?.forEach((p) => { profileMap[p.id] = p; });

      setMembres(
        (memData || []).map((m: Membre) => ({
          ...m,
          email: profileMap[m.user_id]?.email || "",
          full_name: profileMap[m.user_id]?.full_name || "",
          updated_at: profileMap[m.user_id]?.updated_at || "",
        }))
      );
    } catch {
      toast.error("Erreur lors du chargement des collaborateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtering + sorting
  const filtered = useMemo(() => {
    let list = [...membres];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
    }
    if (filterRole !== "all") list = list.filter((m) => m.role === filterRole);
    if (filterStatus === "active") list = list.filter((m) => m.is_active);
    if (filterStatus === "inactive") list = list.filter((m) => !m.is_active);

    list.sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] as string || "";
      const vb = (b as Record<string, unknown>)[sortCol] as string || "";
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [membres, search, filterRole, filterStatus, sortCol, sortDir]);

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    membres.forEach((m) => { counts[m.role] = (counts[m.role] || 0) + 1; });
    return counts;
  }, [membres]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name.slice(0, 2)).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const isOnline = (updatedAt?: string) => {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.email.trim())) {
      toast.error("Adresse email invalide");
      return;
    }
    setInviting(true);
    try {
      const targetCabinet = inviteForm.cabinet_id || cabinets[0]?.id || profile.cabinet_id;
      const { error } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: crypto.randomUUID() + "Aa1!",
        options: {
          data: {
            full_name: inviteForm.nom,
            cabinet_id: targetCabinet,
            role: inviteForm.role,
          },
          emailRedirectTo: `${window.location.origin}/auth?invited=true`,
        },
      });
      if (error) throw error;

      await logAudit({
        action: "INVITATION_UTILISATEUR",
        table_name: "cabinet_membres",
        new_data: { email: inviteForm.email, role: inviteForm.role },
      });

      toast.success(`Invitation envoyee a ${inviteForm.email}`);
      setInviteOpen(false);
      setInviteForm({ email: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
      inviteTimerRef.current = setTimeout(() => loadData(), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'invitation");
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (membre: Membre, newRole: CabinetRole) => {
    const { error } = await supabase
      .from("cabinet_membres")
      .update({ role: newRole })
      .eq("id", membre.id);
    if (error) { toast.error("Erreur lors du changement de role"); return; }
    await logAudit({ action: "CHANGEMENT_ROLE", table_name: "cabinet_membres", record_id: membre.id, old_data: { role: membre.role }, new_data: { role: newRole } });
    toast.success("Role mis a jour");
    await loadData();
  };

  const toggleActive = async (membre: Membre) => {
    const newStatus = !membre.is_active;
    const { error } = await supabase
      .from("cabinet_membres")
      .update({ is_active: newStatus })
      .eq("id", membre.id);
    if (error) { toast.error("Erreur"); return; }
    await logAudit({ action: newStatus ? "ACTIVATION_MEMBRE" : "DESACTIVATION_MEMBRE", table_name: "cabinet_membres", record_id: membre.id });
    toast.success(newStatus ? "Collaborateur active" : "Collaborateur desactive");
    await loadData();
  };

  const deleteMembre = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("cabinet_membres").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    await logAudit({ action: "SUPPRESSION_MEMBRE", table_name: "cabinet_membres", record_id: deleteTarget.id });
    toast.success("Collaborateur supprime");
    setDeleteTarget(null);
    await loadData();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((m) => m.id)));
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkAction === "deactivate") {
      await supabase.from("cabinet_membres").update({ is_active: false }).in("id", ids);
      toast.success(`${ids.length} collaborateur(s) desactive(s)`);
    } else if (bulkAction === "activate") {
      await supabase.from("cabinet_membres").update({ is_active: true }).in("id", ids);
      toast.success(`${ids.length} collaborateur(s) active(s)`);
    } else if (Object.keys(ROLE_LABELS).includes(bulkAction)) {
      await supabase.from("cabinet_membres").update({ role: bulkAction }).in("id", ids);
      toast.success(`Role mis a jour pour ${ids.length} collaborateur(s)`);
    }
    setSelected(new Set());
    setBulkAction("");
    await loadData();
  };

  const exportCSV = () => {
    const header = "Nom,Email,Role,Statut,Cabinet,Date ajout\n";
    const rows = filtered.map((m) => {
      const cab = cabinets.find((c) => c.id === m.cabinet_id);
      return `"${m.full_name}","${m.email}","${m.role}","${m.is_active ? "Actif" : "Inactif"}","${cab?.nom || ""}","${new Date(m.date_ajout).toLocaleDateString("fr-FR")}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collaborateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Collaborateurs</h2>
          <p className="text-sm text-slate-400">
            {membres.length} membre{membres.length > 1 ? "s" : ""} ·{" "}
            {Object.entries(roleCounts).map(([role, count]) => (
              <span key={role} className="mr-2">{count} {role.toLowerCase()}{count > 1 ? "s" : ""}</span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 border-white/10 text-slate-300 hover:bg-white/[0.04]">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" /> Ajouter un collaborateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un collaborateur</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input value={inviteForm.nom} onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })} placeholder="Jean Dupont" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="jean@cabinet.fr" required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as CabinetRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
                        <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {cabinets.length > 1 && (
                  <div className="space-y-2">
                    <Label>Cabinet</Label>
                    <Select value={inviteForm.cabinet_id || cabinets[0]?.id} onValueChange={(v) => setInviteForm({ ...inviteForm, cabinet_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cabinets.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={inviting}>
                  {inviting ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Rechercher par nom ou email..."
            className="pl-9 bg-white/[0.03] border-white/[0.08]"
          />
        </div>
        <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/[0.08]">
            <SelectValue placeholder="Tous les roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les roles</SelectItem>
            {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
              <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] bg-white/[0.03] border-white/[0.08]">
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-slate-400">{selected.size} selectionne(s)</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.08]">
                <SelectValue placeholder="Action en masse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activate">Activer</SelectItem>
                <SelectItem value="deactivate">Desactiver</SelectItem>
                {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
                  <SelectItem key={role} value={role}>Role → {ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkAction} disabled={!bulkAction}>Appliquer</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] bg-white/[0.02]">
              <TableHead className="w-10">
                <Checkbox
                  checked={paginated.length > 0 && selected.size === paginated.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                Collaborateur <SortIcon col="full_name" />
              </TableHead>
              <TableHead className="text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("role")}>
                Role <SortIcon col="role" />
              </TableHead>
              <TableHead className="text-slate-400">Cabinet</TableHead>
              <TableHead className="text-slate-400">Statut</TableHead>
              <TableHead className="text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("date_ajout")}>
                Date ajout <SortIcon col="date_ajout" />
              </TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  Aucun collaborateur trouve.
                </TableCell>
              </TableRow>
            )}
            {paginated.map((m) => {
              const cab = cabinets.find((c) => c.id === m.cabinet_id);
              const online = isOnline(m.updated_at);
              const isSelf = m.user_id === profile?.id;
              return (
                <TableRow key={m.id} className={`border-white/[0.06] hover:bg-white/[0.02] ${!m.is_active ? "opacity-50" : ""}`}>
                  <TableCell>
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(m.full_name || m.email || "")}`}>
                          {getInitials(m.full_name || m.email || "?")}
                        </div>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 text-sm">{m.full_name || "—"}</p>
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isSelf ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>{ROLE_DESCRIPTIONS[m.role]}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => updateRole(m, v as CabinetRole)}>
                        <SelectTrigger className="w-[160px] h-8 bg-transparent border-white/[0.08]">
                          <Badge className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
                            <SelectItem key={role} value={role}>
                              <div>
                                <p>{ROLE_LABELS[role]}</p>
                                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">{cab?.nom || "—"}</TableCell>
                  <TableCell>
                    {m.is_active ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Actif</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {new Date(m.date_ajout).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleActive(m)}>
                            {m.is_active ? (
                              <><UserX className="h-4 w-4 mr-2" /> Desactiver</>
                            ) : (
                              <><UserCheck className="h-4 w-4 mr-2" /> Activer</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(m.email || "");
                            toast.success("Email copie");
                          }}>
                            <MailPlus className="h-4 w-4 mr-2" /> Copier email
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{filtered.length} resultat{filtered.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le collaborateur</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> ? Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={deleteMembre}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
