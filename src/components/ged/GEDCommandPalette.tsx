import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Building2, FileText } from "lucide-react";
import type { SirenFolder } from "@/services/gedService";
import type { GEDDocument } from "@/services/gedService";

interface GEDCommandPaletteProps {
  folders: SirenFolder[];
  documents: GEDDocument[];
  onSelectSiren: (clientRef: string) => void;
  onSelectDocument: (doc: GEDDocument) => void;
}

export default function GEDCommandPalette({
  folders,
  documents,
  onSelectSiren,
  onSelectDocument,
}: GEDCommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher un client ou document..." />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
        <CommandGroup heading="Clients">
          {folders.slice(0, 5).map((folder) => (
            <CommandItem
              key={folder.client_ref}
              value={`${folder.client_name} ${folder.siren}`}
              onSelect={() => {
                onSelectSiren(folder.client_ref);
                setOpen(false);
              }}
            >
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{folder.client_name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {folder.siren}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Documents">
          {documents.slice(0, 5).map((doc) => (
            <CommandItem
              key={doc.id}
              value={`${doc.name} ${doc.category}`}
              onSelect={() => {
                onSelectDocument(doc);
                setOpen(false);
              }}
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{doc.name}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.category}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
