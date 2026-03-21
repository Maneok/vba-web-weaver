import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { useDebounce } from "@/hooks/useDebounce";
import { useAppState } from "@/lib/AppContext";
import { COMPETENCE_LEVELS } from "@/lib/constants";
import { formatDateFr } from "@/lib/dateUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  UserPlus, Search, Download, ChevronUp, ChevronDown,
  UserX, UserCheck, MailPlus, Trash2, MoreHorizontal, ChevronLeft, ChevronRight,
  Users, UserMinus, User, Mail, Info, Loader2, Shield, Copy, CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CabinetRole = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "CONTROLEUR" | "SECRETAIRE" | "STAGIAIRE";

const ROLE_COLORS: Record<CabinetRole, string> = {
  ADMIN: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  SUPERVISEUR: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  COLLABORATEUR: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CONTROLEUR: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  SECRETAIRE: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  STAGIAIRE: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30",
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

type CompetenceValue = "JUNIOR" | "CONFIRME" | "SENIOR" | "EXPERT";

interface Membre {
  id: string;
  cabinet_id: string;
  user_id: string;
  role: CabinetRole;
  is_active: boolean;
  date_ajout: string;
  email?: string;
  full_name?: string;
  updated_at?: string;
  // Joined from collaborateurs
  competence?: CompetenceValue;
  derniere_formation?: string | null;
}

interface CabinetOption {
  id: string;
  nom: string;
}

// Map cabinet roles to collaborateurs.fonction values
const ROLE_TO_FONCTION: Record<CabinetRole, string> = {
  ADMIN: "ASSOCIE SIGNATAIRE",
  SUPERVISEUR: "SUPERVISEUR",
  COLLABORATEUR: "COLLABORATEUR",
  CONTROLEUR: "SUPERVISEUR",
  SECRETAIRE: "SECRETAIRE",
  STAGIAIRE: "STAGIAIRE",
};

const PAGE_SIZE = 15;

function getFormationBadge(date: string | null | undefined): { label: string; className: string } {
  if (!date) return { label: "Non renseignee", className: "bg-slate-500/20 text-slate-400 dark:text-slate-500 dark:text-slate-400 border-slate-500/30" };
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 365) return { label: "A jour", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
  if (diffDays <= 730) return { label: "A renouveler", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  return { label: "Expiree", className: "bg-red-500/20 text-red-300 border-red-500/30" };
}

function escapeCSVField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

function SkeletonRows() {
  return (
    <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function CollaborateursList() {
  const { profile } = useAuth();
  const { refreshAll } = useAppState();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [cabinets, setCabinets] = useState<CabinetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", nom: "", role: "COLLABORATEUR" as CabinetRole, cabinet_id: "" });
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Membre | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Helper to track timeouts for cleanup
  const trackedTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutRefs.current.delete(id);
      fn();
    }, ms);
    timeoutRefs.current.add(id);
    return id;
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
      timeoutRefs.current.forEach((id) => clearTimeout(id));
      timeoutRefs.current.clear();
    };
  }, []);

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

      // Load collaborateurs data for competence + formation
      const emails = profiles?.map((p) => p.email).filter(Boolean) || [];
      const collabMap: Record<string, { niveau_competence?: string; derniere_formation?: string }> = {};
      if (emails.length > 0) {
        const { data: collabs } = await supabase
          .from("collaborateurs")
          .select("email, niveau_competence, derniere_formation")
          .in("email", emails);
        collabs?.forEach((c) => {
          if (c.email) collabMap[c.email] = c;
        });
      }

      setMembres(
        (memData || []).map((m: Membre) => {
          const prof = profileMap[m.user_id];
          const collab = prof?.email ? collabMap[prof.email] : undefined;
          return {
            ...m,
            email: prof?.email || "",
            full_name: prof?.full_name || "",
            updated_at: prof?.updated_at || "",
            competence: (collab?.niveau_competence as CompetenceValue) || undefined,
            derniere_formation: collab?.derniere_formation || null,
          };
        })
      );
    } catch (err) {
      logger.error("CollaborateursList", "Erreur chargement", err);
      toast.error("Erreur lors du chargement des collaborateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  // Filtering + sorting
  const filtered = useMemo(() => {
    let list = [...membres];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
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
  }, [membres, debouncedSearch, filterRole, filterStatus, sortCol, sortDir]);

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const activeCount = useMemo(() => membres.filter((m) => m.is_active).length, [membres]);
  const inactiveCount = useMemo(() => membres.filter((m) => !m.is_active).length, [membres]);

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
    const trimmedEmail = inviteForm.email.trim().toLowerCase();
    const trimmedName = inviteForm.nom.trim();
    if (!emailRegex.test(trimmedEmail)) {
      toast.error("Adresse email invalide");
      return;
    }
    // #6: Name validation - min 2 chars, max 100 chars
    if (trimmedName.length < 2) {
      toast.error("Le nom doit contenir au moins 2 caracteres");
      return;
    }
    if (trimmedName.length > 100) {
      toast.error("Le nom ne doit pas depasser 100 caracteres");
      return;
    }
    // #7: Prevent inviting yourself
    if (profile.email && trimmedEmail === profile.email.toLowerCase()) {
      toast.error("Vous ne pouvez pas vous inviter vous-meme");
      return;
    }
    // #8: Prevent duplicate invites
    const existingMembre = membres.find((m) => m.email?.toLowerCase() === trimmedEmail);
    if (existingMembre) {
      toast.error("Ce collaborateur est deja membre du cabinet");
      return;
    }
    setInviting(true);
    try {
      const targetCabinet = inviteForm.cabinet_id || cabinets[0]?.id || profile.cabinet_id;

      // Map the cabinet role to the 4 auth-compatible roles for the RPC
      // CONTROLEUR and SECRETAIRE are mapped to COLLABORATEUR for auth purposes
      const authRole = ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"].includes(inviteForm.role)
        ? inviteForm.role
        : "COLLABORATEUR";

      const { data: rpcData, error: rpcError } = await supabase.rpc('invite_collaborator', {
        p_email: trimmedEmail,
        p_full_name: trimmedName,
        p_role: authRole,
      });

      if (rpcError) {
        console.error('[INVITE] RPC error:', rpcError);
        throw new Error(rpcError.message || "Erreur lors de l'invitation");
      }

      if (rpcData && !rpcData.success) {
        throw new Error(rpcData.error || "Erreur lors de l'invitation");
      }

      const resData = rpcData as { success?: boolean; error?: string; message?: string; invite_url?: string; token?: string } | null;

      // Sync: also create a record in the collaborateurs table
      // so this person appears in Gouvernance > Organisation
      const fonction = ROLE_TO_FONCTION[inviteForm.role] || "COLLABORATEUR";
      // Check if collaborateur already exists with this email
      const { data: existingCollab } = await supabase
        .from("collaborateurs")
        .select("id")
        .eq("email", trimmedEmail)
        .eq("cabinet_id", targetCabinet)
        .maybeSingle();

      if (!existingCollab) {
        const { error: collabError } = await supabase
          .from("collaborateurs")
          .insert({
            nom: trimmedName,
            email: trimmedEmail,
            fonction,
            niveau_competence: "JUNIOR",
            referent_lcb: false,
            suppleant: "",
            statut_formation: "JAMAIS FORME",
            cabinet_id: targetCabinet,
          });
        if (collabError) {
          logger.warn("CollaborateursList", "Sync collaborateurs failed", collabError);
        }
      }

      // Store invite URL to display in the dialog
      if (resData?.invite_url) {
        setLastInviteUrl(resData.invite_url);
        toast.success(`Invitation creee pour ${trimmedEmail}`);
      } else {
        toast.success(resData?.message || `Invitation envoyee a ${trimmedEmail}`);
        setInviteOpen(false);
        setInviteForm({ email: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
      }
      // #1: Clear inviteTimerRef before setting a new one
      if (inviteTimerRef.current) {
        clearTimeout(inviteTimerRef.current);
        inviteTimerRef.current = null;
      }
      // Refresh both cabinet members and AppContext collaborateurs
      inviteTimerRef.current = setTimeout(async () => {
        inviteTimerRef.current = null;
        await loadData();
        await refreshAll();
      }, 3000);
    } catch (err: unknown) {
      logger.error("CollaborateursList", "Erreur invitation", err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'invitation");
    } finally {
      setInviting(false);
    }
  };

  // #11: Optimistic update for role change + #3: sync to collaborateurs table
  const updateRole = async (membre: Membre, newRole: CabinetRole) => {
    if (membre.user_id === profile?.id) {
      toast.error("Vous ne pouvez pas modifier votre propre role");
      return;
    }
    const previousRole = membre.role;
    // Optimistic update
    setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, role: newRole } : m));

    const { error } = await supabase
      .from("cabinet_membres")
      .update({ role: newRole })
      .eq("id", membre.id);
    if (error) {
      // Rollback on error
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, role: previousRole } : m));
      toast.error("Erreur lors du changement de role");
      return;
    }

    // #3: Sync role change to collaborateurs table
    if (membre.email) {
      const newFonction = ROLE_TO_FONCTION[newRole] || "COLLABORATEUR";
      const { error: collabError } = await supabase
        .from("collaborateurs")
        .update({ fonction: newFonction })
        .eq("email", membre.email)
        .eq("cabinet_id", membre.cabinet_id);
      if (collabError) {
        logger.warn("CollaborateursList", "Sync collaborateurs fonction failed", collabError);
      }
    }

    await logAudit({ action: "CHANGEMENT_ROLE", table_name: "cabinet_membres", record_id: membre.id, old_data: { role: previousRole }, new_data: { role: newRole } });
    toast.success("Role mis a jour");
  };

  // #10: Optimistic update for toggleActive + #4: sync to collaborateurs table
  const toggleActive = async (membre: Membre) => {
    const newStatus = !membre.is_active;
    const previousStatus = membre.is_active;
    // Optimistic update
    setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, is_active: newStatus } : m));

    const { error } = await supabase
      .from("cabinet_membres")
      .update({ is_active: newStatus })
      .eq("id", membre.id);
    if (error) {
      // Rollback on error
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, is_active: previousStatus } : m));
      toast.error("Erreur");
      return;
    }

    // #4: Sync active status to collaborateurs table
    if (membre.email) {
      const newStatut = newStatus ? "ACTIF" : "INACTIF";
      const { error: collabError } = await supabase
        .from("collaborateurs")
        .update({ statut_formation: newStatut })
        .eq("email", membre.email)
        .eq("cabinet_id", membre.cabinet_id);
      if (collabError) {
        logger.warn("CollaborateursList", "Sync collaborateurs active status failed", collabError);
      }
    }

    await logAudit({ action: newStatus ? "ACTIVATION_MEMBRE" : "DESACTIVATION_MEMBRE", table_name: "cabinet_membres", record_id: membre.id });
    toast.success(newStatus ? "Collaborateur active" : "Collaborateur desactive");
  };

  // #5: Delete membre also deletes corresponding collaborateurs record
  const deleteMembre = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("cabinet_membres").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }

    // Also delete the corresponding collaborateurs record
    if (deleteTarget.email) {
      const { error: collabError } = await supabase
        .from("collaborateurs")
        .delete()
        .eq("email", deleteTarget.email)
        .eq("cabinet_id", deleteTarget.cabinet_id);
      if (collabError) {
        logger.warn("CollaborateursList", "Sync delete collaborateurs failed", collabError);
      }
    }

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

  // #12: Bulk action now goes through confirmation dialog
  const requestBulkAction = () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkConfirmOpen(true);
  };

  const executeBulkAction = async () => {
    setBulkConfirmOpen(false);
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkAction === "deactivate") {
      const { error } = await supabase.from("cabinet_membres").update({ is_active: false }).in("id", ids);
      if (error) {
        toast.error("Erreur lors de l'operation groupee");
        logger.error("CollaborateursList", "Bulk deactivate error", error);
        return;
      }
      toast.success(`${ids.length} collaborateur(s) desactive(s)`);
    } else if (bulkAction === "activate") {
      const { error } = await supabase.from("cabinet_membres").update({ is_active: true }).in("id", ids);
      if (error) {
        toast.error("Erreur lors de l'operation groupee");
        logger.error("CollaborateursList", "Bulk activate error", error);
        return;
      }
      toast.success(`${ids.length} collaborateur(s) active(s)`);
    } else if (Object.keys(ROLE_LABELS).includes(bulkAction)) {
      const { error } = await supabase.from("cabinet_membres").update({ role: bulkAction }).in("id", ids);
      if (error) {
        toast.error("Erreur lors de l'operation groupee");
        logger.error("CollaborateursList", "Bulk role change error", error);
        return;
      }
      toast.success(`Role mis a jour pour ${ids.length} collaborateur(s)`);
    }
    setSelected(new Set());
    setBulkAction("");
    await loadData();
  };

  const getBulkActionLabel = () => {
    if (bulkAction === "deactivate") return "desactiver";
    if (bulkAction === "activate") return "activer";
    if (Object.keys(ROLE_LABELS).includes(bulkAction)) return `changer le role en ${ROLE_LABELS[bulkAction as CabinetRole]}`;
    return bulkAction;
  };

  const exportCSV = () => {
    const header = "Nom,Email,Role,Statut,Cabinet,Competence,Formation,Date ajout\n";
    const rows = filtered.map((m) => {
      const cab = cabinets.find((c) => c.id === m.cabinet_id);
      const compLevel = COMPETENCE_LEVELS.find((l) => l.value === m.competence);
      const formBadge = getFormationBadge(m.derniere_formation);
      return [
        escapeCSVField(m.full_name || ""),
        escapeCSVField(m.email || ""),
        escapeCSVField(ROLE_LABELS[m.role] || m.role),
        escapeCSVField(m.is_active ? "Actif" : "Inactif"),
        escapeCSVField(cab?.nom || ""),
        escapeCSVField(compLevel?.label || "Non defini"),
        escapeCSVField(formBadge.label),
        escapeCSVField(formatDateFr(m.date_ajout, "short")),
      ].join(",");
    }).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collaborateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  };

  if (loading) return <SkeletonRows />;

  return (
    <div className="space-y-6">
      {/* #9: aria-live region for bulk action count */}
      <div aria-live="polite" className="sr-only">
        {selected.size > 0 ? `${selected.size} collaborateur${selected.size > 1 ? "s" : ""} selectionne${selected.size > 1 ? "s" : ""}` : ""}
      </div>

      {/* Header + Stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Collaborateurs</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
            {membres.length} membre{membres.length > 1 ? "s" : ""}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
            <span className="text-emerald-400">{activeCount} actif{activeCount > 1 ? "s" : ""}</span>
            {inactiveCount > 0 && (
              <>
                <span className="mx-1"> · </span>
                <span className="text-red-400">{inactiveCount} inactif{inactiveCount > 1 ? "s" : ""}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 border-white/10 text-slate-700 dark:text-slate-300 hover:bg-gray-50/80 dark:bg-white/[0.04]" aria-label="Exporter la liste en CSV">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) {
                setInviteForm({ email: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
                setLastInviteUrl("");
                // #1: Clear inviteTimerRef on dialog close
                if (inviteTimerRef.current) {
                  clearTimeout(inviteTimerRef.current);
                  inviteTimerRef.current = null;
                }
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" aria-label="Inviter un nouveau collaborateur">
                <UserPlus className="h-4 w-4" /> Ajouter un collaborateur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base">Inviter un collaborateur</DialogTitle>
                    <DialogDescription className="text-xs">
                      Ajoutez un membre à votre cabinet
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {lastInviteUrl ? (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-center">Invitation creee avec succes</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/30 space-y-2">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Partagez ce lien avec le collaborateur :
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={lastInviteUrl}
                        className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 border-gray-300 dark:border-white/[0.08]"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(lastInviteUrl);
                            toast.success("Lien copie !");
                          } catch {
                            toast.error("Impossible de copier");
                          }
                        }}
                        className="gap-1.5 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copier
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      Ce lien expire dans 7 jours. Un email a aussi ete envoye si le service est configure.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => {
                      setLastInviteUrl("");
                      setInviteForm({ email: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
                    }}>
                      Nouvelle invitation
                    </Button>
                    <Button type="button" onClick={() => {
                      setLastInviteUrl("");
                      setInviteOpen(false);
                      setInviteForm({ email: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
                    }}>
                      Fermer
                    </Button>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-nom" className="text-xs text-muted-foreground">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="invite-nom" value={inviteForm.nom} onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })} placeholder="Jean Dupont" required minLength={2} maxLength={100} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs text-muted-foreground">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="invite-email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="jean@cabinet.fr" required className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-xs text-muted-foreground">Rôle</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as CabinetRole })}>
                    <SelectTrigger id="invite-role" className="h-10">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="py-0.5">
                            <p className="font-medium text-sm">{ROLE_LABELS[role]}</p>
                            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {cabinets.length > 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-cabinet" className="text-xs text-muted-foreground">Cabinet</Label>
                    <Select value={inviteForm.cabinet_id || cabinets[0]?.id} onValueChange={(v) => setInviteForm({ ...inviteForm, cabinet_id: v })}>
                      <SelectTrigger id="invite-cabinet"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cabinets.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">Un email de réinitialisation de mot de passe sera envoyé au collaborateur pour qu'il puisse se connecter.</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={inviting} className="gap-2">
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {inviting ? "Envoi en cours..." : "Envoyer l'invitation"}
                  </Button>
                </div>
              </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="pl-9 bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]"
            aria-label="Rechercher un collaborateur"
          />
        </div>
        <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]" aria-label="Filtrer par role">
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
          <SelectTrigger className="w-[140px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]" aria-label="Filtrer par statut">
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
            <span className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{selected.size} selectionne(s) (page courante)</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-[180px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]" aria-label="Action en masse">
                <SelectValue placeholder="Action en masse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activate">Activer</SelectItem>
                <SelectItem value="deactivate">Desactiver</SelectItem>
                {(Object.keys(ROLE_LABELS) as CabinetRole[]).map((role) => (
                  <SelectItem key={role} value={role}>Role &rarr; {ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={requestBulkAction} disabled={!bulkAction}>Appliquer</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
              <TableHead className="w-10">
                <Checkbox
                  checked={paginated.length > 0 && selected.size === paginated.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selectionner tous les collaborateurs de cette page"
                />
              </TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                Collaborateur <SortIcon col="full_name" />
              </TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("role")}>
                Role <SortIcon col="role" />
              </TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Competence</TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Formation</TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Cabinet</TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Statut</TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("date_ajout")}>
                Date ajout <SortIcon col="date_ajout" />
              </TableHead>
              <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun collaborateur trouve.</p>
                </TableCell>
              </TableRow>
            )}
            {paginated.map((m) => {
              const cab = cabinets.find((c) => c.id === m.cabinet_id);
              const online = isOnline(m.updated_at);
              const isSelf = m.user_id === profile?.id;
              const compLevel = COMPETENCE_LEVELS.find((l) => l.value === m.competence);
              const formBadge = getFormationBadge(m.derniere_formation);
              return (
                <TableRow key={m.id} className={`border-gray-200 dark:border-white/[0.06] hover:bg-white dark:bg-white/[0.02] ${!m.is_active ? "opacity-50" : ""}`}>
                  <TableCell>
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} aria-label={`Selectionner ${m.full_name || m.email}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(m.full_name || m.email || "")}`}>
                          {getInitials(m.full_name || m.email || "?")}
                        </div>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950" title="En ligne" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                          {m.full_name || <span className="text-slate-400 dark:text-slate-500">&mdash;</span>}
                          {isSelf && <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5">(vous)</span>}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isSelf ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>Vous ne pouvez pas modifier votre propre role</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => updateRole(m, v as CabinetRole)}>
                        <SelectTrigger className="w-[160px] h-8 bg-transparent border-gray-300 dark:border-white/[0.08]" aria-label={`Changer le role de ${m.full_name}`}>
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
                  <TableCell>
                    {compLevel ? (
                      <Badge className={compLevel.color}>{compLevel.label}</Badge>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={formBadge.className}>{formBadge.label}</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {m.derniere_formation
                          ? `Derniere formation : ${formatDateFr(m.derniere_formation, "short")}`
                          : "Aucune date de formation renseignee"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{cab?.nom || <span className="text-slate-300 dark:text-slate-600">&mdash;</span>}</TableCell>
                  <TableCell>
                    {m.is_active ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Actif</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {formatDateFr(m.date_ajout, "short")}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions pour ${m.full_name || m.email}`}>
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
        <div className="flex items-center justify-between text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <span>{filtered.length} resultat{filtered.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Page precedente">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} aria-label="Page suivante">
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

      {/* #12: Bulk action confirmation dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => { if (!open) setBulkConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'action en masse</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment <strong>{getBulkActionLabel()}</strong> {selected.size} collaborateur{selected.size > 1 ? "s" : ""} ? Cette action sera appliquee immediatement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={executeBulkAction}>Confirmer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
