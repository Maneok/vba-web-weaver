import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface CompactDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  sirenContext?: string;
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx";
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

export default function CompactDropZone({ onFilesSelected, sirenContext }: CompactDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const valid = Array.from(fileList).filter((f) => f.size <= MAX_SIZE);
      if (valid.length > 0) onFilesSelected(valid);
    },
    [onFilesSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-16 flex items-center justify-center gap-2 border border-dashed rounded-lg cursor-pointer transition-all duration-150 ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50"
      }`}
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {sirenContext
          ? `Ajouter à ${sirenContext} — `
          : ""}
        Glisser vos documents ici ou cliquer — PDF, JPG, PNG, DOCX (max 10Mo)
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
