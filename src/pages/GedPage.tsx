import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload, FileText, Trash2, Download, Loader2,
  Search, FolderOpen, Plus, ChevronUp, ChevronDown,
  ExternalLink, Package, Users, Bell, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGED } from "@/hooks/useGED";
import {
  GEDKpiCards,
  SirenListItem,
  DocumentRow,
  DocumentPreviewPanel,
  CompactDropZone,
  CategoryFilter,
  KycChecklist,
  ValidationWorkflow,
  UploadDialog,
  AuditTrail,
  ClientLinks,
  ConformityReport,
} from "@/components/ged";
import type { UploadConfig } from "@/components/ged";
import GEDCommandPalette from "@/components/ged/GEDCommandPalette";
import type { GEDDocument } from "@/services/gedService";
import { getSignedUrl } from "@/services/gedService";
import { exportSirenDossier } from "@/services/gedExportService";
import { compressImage } from "@/lib/gedUtils";

/* ─────────── Constants ─────────── */

const CATEGORY_TABS = ["Tous", "KBis", "CNI", "Justificatif", "RIB", "Contrat", "Autre"];

const TAG_SUGGESTIONS = ["urgent", "à vérifier", "validé EC", "en attente client"];

/* ─────────── Component ─────────── */

export default function GedPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Documents");

  const [searchParams] = useSearchParams();
  const preselectedRef = searchParams.get('client_ref') || searchParams.get('client') || '';
  const preselectedSiren = searchParams.get('siren') || '';

  const cabinetId = profile?.cabinet_id || "";
  const userName = profile?.full_name || profile?.email || "";

  const {
    folders,
    filteredFolders,
    selectedSiren,
    filteredDocuments,
    documents,
    stats,
    loading,
    uploading: hookUploading,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    statusFilter,
    setStatusFilter,
    handleSelectSiren,
    handleUpload,
    handleDelete,
    refreshFolders,
    auditEntries,
    auditLoading,
    refreshAuditLog,
    fireAudit,
  } = useGED(cabinetId, preselectedRef || preselectedSiren || undefined);

  // Local UI state
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<GEDDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<GEDDocument | null>(null);

  // Right panel tab: "documents" | "checklist" | "historique"
  const [rightTab, setRightTab] = useState<"documents" | "checklist" | "historique">("documents");

  // KYC checklist collapsible
  const [checklistOpen, setChecklistOpen] = useState(true);

  // Tags & Notes for preview doc
  const [docTags, setDocTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exporting ZIP
  const [exporting, setExporting] = useState(false);

  // All documents across all folders for command palette search
  const allDocuments = useMemo(() => folders.flatMap((f) => f.documents), [folders]);

  const selectedFolder = folders.find((f) => f.client_ref === selectedSiren) || null;

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const segments: { label: string; onClick?: () => void }[] = [
      { label: "Documents", onClick: () => { setPreviewOpen(false); setPreviewDoc(null); } },
    ];
    if (selectedFolder) {
      segments.push({
        label: `${selectedFolder.client_name} (${selectedFolder.siren})`,
        onClick: () => { setPreviewOpen(false); setPreviewDoc(null); },
      });
    }
    if (previewDoc && previewOpen) {
      segments.push({ label: previewDoc.name });
    }
    return segments;
  }, [selectedFolder, previewDoc, previewOpen]);

  /* ─── Adapt GEDDocument to component types ─── */

  const toComponentDoc = useCallback(
    (doc: GEDDocument) => ({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      size: doc.file_size,
      version: doc.current_version,
      expiration: doc.expiration_date,
      url: "",
      created_at: doc.created_at,
      siren: doc.siren || "",
    }),
    [],
  );

  /* ─── Actions ─── */

  const handlePreview = useCallback(async (doc: GEDDocument) => {
    try {
      const url = await getSignedUrl(doc.file_path);
      setPreviewDoc(doc);
      setPreviewUrl(url);
      setPreviewOpen(true);
      // Load tags & notes
      setDocTags((doc as unknown as Record<string, unknown>).tags as string[] || []);
      setDocNotes((doc as unknown as Record<string, unknown>).notes as string || "");
      fireAudit("preview", doc.id, { document_name: doc.name });
    } catch {
      toast.error("Erreur de prévisualisation");
    }
  }, [fireAudit]);

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
      fireAudit("download", doc.id, { document_name: doc.name });
    } catch {
      toast.error("Erreur téléchargement");
    }
  }, [fireAudit]);

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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const processed = await Promise.all(files.map((f) => compressImage(f)));
      setPendingFiles(processed);
      setUploadDialogOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDropFiles = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const processed = await Promise.all(files.map((f) => compressImage(f)));
      setPendingFiles(processed);
      setUploadDialogOpen(true);
    }
  }, []);

  const handleUploadConfirm = useCallback(
    async (configs: UploadConfig[]) => {
      for (const config of configs) {
        await handleUpload(config.file, config.category);
      }
      setUploadDialogOpen(false);
      setPendingFiles([]);
    },
    [handleUpload],
  );

  const handleSelectSirenUI = useCallback(
    (clientRef: string) => {
      handleSelectSiren(clientRef);
      setMobileDetailOpen(true);
      setSelectedDocIds([]);
      setRightTab("documents");
    },
    [handleSelectSiren],
  );

  const handlePreviewFromPalette = useCallback(
    (doc: GEDDocument) => {
      const folder = folders.find((f) => f.documents.some((d) => d.id === doc.id));
      if (folder) handleSelectSiren(folder.client_ref);
      handlePreview(doc);
    },
    [folders, handleSelectSiren, handlePreview],
  );

  const handleRequestDocument = useCallback((cat: string) => {
    toast.info(`Demande de document "${cat}" envoyée au client`);
  }, []);

  const handleValidateDoc = useCallback(
    async (docId: string) => {
      try {
        await supabase
          .from("documents")
          .update({ validation_status: "validated" })
          .eq("id", docId);
        fireAudit("validate", docId, {
          document_name: documents.find((d) => d.id === docId)?.name,
        });
        refreshFolders();
        toast.success("Document validé");
      } catch {
        toast.error("Erreur de validation");
      }
    },
    [fireAudit, documents, refreshFolders],
  );

  const handleRejectDoc = useCallback(
    async (docId: string, reason: string) => {
      try {
        await supabase
          .from("documents")
          .update({ validation_status: reason ? "rejected" : "pending" })
          .eq("id", docId);
        fireAudit("reject", docId, {
          document_name: documents.find((d) => d.id === docId)?.name,
          reason,
        });
        refreshFolders();
        toast.success(reason ? "Document rejeté" : "Validation annulée");
      } catch {
        toast.error("Erreur");
      }
    },
    [fireAudit, documents, refreshFolders],
  );

  /* ─── Export ZIP ─── */
  const handleExportZip = useCallback(async () => {
    if (!selectedFolder) return;
    setExporting(true);
    try {
      await exportSirenDossier(
        selectedFolder.siren,
        selectedFolder.client_name,
        selectedFolder.documents,
        getSignedUrl,
      );
      toast.success("Dossier exporté");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }, [selectedFolder]);

  /* ─── Tags ─── */
  const addTag = useCallback(() => {
    if (!newTag.trim() || !previewDoc) return;
    const updated = [...docTags, newTag.trim()];
    setDocTags(updated);
    setNewTag("");
    supabase
      .from("documents")
      .update({ tags: updated })
      .eq("id", previewDoc.id)
      .then(() => {
        fireAudit("tag_change", previewDoc.id, {
          document_name: previewDoc.name,
          tags: updated,
        });
      });
  }, [newTag, docTags, previewDoc, fireAudit]);

  const removeTag = useCallback(
    (tag: string) => {
      if (!previewDoc) return;
      const updated = docTags.filter((t) => t !== tag);
      setDocTags(updated);
      supabase
        .from("documents")
        .update({ tags: updated })
        .eq("id", previewDoc.id)
        .then(() => {
          fireAudit("tag_change", previewDoc.id, {
            document_name: previewDoc.name,
            tags: updated,
          });
        });
    },
    [docTags, previewDoc, fireAudit],
  );

  /* ─── Notes (debounced save) ─── */
  const handleNotesChange = useCallback(
    (value: string) => {
      setDocNotes(value);
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
      if (!previewDoc) return;
      notesTimeoutRef.current = setTimeout(() => {
        supabase
          .from("documents")
          .update({ notes: value })
          .eq("id", previewDoc.id)
          .then(() => {});
      }, 500);
    },
    [previewDoc],
  );

  // Cleanup notes timeout
  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    };
  }, []);

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

  /* ─── Onboarding (zero-state) ─── */

  const renderOnboarding = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto py-16 animate-fade-in-up">
        <FolderOpen className="w-16 h-16 mx-auto mb-6 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Bienvenue dans votre GED
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Centralisez et gérez les documents KYC de vos clients en 3 étapes
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
            <Users className="w-8 h-8 text-primary" />
            <p className="text-xs text-muted-foreground text-center">Créez vos dossiers clients</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-xs text-muted-foreground text-center">Importez les pièces KYC</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
            <Bell className="w-8 h-8 text-primary" />
            <p className="text-xs text-muted-foreground text-center">
              Recevez les alertes d'expiration
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/nouveau-client")}>
            <Plus className="w-4 h-4 mr-1.5" />
            Créer mon premier client
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-1.5" />
            Importer des documents
          </Button>
        </div>
      </div>
    </div>
  );

  /* ─── Siren panel ─── */

  const statusFilterMap: { value: typeof statusFilter; label: string }[] = [
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
            <p className="text-xs mt-1">Les documents KYC apparaîtront ici</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate("/nouveau-client")}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Créer un client
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
                onClick={() => handleSelectSirenUI(folder.client_ref)}
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
            <p className="text-sm">Sélectionnez un dossier client dans la liste</p>
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
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
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
              {/* Client links */}
              <div className="mt-1.5">
                <ClientLinks siren={selectedFolder.siren} clientRef={selectedFolder.client_ref} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportZip}
                    disabled={exporting || selectedFolder.total_docs === 0}
                  >
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Package className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    ZIP
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter le dossier complet en ZIP</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Importer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/client/${selectedFolder.client_ref}`)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Fiche
              </Button>
            </div>
          </div>
        </div>

        {/* Sub-tabs: Documents | Checklist KYC | Historique */}
        <div className="flex border-b border-border/30">
          {(
            [
              { key: "documents", label: "Documents" },
              { key: "checklist", label: "Checklist KYC" },
              { key: "historique", label: "Historique" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRightTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                rightTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {rightTab === "documents" && renderDocumentsTab()}
          {rightTab === "checklist" && (
            <div className="p-4">
              <KycChecklist
                siren={selectedFolder.siren}
                vigilanceLevel="normale"
                existingCategories={documents.map((d) => d.category)}
                onRequestDocument={handleRequestDocument}
              />
            </div>
          )}
          {rightTab === "historique" && (
            <AuditTrail
              entries={auditEntries}
              loading={auditLoading}
              title={`Historique — ${selectedFolder.client_name}`}
            />
          )}
        </div>

        {/* Compact drop zone — only on documents tab */}
        {rightTab === "documents" && (
          <div className="hidden lg:block px-4 pb-4">
            <CompactDropZone
              onFilesSelected={handleDropFiles}
              sirenContext={selectedFolder.client_name}
            />
          </div>
        )}
      </div>
    );
  };

  /* ─── Documents tab content ─── */

  const renderDocumentsTab = () => {
    if (!selectedFolder) return null;

    // Collapsible KYC checklist at the top if incomplete
    const isIncomplete = selectedFolder.completion_rate < 100;

    return (
      <>
        {/* Inline collapsible KYC checklist */}
        {isIncomplete && (
          <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen} className="border-b border-border/30">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span>Checklist KYC ({selectedFolder.total_docs}/{selectedFolder.required_docs})</span>
              {checklistOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-3">
              <KycChecklist
                siren={selectedFolder.siren}
                vigilanceLevel="normale"
                existingCategories={documents.map((d) => d.category)}
                onRequestDocument={handleRequestDocument}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Category filter */}
        <div className="px-4 pt-3 pb-2">
          <CategoryFilter
            categories={CATEGORY_TABS}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* Documents table */}
        <div className="px-4 py-3">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Upload className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun document</p>
              <p className="text-xs mt-1">
                Importez les pièces KYC pour {selectedFolder.client_name}
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
                  <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Catégorie</th>
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
      </>
    );
  };

  /* ─── Preview panel with validation + tags + notes ─── */

  const renderPreviewContent = () => {
    if (!previewDoc) return null;

    const validationStatus =
      ((previewDoc as unknown as Record<string, unknown>).validation_status as string) || "pending";

    return (
      <DocumentPreviewPanel
        doc={{
          id: previewDoc.id,
          name: previewDoc.name,
          category: previewDoc.category,
          size: previewDoc.file_size,
          version: previewDoc.current_version,
          expiration: previewDoc.expiration_date,
          url: previewUrl,
          created_at: previewDoc.created_at,
          siren: previewDoc.siren || "",
          uploaded_by: undefined,
        }}
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewDoc(null);
        }}
        onDownload={() => handleDownload(previewDoc)}
        onDelete={() => {
          handleDeleteDoc(previewDoc);
          setPreviewOpen(false);
          setPreviewDoc(null);
        }}
      >
        {/* Validation workflow */}
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Validation
          </h4>
          <ValidationWorkflow
            docId={previewDoc.id}
            currentStatus={validationStatus as "pending" | "validated" | "rejected"}
            onValidate={handleValidateDoc}
            onReject={handleRejectDoc}
          />
        </div>

        {/* Tags */}
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Tags
          </h4>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {docTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Ajouter un tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              className="h-7 text-xs flex-1"
            />
          </div>
          {TAG_SUGGESTIONS.filter((s) => !docTags.includes(s)).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_SUGGESTIONS.filter((s) => !docTags.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setNewTag(s);
                    const updated = [...docTags, s];
                    setDocTags(updated);
                    supabase.from("documents").update({ tags: updated }).eq("id", previewDoc.id);
                    fireAudit("tag_change", previewDoc.id, { tags: updated });
                  }}
                  className="text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Notes
          </h4>
          <Textarea
            placeholder="Ajouter une note sur ce document..."
            value={docNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
        </div>
      </DocumentPreviewPanel>
    );
  };

  /* ─────────── RENDER ─────────── */

  // If no folders and not loading, show onboarding
  const showOnboarding = !loading && folders.length === 0;

  return (
    <div className="animate-page-in flex flex-col h-[calc(100vh-4rem)]">
      {/* Command Palette */}
      <GEDCommandPalette
        folders={folders}
        documents={allDocuments}
        onSelectSiren={handleSelectSirenUI}
        onSelectDocument={handlePreviewFromPalette}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-6 py-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          {breadcrumb.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {seg.onClick ? (
                <button onClick={seg.onClick} className="hover:text-foreground transition-colors">
                  {seg.label}
                </button>
              ) : (
                <span className="text-foreground">{seg.label}</span>
              )}
            </span>
          ))}
        </nav>

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
          <div className="flex items-center gap-2">
            <ConformityReport
              folders={folders}
              cabinetName="Cabinet"
              generatedBy={userName}
            />
            <Button onClick={handleImportClick}>
              <Plus className="w-4 h-4 mr-1.5" />
              Importer
            </Button>
          </div>
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
        {!showOnboarding && (
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
        )}
      </div>

      {/* Onboarding or Master-Detail Layout */}
      {showOnboarding ? (
        renderOnboarding()
      ) : (
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
      )}

      {/* Multi-selection action bar */}
      {selectedDocIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-card border shadow-lg rounded-xl px-6 py-3 flex items-center gap-4 animate-fade-in-up z-20">
          <span className="text-sm font-medium">
            {selectedDocIds.length} document{selectedDocIds.length > 1 ? "s" : ""} sélectionné
            {selectedDocIds.length > 1 ? "s" : ""}
          </span>
          <Button variant="outline" size="sm" onClick={handleBulkDownload}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Télécharger
          </Button>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Supprimer
          </Button>
        </div>
      )}

      {/* Preview Panel with validation + tags + notes */}
      {renderPreviewContent()}

      {/* Smart Upload Dialog */}
      {pendingFiles.length > 0 && selectedFolder && (
        <UploadDialog
          files={pendingFiles}
          siren={selectedFolder.siren}
          clientName={selectedFolder.client_name}
          existingDocs={documents.map((d) => ({
            id: d.id,
            name: d.name,
            size: d.file_size,
            created_at: d.created_at,
            version: d.current_version,
          }))}
          isOpen={uploadDialogOpen}
          onClose={() => {
            setUploadDialogOpen(false);
            setPendingFiles([]);
          }}
          onConfirm={handleUploadConfirm}
        />
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer « {deleteTarget?.name} » ? Cette action est
              irréversible.
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
