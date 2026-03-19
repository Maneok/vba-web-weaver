import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Upload, FileText, Trash2, Download, Clock, AlertTriangle, Loader2,
  Search, FolderOpen, History, Eye, Plus, X, File,
  ChevronUp, ChevronDown, Building2, FileImage, FileCode,
  CheckCircle, ExternalLink, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAppState } from "@/lib/AppContext";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { logger } from "@/lib/logger";
import { useNavigate } from "react-router-dom";

/* ─────────── Types ─────────── */

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  client_ref: string | null;
  expiration_date: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  file_path: string;
  file_size: number;
  comment: string | null;
  created_at: string;
}

interface StorageFile {
  name: string;
  id: string | null;
  created_at: string;
  updated_at: string;
  metadata: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  } | null;
}

interface SirenGroup {
  siren: string;
  clientName: string;
  clientRef: string | null;
  files: StorageFile[];
  totalDocs: number;
  requiredDocs: number;
  lastUpdated: string;
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

/* ─────────── Constants ─────────── */

const CATEGORIES = [
  { value: "cni", label: "CNI / Passeport" },
  { value: "kbis", label: "KBis" },
  { value: "rib", label: "RIB" },
  { value: "justificatif", label: "Justificatif domicile" },
  { value: "contrat", label: "Lettre de mission" },
  { value: "facture", label: "Facture" },
  { value: "attestation", label: "Attestation" },
  { value: "autre", label: "Autre" },
];

const REQUIRED_DOC_COUNT = 9; // KYC required docs per client

const EXPIRABLE_CATEGORIES = ["cni", "kbis"];

const CATEGORY_TABS = [
  { value: "all", label: "Tous" },
  { value: "kbis", label: "KBis" },
  { value: "cni", label: "CNI" },
  { value: "justificatif", label: "Justificatif" },
  { value: "rib", label: "RIB" },
  { value: "contrat", label: "Contrat" },
  { value: "autre", label: "Autre" },
];

/* ─────────── Helpers ─────────── */

function getExpirationStatus(expirationDate: string | null): { label: string; variant: "default" | "destructive" | "secondary" | "outline"; daysLeft: number; colorClass: string } | null {
  if (!expirationDate) return null;
  try {
    const parsed = parseISO(expirationDate);
    if (isNaN(parsed.getTime())) return null;
  } catch { return null; }
  const days = differenceInDays(parseISO(expirationDate), new Date());
  if (days < 0) return { label: `Expiré (${Math.abs(days)}j)`, variant: "destructive", daysLeft: days, colorClass: "text-red-400 animate-pulse" };
  if (days <= 30) return { label: `${days}j restants`, variant: "destructive", daysLeft: days, colorClass: "text-red-400" };
  if (days <= 90) return { label: `${days}j restants`, variant: "secondary", daysLeft: days, colorClass: "text-amber-400" };
  return { label: `Valide (${days}j)`, variant: "outline", daysLeft: days, colorClass: "text-emerald-400" };
}

function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes < 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatSiren(siren: string): string {
  const clean = siren.replace(/\s/g, "");
  if (clean.length !== 9) return siren;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
  if (ext === "html" || ext === "htm") return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />;
  return <File className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />;
}

function guessCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("cni") || lower.includes("passeport") || lower.includes("identite")) return "cni";
  if (lower.includes("kbis")) return "kbis";
  if (lower.includes("rib")) return "rib";
  if (lower.includes("mission") || lower.includes("contrat")) return "contrat";
  if (lower.includes("justificatif") || lower.includes("domicile")) return "justificatif";
  return "autre";
}

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

type SortColumn = "name" | "category" | "file_size" | "version" | "expiration" | "updated_at";
type SortDir = "asc" | "desc";
type SirenFilter = "all" | "complets" | "incomplets" | "alertes";

/* ─────────── Component ─────────── */

