import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, MapPin, Users, Crown } from "lucide-react";

interface Cabinet {
  id: string;
  nom: string;
  adresse: string | null;
  cp: string | null;
  ville: string | null;
  siret: string | null;
  numero_oec: string | null;
  email: string | null;
  telephone: string | null;
  couleur_primaire: string;
  is_principal: boolean;
  parent_cabinet_id: string | null;
  created_at: string;
  membre_count?: number;
}

export default function CabinetsList() {
  const { profile } = useAuth();
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", ville: "", siret: "" });
  const [saving, setSaving] = useState(false);

  const loadCabinets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinets")
        .select("*")
        .order("is_principal", { ascending: false });
      if (error) throw error;

      // Count members per cabinet
      const { data: membres } = await supabase
        .from("cabinet_membres")
        .select("cabinet_id");

      const counts: Record<string, number> = {};
      membres?.forEach((m: { cabinet_id: string }) => {
        counts[m.cabinet_id] = (counts[m.cabinet_id] || 0) + 1;
      });

      setCabinets(
        (data || []).map((c) => ({ ...c, couleur_primaire: c.couleur_primaire || "#3b82f6", membre_count: counts[c.id] || 0 })) as Cabinet[]
      );
    } catch {
      toast.error("Erreur lors du chargement des cabinets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCabinets(); }, [loadCabinets]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const parentId = cabinets.find((c) => c.is_principal)?.id;
      const { error } = await supabase.from("cabinets").insert({
        nom: form.nom,
        ville: form.ville || null,
        siret: form.siret || null,
        is_principal: false,
        parent_cabinet_id: parentId || null,
      });
      if (error) throw error;

      // Add current user as admin of new cabinet
      const { data: newCab } = await supabase
        .from("cabinets")
        .select("id")
        .eq("nom", form.nom)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (newCab && profile) {
        await supabase.from("cabinet_membres").insert({
          cabinet_id: newCab.id,
          user_id: profile.id,
          role: "ADMIN",
        });
      }

      toast.success("Cabinet ajoute");
      setAddOpen(false);
      setForm({ nom: "", ville: "", siret: "" });
      await loadCabinets();
    } catch {
      toast.error("Erreur lors de l'ajout du cabinet");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Cabinets du reseau</h2>
          <p className="text-sm text-slate-400">{cabinets.length} cabinet{cabinets.length > 1 ? "s" : ""}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter un cabinet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau cabinet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nom du cabinet</Label>
                <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Cabinet Lyon" required />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Lyon" />
              </div>
              <div className="space-y-2">
                <Label>SIRET</Label>
                <Input value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="123 456 789 00012" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Ajout..." : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] bg-white/[0.02]">
              <TableHead className="text-slate-400">Cabinet</TableHead>
              <TableHead className="text-slate-400">Ville</TableHead>
              <TableHead className="text-slate-400">SIRET</TableHead>
              <TableHead className="text-slate-400 text-center">Collaborateurs</TableHead>
              <TableHead className="text-slate-400">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cabinets.map((c) => (
              <TableRow key={c.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.couleur_primaire + "20" }}>
                      <Building2 className="h-4 w-4" style={{ color: c.couleur_primaire }} />
                    </div>
                    <span className="font-medium text-slate-200">{c.nom}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {c.ville ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="h-3 w-3" /> {c.ville}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-400 font-mono text-xs">{c.siret || "—"}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Users className="h-3 w-3" /> {c.membre_count}
                  </span>
                </TableCell>
                <TableCell>
                  {c.is_principal ? (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1">
                      <Crown className="h-3 w-3" /> Principal
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 border-slate-700">Secondaire</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
