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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  UserPlus, Search, Download, ChevronUp, ChevronDown,
  UserX, UserCheck, Trash2, MoreHorizontal, ChevronLeft, ChevronRight,
  Users, User, Mail, Info, Loader2, Shield, Copy, CheckCircle2,
  Clock, XCircle, RefreshCw, AlertTriangle, X, Send, ClipboardCopy,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─── types ─── */

type CabinetRole = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "CONTROLEUR" | "SECRETAIRE" | "STAGIAIRE";

const ROLE_COLORS: Record<CabinetRole, string> = {
  ADMIN: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  SUPERVISEUR: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  COLLABORATEUR: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  CONTROLEUR: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SECRETAIRE: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30",
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
  "bg-blue-500/30 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "bg-purple-500/30 text-purple-700 dark:text-purple-300",
  "bg-amber-500/30 text-amber-700 dark:text-amber-300",
  "bg-pink-500/30 text-pink-700 dark:text-pink-300",
  "bg-cyan-500/30 text-cyan-700 dark:text-cyan-300",
];

const INVITE_URL_BASE = "https://vba-web-weaver.vercel.app/invite/";

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
  last_login_at?: string;
  competence?: CompetenceValue;
  derniere_formation?: string | null;
  referent_lcb?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  attempt_count: number | null;
  invited_by: string | null;
  invited_by_name?: string;
  token: string;
}

interface CabinetOption {
  id: string;
  nom: string;
}

const ROLE_TO_FONCTION: Record<CabinetRole, string> = {
  ADMIN: "ASSOCIE SIGNATAIRE",
  SUPERVISEUR: "SUPERVISEUR",
  COLLABORATEUR: "COLLABORATEUR",
  CONTROLEUR: "SUPERVISEUR",
  SECRETAIRE: "SECRETAIRE",
  STAGIAIRE: "STAGIAIRE",
};

const PAGE_SIZE = 15;