export default function GedPage() {
  const { profile } = useAuth();
  const { clients } = useAppState();
  const navigate = useNavigate();

  useDocumentTitle("Documents");

  // Core data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageFolders, setStorageFolders] = useState<{ siren: string; files: StorageFile[] }[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);

  // Master-detail state
  const [selectedSiren, setSelectedSiren] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sirenFilter, setSirenFilter] = useState<SirenFilter>("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDir>("desc");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("autre");
  const [uploadClientRef, setUploadClientRef] = useState("");
  const [uploadExpiration, setUploadExpiration] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Version/delete dialogs
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ names: string; proceed: () => void } | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [versionComment, setVersionComment] = useState("");

  const debouncedSearch = useDebounce(searchQuery, 300);

  /* ─── Data fetching ─── */

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        toast.error("Erreur chargement documents");
        logger.error("GED", "Erreur chargement documents", error);
      } else {
        setDocuments((data as Document[]) || []);
      }
    } catch (err) {
      toast.error("Erreur chargement documents");
      logger.error("GED", "fetchDocuments exception", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStorageFiles = useCallback(async () => {
    setStorageLoading(true);
    try {
      const { data: folders, error: folderError } = await supabase.storage
        .from("kyc-documents")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (folderError) {
        logger.error("GED", "Storage list error", folderError);
        setStorageLoading(false);
        return;
      }

      if (!folders || folders.length === 0) {
        setStorageFolders([]);
        setStorageLoading(false);
        return;
      }

      const folderEntries = folders.filter(folder => !folder.id);
      const results = await Promise.all(
        folderEntries.map(async (folder) => {
          try {
            const { data: files, error: listErr } = await supabase.storage
              .from("kyc-documents")
              .list(folder.name, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

            if (listErr) {
              logger.error("GED", `Error listing folder ${folder.name}:`, listErr);
              return null;
            }

            if (files && files.length > 0) {
              return { siren: folder.name, files: files as StorageFile[] };
            }
            return null;
          } catch (err) {
            logger.error("GED", `Exception listing folder ${folder.name}:`, err);
            return null;
          }
        })
      );

      const valid = results.filter(Boolean) as { siren: string; files: StorageFile[] }[];
      setStorageFolders(valid);
      if (valid.length > 0 && !selectedSiren) {
        setSelectedSiren(valid[0].siren);
      }
    } catch (err: unknown) {
      logger.error("GED", "Error fetching storage", err);
      toast.error("Erreur lors du chargement des documents KYC");
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchStorageFiles();
  }, [fetchDocuments, fetchStorageFiles]);

  /* ─── Derived data: SIREN groups ─── */

  const clientBySiren = useMemo(() => {
    const map = new Map<string, { name: string; ref: string }>();
    for (const c of clients) {
      if (c.siren) map.set(c.siren.replace(/\s/g, ""), { name: c.raisonSociale, ref: c.ref });
    }
    return map;
  }, [clients]);

  const sirenGroups: SirenGroup[] = useMemo(() => {
    return storageFolders.map((folder) => {
      const cleanSiren = folder.siren.replace(/\s/g, "");
      const clientInfo = clientBySiren.get(cleanSiren);
      const totalDocs = folder.files.length;
      const lastFile = folder.files[0];
      const lastUpdated = lastFile?.updated_at || lastFile?.created_at || "";

      // Check document expiration status from the documents table
      const sirenDocs = documents.filter(d => d.client_ref && clientInfo?.ref && d.client_ref === clientInfo.ref);
      const hasExpired = sirenDocs.some(d => {
        const s = getExpirationStatus(d.expiration_date);
        return s && s.daysLeft < 0;
      });
      const hasExpiringSoon = sirenDocs.some(d => {
        const s = getExpirationStatus(d.expiration_date);
        return s && s.daysLeft >= 0 && s.daysLeft <= 30;
      });

      return {
        siren: folder.siren,
        clientName: clientInfo?.name || `SIREN ${formatSiren(folder.siren)}`,
        clientRef: clientInfo?.ref || null,
        files: folder.files,
        totalDocs,
        requiredDocs: REQUIRED_DOC_COUNT,
        lastUpdated,
        hasExpired,
        hasExpiringSoon,
      };
    });
  }, [storageFolders, clientBySiren, documents]);

  const filteredSirenGroups = useMemo(() => {
    let groups = sirenGroups;

    // Text search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      groups = groups.filter(g =>
        g.clientName.toLowerCase().includes(q) ||
        g.siren.includes(q) ||
        formatSiren(g.siren).includes(q)
      );
    }

    // Status filter
    if (sirenFilter === "complets") {
      groups = groups.filter(g => g.totalDocs >= g.requiredDocs);
    } else if (sirenFilter === "incomplets") {
      groups = groups.filter(g => g.totalDocs < g.requiredDocs);
    } else if (sirenFilter === "alertes") {
      groups = groups.filter(g => g.hasExpired || g.hasExpiringSoon);
    }

    return groups;
  }, [sirenGroups, debouncedSearch, sirenFilter]);

  const selectedGroup = sirenGroups.find(g => g.siren === selectedSiren) || null;

  /* ─── KPIs ─── */

  const kpis = useMemo(() => {
    const totalDocs = storageFolders.reduce((sum, f) => sum + f.files.length, 0);
    const expiringSoon = documents.filter(d => {
      const s = getExpirationStatus(d.expiration_date);
      return s && s.daysLeft >= 0 && s.daysLeft <= 30;
    }).length;
    const expired = documents.filter(d => {
      const s = getExpirationStatus(d.expiration_date);
      return s && s.daysLeft < 0;
    }).length;
    const avgCompletude = sirenGroups.length > 0
      ? Math.round(sirenGroups.reduce((sum, g) => sum + Math.min(100, (g.totalDocs / g.requiredDocs) * 100), 0) / sirenGroups.length)
      : 0;

    return { totalDocs, expiringSoon, expired, avgCompletude };
  }, [storageFolders, documents, sirenGroups]);

  /* ─── Selected SIREN files filtered & sorted ─── */

  const selectedFiles = useMemo(() => {
    if (!selectedGroup) return [];
    let files = [...selectedGroup.files];

    // Category filter based on file name heuristics
    if (activeCategory !== "all") {
      files = files.filter(f => {
        const cat = guessCategoryFromName(f.name);
        return cat === activeCategory;
      });
    }

    // Sort
    files.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "file_size":
          return dir * ((a.metadata?.size || 0) - (b.metadata?.size || 0));
        case "updated_at":
          return dir * (a.updated_at || a.created_at || "").localeCompare(b.updated_at || b.created_at || "");
        default:
          return dir * a.name.localeCompare(b.name);
      }
    });

    return files;
  }, [selectedGroup, activeCategory, sortColumn, sortDirection]);

  /* ─── Actions ─── */

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return null;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const selectSiren = (siren: string) => {
    setSelectedSiren(siren);
    setActiveCategory("all");
    setMobileDetailOpen(true);
  };

  const downloadStorageFile = async (siren: string, fileName: string) => {
    const filePath = `${siren}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      toast.error("Erreur téléchargement");
      return;
    }

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = fileName;
    a.click();
  };

  const previewStorageFile = async (siren: string, fileName: string) => {
    const filePath = `${siren}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      toast.error("Erreur prévisualisation");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  /* ─── Upload logic (preserved from original) ─── */

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const MAX_DROP_SIZE = 10 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_DROP_SIZE) {
        toast.error("Fichier trop volumineux (max 10 Mo)");
        return;
      }
    }
    if (files.length > 0) {
      setPendingFiles(files);
      setUploadCategory(guessCategoryFromName(files[0].name));
      if (selectedGroup?.clientRef) setUploadClientRef(selectedGroup.clientRef);
      setUploadDialogOpen(true);
    }
  }, [selectedGroup]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_DROP_SIZE = 10 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_DROP_SIZE) {
        toast.error("Fichier trop volumineux (max 10 Mo)");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    if (files.length > 0) {
      setPendingFiles(files);
      if (selectedGroup?.clientRef) setUploadClientRef(selectedGroup.clientRef);
      setUploadDialogOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedGroup]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFiles = async () => {
    if (pendingFiles.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Vous devez être connecté"); return; }

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx"];

    for (const file of pendingFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" dépasse la taille maximale (20 Mo)`);
        return;
      }
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`"${file.name}" : type de fichier non autorisé`);
        return;
      }
      if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
        toast.error(`"${file.name}" : nom de fichier invalide`);
        return;
      }
    }

    const existingNames = new Set(documents.map((d) => d.name.toLowerCase()));
    const duplicates = pendingFiles.filter((f) => existingNames.has(f.name.toLowerCase()));
    if (duplicates.length > 0) {
      const names = duplicates.map((f) => `"${f.name}"`).join(", ");
      setDuplicateConfirm({
        names,
        proceed: () => { setDuplicateConfirm(null); doUpload(pendingFiles); },
      });
      return;
    }

    doUpload(pendingFiles);
  };

  const doUpload = async (filesToUpload: File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Vous devez être connecté"); return; }

    setUploading(true);
    try {
      for (const file of filesToUpload) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${user.id}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: docData, error: docError } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            cabinet_id: profile?.cabinet_id || null,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            category: uploadCategory,
            client_ref: uploadClientRef || null,
            expiration_date: uploadExpiration || null,
            current_version: 1,
          })
          .select()
          .single();

        if (docError) throw docError;

        await supabase.from("document_versions").insert({
          document_id: docData.id,
          cabinet_id: profile?.cabinet_id || null,
          version_number: 1,
          file_path: filePath,
          file_size: file.size,
          uploaded_by: user.id,
          comment: "Version initiale",
        });
      }

      toast.success(`${filesToUpload.length} document(s) importé(s)`);
      setUploadDialogOpen(false);
      setPendingFiles([]);
      setUploadCategory("autre");
      setUploadClientRef("");
      setUploadExpiration("");
      fetchDocuments();
      fetchStorageFiles();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erreur lors de l'import"));
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteDocument = async () => {
    const doc = deleteTarget;
    if (!doc) return;
    setDeleteTarget(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: storageErr } = await supabase.storage.from("documents").remove([doc.file_path]);
      if (storageErr) logger.warn("GED", "Storage delete warning:", storageErr);

      const { data: versionData } = await supabase
        .from("document_versions")
        .select("file_path")
        .eq("document_id", doc.id);
      if (versionData) {
        const paths = versionData.map((v: { file_path: string }) => v.file_path).filter((p: string) => p !== doc.file_path);
        if (paths.length > 0) await supabase.storage.from("documents").remove(paths);
      }

      const { error: dbErr } = await supabase.from("documents").delete().eq("id", doc.id);
      if (dbErr) throw dbErr;
      toast.success("Document supprimé");
      fetchDocuments();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
      logger.error("GED", "deleteDocument error", err);
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (error || !data || data.size === 0) {
      toast.error("Erreur téléchargement");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const openVersionDialog = async (doc: Document) => {
    setSelectedDoc(doc);
    const { data } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", doc.id)
      .order("version_number", { ascending: false });
    setVersions((data as DocumentVersion[]) || []);
    setVersionDialogOpen(true);
  };

  const uploadNewVersion = async () => {
    if (!newVersionFile || !selectedDoc) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    try {
      const newVersion = selectedDoc.current_version + 1;
      const filePath = `${user.id}/${Date.now()}_v${newVersion}_${newVersionFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, newVersionFile);
      if (uploadError) throw uploadError;

      await supabase.from("document_versions").insert({
        document_id: selectedDoc.id,
        cabinet_id: profile?.cabinet_id || null,
        version_number: newVersion,
        file_path: filePath,
        file_size: newVersionFile.size,
        uploaded_by: user.id,
        comment: versionComment || null,
      });

      await supabase
        .from("documents")
        .update({
          current_version: newVersion,
          file_path: filePath,
          file_size: newVersionFile.size,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDoc.id);

      toast.success(`Version ${newVersion} importée`);
      setNewVersionFile(null);
      setVersionComment("");
      setVersionDialogOpen(false);
      fetchDocuments();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erreur lors de la mise à jour"));
    } finally {
      setUploading(false);
    }
  };

  /* ─── Render helpers ─── */

  const isLoading = loading || storageLoading;

  const renderSirenPanel = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {/* Filter pills */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {([
            { value: "all", label: "Tous" },
            { value: "complets", label: "Complets" },
            { value: "incomplets", label: "Incomplets" },
            { value: "alertes", label: "Alertes" },
          ] as { value: SirenFilter; label: string }[]).map(pill => (
            <button
              key={pill.value}
              onClick={() => setSirenFilter(pill.value)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                sirenFilter === pill.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* SIREN list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-3/4 skeleton-shimmer rounded" />
                <div className="h-3 w-1/2 skeleton-shimmer rounded" />
                <div className="h-2 w-full skeleton-shimmer rounded" />
              </div>
            ))}
          </div>
        ) : filteredSirenGroups.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun dossier trouvé</p>
          </div>
        ) : (
          <div className="py-1">
            {filteredSirenGroups.map((group, idx) => {
              const isSelected = selectedSiren === group.siren;
              const completude = Math.min(100, Math.round((group.totalDocs / group.requiredDocs) * 100));
              const statusColor = group.hasExpired
                ? "bg-red-400"
                : group.totalDocs >= group.requiredDocs
                  ? "bg-emerald-400"
                  : "bg-amber-400";

              return (
                <button
                  key={group.siren}
                  onClick={() => selectSiren(group.siren)}
                  className={`w-full text-left px-3 py-3 transition-colors animate-fade-in-up ${
                    isSelected
                      ? "bg-accent border-l-2 border-primary"
                      : "hover:bg-accent/50 border-l-2 border-transparent"
                  }`}
                  style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                        <span className="font-semibold text-sm text-foreground truncate">
                          {group.clientName}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-4 font-mono">
                        {formatSiren(group.siren)}
                      </p>
                    </div>
                    {group.lastUpdated && (
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {(() => {
                          try {
                            return formatDistanceToNow(parseISO(group.lastUpdated), { addSuffix: true, locale: fr });
                          } catch {
                            return "";
                          }
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 ml-4">
                    <Progress value={completude} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {group.totalDocs}/{group.requiredDocs}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderDetailPanel = () => {
    if (!selectedGroup) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sélectionnez un dossier SIREN</p>
          </div>
        </div>
      );
    }

    const completude = Math.min(100, Math.round((selectedGroup.totalDocs / selectedGroup.requiredDocs) * 100));

    return (
      <div className="flex flex-col h-full animate-step-in">
        {/* Detail header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground truncate">{selectedGroup.clientName}</h2>
              <Badge variant={completude >= 100 ? "default" : "secondary"} className="shrink-0">
                {completude}% complet
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{formatSiren(selectedGroup.siren)}</p>
          </div>
          {selectedGroup.clientRef && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => navigate(`/client/${selectedGroup.clientRef}`)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Voir fiche
            </Button>
          )}
        </div>

        {/* Category tabs */}
        <div className="px-4 pt-3 pb-2 flex gap-1.5 overflow-x-auto border-b border-border/30">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                activeCategory === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Documents table */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {selectedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun document</p>
              <p className="text-xs mt-1">Importez les pièces KYC requises</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleImportClick}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Importer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    Document <SortIcon col="name" />
                  </TableHead>
                  <TableHead className="text-muted-foreground">Catégorie</TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => handleSort("file_size")}
                  >
                    Taille <SortIcon col="file_size" />
                  </TableHead>
                  <TableHead className="text-muted-foreground">Expiration</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedFiles.map((file) => {
                  const cat = guessCategoryFromName(file.name);
                  const catLabel = CATEGORIES.find(c => c.value === cat)?.label || cat;
                  // Try to find expiration from documents table
                  const matchDoc = documents.find(d =>
                    d.name.toLowerCase() === file.name.toLowerCase() ||
                    d.file_path.includes(file.name)
                  );
                  const expStatus = matchDoc ? getExpirationStatus(matchDoc.expiration_date) : null;

                  return (
                    <TableRow key={file.name} className="border-border/20 group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.name)}
                          <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {catLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {file.metadata?.size ? formatFileSize(file.metadata.size) : "—"}
                      </TableCell>
                      <TableCell>
                        {expStatus ? (
                          <Badge variant={expStatus.variant} className={`text-xs ${expStatus.daysLeft < 0 ? "animate-pulse" : ""}`}>
                            {expStatus.label}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-blue-400"
                                onClick={() => previewStorageFile(selectedGroup.siren, file.name)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Prévisualiser</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-emerald-400"
                                onClick={() => downloadStorageFile(selectedGroup.siren, file.name)}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Télécharger</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                onClick={() => {
                                  if (matchDoc) setDeleteTarget(matchDoc);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Compact drop zone — hidden on mobile */}
        <div className="hidden lg:block px-4 pb-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleImportClick}
            className={`border border-dashed rounded-lg py-3 px-4 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-primary/20 hover:border-primary/50"
            }`}
          >
            <p className="text-xs text-muted-foreground">
              <Upload className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Glisser vos documents ici — PDF, JPG, PNG, DOCX (max 10 Mo)
            </p>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────── RENDER ─────────── */

  return (
    <div className="animate-page-in flex flex-col h-[calc(100vh-4rem)]">
      {/* ═══ Sticky Header ═══ */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {sirenGroups.length} dossier{sirenGroups.length > 1 ? "s" : ""} • {kpis.totalDocs} doc{kpis.totalDocs > 1 ? "s" : ""}{kpis.expired > 0 ? ` • ${kpis.expired} alerte${kpis.expired > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <Button onClick={handleImportClick}>
            <Plus className="w-4 h-4 mr-1.5" />
            Importer
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
          />
        </div>

        {/* ═══ KPI Cards ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 animate-stagger-in">
          <div className="glass-card p-3 kpi-glow-blue">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Total documents</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis.totalDocs}</p>
          </div>
          <div className="glass-card p-3 kpi-glow-amber">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Expirant &lt;30j</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis.expiringSoon}</p>
          </div>
          <div className="glass-card p-3 kpi-glow-red">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-muted-foreground">Expirés</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis.expired}</p>
          </div>
          <div className="glass-card p-3 kpi-glow-green">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Complétude KYC</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis.avgCompletude}%</p>
          </div>
        </div>
      </div>

      {/* ═══ Master-Detail Layout ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — SIREN list (desktop) */}
        <div className="hidden lg:flex lg:flex-col w-[320px] border-r border-border/50 bg-background">
          {renderSirenPanel()}
        </div>

        {/* Left panel — SIREN list (mobile: full width) */}
        <div className="flex flex-col flex-1 lg:hidden">
          {!mobileDetailOpen ? (
            renderSirenPanel()
          ) : (
            <div className="flex flex-col h-full">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-primary border-b border-border/50"
              >
                <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                Retour aux dossiers
              </button>
              {renderDetailPanel()}
            </div>
          )}
        </div>

        {/* Right panel — Detail (desktop) */}
        <div className="hidden lg:flex lg:flex-col flex-1 bg-background">
          {renderDetailPanel()}
        </div>
      </div>

      {/* ═══ Dialogs ═══ */}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>Importer {pendingFiles.length} document(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {pendingFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  {getFileIcon(file.name)}
                  <span className="truncate text-foreground">{file.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Référence client (optionnel)</Label>
              <Input
                placeholder="ex: CLI-001"
                value={uploadClientRef}
                onChange={(e) => setUploadClientRef(e.target.value)}
              />
            </div>

            {EXPIRABLE_CATEGORIES.includes(uploadCategory) && (
              <div className="space-y-2">
                <Label>Date d'expiration</Label>
                <Input
                  type="date"
                  value={uploadExpiration}
                  onChange={(e) => setUploadExpiration(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Vous recevrez des alertes avant l'expiration du document
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Annuler</Button>
            <Button onClick={uploadFiles} disabled={uploading}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</> : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-lg bg-background border-border">
          <DialogHeader>
            <DialogTitle>Historique des versions — {selectedDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 text-sm">
                  <Badge variant="outline">v{v.version_number}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">
                      {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </p>
                    {v.comment && <p className="text-xs text-muted-foreground mt-0.5">{v.comment}</p>}
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(v.file_size || 0)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-blue-400"
                    onClick={() => downloadDocument(v.file_path, `v${v.version_number}_${selectedDoc?.name}`)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Ajouter une nouvelle version</p>
              <Input
                type="file"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              />
              <Input
                placeholder="Commentaire (optionnel)"
                value={versionComment}
                onChange={(e) => setVersionComment(e.target.value)}
              />
              <Button onClick={uploadNewVersion} disabled={!newVersionFile || uploading} className="w-full">
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Créer la version {(selectedDoc?.current_version || 0) + 1}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer le document "{deleteTarget?.name}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDeleteDocument}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm duplicate */}
      <Dialog open={!!duplicateConfirm} onOpenChange={(open) => { if (!open) setDuplicateConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Documents en doublon</DialogTitle>
            <DialogDescription>
              Les documents suivants existent déjà : {duplicateConfirm?.names}. Voulez-vous les importer quand même ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDuplicateConfirm(null)}>Annuler</Button>
            <Button onClick={() => duplicateConfirm?.proceed()}>Importer quand même</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
