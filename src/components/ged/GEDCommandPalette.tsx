import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Building2, FileText, Clock } from "lucide-react";
import type { SirenFolder } from "@/services/gedService";
import type { GEDDocument } from "@/services/gedService";

interface GEDCommandPaletteProps {
  folders: SirenFolder[];
  documents: GEDDocument[];
  onSelectSiren: (clientRef: string) => void;
  onSelectDocument: (doc: GEDDocument) => void;
}

const HISTORY_KEY = "ged-search-history";
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").slice(0, MAX_HISTORY);
  } catch { return []; }
}

function saveHistory(query: string) {
  const prev = loadHistory().filter(q => q !== query);
  const next = [query, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

/* #144 — Relevance scoring */
function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;                      // Exact match
  if (t.startsWith(q)) return 80;               // Starts with
  if (t.includes(q)) return 60;                 // Contains
  const words = q.split(/\s+/);
  const allWordsMatch = words.every(w => t.includes(w));
  if (allWordsMatch) return 40;                  // All words match
  const someWordsMatch = words.some(w => t.includes(w));
  if (someWordsMatch) return 20;                 // Some words match
  return 0;
}

export default function GEDCommandPalette({
  folders,
  documents,
  onSelectSiren,
  onSelectDocument,
}: GEDCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [history] = useState(loadHistory);

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

  /* #139 — Search in notes/tags + #144 relevance sorting */
  const rankedFolders = useMemo(() => {
    if (!search.trim()) return folders.slice(0, 8);
    return folders
      .map(f => ({
        folder: f,
        score: Math.max(
          scoreMatch(search, f.client_name),
          scoreMatch(search, f.siren),
          scoreMatch(search, f.client_ref),
        ),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.folder);
  }, [folders, search]);

  const rankedDocs = useMemo(() => {
    if (!search.trim()) return documents.slice(0, 8);
    return documents
      .map(d => ({
        doc: d,
        score: Math.max(
          scoreMatch(search, d.name),
          scoreMatch(search, d.category),
          scoreMatch(search, (d as any).label || ""),
          scoreMatch(search, (d as any).notes || ""),
          scoreMatch(search, ((d as any).tags || []).join(" ")),
        ),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.doc);
  }, [documents, search]);

  const handleSelect = (cb: () => void) => {
    if (search.trim()) saveHistory(search.trim());
    cb();
    setOpen(false);
    setSearch("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher un client, document, tag, note..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

        {/* #145 — Search history */}
        {!search.trim() && history.length > 0 && (
          <CommandGroup heading="Recherches récentes">
            {history.map((q) => (
              <CommandItem
                key={q}
                value={`history:${q}`}
                onSelect={() => setSearch(q)}
              >
                <Clock className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{q}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {rankedFolders.length > 0 && (
          <>
            {!search.trim() && history.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Clients">
              {rankedFolders.map((folder) => (
                <CommandItem
                  key={folder.client_ref}
                  value={`${folder.client_name} ${folder.siren}`}
                  onSelect={() => handleSelect(() => onSelectSiren(folder.client_ref))}
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm">{folder.client_name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {folder.siren}
                      {folder.total_docs > 0 && ` · ${folder.total_docs} doc${folder.total_docs > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {rankedDocs.length > 0 && (
          <CommandGroup heading="Documents">
            {rankedDocs.map((doc) => (
              <CommandItem
                key={doc.id}
                value={`${doc.name} ${doc.category} ${(doc as any).label || ""} ${((doc as any).tags || []).join(" ")}`}
                onSelect={() => handleSelect(() => onSelectDocument(doc))}
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{(doc as any).label || doc.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {doc.category}
                    {(doc as any).tags?.length > 0 && ` · ${(doc as any).tags.join(", ")}`}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
