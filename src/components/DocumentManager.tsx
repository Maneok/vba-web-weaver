import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Clock, AlertTriangle, Download, History } from "lucide-react";
import type { ClientDocument, DocumentType } from "@/lib/types";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "KBIS", label: "Extrait Kbis" },
  { value: "STATUTS", label: "Statuts" },
  { value: "CNI", label: "Pièce d'identité (CNI)" },
  { value: "RIB", label: "RIB" },
  { value: "LETTRE_MISSION", label: "Lettre de mission" },
  { value: "FICHE_LCB", label: "Fiche LCB-FT" },
  { value: "COMPTES_ANNUELS", label: "Comptes annuels" },
  { value: "AUTRE", label: "Autre" },
];

interface Props {
  documents: ClientDocument[];
  onDocumentsChange: (docs: ClientDocument[]) => void;
  clientRef: string;
}

export default function DocumentManager({ documents, onDocumentsChange, clientRef }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("KBIS");
  const [expiryDate, setExpiryDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    const newDocs: ClientDocument[] = [];
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      // Check if there's an existing document of this type
      const existing = documents.find(d => d.type === uploadType);
      if (existing) {
        // Version the old document
        const updated = documents.map(d => {
          if (d.id !== existing.id) return d;
          return {
            ...d,
            url,
            name: file.name,
            uploadDate: new Date().toISOString().split("T")[0],
            expiryDate: expiryDate || undefined,
            version: d.version + 1,
            previousVersions: [
              ...(d.previousVersions || []),
              { url: d.url, uploadDate: d.uploadDate },
            ],
          };
        });
        onDocumentsChange(updated);
        return;
      }

      newDocs.push({
        id: `${clientRef}-${uploadType}-${Date.now()}`,
        type: uploadType,
        name: file.name,
        url,
        uploadDate: new Date().toISOString().split("T")[0],
        expiryDate: expiryDate || undefined,
        version: 1,
      });
    });

    if (newDocs.length > 0) {
      onDocumentsChange([...documents, ...newDocs]);
    }
    setExpiryDate("");
  }, [documents, uploadType, expiryDate, clientRef, onDocumentsChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeDoc = (id: string) => {
    onDocumentsChange(documents.filter(d => d.id !== id));
  };

  const now = new Date();

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">GED — Documents</h3>

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          Glissez-déposez un fichier ici ou
        </p>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <Select value={uploadType} onValueChange={v => setUploadType(v as DocumentType)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            placeholder="Date expiration"
            className="w-[150px] h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Parcourir
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => e.target.files && handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map(doc => {
            const isExpired = doc.expiryDate && new Date(doc.expiryDate) < now;
            const expiringSoon = doc.expiryDate && !isExpired && (new Date(doc.expiryDate).getTime() - now.getTime()) < 90 * 86400000;

            return (
              <div key={doc.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                isExpired ? "border-red-200 bg-red-50 dark:bg-red-950/10" :
                expiringSoon ? "border-amber-200 bg-amber-50 dark:bg-amber-950/10" :
                "bg-card"
              }`}>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted font-semibold">{doc.type}</span>
                      <span>v{doc.version}</span>
                      <span>Ajouté le {doc.uploadDate}</span>
                      {doc.expiryDate && (
                        <span className={`flex items-center gap-1 ${isExpired ? "text-red-600 font-semibold" : expiringSoon ? "text-amber-600" : ""}`}>
                          {isExpired && <AlertTriangle className="w-3 h-3" />}
                          {expiringSoon && <Clock className="w-3 h-3" />}
                          Expire: {doc.expiryDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {doc.previousVersions && doc.previousVersions.length > 0 && (
                    <Button variant="ghost" size="sm" title={`${doc.previousVersions.length} version(s) antérieure(s)`}>
                      <History className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, "_blank")}>
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeDoc(doc.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Aucun document uploadé pour ce client.</p>
      )}
    </div>
  );
}
