import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, BookOpen, Trash2, ShieldAlert } from "lucide-react";
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
  "Résiliation",
  "Responsabilité",
  "Confidentialité",
  "Juridiction",
  "Custom",
] as const;

const DEFAULT_CLAUSES: Clause[] = [
  {
    id: "c1",
    title: "Objet de la mission",
    content:
      "Le cabinet {{cabinet_nom}} est chargé de la mission de {{mission}} pour le compte de {{raison_sociale}}, SIREN {{siren}}, dont le siège social est situé au {{adresse}}, {{cp}} {{ville}}.",
    category: "Mission",
    obligatoire: true,
  },
  {
    id: "c2",
    title: "Durée de la mission",
    content:
      "La présente lettre de mission prend effet à compter du {{date_debut_mission}} pour une durée indéterminée. Elle pourra être résiliée par l'une ou l'autre des parties dans les conditions prévues ci-après.",
    category: "Mission",
    obligatoire: true,
  },
  {
    id: "c3",
    title: "Honoraires et modalités de règlement",
    content:
      "Les honoraires annuels sont fixés à {{honoraires}} € HT, payables {{frequence}}. Toute prestation supplémentaire fera l'objet d'un devis préalable. Les honoraires seront révisables annuellement selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE (référence : Indice des prix de production des services aux entreprises — Services comptables).",
    category: "Honoraires",
    obligatoire: true,
  },
  {
    id: "c4",
    title: "Mandat de prélèvement SEPA",
    content:
      "Le client autorise le prélèvement SEPA sur le compte IBAN {{iban}}, BIC {{bic}}, pour le règlement des honoraires selon l'échéancier convenu.",
    category: "Honoraires",
    obligatoire: false,
  },
  {
    id: "c5",
    title: "Obligations LCB-FT",
    content:
      "Conformément aux articles L.561-1 et suivants du Code monétaire et financier, le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme. Le niveau de vigilance appliqué est : {{niv_vigilance}}. Score de risque global : {{score_global}}/100. Le cabinet procède aux diligences d'identification et de vérification d'identité du client, de ses dirigeants et de ses bénéficiaires effectifs, conformément aux articles L.561-5 à L.561-5-1 du CMF.",
    category: "LCB-FT",
    obligatoire: true,
  },
  {
    id: "c6",
    title: "Identification du bénéficiaire effectif",
    content:
      "Le(s) bénéficiaire(s) effectif(s) identifié(s) : {{beneficiaires_effectifs}}. Le client s'engage à informer le cabinet de toute modification relative à ses bénéficiaires effectifs dans un délai de 30 jours, conformément à l'article L.561-6 du Code monétaire et financier.",
    category: "LCB-FT",
    obligatoire: true,
  },
  {
    id: "c7",
    title: "Personne politiquement exposée",
    content:
      "PPE déclarée : {{ppe}}. Le cas échéant, des mesures de vigilance renforcée sont appliquées conformément aux articles L.561-10 et R.561-18 du Code monétaire et financier, incluant un examen renforcé des opérations et l'obtention de l'accord d'un membre de la direction pour l'entrée en relation d'affaires.",
    category: "LCB-FT",
    obligatoire: false,
  },
  {
    id: "c8",
    title: "Protection des données (RGPD)",
    content:
      "Le cabinet s'engage à traiter les données personnelles du client conformément au Règlement Général sur la Protection des Données (UE) 2016/679 et à la loi n°78-17 du 6 janvier 1978 modifiée. Les données collectées sont nécessaires à l'exécution de la mission et sont conservées pendant la durée légale. Le responsable du traitement est le cabinet, représenté par {{associe}}.",
    category: "RGPD",
    obligatoire: true,
  },
  {
    id: "c9",
    title: "Droit d'accès et de rectification",
    content:
      "Conformément aux articles 15 à 21 du RGPD, le client dispose d'un droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité de ses données et d'opposition. Pour exercer ces droits, il peut contacter le cabinet à l'adresse : {{cabinet_adresse}}. En cas de réclamation, le client peut saisir la CNIL.",
    category: "RGPD",
    obligatoire: false,
  },
  {
    id: "c10",
    title: "Clause de résiliation",
    content:
      "Conformément à l'article 1225 du Code civil, chacune des parties peut résilier la présente lettre de mission par lettre recommandée avec accusé de réception, moyennant un préavis de trois mois avant la date d'échéance. En cas de manquement grave de l'une des parties à ses obligations essentielles, la résiliation pourra intervenir de plein droit après mise en demeure restée infructueuse pendant un délai de trente (30) jours.",
    category: "Résiliation",
    obligatoire: true,
  },
  {
    id: "c11",
    title: "Juridiction compétente",
    content:
      "En cas de litige relatif à l'interprétation ou à l'exécution de la présente lettre de mission, les parties conviennent de tenter préalablement une conciliation auprès du Conseil Régional de l'Ordre des Experts-Comptables (CROEC). À défaut d'accord amiable, le tribunal compétent du siège du cabinet sera seul compétent. La loi française est applicable.",
    category: "Juridiction",
    obligatoire: true,
  },
  {
    id: "c12",
    title: "Responsabilité civile professionnelle",
    content:
      "Le cabinet est couvert par une assurance responsabilité civile professionnelle souscrite auprès de MMA IARD, police n°{{police_rc}}, conformément aux dispositions de l'article 17 de l'ordonnance n°45-2138 du 19 septembre 1945. La responsabilité du cabinet est limitée aux fautes prouvées dans l'exécution de la mission définie par la présente lettre, dans les limites du plafond de garantie du contrat d'assurance.",
    category: "Responsabilité",
    obligatoire: false,
  },
  {
    id: "c13",
    title: "Confidentialité et secret professionnel",
    content:
      "Le cabinet est tenu au secret professionnel conformément à l'article 147 du Code de déontologie des experts-comptables (décret n°2012-432 du 30 mars 2012). Cette obligation couvre l'ensemble des informations, documents et données dont le cabinet a connaissance dans le cadre de l'exécution de sa mission. Le client autorise le cabinet à communiquer les informations nécessaires aux autorités compétentes dans le cadre de ses obligations légales, notamment en matière de LCB-FT.",
    category: "Confidentialité",
    obligatoire: false,
  },
  {
    id: "c14",
    title: "Non-sollicitation des collaborateurs",
    content:
      "Pendant la durée de la mission et pendant une période de douze (12) mois suivant sa cessation, le client s'interdit de solliciter, recruter ou employer directement ou indirectement tout collaborateur du cabinet ayant participé à l'exécution de la mission, sauf accord écrit préalable du cabinet. En cas de manquement, le client s'engage à verser au cabinet une indemnité forfaitaire égale à douze mois de rémunération brute du collaborateur concerné.",
    category: "Confidentialité",
    obligatoire: false,
  },
  {
    id: "c15",
    title: "Clause de travail dissimulé",
    content:
      "Le client atteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du Travail, avoir immatriculé son entreprise au RCS, employer régulièrement tous ses salariés et ne pas employer de salariés étrangers démunis du titre les autorisant à travailler en France.",
    category: "Mission",
    obligatoire: true,
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
  const [newCategory, setNewCategory] = useState("Custom");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: Clause[] = JSON.parse(stored);
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

  const filtered = useMemo(() => allClauses.filter((c) => {
    const matchCategory = activeCategory === "Toutes" || c.category === activeCategory;
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  }), [allClauses.length, activeCategory, search]);

  const obligatoireCount = filtered.filter(c => c.obligatoire).length;

  const handleAddCustom = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const clause: Clause = {
      id: `custom-${Date.now()}`,
      title: sanitizeText(newTitle.trim()),
      content: sanitizeText(newContent.trim()),
      category: newCategory,
      obligatoire: false,
    };
    saveCustomClauses([...customClauses, clause]);
    setNewTitle("");
    setNewContent("");
    setNewCategory("Custom");
    setShowAddForm(false);
  };

  const handleDeleteCustom = (id: string) => {
    saveCustomClauses(customClauses.filter((c) => c.id !== id));
  };

  const customCategoryOptions = CATEGORIES.filter(c => c !== "Toutes");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] sm:max-w-[460px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Bibliothèque de clauses
          </SheetTitle>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {allClauses.length} clauses disponibles · {obligatoireCount} obligatoires dans cette vue
          </p>
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
            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="text-[10px] px-2 py-1 rounded-full border border-transparent data-[state=active]:border-blue-500/30 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filtered.map((clause) => (
              <div
                key={clause.id}
                className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-3 hover:bg-accent/50 hover:border-blue-300 dark:hover:border-blue-500/20 cursor-pointer transition-all group focus-within:ring-2 focus-within:ring-blue-400"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddClause(clause); onOpenChange(false); } }}
                onClick={() => {
                  onAddClause(clause);
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{clause.title}</h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {clause.obligatoire ? (
                      <Badge className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-500 border border-red-500/20 gap-0.5">
                        <ShieldAlert className="w-2.5 h-2.5" /> Obligatoire
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        Optionnel
                      </Badge>
                    )}
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
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                  {clause.content}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 dark:border-white/10">
                    {clause.category}
                  </Badge>
                  {clause.id.startsWith("custom-") && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-300 dark:border-purple-500/20 text-purple-500">
                      Personnalisée
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune clause trouvée
                </p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                  Essayez un autre filtre ou créez une clause personnalisée
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-white/[0.06] pt-3">
            {showAddForm ? (
              <div className="space-y-2">
                <Input
                  placeholder="Titre de la clause"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {customCategoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  placeholder="Contenu de la clause (variables {{...}} acceptées)"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCustom} disabled={!newTitle.trim() || !newContent.trim()}>
                    Ajouter
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewTitle(""); setNewContent(""); setNewCategory("Custom"); }}>
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
                Nouvelle clause personnalisée
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
