import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Copy, Edit2, Trash2, Star, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDateFr } from "@/lib/dateUtils";

export interface TemplateBlock {
  id: string;
  title: string;
  content: string;
  visible: boolean;
  type: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  blocks: TemplateBlock[];
  isDefault: boolean;
  updatedAt: string;
}

const STORAGE_KEY = "lcb-templates";

const PRELOADED_TEMPLATES: Template[] = [
  {
    id: "tpl-standard",
    name: "Standard Cabinet",
    description: "Lettre de mission standard pour les missions de tenue comptable et revision",
    blocks: [
      { id: "b1", title: "Objet de la mission", content: "Le cabinet {{cabinet_nom}} est charge de la mission de {{mission}} pour le compte de {{raison_sociale}}, SIREN {{siren}}.", visible: true, type: "Mission" },
      { id: "b2", title: "Duree", content: "La presente lettre de mission prend effet a compter du {{date_debut_mission}}.", visible: true, type: "Mission" },
      { id: "b3", title: "Honoraires", content: "Les honoraires annuels sont fixes a {{honoraires}} EUR HT, payables {{frequence}}.", visible: true, type: "Honoraires" },
      { id: "b4", title: "Obligations LCB-FT", content: "Niveau de vigilance applique : {{niv_vigilance}}. Score de risque : {{score_global}}/100.", visible: true, type: "LCB-FT" },
      { id: "b5", title: "RGPD", content: "Le cabinet s'engage a traiter les donnees conformement au RGPD.", visible: true, type: "RGPD" },
      { id: "b6", title: "Resiliation", content: "Chacune des parties peut resilier avec un preavis de trois mois.", visible: true, type: "Resiliation" },
      { id: "b7", title: "Juridiction", content: "Tribunal competent du siege du cabinet. Loi francaise applicable.", visible: true, type: "Juridiction" },
    ],
    isDefault: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-immobilier",
    name: "Mission Immobilier",
    description: "Template adapte aux SCI et activites immobilieres avec clauses specifiques",
    blocks: [
      { id: "b1", title: "Objet - Mission immobiliere", content: "Le cabinet {{cabinet_nom}} est charge de la mission de {{mission}} pour la societe {{raison_sociale}} ({{forme_juridique}}), SIREN {{siren}}, ayant pour objet la gestion immobiliere.", visible: true, type: "Mission" },
      { id: "b2", title: "Honoraires", content: "Les honoraires annuels sont fixes a {{honoraires}} EUR HT.", visible: true, type: "Honoraires" },
      { id: "b3", title: "Vigilance renforcee immobilier", content: "L'activite immobiliere presentant des risques specifiques en matiere de LCB-FT, le niveau de vigilance {{niv_vigilance}} est applique. Score : {{score_global}}/100.", visible: true, type: "LCB-FT" },
      { id: "b4", title: "Beneficiaires effectifs", content: "Beneficiaires effectifs identifies : {{beneficiaires_effectifs}}.", visible: true, type: "LCB-FT" },
      { id: "b5", title: "RGPD", content: "Traitement des donnees conforme au RGPD.", visible: true, type: "RGPD" },
      { id: "b6", title: "Resiliation", content: "Preavis de trois mois par LRAR.", visible: true, type: "Resiliation" },
    ],
    isDefault: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-constitution",
    name: "Mission Constitution",
    description: "Template pour les missions de constitution et cession de societe",
    blocks: [
      { id: "b1", title: "Objet - Constitution", content: "Le cabinet {{cabinet_nom}} est charge d'accompagner {{dirigeant}} dans la constitution de la societe {{raison_sociale}} ({{forme_juridique}}), au capital de {{capital}} EUR.", visible: true, type: "Mission" },
      { id: "b2", title: "Honoraires constitution", content: "Les honoraires pour la mission de constitution sont fixes a {{honoraires}} EUR HT, payables a la signature.", visible: true, type: "Honoraires" },
      { id: "b3", title: "LCB-FT", content: "Vigilance : {{niv_vigilance}}. Score : {{score_global}}/100.", visible: true, type: "LCB-FT" },
      { id: "b4", title: "RGPD", content: "Traitement des donnees conforme au RGPD.", visible: true, type: "RGPD" },
      { id: "b5", title: "Juridiction", content: "Loi francaise applicable.", visible: true, type: "Juridiction" },
    ],
    isDefault: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-social",
    name: "Mission Social",
    description: "Template pour les missions de paie et gestion sociale",
    blocks: [
      { id: "b1", title: "Objet - Mission sociale", content: "Le cabinet {{cabinet_nom}} est charge de la gestion sociale et de la paie pour {{raison_sociale}}, SIREN {{siren}}, employant {{effectif}} salaries.", visible: true, type: "Mission" },
      { id: "b2", title: "Honoraires social", content: "Les honoraires sont fixes a {{honoraires}} EUR HT par mois, pour {{effectif}} bulletins de paie.", visible: true, type: "Honoraires" },
      { id: "b3", title: "LCB-FT", content: "Vigilance : {{niv_vigilance}}.", visible: true, type: "LCB-FT" },
      { id: "b4", title: "RGPD - Donnees sociales", content: "Les donnees sociales des salaries sont traitees conformement au RGPD. Le cabinet est sous-traitant au sens de l'article 28.", visible: true, type: "RGPD" },
      { id: "b5", title: "Resiliation", content: "Preavis de trois mois.", visible: true, type: "Resiliation" },
    ],
    isDefault: false,
    updatedAt: new Date().toISOString(),
  },
];

