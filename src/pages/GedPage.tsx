import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Upload, FileText, Trash2, Download, Clock, AlertTriangle,
  Search, FolderOpen, History, Eye, Plus, X, File,
  ChevronRight, ChevronDown, Building2, FileImage, FileCode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

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

interface SirenFolder {
  siren: string;
  files: StorageFile[];
  expanded: boolean;
}

const CATEGORIES = [
  { value: "cni", label: "CNI / Passeport" },
  { value: "kbis", label: "Kbis" },
  { value: "rib", label: "RIB" },
  { value: "contrat", label: "Lettre de mission" },
  { value: "facture", label: "Facture" },
  { value: "attestation", label: "Attestation" },
  { value: "autre", label: "Autre" },
];

const EXPIRABLE_CATEGORIES = ["cni", "kbis"];

function getExpirationStatus(expirationDate: string | null): { label: string; variant: "default" | "destructive" | "secondary" | "outline"; daysLeft: number } | null {
  if (!expirationDate) return null;
  const days = differenceInDays(parseISO(expirationDate), new Date());
  if (days < 0) return { label: `Expire depuis ${Math.abs(days)}j`, variant: "destructive", daysLeft: days };
  if (days <= 30) return { label: `Expire dans ${days}j`, variant: "destructive", daysLeft: days };
  if (days <= 90) return { label: `Expire dans ${days}j`, variant: "secondary", daysLeft: days };
  return { label: `Valide (${days}j)`, variant: "outline", daysLeft: days };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
  if (ext === "html" || ext === "htm") return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (ext === "txt") return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  return <File className="w-4 h-4 text-slate-500 shrink-0" />;
}

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export default function GedPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterExpiration, setFilterExpiration] = useState<string>("all");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("autre");
  const [uploadClientRef, setUploadClientRef] = useState("");
  const [uploadExpiration, setUploadExpiration] = useState("");

  // Version dialog
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [versionComment, setVersionComment] = useState("");

  // Storage browser state
  const [storageFolders, setStorageFolders] = useState<SirenFolder[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageSearch, setStorageSearch] = useState("");

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        toast.error("Erreur chargement documents");
        console.error(error);
      } else {
        setDocuments((data as Document[]) || []);
      }
    } catch (err) {
      console.error("[GED] fetchDocuments error:", err);
      toast.error("Erreur chargement documents");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStorageFiles = useCallback(async () => {
    setStorageLoading(true);
    try {
      // List top-level folders (SIRENs)
      const { data: folders, error: folderError } = await supabase.storage
        .from("kyc-documents")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (folderError) {
        console.error("Storage list error:", folderError);
        setStorageLoading(false);
        return;
      }

      if (!folders || folders.length === 0) {
        setStorageFolders([]);
        setStorageLoading(false);
        return;
      }

      // For each folder (SIREN), list its files
      const sirenFolders: SirenFolder[] = [];
      for (const folder of folders) {
        // Skip non-folder entries (files at root level)
        if (folder.id) {
          // This is a file, not a folder — treat root files separately
          continue;
        }

        const { data: files } = await supabase.storage
          .from("kyc-documents")
          .list(folder.name, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

        if (files && files.length > 0) {
          sirenFolders.push({
            siren: folder.name,
            files: files as StorageFile[],
            expanded: false,
          });
        }
      }

      setStorageFolders(sirenFolders);
    } catch (err) {
      console.error("Error fetching storage:", err);
    }
    setStorageLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchStorageFiles();
  }, [fetchDocuments, fetchStorageFiles]);

  const toggleFolder = (siren: string) => {
    setStorageFolders((prev) =>
      prev.map((f) =>
        f.siren === siren ? { ...f, expanded: !f.expanded } : f
      )
    );
  };

  const downloadStorageFile = async (siren: string, fileName: string) => {
    const filePath = `${siren}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .download(filePath);

    if (error) {
      toast.error("Erreur telechargement");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStorageFolders = storageFolders
    .map((folder) => {
      if (!storageSearch) return folder;
      const searchLower = storageSearch.toLowerCase();
      const sirenMatch = folder.siren.toLowerCase().includes(searchLower);
      const matchingFiles = folder.files.filter((f) =>
        f.name.toLowerCase().includes(searchLower)
      );
      if (sirenMatch) return { ...folder, expanded: true };
      if (matchingFiles.length > 0)
        return { ...folder, files: matchingFiles, expanded: true };
      return null;
    })
    .filter(Boolean) as SirenFolder[];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingFiles(files);
      const name = files[0].name.toLowerCase();
      if (name.includes("cni") || name.includes("passeport") || name.includes("identite")) {
        setUploadCategory("cni");
      } else if (name.includes("kbis")) {
        setUploadCategory("kbis");
      } else if (name.includes("rib")) {
        setUploadCategory("rib");
      } else if (name.includes("mission") || name.includes("contrat")) {
        setUploadCategory("contrat");
      }
      setUploadDialogOpen(true);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(files);
      setUploadDialogOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  const MAX_FILE_COUNT = 10;
  const ALLOWED_MIME_TYPES = [
    "application/pdf", "image/png", "image/jpeg", "image/jpg",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const uploadFiles = async () => {
    if (pendingFiles.length === 0) return;

    if (pendingFiles.length > MAX_FILE_COUNT) {
      toast.error(`Maximum ${MAX_FILE_COUNT} fichiers a la fois`);
      return;
    }

    for (const file of pendingFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" depasse la limite de 20 Mo`);
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`Type de fichier non autorise: ${file.type || "inconnu"}`);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez etre connecte");
      return;
    }

    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const timestamp = Date.now();
        const filePath = `${user.id}/${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: docData, error: docError } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
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
          .maybeSingle();

        if (docError) throw docError;

        await supabase.from("document_versions").insert({
          document_id: docData.id,
          version_number: 1,
          file_path: filePath,
          file_size: file.size,
          uploaded_by: user.id,
          comment: "Version initiale",
        });
      }

      toast.success(`${pendingFiles.length} document(s) importe(s)`);
      setUploadDialogOpen(false);
      setPendingFiles([]);
      setUploadCategory("autre");
      setUploadClientRef("");
      setUploadExpiration("");
      fetchDocuments();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erreur lors de l'import"));
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc: Document) => {
    if (deleting) return;
    setDeleting(doc.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.storage.from("documents").remove([doc.file_path]);
      const { data: versionData } = await supabase
        .from("document_versions")
        .select("file_path")
        .eq("document_id", doc.id);
      if (versionData) {
        const paths = versionData.map((v: { file_path: string }) => v.file_path).filter((p: string) => p !== doc.file_path);
        if (paths.length > 0) await supabase.storage.from("documents").remove(paths);
      }

      await supabase.from("documents").delete().eq("id", doc.id);
      toast.success("Document supprime");
      fetchDocuments();
    } catch (err) {
      console.error("[GED] Delete error:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (error) {
        toast.error("Erreur telechargement");
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[GED] Download error:", err);
      toast.error("Erreur telechargement");
    }
  };

  const openVersionDialog = async (doc: Document) => {
    try {
      setSelectedDoc(doc);
      const { data } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", doc.id)
        .order("version_number", { ascending: false });
      setVersions((data as DocumentVersion[]) || []);
      setVersionDialogOpen(true);
    } catch (err) {
      console.error("[GED] Version dialog error:", err);
      toast.error("Erreur chargement des versions");
    }
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

      toast.success(`Version ${newVersion} importee`);
      setNewVersionFile(null);
      setVersionComment("");
      setVersionDialogOpen(false);
      fetchDocuments();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erreur lors de la mise a jour"));
    } finally {
      setUploading(false);
    }
  };

  // Filtered documents
  const filtered = documents.filter((doc) => {
    const matchSearch =
      !searchTerm ||
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.client_ref && doc.client_ref.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategory = filterCategory === "all" || doc.category === filterCategory;
    const matchExpiration = (() => {
      if (filterExpiration === "all") return true;
      if (filterExpiration === "expired") {
        const status = getExpirationStatus(doc.expiration_date);
        return status && status.daysLeft < 0;
      }
      if (filterExpiration === "soon") {
        const status = getExpirationStatus(doc.expiration_date);
        return status && status.daysLeft >= 0 && status.daysLeft <= 90;
      }
      return true;
    })();
    return matchSearch && matchCategory && matchExpiration;
  });

  // Expiration alerts
  const expiringDocs = documents.filter((doc) => {
    const status = getExpirationStatus(doc.expiration_date);
    return status && status.daysLeft <= 90;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">GED Intelligente</h1>
        <p className="text-sm text-slate-400 mt-1">
          Gestion electronique des documents — Upload, versionning et alertes d'expiration
        </p>
      </div>

      {/* Expiration Alerts */}
      {expiringDocs.length > 0 && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm text-red-300">Alertes expiration documents</p>
              <div className="mt-2 space-y-1">
                {expiringDocs.map((doc) => {
                  const status = getExpirationStatus(doc.expiration_date);
                  return (
                    <div key={doc.id} className="flex items-center gap-2 text-sm">
                      <Badge variant={status?.variant}>{status?.label}</Badge>
                      <span className="font-medium text-slate-200">{doc.name}</span>
                      {doc.client_ref && (
                        <span className="text-slate-400">({doc.client_ref})</span>
                      )}
                      <span className="text-slate-500">
                        - {CATEGORIES.find((c) => c.value === doc.category)?.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Supabase Storage Browser — kyc-documents bucket              */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Documents KYC par SIREN</h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Rechercher SIREN ou fichier..."
              value={storageSearch}
              onChange={(e) => setStorageSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500"
            />
          </div>
        </div>

        {storageLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent" />
            <span className="ml-3 text-sm text-slate-400">Chargement du stockage...</span>
          </div>
        ) : filteredStorageFolders.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun dossier SIREN trouve dans le bucket kyc-documents.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredStorageFolders.map((folder) => (
              <div key={folder.siren}>
                {/* Folder row */}
                <button
                  onClick={() => toggleFolder(folder.siren)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                >
                  {folder.expanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span className="font-mono text-sm font-medium text-slate-200">
                    {folder.siren}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">
                    {folder.files.length} fichier{folder.files.length > 1 ? "s" : ""}
                  </span>
                </button>

                {/* Expanded file list */}
                {folder.expanded && (
                  <div className="ml-6 pl-4 border-l border-white/5 space-y-0.5 mb-2">
                    {folder.files.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        {getFileIcon(file.name)}
                        <span className="text-sm text-slate-300 truncate flex-1">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {file.metadata?.size
                            ? formatFileSize(file.metadata.size)
                            : "—"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => downloadStorageFile(folder.siren, file.name)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Telecharger
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Drop zone                                                    */}
      {/* ============================================================ */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-blue-500 bg-blue-500/10"
            : "border-white/10 hover:border-blue-500/40 hover:bg-white/[0.02]"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-slate-500 mb-3" />
        <p className="font-medium text-slate-300">
          Glissez-deposez vos documents ici
        </p>
        <p className="text-sm text-slate-500 mt-1">
          ou cliquez pour selectionner des fichiers (PDF, images, documents)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
        />
      </div>

      {/* ============================================================ */}
      {/* Filters                                                      */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par nom ou ref client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-slate-200">
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterExpiration} onValueChange={setFilterExpiration}>
          <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-slate-200">
            <SelectValue placeholder="Expiration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="expired">Expires</SelectItem>
            <SelectItem value="soon">Expire bientot (&lt;90j)</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-slate-400">
          {filtered.length} document(s)
        </div>
      </div>

      {/* ============================================================ */}
      {/* Documents table                                              */}
      {/* ============================================================ */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-slate-400">Document</TableHead>
              <TableHead className="text-slate-400">Categorie</TableHead>
              <TableHead className="text-slate-400">Client</TableHead>
              <TableHead className="text-slate-400">Taille</TableHead>
              <TableHead className="text-slate-400">Version</TableHead>
              <TableHead className="text-slate-400">Expiration</TableHead>
              <TableHead className="text-slate-400">Modifie le</TableHead>
              <TableHead className="text-right text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-white/5 hover:bg-white/[0.02]">
                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {documents.length === 0
                    ? "Aucun document. Importez vos premiers fichiers ci-dessus."
                    : "Aucun document ne correspond aux filtres."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((doc) => {
                const expStatus = getExpirationStatus(doc.expiration_date);
                return (
                  <TableRow key={doc.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.name)}
                        <span className="font-medium text-sm text-slate-200 truncate max-w-[200px]">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-white/10 text-slate-300">
                        {CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">{doc.client_ref || "-"}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatFileSize(doc.file_size || 0)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openVersionDialog(doc)}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        v{doc.current_version}
                      </button>
                    </TableCell>
                    <TableCell>
                      {expStatus ? (
                        <Badge variant={expStatus.variant} className="text-xs">
                          {expStatus.label}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-600">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(parseISO(doc.updated_at), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                          onClick={() => downloadDocument(doc.file_path, doc.name)}
                          title="Telecharger"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                          onClick={() => openVersionDialog(doc)}
                          title="Versions"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => deleteDocument(doc)}
                          disabled={deleting === doc.id}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Importer {pendingFiles.length} document(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg p-2.5 border border-white/5">
                  {getFileIcon(file.name)}
                  <span className="truncate text-slate-200">{file.name}</span>
                  <span className="text-slate-500 ml-auto shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Categorie</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Reference client (optionnel)</Label>
              <Input
                placeholder="ex: CLI-001"
                value={uploadClientRef}
                onChange={(e) => setUploadClientRef(e.target.value)}
                className="bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            {EXPIRABLE_CATEGORIES.includes(uploadCategory) && (
              <div className="space-y-2">
                <Label className="text-slate-300">Date d'expiration</Label>
                <Input
                  type="date"
                  value={uploadExpiration}
                  onChange={(e) => setUploadExpiration(e.target.value)}
                  className="bg-white/5 border-white/10 text-slate-200"
                />
                <p className="text-xs text-slate-500">
                  Vous recevrez des alertes avant l'expiration du document
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5">
              Annuler
            </Button>
            <Button onClick={uploadFiles} disabled={uploading}>
              {uploading ? "Import en cours..." : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Historique des versions — {selectedDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] text-sm"
                >
                  <Badge variant="outline" className="border-white/10 text-slate-300">v{v.version_number}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-400">
                      {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </p>
                    {v.comment && <p className="text-xs text-slate-500 mt-0.5">{v.comment}</p>}
                  </div>
                  <span className="text-slate-500 text-xs shrink-0">
                    {formatFileSize(v.file_size || 0)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                    onClick={() => downloadDocument(v.file_path, `v${v.version_number}_${selectedDoc?.name}`)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <p className="text-sm font-medium text-slate-300">Ajouter une nouvelle version</p>
              <Input
                type="file"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                className="bg-white/5 border-white/10 text-slate-200 file:text-slate-400"
              />
              <Input
                placeholder="Commentaire (optionnel)"
                value={versionComment}
                onChange={(e) => setVersionComment(e.target.value)}
                className="bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500"
              />
              <Button
                onClick={uploadNewVersion}
                disabled={!newVersionFile || uploading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                {uploading ? "Import..." : `Creer la version ${(selectedDoc?.current_version || 0) + 1}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
