import { useState, useCallback, useRef, useMemo } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Upload, FileText, Trash2, Download, Loader2,
  Search, FolderOpen, Plus, ChevronUp,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAppState } from "@/lib/AppContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { logger } from "@/lib/logger";
import { useNavigate } from "react-router-dom";
import { useGED } from "@/hooks/useGED";
import {
  GEDKpiCards,
  SirenListItem,
  DocumentRow,
  DocumentPreviewPanel,
  CompactDropZone,
  CategoryFilter,
} from "@/components/ged";
import GEDCommandPalette from "@/components/ged/GEDCommandPalette";
import type { GEDDocument } from "@/services/gedService";
import { getSignedUrl } from "@/services/gedService";

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

const CATEGORY_TABS = ["Tous", "KBis", "CNI", "Justificatif", "RIB", "Contrat", "Autre"];

const EXPIRABLE_CATEGORIES = ["cni", "kbis"];

/* ─────────── Helpers ─────────── */

function guessCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("cni") || lower.includes("passeport") || lower.includes("identite")) return "cni";
  if (lower.includes("kbis")) return "kbis";
  if (lower.includes("rib")) return "rib";
  if (lower.includes("mission") || lower.includes("contrat")) return "contrat";
  if (lower.includes("justificatif") || lower.includes("domicile")) return "justificatif";
  return "autre";
}

function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes < 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

type StatusFilter = "all" | "complete" | "incomplete" | "alert";

/* ─────────── Component ─────────── */

