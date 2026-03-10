import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, User, AlertTriangle } from "lucide-react";
import type { Client, AlerteRegistre, LogEntry } from "@/lib/types";

interface DashboardSearchProps {
  clients: Client[];
  alertes: AlerteRegistre[];
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

type SearchResult = {
  type: "client" | "alerte";
  label: string;
  subtitle: string;
  navigateTo: string;
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fuzzyMatch(text: string, query: string): boolean {
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  return words.every((word) => normalizedText.includes(word));
}

export default function DashboardSearch({
  clients,
  alertes,
  className,
  inputRef: externalInputRef,
}: DashboardSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Compute search results
  const results = useMemo<SearchResult[]>(() => {
    if (debouncedQuery.length < 2) return [];

    const matched: SearchResult[] = [];

    for (const client of clients) {
      if (matched.length >= 8) break;
      const searchable = [
        client.raisonSociale,
        client.ref,
        client.siren,
        client.dirigeant,
      ]
        .filter(Boolean)
        .join(" ");
      if (fuzzyMatch(searchable, debouncedQuery)) {
        matched.push({
          type: "client",
          label: client.raisonSociale,
          subtitle: `${client.ref} — ${client.siren || "Sans SIREN"}`,
          navigateTo: `/client/${client.ref}`,
        });
      }
    }

    for (const alerte of alertes) {
      if (matched.length >= 8) break;
      const searchable = [alerte.clientConcerne, alerte.categorie]
        .filter(Boolean)
        .join(" ");
      if (fuzzyMatch(searchable, debouncedQuery)) {
        matched.push({
          type: "alerte",
          label: alerte.clientConcerne,
          subtitle: alerte.categorie,
          navigateTo: "/registre",
        });
      }
    }

    return matched;
  }, [debouncedQuery, clients, alertes]);

  // Open/close dropdown based on results
  useEffect(() => {
    setIsOpen(debouncedQuery.length >= 2);
    setActiveIndex(-1);
  }, [debouncedQuery]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    navigate(result.navigateTo);
  }

  function handleClear() {
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={(el) => {
            (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            if (externalInputRef) (externalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setIsOpen(true);
          }}
          placeholder="Rechercher un client, alerte..."
          className="w-full rounded-xl bg-muted/50 border border-border pl-10 pr-10 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          aria-label="Recherche globale"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="dashboard-search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
          }
          autoComplete="off"
        />
        {query.length > 0 && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Effacer la recherche"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-card border border-border shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Aucun résultat pour &laquo;&nbsp;{debouncedQuery}&nbsp;&raquo;
            </div>
          ) : (
            <ul
              ref={listRef}
              id="dashboard-search-listbox"
              role="listbox"
              className="max-h-80 overflow-y-auto py-1"
            >
              {results.map((result, index) => (
                <li
                  key={`${result.type}-${index}`}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {result.type === "client" ? (
                    <User className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{result.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.subtitle}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