function loadTemplates(): Template[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Template[];
    }
  } catch { /* ignore */ }
  return PRELOADED_TEMPLATES;
}

function saveTemplates(templates: Template[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch { /* storage full */ }
}

interface TemplateManagerProps {
  onLoadTemplate?: (template: Template) => void;
}

export default function TemplateManager({ onLoadTemplate }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editDialog, setEditDialog] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const updateAndSave = (updated: Template[]) => {
    setTemplates(updated);
    saveTemplates(updated);
  };

  const handleDuplicate = (tpl: Template) => {
    const dup: Template = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      name: `${tpl.name} (copie)`,
      isDefault: false,
      updatedAt: new Date().toISOString(),
      blocks: tpl.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
    };
    updateAndSave([...templates, dup]);
    toast.success("Template duplique");
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.isDefault) {
      toast.error("Impossible de supprimer le template par defaut");
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    updateAndSave(templates.filter((t) => t.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    toast.success("Template supprime");
  };

  const handleSetDefault = (id: string) => {
    updateAndSave(
      templates.map((t) => ({ ...t, isDefault: t.id === id }))
    );
    toast.success("Template par defaut mis a jour");
  };

  const handleEdit = (tpl: Template) => {
    setEditDialog(tpl);
    setEditName(tpl.name);
    setEditDesc(tpl.description);
  };

  const handleEditSave = () => {
    if (!editDialog) return;
    updateAndSave(
      templates.map((t) =>
        t.id === editDialog.id
          ? { ...t, name: editName, description: editDesc, updatedAt: new Date().toISOString() }
          : t
      )
    );
    setEditDialog(null);
    toast.success("Template modifie");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Templates de lettre de mission</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            const newTpl: Template = {
              id: `tpl-${Date.now()}`,
              name: "Nouveau template",
              description: "Description du template",
              blocks: [],
              isDefault: false,
              updatedAt: new Date().toISOString(),
            };
            updateAndSave([...templates, newTpl]);
            toast.success("Template cree");
          }}
        >
          <Plus className="h-4 w-4" />
          Nouveau template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="relative">
            {tpl.isDefault && (
              <Badge className="absolute top-3 right-3 gap-1" variant="default">
                <Star className="h-3 w-3" />
                Par defaut
              </Badge>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {tpl.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{tpl.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                <span>{tpl.blocks.length} blocs</span>
                <span>Modifie le {formatDateFr(tpl.updatedAt, "short")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onLoadTemplate && (
                  <Button size="sm" variant="default" onClick={() => onLoadTemplate(tpl)}>
                    Charger
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleEdit(tpl)}>
                  <Edit2 className="h-3 w-3" /> Modifier
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDuplicate(tpl)}>
                  <Copy className="h-3 w-3" /> Dupliquer
                </Button>
                {!tpl.isDefault && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSetDefault(tpl.id)}>
                    <Star className="h-3 w-3" /> Par defaut
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleDelete(tpl.id)}>
                  <Trash2 className="h-3 w-3" /> Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
            <DialogDescription>Modifiez le nom et la description du template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Annuler</Button>
            <Button onClick={handleEditSave}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>Cette action est definitive et ne peut pas etre annulee.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Etes-vous sur de vouloir supprimer ce template ? Cette action est irreversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
