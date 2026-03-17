import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Plus, BookOpen, Trash2 } from "lucide-react";
import { sanitizeText } from "@/lib/lmValidation";

export interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  obligatoire: boolean;
}

const CATEGORIES = [
  "Toutes",
  "Mission",
  "Honoraires",
  "LCB-FT",
  "RGPD",
  "Resiliation",
  "Juridiction",
  "Custom",
] as const;

const DEFAULT_CLAUSES: Clause[] = [
  {
    id: "c1",
    title: "Objet de la mission",
    content:
      "Le cabinet {{cabinet_nom}} est charge de la mission de {{mission}} pour le compte de {{raison_sociale}}, SIREN {{siren}}, dont le siege social est situe au {{adresse}}, {{cp}} {{ville}}.",
    category: "Mission",
    obligatoire: true,
  },
  {
    id: "c2",
    title: "Duree de la mission",
    content:
      "La presente lettre de mission prend effet a compter du {{date_debut_mission}} pour une duree indeterminee. Elle pourra etre resiliee par l'une ou l'autre des parties dans les conditions prevues ci-apres.",
    category: "Mission",
    obligatoire: true,
  },
  {
    id: "c3",
    title: "Honoraires et modalites de reglement",
    content:
      "Les honoraires annuels sont fixes a {{honoraires}} EUR HT, payables {{frequence}}. Toute prestation supplementaire fera l'objet d'un devis prealable.",
    category: "Honoraires",
    obligatoire: true,
  },
  {
    id: "c4",
    title: "Mandat de prelevement SEPA",
    content:
      "Le client autorise le prelevement SEPA sur le compte IBAN {{iban}}, BIC {{bic}}, pour le reglement des honoraires selon l'echeancier convenu.",
    category: "Honoraires",
    obligatoire: false,
  },
  {
    id: "c5",
    title: "Obligations LCB-FT",
    content:
      "Conformement aux articles L.561-1 et suivants du Code monetaire et financier, le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme. Le niveau de vigilance applique est : {{niv_vigilance}}. Score de risque global : {{score_global}}/100.",
    category: "LCB-FT",
    obligatoire: true,
  },
  {
    id: "c6",
    title: "Identification du beneficiaire effectif",
    content:
      "Le(s) beneficiaire(s) effectif(s) identifie(s) : {{beneficiaires_effectifs}}. Le client s'engage a informer le cabinet de toute modification relative a ses beneficiaires effectifs dans un delai de 30 jours.",
    category: "LCB-FT",
    obligatoire: true,
  },
  {
    id: "c7",
    title: "Personne politiquement exposee",
    content:
      "PPE declaree : {{ppe}}. Le cas echeant, des mesures de vigilance renforcee sont appliquees conformement a la reglementation en vigueur.",
    category: "LCB-FT",
    obligatoire: false,
  },
  {
    id: "c8",
    title: "Protection des donnees (RGPD)",
    content:
      "Le cabinet s'engage a traiter les donnees personnelles du client conformement au Reglement General sur la Protection des Donnees (UE) 2016/679. Les donnees collectees sont necessaires a l'execution de la mission et sont conservees pendant la duree legale.",
    category: "RGPD",
    obligatoire: true,
  },
  {
    id: "c9",
    title: "Droit d'acces et de rectification",
    content:
      "Le client dispose d'un droit d'acces, de rectification, d'effacement et de portabilite de ses donnees. Pour exercer ces droits, il peut contacter le cabinet a l'adresse : {{cabinet_adresse}}.",
    category: "RGPD",
    obligatoire: false,
  },
  {
    id: "c10",
    title: "Clause de resiliation",
    content:
      "Chacune des parties peut resilier la presente lettre de mission par lettre recommandee avec accuse de reception, moyennant un preavis de trois mois. En cas de manquement grave, la resiliation peut etre immediate.",
    category: "Resiliation",
    obligatoire: true,
  },
  {
    id: "c11",
    title: "Juridiction competente",
    content:
      "En cas de litige, les parties conviennent de soumettre leur differend au tribunal competent du siege du cabinet. La loi francaise est applicable.",
    category: "Juridiction",
    obligatoire: true,
  },
  {
    id: "c12",
    title: "Responsabilite professionnelle",
    content:
      "Le cabinet est couvert par une assurance responsabilite civile professionnelle. Sa responsabilite est limitee aux fautes prouvees dans l'execution de la mission definie par la presente lettre.",
    category: "Mission",
    obligatoire: false,
  },
];

const STORAGE_KEY = "lcb-clause-library-custom";

interface ClauseLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClause: (clause: Clause) => void;
}

export default function ClauseLibrary({ open, onOpenChange, onAddClause }: ClauseLibraryProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [customClauses, setCustomClauses] = useState<Clause[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: Clause[] = JSON.parse(stored);
        // Re-sanitize stored clauses in case sessionStorage was tampered with
        const sanitized = parsed.map((c) => ({
          ...c,
          title: sanitizeText(String(c.title || "")),
          content: sanitizeText(String(c.content || "")),
        }));
        setCustomClauses(sanitized);
      } catch { /* ignore */ }
    }
  }, []);

  const saveCustomClauses = (clauses: Clause[]) => {
    setCustomClauses(clauses);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clauses)); } catch { /* storage full */ }
  };

  const allClauses = [...DEFAULT_CLAUSES, ...customClauses];

  const filtered = allClauses.filter((c) => {
    const matchCategory = activeCategory === "Toutes" || c.category === activeCategory;
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleAddCustom = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const clause: Clause = {
      id: `custom-${Date.now()}`,
      title: sanitizeText(newTitle.trim()),
      content: sanitizeText(newContent.trim()),
      category: "Custom",
      obligatoire: false,
    };
    saveCustomClauses([...customClauses, clause]);
    setNewTitle("");
    setNewContent("");
    setShowAddForm(false);
  };

  const handleDeleteCustom = (id: string) => {
    saveCustomClauses(customClauses.filter((c) => c.id !== id));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Bibliotheque de clauses
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une clause..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs px-2 py-1">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.map((clause) => (
              <div
                key={clause.id}
                className="border rounded-lg p-3 hover:bg-accent/50 cursor-pointer transition-colors group focus-within:ring-2 focus-within:ring-blue-400"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddClause(clause); onOpenChange(false); } }}
                onClick={() => {
                  onAddClause(clause);
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium">{clause.title}</h4>
                  <div className="flex items-center gap-1">
                    <Badge variant={clause.obligatoire ? "default" : "secondary"} className="text-[10px]">
                      {clause.obligatoire ? "Obligatoire" : "Optionnel"}
                    </Badge>
                    {clause.id.startsWith("custom-") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustom(clause.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {clause.content ? `${clause.content.slice(0, 120)}${clause.content.length > 120 ? "..." : ""}` : ""}
                </p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  {clause.category}
                </Badge>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune clause trouvee
              </p>
            )}
          </div>

          <div className="border-t pt-3">
            {showAddForm ? (
              <div className="space-y-2">
                <Input
                  placeholder="Titre de la clause"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                  placeholder="Contenu de la clause (variables {{...}} acceptees)"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCustom}>Ajouter</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                Ajouter une clause personnalisee
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