export default function GedPage() {
  const { profile } = useAuth();
  const { clients } = useAppState();
  const navigate = useNavigate();
  useDocumentTitle("Documents");

  const cabinetId = profile?.cabinet_id || "";

  const {
    folders,
    filteredFolders,
    selectedSiren,
    filteredDocuments,
    stats,
    loading,
    uploading: hookUploading,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    statusFilter,
    setStatusFilter,
    handleSelectSiren,
    handleUpload,
    handleDelete,
    refreshFolders,
  } = useGED(cabinetId);

  // Local UI state
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<GEDDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("autre");
  const [uploadExpiration, setUploadExpiration] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<GEDDocument | null>(null);

  // All documents across all folders for command palette search
  const allDocuments = useMemo(() => {
    return folders.flatMap((f) => f.documents);
  }, [folders]);

  const selectedFolder = folders.find((f) => f.client_ref === selectedSiren) || null;

  /* ─── Adapt GEDDocument to component types ─── */

  const toComponentDoc = useCallback(
    (doc: GEDDocument) => ({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      size: doc.file_size,
      version: doc.current_version,
      expiration: doc.expiration_date,
      url: "", // resolved lazily via signed URL
      created_at: doc.created_at,
      siren: doc.siren || "",
    }),
    [],
  );

  /* ─── Actions ─── */

  const handlePreview = useCallback(async (doc: GEDDocument) => {
    try {
      const url = await getSignedUrl(doc.file_path);
      setPreviewDoc({ ...doc });
      setPreviewOpen(true);
      // For the preview panel, we need the URL
      setPreviewDoc((prev) => (prev ? { ...prev, _signedUrl: url } as GEDDocument & { _signedUrl: string } : null));
    } catch {
      toast.error("Erreur de prévisualisation");
    }
  }, []);

  const handleDownload = useCallback(async (doc: GEDDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (error || !data) {
        toast.error("Erreur téléchargement");
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("Erreur téléchargement");
    }
  }, []);

  const handleDeleteDoc = useCallback((doc: GEDDocument) => {
    setDeleteTarget(doc);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedDocIds((prev) => prev.filter((id) => id !== deleteTarget.id));
  }, [deleteTarget, handleDelete]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(files);
      setUploadCategory(guessCategoryFromName(files[0].name));
      setUploadDialogOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDropFiles = useCallback((files: File[]) => {
    if (files.length > 0) {
      setPendingFiles(files);
      setUploadCategory(guessCategoryFromName(files[0].name));
      setUploadDialogOpen(true);
    }
  }, []);

  const uploadFiles = async () => {
    if (pendingFiles.length === 0 || !selectedSiren) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        await handleUpload(file, uploadCategory);
      }
      setUploadDialogOpen(false);
      setPendingFiles([]);
      setUploadCategory("autre");
      setUploadExpiration("");
    } catch {
      // errors handled in hook
    } finally {
      setUploading(false);
    }
  };

  const handleSelectSirenFromPalette = useCallback(
    (clientRef: string) => {
      handleSelectSiren(clientRef);
      setMobileDetailOpen(true);
      setSelectedDocIds([]);
    },
    [handleSelectSiren],
  );

  const handlePreviewFromPalette = useCallback(
    (doc: GEDDocument) => {
      // Select the folder first, then preview
      if (doc.client_name) {
        const folder = folders.find((f) => f.documents.some((d) => d.id === doc.id));
        if (folder) handleSelectSiren(folder.client_ref);
      }
      handlePreview(doc);
    },
    [folders, handleSelectSiren, handlePreview],
  );

  /* ─── Multi-selection ─── */

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedDocIds.length === filteredDocuments.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocuments.map((d) => d.id));
    }
  }, [selectedDocIds, filteredDocuments]);

  const handleBulkDownload = useCallback(async () => {
    const docs = filteredDocuments.filter((d) => selectedDocIds.includes(d.id));
    for (const doc of docs) {
      await handleDownload(doc);
    }
  }, [filteredDocuments, selectedDocIds, handleDownload]);

  const handleBulkDelete = useCallback(async () => {
    const count = selectedDocIds.length;
    if (!window.confirm(`Supprimer ${count} document${count > 1 ? "s" : ""} ?`)) return;
    for (const id of selectedDocIds) {
      await handleDelete(id);
    }
    setSelectedDocIds([]);
  }, [selectedDocIds, handleDelete]);

  /* ─── Skeleton renderers ─── */

  const renderSkeletonKpi = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
      ))}
    </div>
  );

  const renderSkeletonSirenList = () => (
    <div className="p-3 space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 w-full skeleton-shimmer rounded-lg" />
      ))}
    </div>
  );

  const renderSkeletonTable = () => (
    <div className="p-4 space-y-2">
      <div className="h-8 w-full skeleton-shimmer rounded" />
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-10 w-full skeleton-shimmer rounded" />
      ))}
    </div>
  );

  /* ─── Siren panel ─── */

  const statusFilterMap: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "complete", label: "Complets" },
    { value: "incomplete", label: "Incomplets" },
    { value: "alert", label: "Alertes" },
  ];

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
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {statusFilterMap.map((pill) => (
            <button
              key={pill.value}
              onClick={() => setStatusFilter(pill.value)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                statusFilter === pill.value
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
        {loading ? (
          renderSkeletonSirenList()
        ) : filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun dossier client</p>
            <p className="text-xs mt-1">Les documents KYC apparaitront ici</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate("/clients/nouveau")}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Creer un client
            </Button>
          </div>
        ) : (
          <div className="py-1">
            {filteredFolders.map((folder) => (
              <SirenListItem
                key={folder.client_ref}
                siren={folder.siren}
                clientName={folder.client_name}
                docCount={folder.total_docs}
                requiredDocs={folder.required_docs}
                lastUpdate={folder.last_update}
                hasExpired={folder.has_expired}
                isSelected={selectedSiren === folder.client_ref}
                onClick={() => {
                  handleSelectSiren(folder.client_ref);
                  setMobileDetailOpen(true);
                  setSelectedDocIds([]);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <div className="p-2 border-t border-border/30 text-center">
        <span className="text-xs text-muted-foreground">
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}K pour rechercher
        </span>
      </div>
    </div>
  );

  /* ─── Detail panel ─── */

  const renderDetailPanel = () => {
    if (loading) return renderSkeletonTable();

    if (!selectedFolder) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selectionnez un dossier client dans la liste</p>
          </div>
        </div>
      );
    }

    const completion = Math.min(
      100,
      Math.round((selectedFolder.total_docs / selectedFolder.required_docs) * 100),
    );

    return (
      <div className="flex flex-col h-full animate-step-in">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {selectedFolder.client_name}
              </h2>
              <Badge variant={completion >= 100 ? "default" : "secondary"} className="shrink-0">
                {completion}% complet
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {selectedFolder.siren}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleImportClick}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Importer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajouter des documents a ce dossier</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/client/${selectedFolder.client_ref}`)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Voir fiche
            </Button>
          </div>
        </div>

        {/* Category filter */}
        <div className="px-4 pt-3 pb-2 border-b border-border/30">
          <CategoryFilter
            categories={CATEGORY_TABS}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* Documents table */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Upload className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun document</p>
              <p className="text-xs mt-1">
                Importez les pieces KYC pour {selectedFolder.client_name}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleImportClick}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Importer
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30 text-left">
                  <th className="py-2 px-3 w-8">
                    <Checkbox
                      checked={
                        selectedDocIds.length === filteredDocuments.length &&
                        filteredDocuments.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Document</th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Categorie</th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Taille</th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Version</th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Expiration</th>
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={toComponentDoc(doc)}
                    onPreview={() => handlePreview(doc)}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => handleDeleteDoc(doc)}
                    prefixCell={
                      <Checkbox
                        checked={selectedDocIds.includes(doc.id)}
                        onCheckedChange={() => toggleDocSelection(doc.id)}
                      />
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Compact drop zone */}
        <div className="hidden lg:block px-4 pb-4">
          <CompactDropZone
            onFilesSelected={handleDropFiles}
            sirenContext={selectedFolder.client_name}
          />
        </div>
      </div>
    );
  };

  /* ─────────── RENDER ─────────── */

  return (
    <div className="animate-page-in flex flex-col h-[calc(100vh-4rem)]">
      {/* Command Palette */}
      <GEDCommandPalette
        folders={folders}
        documents={allDocuments}
        onSelectSiren={handleSelectSirenFromPalette}
        onSelectDocument={handlePreviewFromPalette}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {folders.length} dossier{folders.length > 1 ? "s" : ""} •{" "}
              {stats?.total_documents || 0} doc{(stats?.total_documents || 0) > 1 ? "s" : ""}
              {(stats?.expired || 0) > 0
                ? ` • ${stats!.expired} alerte${stats!.expired > 1 ? "s" : ""}`
                : ""}
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

        {/* KPI Cards */}
        <div className="mt-4">
          {loading ? (
            renderSkeletonKpi()
          ) : stats ? (
            <GEDKpiCards
              totalDocs={stats.total_documents}
              expiringCount={stats.expiring_soon}
              expiredCount={stats.expired}
              completionRate={stats.avg_completion}
            />
          ) : null}
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — SIREN list (desktop) */}
        <div className="hidden lg:flex lg:flex-col w-[320px] border-r border-border/50 bg-background">
          {renderSirenPanel()}
        </div>

        {/* Left panel — SIREN list (mobile) */}
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

      {/* Multi-selection action bar */}
      {selectedDocIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-card border shadow-lg rounded-xl px-6 py-3 flex items-center gap-4 animate-fade-in-up z-20">
          <span className="text-sm font-medium">
            {selectedDocIds.length} document{selectedDocIds.length > 1 ? "s" : ""} selectionne
            {selectedDocIds.length > 1 ? "s" : ""}
          </span>
          <Button variant="outline" size="sm" onClick={handleBulkDownload}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Telecharger
          </Button>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Supprimer
          </Button>
        </div>
      )}

      {/* Preview Panel */}
      <DocumentPreviewPanel
        doc={
          previewDoc
            ? {
                id: previewDoc.id,
                name: previewDoc.name,
                category: previewDoc.category,
                size: previewDoc.file_size,
                version: previewDoc.current_version,
                expiration: previewDoc.expiration_date,
                url: (previewDoc as unknown as Record<string, string>)?._signedUrl || "",
                created_at: previewDoc.created_at,
                siren: previewDoc.siren || "",
                uploaded_by: undefined,
              }
            : null
        }
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewDoc(null);
        }}
        onDownload={previewDoc ? () => handleDownload(previewDoc) : undefined}
        onDelete={
          previewDoc
            ? () => {
                handleDeleteDoc(previewDoc);
                setPreviewOpen(false);
                setPreviewDoc(null);
              }
            : undefined
        }
      />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>Importer {pendingFiles.length} document(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {pendingFiles.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5 border border-border/50"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground">{file.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={uploadFiles} disabled={uploading || hookUploading}>
              {uploading || hookUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...
                </>
              ) : (
                "Importer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer "{deleteTarget?.name}" ? Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
