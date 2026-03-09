import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Pencil, Save, X, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CabinetInfo {
  siret: string;
  numero_oec: string;
  croec: string;
  adresse: string;
  cp: string;
  ville: string;
  rc_pro_assureur: string;
  rc_pro_police: string;
  rc_pro_expiration: string;
  raison_sociale: string;
}

const EMPTY_INFO: CabinetInfo = {
  siret: "", numero_oec: "", croec: "", adresse: "", cp: "", ville: "",
  rc_pro_assureur: "", rc_pro_police: "", rc_pro_expiration: "", raison_sociale: "",
};

export default function InfosCabinet() {
  const [info, setInfo] = useState<CabinetInfo>({ ...EMPTY_INFO });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CabinetInfo>({ ...EMPTY_INFO });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCabinetInfo();
  }, []);

  const loadCabinetInfo = async () => {
    try {
      const { data } = await supabase
        .from("parametres")
        .select("value")
        .eq("key", "cabinet_info")
        .maybeSingle();
      if (data?.value) {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setInfo({ ...EMPTY_INFO, ...parsed });
      }
    } catch {
      // silent — will use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditForm({ ...info });
    setEditing(true);
  };

  const handleSave = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("parametres")
        .upsert({ key: "cabinet_info", value: editForm as unknown as Record<string, unknown> }, { onConflict: "key" });
      if (error) throw error;
      setInfo({ ...editForm });
      setEditing(false);
      toast.success("Informations du cabinet mises a jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  }, [editForm]);

  const isRcProExpired = () => {
    if (!info.rc_pro_expiration) return false;
    return new Date(info.rc_pro_expiration) < new Date();
  };

  const isRcProSoon = () => {
    if (!info.rc_pro_expiration) return false;
    const exp = new Date(info.rc_pro_expiration);
    const now = new Date();
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  if (loading) {
    return (
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-700 rounded w-1/3" />
            <div className="h-4 bg-slate-700 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Informations du cabinet
        </CardTitle>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Raison sociale</Label>
              <Input value={editForm.raison_sociale} onChange={e => setEditForm(p => ({ ...p, raison_sociale: e.target.value }))} placeholder="Cabinet X" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">SIRET</Label>
              <Input value={editForm.siret} onChange={e => setEditForm(p => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">N° OEC</Label>
              <Input value={editForm.numero_oec} onChange={e => setEditForm(p => ({ ...p, numero_oec: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">CROEC</Label>
              <Input value={editForm.croec} onChange={e => setEditForm(p => ({ ...p, croec: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Adresse</Label>
              <Input value={editForm.adresse} onChange={e => setEditForm(p => ({ ...p, adresse: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Code postal</Label>
              <Input value={editForm.cp} onChange={e => setEditForm(p => ({ ...p, cp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Ville</Label>
              <Input value={editForm.ville} onChange={e => setEditForm(p => ({ ...p, ville: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Assureur RC Pro</Label>
              <Input value={editForm.rc_pro_assureur} onChange={e => setEditForm(p => ({ ...p, rc_pro_assureur: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">N° police RC Pro</Label>
              <Input value={editForm.rc_pro_police} onChange={e => setEditForm(p => ({ ...p, rc_pro_police: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Expiration RC Pro</Label>
              <Input type="date" value={editForm.rc_pro_expiration} onChange={e => setEditForm(p => ({ ...p, rc_pro_expiration: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            <InfoField label="Raison sociale" value={info.raison_sociale} />
            <InfoField label="SIRET" value={info.siret} />
            <InfoField label="N° OEC" value={info.numero_oec} />
            <InfoField label="CROEC" value={info.croec} />
            <InfoField label="Adresse" value={[info.adresse, info.cp, info.ville].filter(Boolean).join(", ")} />
            <div className="space-y-0.5">
              <span className="text-xs text-slate-500">RC Pro</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">{info.rc_pro_assureur || "---"}</span>
                {info.rc_pro_police && <span className="text-xs text-slate-500">({info.rc_pro_police})</span>}
                {info.rc_pro_expiration && (
                  isRcProExpired() ? (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" /> Expiree
                    </Badge>
                  ) : isRcProSoon() ? (
                    <Badge className="bg-amber-500/15 text-amber-400 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" /> Expire bientot
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-400 text-xs gap-1">
                      <Shield className="w-3 h-3" /> Valide
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <p className="text-sm">{value || "---"}</p>
    </div>
  );
}
