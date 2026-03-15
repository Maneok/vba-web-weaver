import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plug, Plus, RefreshCcw, Wifi, WifiOff, AlertTriangle } from "lucide-react";

interface Connecteur {
  id: string;
  cabinet_id: string;
  nom: string;
  type: string;
  statut: "connecte" | "deconnecte" | "erreur";
  config: Record<string, unknown>;
  derniere_connexion: string | null;
  derniere_activite: string | null;
  created_at: string;
}

const DEFAULT_CONNECTEURS = [
  { nom: "INPI RBE", type: "registre", description: "Registre National des Entreprises" },
  { nom: "Pappers", type: "registre", description: "API donnees entreprises" },
  { nom: "OpenSanctions", type: "sanctions", description: "Base sanctions internationales" },
  { nom: "BODACC", type: "registre", description: "Bulletin officiel des annonces civiles et commerciales" },
  { nom: "DG Tresor - Gel d'avoirs", type: "sanctions", description: "Liste nationale de gel des avoirs" },
  { nom: "Google Places", type: "verification", description: "Verification d'adresses" },
  { nom: "NewsAPI", type: "veille", description: "Veille mediatique" },
  { nom: "Google Vision OCR", type: "documents", description: "Reconnaissance optique de caracteres" },
];

const STATUT_CONFIG = {
  connecte: { icon: Wifi, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Connecte" },
  deconnecte: { icon: WifiOff, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "Deconnecte" },
  erreur: { icon: AlertTriangle, color: "bg-red-500/20 text-red-300 border-red-500/30", label: "Erreur" },
};

const TYPE_LABELS: Record<string, string> = {
  registre: "Registre",
  sanctions: "Sanctions",
  verification: "Verification",
  veille: "Veille",
  documents: "Documents",
};

export default function ConnecteursPanel() {
  const [connecteurs, setConnecteurs] = useState<Connecteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", type: "registre" });
  const [saving, setSaving] = useState(false);

  const loadConnecteurs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_connecteurs")
        .select("*")
        .order("nom");
      if (error) throw error;
      setConnecteurs((data || []) as Connecteur[]);
    } catch {
      toast.error("Erreur lors du chargement des connecteurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConnecteurs(); }, [loadConnecteurs]);

  const initDefaults = async () => {
    try {
      // Get current cabinet
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) return;

      const existing = new Set(connecteurs.map((c) => c.nom));
      const toInsert = DEFAULT_CONNECTEURS
        .filter((d) => !existing.has(d.nom))
        .map((d) => ({ cabinet_id: cab.id, nom: d.nom, type: d.type, statut: "deconnecte" as const }));

      if (toInsert.length === 0) {
        toast.info("Tous les connecteurs sont deja configures");
        return;
      }

      const { error } = await supabase.from("cabinet_connecteurs").insert(toInsert);
      if (error) throw error;
      toast.success(`${toInsert.length} connecteur(s) ajoute(s)`);
      await loadConnecteurs();
    } catch {
      toast.error("Erreur lors de l'initialisation");
    }
  };

  const toggleStatut = async (connecteur: Connecteur) => {
    const newStatut = connecteur.statut === "connecte" ? "deconnecte" : "connecte";
    const { error } = await supabase
      .from("cabinet_connecteurs")
      .update({
        statut: newStatut,
        ...(newStatut === "connecte" ? { derniere_connexion: new Date().toISOString() } : {}),
      })
      .eq("id", connecteur.id);

    if (error) { toast.error("Erreur"); return; }
    toast.success(newStatut === "connecte" ? "Connecteur active" : "Connecteur desactive");
    await loadConnecteurs();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) throw new Error("Cabinet non trouve");

      const { error } = await supabase.from("cabinet_connecteurs").insert({
        cabinet_id: cab.id,
        nom: form.nom,
        type: form.type,
        statut: "deconnecte",
      });
      if (error) throw error;
      toast.success("Connecteur ajoute");
      setAddOpen(false);
      setForm({ nom: "", type: "registre" });
      await loadConnecteurs();
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Plug className="h-5 w-5 text-blue-400" /> Connecteurs
          </h2>
          <p className="text-sm text-slate-400">Gerez les connexions aux APIs externes.</p>
        </div>
        <div className="flex items-center gap-2">
          {connecteurs.length === 0 && (
            <Button variant="outline" size="sm" onClick={initDefaults} className="gap-2 border-white/10 text-slate-300 hover:bg-white/[0.04]">
              <RefreshCcw className="h-4 w-4" /> Initialiser les connecteurs
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter un connecteur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau connecteur</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Pappers" required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Ajout..." : "Ajouter"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {connecteurs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Plug className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun connecteur configure.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={initDefaults}>
            Initialiser les connecteurs par defaut
          </Button>
        </div>
      ) : (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-white/[0.02]">
                <TableHead className="text-slate-400">Connecteur</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Statut</TableHead>
                <TableHead className="text-slate-400">Premiere connexion</TableHead>
                <TableHead className="text-slate-400">Derniere activite</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connecteurs.map((c) => {
                const config = STATUT_CONFIG[c.statut];
                const StatusIcon = config.icon;
                const defaultInfo = DEFAULT_CONNECTEURS.find((d) => d.nom === c.nom);
                return (
                  <TableRow key={c.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-200">{c.nom}</p>
                        {defaultInfo && <p className="text-xs text-slate-500">{defaultInfo.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-slate-400 border-slate-700">
                        {TYPE_LABELS[c.type] || c.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 ${config.color}`}>
                        <StatusIcon className="h-3 w-3" /> {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(c.derniere_connexion)}</TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(c.derniere_activite)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatut(c)}
                        className={c.statut === "connecte" ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}
                      >
                        {c.statut === "connecte" ? "Deconnecter" : "Connecter"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