const INV_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Clock },
  accepted: { label: "Acceptee", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  expired: { label: "Expiree", color: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30", icon: AlertTriangle },
  revoked: { label: "Annulee", color: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30", icon: XCircle },
};

/* ─── helpers ─── */

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "jamais";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "dans le futur";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function escapeCSVField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

export default function CollaborateursList() {
  const { profile } = useAuth();
  const { refreshAll } = useAppState();

  /* ─── state ─── */
  const [membres, setMembres] = useState<Membre[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [cabinets, setCabinets] = useState<CabinetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"membres" | "invitations">("membres");

  // Members filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Invitations filters
  const [invSearch, setInvSearch] = useState("");
  const debouncedInvSearch = useDebounce(invSearch, 300);
  const [invFilterStatus, setInvFilterStatus] = useState<string>("all");
  const [invSelected, setInvSelected] = useState<Set<string>>(new Set());

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", prenom: "", nom: "", role: "COLLABORATEUR" as CabinetRole, cabinet_id: "" });
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const debouncedInviteEmail = useDebounce(inviteForm.email, 500);

  // Delete + bulk
  const [deleteTarget, setDeleteTarget] = useState<Membre | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Resend cooldown per invitation
  const [resendCooldowns, setResendCooldowns] = useState<Record<string, number>>({});

  const trackedTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timeoutRefs.current.delete(id); fn(); }, ms);
    timeoutRefs.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
      timeoutRefs.current.forEach((id) => clearTimeout(id));
      timeoutRefs.current.clear();
    };
  }, []);

  /* ─── data loading ─── */

  const loadData = useCallback(async () => {
    try {
      const { data: cabData } = await supabase.from("cabinets").select("id, nom").order("is_principal", { ascending: false });
      setCabinets(cabData || []);

      // Members via cabinet_membres + profiles join
      const { data: memData, error } = await supabase
        .from("cabinet_membres")
        .select("*")
        .order("date_ajout", { ascending: true });
      if (error) throw error;

      const userIds = (memData || []).map((m: Membre) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, updated_at, last_login_at")
        .in("id", userIds);

      const profileMap: Record<string, { email: string; full_name: string; updated_at: string; last_login_at: string | null }> = {};
      profiles?.forEach((p) => { profileMap[p.id] = p; });

      // Collaborateurs for competence + referent_lcb
      const emails = profiles?.map((p) => p.email).filter(Boolean) || [];
      const collabMap: Record<string, { niveau_competence?: string; derniere_formation?: string; referent_lcb?: boolean }> = {};
      if (emails.length > 0) {
        const { data: collabs } = await supabase
          .from("collaborateurs")
          .select("email, niveau_competence, derniere_formation, referent_lcb")
          .in("email", emails);
        collabs?.forEach((c) => { if (c.email) collabMap[c.email] = c; });
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
            last_login_at: prof?.last_login_at || null,
            competence: (collab?.niveau_competence as CompetenceValue) || undefined,
            derniere_formation: collab?.derniere_formation || null,
            referent_lcb: collab?.referent_lcb || false,
          };
        })
      );

      // Load invitations
      await loadInvitations();
    } catch (err) {
      logger.error("CollaborateursList", "Erreur chargement", err);
      toast.error("Erreur lors du chargement des collaborateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at, expires_at, accepted_at, attempt_count, invited_by, token")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Resolve invited_by names
      const byIds = [...new Set((data || []).map((i) => i.invited_by).filter(Boolean))] as string[];
      let byMap: Record<string, string> = {};
      if (byIds.length > 0) {
        const { data: byProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", byIds);
        byProfiles?.forEach((p) => { byMap[p.id] = p.full_name || ""; });
      }

      setInvitations(
        (data || []).map((inv) => ({
          ...inv,
          invited_by_name: inv.invited_by ? (byMap[inv.invited_by] || "") : "",
        }))
      );
    } catch (err) {
      logger.error("CollaborateursList", "Erreur chargement invitations", err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // #38: Auto-refresh invitations every 30s
  useEffect(() => {
    const interval = setInterval(loadInvitations, 30000);
    return () => clearInterval(interval);
  }, [loadInvitations]);

  // #40: Realtime subscription for invitation changes
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    const channel = supabase
      .channel("invitations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations", filter: `cabinet_id=eq.${profile.cabinet_id}` }, (payload) => {
        if (payload.eventType === "UPDATE" && (payload.new as Invitation).status === "accepted") {
          toast.success(`${(payload.new as Invitation).email} a accepte l'invitation !`);
        }
        loadInvitations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.cabinet_id, loadInvitations]);

  // #19: Check if invite email already exists as member
  useEffect(() => {
    if (!debouncedInviteEmail || debouncedInviteEmail.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedInviteEmail)) {
      setEmailExists(null);
      return;
    }
    setCheckingEmail(true);
    const existing = membres.find((m) => m.email?.toLowerCase() === debouncedInviteEmail.toLowerCase());
    setEmailExists(!!existing);
    setCheckingEmail(false);
  }, [debouncedInviteEmail, membres]);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  /* ─── computed ─── */

  const activeCount = useMemo(() => membres.filter((m) => m.is_active).length, [membres]);
  const inactiveCount = useMemo(() => membres.filter((m) => !m.is_active).length, [membres]);
  const pendingInvCount = useMemo(() => invitations.filter((i) => i.status === "pending").length, [invitations]);
  const acceptedInvCount = useMemo(() => invitations.filter((i) => i.status === "accepted").length, [invitations]);
  const expiredInvCount = useMemo(() => invitations.filter((i) => i.status === "expired").length, [invitations]);
  const revokedInvCount = useMemo(() => invitations.filter((i) => i.status === "revoked").length, [invitations]);

  // #7: Acceptance rate
  const acceptanceRate = useMemo(() => {
    const total = invitations.length;
    if (total === 0) return 0;
    return Math.round((acceptedInvCount / total) * 100);
  }, [invitations, acceptedInvCount]);

  // #3: Seats
  const seatsUsed = membres.length;
  const seatsLimit = 50; // From plan
  const seatsPercent = Math.round((seatsUsed / seatsLimit) * 100);

  // Members filtering
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

  // Invitations filtering
  const filteredInvitations = useMemo(() => {
    let list = [...invitations];
    if (debouncedInvSearch) {
      const q = debouncedInvSearch.toLowerCase();
      list = list.filter((i) => i.email.toLowerCase().includes(q));
    }
    if (invFilterStatus !== "all") list = list.filter((i) => i.status === invFilterStatus);
    return list;
  }, [invitations, debouncedInvSearch, invFilterStatus]);

  const hasActiveFilters = search || filterRole !== "all" || filterStatus !== "all";
  const hasActiveInvFilters = invSearch || invFilterStatus !== "all";

  // #8: Most recent member
  const newestMember = useMemo(() => {
    if (membres.length === 0) return null;
    return [...membres].sort((a, b) => new Date(b.date_ajout).getTime() - new Date(a.date_ajout).getTime())[0];
  }, [membres]);

  // #32: Check if last admin
  const adminCount = useMemo(() => membres.filter((m) => m.role === "ADMIN" && m.is_active).length, [membres]);

  /* ─── sort helpers ─── */

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  /* ─── invitation actions ─── */

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${INVITE_URL_BASE}${token}`);
      toast.success("Lien copie !");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleResend = async (inv: Invitation) => {
    if (resendCooldowns[inv.id] && Date.now() < resendCooldowns[inv.id]) {
      toast.error("Veuillez patienter avant de renvoyer");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("resend_invitation", { p_invitation_id: inv.id });
      if (error) throw error;
      const res = data as { success?: boolean; error?: string; message?: string; invite_url?: string } | null;
      if (res && !res.success) {
        toast.error(res.error || "Erreur");
        return;
      }
      toast.success(res?.message || "Invitation renvoyee");
      if (res?.invite_url) {
        try {
          await navigator.clipboard.writeText(res.invite_url);
          toast.info("Nouveau lien copie dans le presse-papier");
        } catch { /* ignore */ }
      }
      // #35: 5 min cooldown
      setResendCooldowns((prev) => ({ ...prev, [inv.id]: Date.now() + 5 * 60 * 1000 }));
      await loadInvitations();
    } catch {
      toast.error("Erreur lors du renvoi");
    }
  };

  const handleRevoke = async (inv: Invitation) => {
    try {
      const { data, error } = await supabase.rpc("revoke_invitation", { p_invitation_id: inv.id });
      if (error) throw error;
      toast.success("Invitation annulee");
      await loadInvitations();
    } catch {
      toast.error("Erreur lors de l'annulation");
    }
  };

  // #39: Bulk revoke invitations
  const handleBulkRevoke = async () => {
    const ids = Array.from(invSelected);
    const pendingIds = ids.filter((id) => invitations.find((i) => i.id === id)?.status === "pending");
    if (pendingIds.length === 0) { toast.error("Aucune invitation en attente selectionnee"); return; }
    let success = 0;
    for (const id of pendingIds) {
      try {
        await supabase.rpc("revoke_invitation", { p_invitation_id: id });
        success++;
      } catch { /* skip */ }
    }
    toast.success(`${success} invitation(s) annulee(s)`);
    setInvSelected(new Set());
    await loadInvitations();
  };

  /* ─── member actions ─── */

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = inviteForm.email.trim().toLowerCase();
    const trimmedPrenom = inviteForm.prenom.trim();
    const trimmedNom = inviteForm.nom.trim();
    if (!emailRegex.test(trimmedEmail)) { toast.error("Adresse email invalide"); return; }
    if (trimmedPrenom.length < 2) { toast.error("Le prenom doit contenir au moins 2 caracteres"); return; }
    if (trimmedNom.length < 2) { toast.error("Le nom doit contenir au moins 2 caracteres"); return; }
    if (profile.email && trimmedEmail === profile.email.toLowerCase()) { toast.error("Vous ne pouvez pas vous inviter vous-meme"); return; }
    if (emailExists) { toast.error("Ce collaborateur est deja membre du cabinet"); return; }

    setInviting(true);
    try {
      const targetCabinet = inviteForm.cabinet_id || cabinets[0]?.id || profile.cabinet_id;
      const authRole = ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"].includes(inviteForm.role) ? inviteForm.role : "COLLABORATEUR";

      const { data: rpcData, error: rpcError } = await supabase.rpc("invite_collaborator", {
        p_email: trimmedEmail,
        p_prenom: trimmedPrenom,
        p_nom: trimmedNom,
        p_role: authRole,
      });
      if (rpcError) throw new Error(rpcError.message || "Erreur lors de l'invitation");
      if (rpcData && !rpcData.success) throw new Error(rpcData.error || "Erreur lors de l'invitation");

      const resData = rpcData as { success?: boolean; error?: string; message?: string; invite_url?: string; token?: string } | null;

      // Sync to collaborateurs table
      const fonction = ROLE_TO_FONCTION[inviteForm.role] || "COLLABORATEUR";
      const { data: existingCollab } = await supabase.from("collaborateurs").select("id").eq("email", trimmedEmail).eq("cabinet_id", targetCabinet).maybeSingle();
      if (!existingCollab) {
        await supabase.from("collaborateurs").insert({
          nom: `${trimmedPrenom} ${trimmedNom}`,
          email: trimmedEmail,
          fonction,
          niveau_competence: "JUNIOR",
          referent_lcb: false,
          suppleant: "",
          statut_formation: "JAMAIS FORME",
          cabinet_id: targetCabinet,
        });
      }

      if (resData?.invite_url) {
        setLastInviteUrl(resData.invite_url);
        toast.success(`Invitation creee pour ${trimmedEmail}`);
      } else {
        toast.success(resData?.message || `Invitation envoyee a ${trimmedEmail}`);
        setInviteOpen(false);
        setInviteForm({ email: "", prenom: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
      }

      if (inviteTimerRef.current) { clearTimeout(inviteTimerRef.current); inviteTimerRef.current = null; }
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

  const updateRole = async (membre: Membre, newRole: CabinetRole) => {
    if (membre.user_id === profile?.id) { toast.error("Vous ne pouvez pas modifier votre propre role"); return; }
    // #32: Prevent demoting last admin
    if (membre.role === "ADMIN" && newRole !== "ADMIN" && adminCount <= 1) {
      toast.error("Impossible : il doit rester au moins un administrateur");
      return;
    }
    const previousRole = membre.role;
    setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, role: newRole } : m));
    const { error } = await supabase.from("cabinet_membres").update({ role: newRole }).eq("id", membre.id);
    if (error) {
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, role: previousRole } : m));
      toast.error("Erreur lors du changement de role");
      return;
    }
    if (membre.email) {
      const newFonction = ROLE_TO_FONCTION[newRole] || "COLLABORATEUR";
      await supabase.from("collaborateurs").update({ fonction: newFonction }).eq("email", membre.email).eq("cabinet_id", membre.cabinet_id);
    }
    await logAudit({ action: "CHANGEMENT_ROLE", table_name: "cabinet_membres", record_id: membre.id, old_data: { role: previousRole }, new_data: { role: newRole } });
    toast.success("Role mis a jour");
  };

  const toggleActive = async (membre: Membre) => {
    // #31: Can't deactivate yourself
    if (membre.user_id === profile?.id) { toast.error("Vous ne pouvez pas vous desactiver"); return; }
    const newStatus = !membre.is_active;
    const previousStatus = membre.is_active;
    setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, is_active: newStatus } : m));
    const { error } = await supabase.from("cabinet_membres").update({ is_active: newStatus }).eq("id", membre.id);
    if (error) {
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, is_active: previousStatus } : m));
      toast.error("Erreur");
      return;
    }
    if (membre.email) {
      await supabase.from("collaborateurs").update({ statut_formation: newStatus ? "ACTIF" : "INACTIF" }).eq("email", membre.email).eq("cabinet_id", membre.cabinet_id);
    }
    await logAudit({ action: newStatus ? "ACTIVATION_MEMBRE" : "DESACTIVATION_MEMBRE", table_name: "cabinet_membres", record_id: membre.id });
    toast.success(newStatus ? "Collaborateur active" : "Collaborateur desactive");
  };

  const deleteMembre = async () => {
    if (!deleteTarget) return;
    // #29: ADMIN only
    if (profile?.role !== "ADMIN") { toast.error("Seuls les administrateurs peuvent supprimer"); return; }
    const { error } = await supabase.from("cabinet_membres").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    if (deleteTarget.email) {
      await supabase.from("collaborateurs").delete().eq("email", deleteTarget.email).eq("cabinet_id", deleteTarget.cabinet_id);
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
      if (error) { toast.error("Erreur"); return; }
      toast.success(`${ids.length} collaborateur(s) desactive(s)`);
    } else if (bulkAction === "activate") {
      const { error } = await supabase.from("cabinet_membres").update({ is_active: true }).in("id", ids);
      if (error) { toast.error("Erreur"); return; }
      toast.success(`${ids.length} collaborateur(s) active(s)`);
    } else if (Object.keys(ROLE_LABELS).includes(bulkAction)) {
      const { error } = await supabase.from("cabinet_membres").update({ role: bulkAction }).in("id", ids);
      if (error) { toast.error("Erreur"); return; }
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

  /* ─── exports ─── */

  const exportMembresCSV = () => {
    const header = "Nom,Email,Role,Statut,Derniere connexion,Date ajout\n";
    const rows = filtered.map((m) => [
      escapeCSVField(m.full_name || ""),
      escapeCSVField(m.email || ""),
      escapeCSVField(ROLE_LABELS[m.role] || m.role),
      escapeCSVField(m.is_active ? "Actif" : "Inactif"),
      escapeCSVField(relativeTime(m.last_login_at)),
      escapeCSVField(formatDateFr(m.date_ajout, "short")),
    ].join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collaborateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  };

  const exportInvitationsCSV = () => {
    const header = "Email,Role,Statut,Envoyee le,Expire le,Tentatives,Invite par\n";
    const rows = filteredInvitations.map((i) => [
      escapeCSVField(i.email),
      escapeCSVField(ROLE_LABELS[i.role as CabinetRole] || i.role),
      escapeCSVField(INV_STATUS_CONFIG[i.status]?.label || i.status),
      escapeCSVField(i.created_at ? formatDateFr(i.created_at, "short") : ""),
      escapeCSVField(formatDateFr(i.expires_at, "short")),
      escapeCSVField(String(i.attempt_count || 0)),
      escapeCSVField(i.invited_by_name || ""),
    ].join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV telecharge");
  };

  /* ─── render ─── */

  if (loading) return <SkeletonRows />;

  return (
    <div className="space-y-6">
      {/* ═══ Header + Stats (#1) ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Collaborateurs</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {membres.length} membre{membres.length > 1 ? "s" : ""}
            <span className="mx-1.5 text-slate-400 dark:text-slate-600">|</span>
            <span className="text-emerald-600 dark:text-emerald-400">{activeCount} actif{activeCount > 1 ? "s" : ""}</span>
            {pendingInvCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-400 dark:text-slate-600">|</span>
                <span className="text-amber-600 dark:text-amber-400">{pendingInvCount} invitation{pendingInvCount > 1 ? "s" : ""} en attente</span>
              </>
            )}
          </p>
        </div>
        <Dialog
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open);
            if (!open) {
              setInviteForm({ email: "", prenom: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
              setLastInviteUrl("");
              setEmailExists(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" /> Inviter un collaborateur
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
                    {/* #25: Seats remaining */}
                    {seatsLimit - seatsUsed} siege{seatsLimit - seatsUsed > 1 ? "s" : ""} disponible{seatsLimit - seatsUsed > 1 ? "s" : ""} sur {seatsLimit}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            {lastInviteUrl ? (
              <div className="space-y-4 pt-2">
                {/* #24: Success animation */}
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-center">Invitation creee avec succes</p>
                </div>
                {/* #22: Copiable link */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/30 space-y-2">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Partagez ce lien avec le collaborateur :</p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={lastInviteUrl} className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 border-gray-300 dark:border-white/[0.08]" onFocus={(e) => e.target.select()} />
                    <Button size="sm" variant="outline" type="button" onClick={() => handleCopyLink(lastInviteUrl.replace(INVITE_URL_BASE, ""))} className="gap-1.5 shrink-0">
                      <Copy className="w-3.5 h-3.5" /> Copier
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-300">Ce lien expire dans 7 jours.</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {/* #23: Invite another */}
                  <Button type="button" variant="outline" onClick={() => {
                    setLastInviteUrl("");
                    setInviteForm({ email: "", prenom: "", nom: "", role: "COLLABORATEUR", cabinet_id: "" });
                    setEmailExists(null);
                  }}>
                    Inviter un autre
                  </Button>
                  <Button type="button" onClick={() => { setLastInviteUrl(""); setInviteOpen(false); }}>
                    Fermer
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                {/* #17: Prenom + Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-prenom" className="text-xs text-muted-foreground">Prenom</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="invite-prenom" value={inviteForm.prenom} onChange={(e) => setInviteForm({ ...inviteForm, prenom: e.target.value })} placeholder="Jean" required minLength={2} className="pl-9" autoComplete="given-name" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-nom" className="text-xs text-muted-foreground">Nom</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="invite-nom" value={inviteForm.nom} onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })} placeholder="DUPONT" required minLength={2} className="pl-9 uppercase" autoComplete="family-name" />
                    </div>
                  </div>
                </div>
                {/* #18: Email with real-time validation */}
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs text-muted-foreground">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="jean@cabinet.fr"
                      required
                      className={`pl-9 ${emailExists === true ? "border-red-500 focus-visible:ring-red-500" : emailExists === false ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                    />
                    {checkingEmail && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {emailExists === true && <p className="text-xs text-red-500">Cet email est deja membre du cabinet</p>}
                </div>
                {/* #20: Role with descriptions */}
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-xs text-muted-foreground">Role</Label>
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
                        {cabinets.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* #21: Info message */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">Un lien d'invitation sera genere. Vous pourrez le copier et le partager.</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>Annuler</Button>
                  <Button type="submit" disabled={inviting || inviteForm.prenom.trim().length < 2 || inviteForm.nom.trim().length < 2 || emailExists === true} className="gap-2">
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {inviting ? "Envoi en cours..." : "Envoyer l'invitation"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ═══ #3: Seats progress ═══ */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-400">Sieges utilises</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{seatsUsed}/{seatsLimit}</span>
          </div>
          <Progress value={seatsPercent} className="h-2" />
        </div>
        {/* #4: Alert if > 80% */}
        {seatsPercent > 80 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            Limite bientot atteinte
          </div>
        )}
      </div>

      {/* ═══ #41: Sub-tabs ═══ */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200 dark:border-white/10 w-fit">
        <button
          onClick={() => setActiveSection("membres")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === "membres" ? "bg-white dark:bg-white/10 text-blue-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Membres ({membres.length})
        </button>
        <button
          onClick={() => setActiveSection("invitations")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${activeSection === "invitations" ? "bg-white dark:bg-white/10 text-blue-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <Send className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Invitations ({invitations.length})
          {/* #2: Badge if pending */}
          {pendingInvCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {pendingInvCount}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════ SECTION A: MEMBRES ═══════════════════ */}
      {activeSection === "membres" && (
        <div className="space-y-4">
          {/* Filters (#9-16) */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email..." className="pl-9 bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]" />
            </div>
            <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]">
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
              <SelectTrigger className="w-[130px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            {/* #16: Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterRole("all"); setFilterStatus("all"); }} className="gap-1.5 text-slate-500">
                <X className="h-3.5 w-3.5" /> Effacer
              </Button>
            )}
            {/* #47: Export */}
            <Button variant="outline" size="sm" onClick={exportMembresCSV} className="gap-2 border-gray-300 dark:border-white/10 ml-auto">
              <Download className="h-4 w-4" /> CSV
            </Button>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">{selected.size} sel.</span>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-[170px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]">
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
                <Button size="sm" onClick={requestBulkAction} disabled={!bulkAction}>Appliquer</Button>
              </div>
            )}
          </div>

          {/* #8: Newest member info */}
          {newestMember && membres.length > 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dernier membre ajoute : <span className="font-medium text-slate-700 dark:text-slate-300">{newestMember.full_name}</span> — {relativeTime(newestMember.date_ajout)}
            </p>
          )}

          {/* Members table */}
          <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <TableHead className="w-10">
                    <Checkbox checked={paginated.length > 0 && selected.size === paginated.length} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                    Collaborateur <SortIcon col="full_name" />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("role")}>
                    Role <SortIcon col="role" />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Statut</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("last_login_at")}>
                    Derniere connexion <SortIcon col="last_login_at" />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort("date_ajout")}>
                    Date ajout <SortIcon col="date_ajout" />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                      {/* #46: Empty state */}
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {membres.length === 0
                        ? <p>Vous etes le seul membre. Invitez vos collaborateurs !</p>
                        : <p>Aucun collaborateur trouve.</p>}
                    </TableCell>
                  </TableRow>
                )}
                {paginated.map((m, idx) => {
                  const isSelf = m.user_id === profile?.id;
                  return (
                    <TableRow
                      key={m.id}
                      className={`border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${!m.is_active ? "opacity-50" : ""} ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <TableCell>
                        <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(m.full_name || m.email || "")}`}>
                            {getInitials(m.full_name || m.email || "?")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                              {m.full_name || <span className="text-slate-400 dark:text-slate-500">&mdash;</span>}
                              {/* #30: (vous) */}
                              {isSelf && <span className="text-xs text-blue-500 ml-1.5">(vous)</span>}
                              {/* #33: Referent LCB-FT */}
                              {m.referent_lcb && <Badge className="ml-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9px] py-0">LCB-FT</Badge>}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        ) : (
                          <Select value={m.role} onValueChange={(v) => updateRole(m, v as CabinetRole)}>
                            <SelectTrigger className="w-[150px] h-8 bg-transparent border-gray-300 dark:border-white/[0.08]">
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
                        {m.is_active
                          ? <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Actif</Badge>
                          : <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30">Inactif</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {relativeTime(m.last_login_at)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {formatDateFr(m.date_ajout, "short")}
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
                                {m.is_active
                                  ? <><UserX className="h-4 w-4 mr-2" /> Desactiver</>
                                  : <><UserCheck className="h-4 w-4 mr-2" /> Activer</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(m.email || ""); toast.success("Email copie"); }}>
                                <ClipboardCopy className="h-4 w-4 mr-2" /> Copier email
                              </DropdownMenuItem>
                              {/* #29: Delete (ADMIN only) */}
                              {profile?.role === "ADMIN" && (
                                <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeleteTarget(m)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                                </DropdownMenuItem>
                              )}
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
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
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
        </div>
      )}

      {/* ═══════════════════ SECTION B: INVITATIONS ═══════════════════ */}
      {activeSection === "invitations" && (
        <div className="space-y-4">
          {/* #5: Mini dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "En attente", count: pendingInvCount, color: "text-amber-600 dark:text-amber-400" },
              { label: "Acceptees", count: acceptedInvCount, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Expirees", count: expiredInvCount, color: "text-slate-500 dark:text-slate-400" },
              { label: "Taux acceptation", count: `${acceptanceRate}%`, color: "text-blue-600 dark:text-blue-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters (#12-16) */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input value={invSearch} onChange={(e) => setInvSearch(e.target.value)} placeholder="Rechercher par email..." className="pl-9 bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]" />
            </div>
            <Select value={invFilterStatus} onValueChange={setInvFilterStatus}>
              <SelectTrigger className="w-[160px] bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="accepted">Acceptees</SelectItem>
                <SelectItem value="expired">Expirees</SelectItem>
                <SelectItem value="revoked">Annulees</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveInvFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setInvSearch(""); setInvFilterStatus("all"); }} className="gap-1.5 text-slate-500">
                <X className="h-3.5 w-3.5" /> Effacer
              </Button>
            )}
            {/* #48: Export invitations CSV */}
            <Button variant="outline" size="sm" onClick={exportInvitationsCSV} className="gap-2 border-gray-300 dark:border-white/10 ml-auto">
              <Download className="h-4 w-4" /> CSV
            </Button>
            {/* #39: Bulk revoke */}
            {invSelected.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkRevoke} className="gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Annuler {invSelected.size} sel.
              </Button>
            )}
          </div>

          {/* Invitations table */}
          <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredInvitations.filter((i) => i.status === "pending").length > 0 && invSelected.size === filteredInvitations.filter((i) => i.status === "pending").length}
                      onCheckedChange={() => {
                        const pendingIds = filteredInvitations.filter((i) => i.status === "pending").map((i) => i.id);
                        if (invSelected.size === pendingIds.length) setInvSelected(new Set());
                        else setInvSelected(new Set(pendingIds));
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Statut</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Envoyee le</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Expire le</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 text-center">Tent.</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400">Invite par</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500 dark:text-slate-400">
                      {/* #45: Empty state */}
                      <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium mb-1">Aucune invitation envoyee</p>
                      <p className="text-xs">Invitez votre premier collaborateur en cliquant sur le bouton ci-dessus.</p>
                    </TableCell>
                  </TableRow>
                )}
                {filteredInvitations.map((inv, idx) => {
                  const statusCfg = INV_STATUS_CONFIG[inv.status] || INV_STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const remaining = daysUntil(inv.expires_at);
                  const expiresSoon = inv.status === "pending" && remaining <= 1 && remaining >= 0;
                  const isExpiredDate = remaining < 0;
                  const inCooldown = resendCooldowns[inv.id] && Date.now() < resendCooldowns[inv.id];
                  return (
                    <TableRow
                      key={inv.id}
                      className={`border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <TableCell>
                        {inv.status === "pending" && (
                          <Checkbox
                            checked={invSelected.has(inv.id)}
                            onCheckedChange={() => {
                              const next = new Set(invSelected);
                              if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id);
                              setInvSelected(next);
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-800 dark:text-slate-200 font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[inv.role as CabinetRole] || ROLE_COLORS.COLLABORATEUR}>
                          {ROLE_LABELS[inv.role as CabinetRole] || inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                        {/* #37: Expires soon badge */}
                        {expiresSoon && <Badge className="ml-1.5 bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 text-[9px] py-0">Expire bientot</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {inv.created_at ? formatDateFr(inv.created_at, "short") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {formatDateFr(inv.expires_at, "short")}
                        <span className={`ml-1 ${isExpiredDate ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
                          ({isExpiredDate ? `expiree depuis ${Math.abs(remaining)}j` : `dans ${remaining}j`})
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600 dark:text-slate-400">{inv.attempt_count || 0}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">{inv.invited_by_name || "—"}</TableCell>
                      <TableCell className="text-right">
                        {(inv.status === "pending" || inv.status === "expired") && (
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "pending" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopyLink(inv.token)}>
                                    <ClipboardCopy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copier le lien</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleResend(inv)} disabled={!!inCooldown}>
                                  <RefreshCw className={`h-3.5 w-3.5 ${inCooldown ? "opacity-30" : ""}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{inCooldown ? "Patientez 5 min" : "Renvoyer"}</TooltipContent>
                            </Tooltip>
                            {inv.status === "pending" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleRevoke(inv)}>
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Annuler</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* #6: Last invitation sent */}
          {invitations.length > 0 && invitations[0].created_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Derniere invitation envoyee : {relativeTime(invitations[0].created_at)} a <span className="font-medium">{invitations[0].email}</span>
            </p>
          )}
        </div>
      )}

      {/* ═══ Dialogs ═══ */}

      {/* Delete confirmation (#29) */}
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

      {/* Bulk action confirmation */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => { if (!open) setBulkConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'action en masse</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment <strong>{getBulkActionLabel()}</strong> {selected.size} collaborateur{selected.size > 1 ? "s" : ""} ?
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
