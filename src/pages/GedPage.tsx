import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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
      // Auto-detect category from filename
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

  const uploadFiles = async () => {
    if (pendingFiles.length === 0) return;

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
          .single();

        if (docError) throw docError;

        // Create version 1
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.storage.from("documents").remove([doc.file_path]);
    // Remove all version files
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
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GED Intelligente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestion electronique des documents - Upload, versionning et alertes d'expiration
        </p>
      </div>

      {/* Expiration Alerts */}
      {expiringDocs.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Alertes expiration documents</p>
                <div className="mt-2 space-y-1">
                  {expiringDocs.map((doc) => {
                    const status = getExpirationStatus(doc.expiration_date);
                    return (
                      <div key={doc.id} className="flex items-center gap-2 text-sm">
                        <Badge variant={status?.variant}>{status?.label}</Badge>
                        <span className="font-medium">{doc.name}</span>
                        {doc.client_ref && (
                          <span className="text-muted-foreground">({doc.client_ref})</span>
                        )}
                        <span className="text-muted-foreground">
                          - {CATEGORIES.find((c) => c.value === doc.category)?.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">
          Glissez-deposez vos documents ici
        </p>
        <p className="text-sm text-muted-foreground mt-1">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou ref client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Expiration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="expired">Expires</SelectItem>
            <SelectItem value="soon">Expire bientot (&lt;90j)</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filtered.length} document(s)
        </div>
      </div>

      {/* Documents table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Modifie le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{doc.client_ref || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size || 0)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => openVersionDialog(doc)}
                          className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
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
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(doc.updated_at), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => downloadDocument(doc.file_path, doc.name)}
                            title="Telecharger"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openVersionDialog(doc)}
                            title="Versions"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteDocument(doc)}
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
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer {pendingFiles.length} document(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File list */}
            <div className="space-y-2">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded p-2">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
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
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference client (optionnel)</Label>
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
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Historique des versions - {selectedDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Version list */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-3 rounded-lg border text-sm"
                >
                  <Badge variant="outline">v{v.version_number}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">
                      {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </p>
                    {v.comment && <p className="text-xs mt-0.5">{v.comment}</p>}
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {formatFileSize(v.file_size || 0)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => downloadDocument(v.file_path, `v${v.version_number}_${selectedDoc?.name}`)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Upload new version */}
            <div className="border-t pt-4 space-y-3">
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
