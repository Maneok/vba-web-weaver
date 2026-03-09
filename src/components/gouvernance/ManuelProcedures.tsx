import { useState, useMemo, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import { manuelService, lecturesService, type ManuelVersion, type LectureRecord } from "@/lib/gouvernanceService";
import { logsService } from "@/lib/supabaseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Eye, Plus, Clock, CheckCircle2, Send,
  Users, AlertCircle, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export function formatDate(dateStr: string): string {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function daysSince(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `dans ${Math.abs(days)} jour(s)`;
  if (days === 0) return "aujourd'hui";
  if (days < 30) return `il y a ${days} jour(s)`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an(s)`;
}

const DEFAULT_VERSIONS: ManuelVersion[] = [
  {
    id: "v3", version: "v3", date: "2026-01-15", statut: "VALIDE",
    resume: "Mise a jour suite aux nouvelles lignes directrices TRACFIN",
    contenu: "Manuel de procedures LCB-FT - Version 3\n\n1. Identification et verification d'identite\n2. Classification des risques\n3. Vigilance constante\n4. Declaration de soupcon\n5. Conservation des documents\n6. Formation du personnel\n7. Controle interne",
  },
  {
    id: "v2", version: "v2", date: "2025-01-10", statut: "ARCHIVE",
    resume: "Ajout de la procedure de gel des avoirs",
    contenu: "Manuel de procedures LCB-FT - Version 2",
  },
  {
    id: "v1", version: "v1", date: "2024-03-01", statut: "ARCHIVE",
    resume: "Version initiale du manuel de procedures",
    contenu: "Manuel de procedures LCB-FT - Version 1",
  },
];

export default function ManuelProcedures() {
  const { collaborateurs } = useAppState();
  const [versions, setVersions] = useState<ManuelVersion[]>([]);
  const [lectures, setLectures] = useState<LectureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ManuelVersion | null>(null);
  const [newVersion, setNewVersion] = useState({ resume: "", contenu: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      let versionsData = await manuelService.getAll();
      if (versionsData.length === 0) {
        for (const v of DEFAULT_VERSIONS) {
          await manuelService.create(v);
        }
        versionsData = DEFAULT_VERSIONS;
      }
      setVersions(versionsData);
      const lecturesData = await lecturesService.getAll();
      setLectures(lecturesData);
    } catch (err) {
      logger.error("ManuelProcedures", "loadData error:", err);
      setVersions(DEFAULT_VERSIONS);
    } finally {
      setLoading(false);
    }
  };

  const currentVersion = useMemo(() =>
    versions.find(v => v.statut === "VALIDE") || versions[0],
    [versions]
  );

  const lectureStatus = useMemo(() => {
    if (!currentVersion) return [];
    const lectureMap = new Map(
      lectures.filter(l => l.manuel_version_id === currentVersion.id).map(l => [l.collaborateur, l])
    );
    return collaborateurs.map(c => ({
      collaborateur: c.nom,
      dateLecture: lectureMap.get(c.nom)?.date_lecture || null,
      lectureId: lectureMap.get(c.nom)?.id || null,
    }));
  }, [currentVersion, lectures, collaborateurs]);

  const readCount = lectureStatus.filter(l => l.dateLecture).length;
  const totalCollabs = collaborateurs.length;

  const handleView = (version: ManuelVersion) => {
    setViewingVersion(version);
    setShowViewDialog(true);
  };

  const handleNewVersion = useCallback(async () => {
    if (!newVersion.resume) {
      toast.error("Le resume est requis");
      return;
    }
    setSaving(true);
    try {
      const vNum = versions.length + 1;
      const newV: Omit<ManuelVersion, "id"> & { id?: string } = {
        version: `v${vNum}`,
        date: new Date().toISOString().split("T")[0],
        statut: "VALIDE",
        resume: newVersion.resume,
        contenu: newVersion.contenu || "Nouveau manuel de procedures",
      };
      for (const v of versions.filter(v => v.statut === "VALIDE")) {
        await manuelService.update(v.id, { statut: "ARCHIVE" });
      }
      const created = await manuelService.create(newV);
      if (created) {
        setVersions(prev => [created, ...prev.map(v => ({ ...v, statut: "ARCHIVE" as const }))]);
        toast.success("Nouvelle version creee");
        logsService.add("CREATE_MANUEL_VERSION", `Version ${newV.version} du manuel creee`, undefined, "manuel_procedures").catch(() => {});
      }
      setNewVersion({ resume: "", contenu: "" });
      setShowNewDialog(false);
    } catch (err) {
      logger.error("ManuelProcedures", "handleNewVersion error:", err);
      toast.error("Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }, [newVersion, versions]);

  const handleRelance = () => {
    const nonLus = lectureStatus.filter(l => !l.dateLecture).map(l => l.collaborateur);
    if (nonLus.length === 0) {
      toast.info("Tous les collaborateurs ont lu le manuel");
      return;
    }
    const emails = collaborateurs
      .filter(c => nonLus.includes(c.nom) && c.email)
      .map(c => c.email)
      .join(",");
    if (emails) {
      window.open(`mailto:${emails}?subject=Rappel%20lecture%20Manuel%20LCB-FT`);
    }
    toast.success(`Relance envoyee a ${nonLus.length} collaborateur(s)`);
  };

  const handleMarkRead = useCallback(async (collabName: string) => {
    if (!currentVersion) return;
    try {
      const record: Omit<LectureRecord, "id"> & { id?: string } = {
        manuel_version_id: currentVersion.id,
        collaborateur: collabName,
        date_lecture: new Date().toISOString().split("T")[0],
      };
      const created = await lecturesService.create(record);
      if (created) {
        setLectures(prev => [...prev, created]);
        toast.success(`${collabName} marque comme lecteur`);
      }
    } catch (err) {
      logger.error("ManuelProcedures", "handleMarkRead error:", err);
      toast.error("Erreur");
    }
  }, [currentVersion]);

  const nextReviewDate = currentVersion ? (() => {
    const d = new Date(currentVersion.date);
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  })() : null;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Manuel actuel */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Manuel de procedures LCB-FT</h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-sm text-slate-400">Version actuelle : <strong>{currentVersion?.version}</strong> du {formatDate(currentVersion?.date || "")}</span>
                  <Badge className="bg-emerald-500/15 text-emerald-400 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> VALIDE
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Derniere MAJ : {daysSince(currentVersion?.date || "")}</span>
                  {nextReviewDate && (
                    <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Prochaine revue : {formatDate(nextReviewDate)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => currentVersion && handleView(currentVersion)}>
                <Eye className="w-3.5 h-3.5" /> Voir
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setShowNewDialog(true)}>
                <Plus className="w-3.5 h-3.5" /> Nouvelle version
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diffusion */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Diffusion — Lu par {readCount}/{totalCollabs} collaborateur(s)
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRelance}>
            <Send className="w-3.5 h-3.5" /> Relancer les non-lecteurs
          </Button>
        </CardHeader>
        <CardContent>
          {lectureStatus.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucun collaborateur enregistre</p>
          ) : (
            <div className="space-y-2">
              {lectureStatus.map(l => (
                <div key={l.collaborateur} className="flex items-center justify-between py-2 px-3 rounded-md bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${l.dateLecture ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-sm">{l.collaborateur}</span>
                  </div>
                  {l.dateLecture ? (
                    <span className="text-xs text-slate-500">Lu le {formatDate(l.dateLecture)}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500/15 text-red-400 text-xs">Non lu</Badge>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleMarkRead(l.collaborateur)}>
                        Marquer lu
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            Historique des versions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
            <div className="space-y-4 pl-8">
              {versions.map(v => (
                <div key={v.id} className="relative">
                  <div className={`absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                    v.statut === "VALIDE" ? "bg-emerald-400 border-emerald-400" : "bg-slate-700 border-slate-600"
                  }`} />
                  <button onClick={() => handleView(v)}
                    className="w-full text-left p-3 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v.version}</span>
                        <Badge className={`text-xs ${v.statut === "VALIDE" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                          {v.statut}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{formatDate(v.date)}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{v.resume}</p>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog View */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              {viewingVersion?.version} — {formatDate(viewingVersion?.date || "")}
            </DialogTitle>
            <DialogDescription>{viewingVersion?.resume}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-slate-300 bg-white/[0.02] p-4 rounded-md border border-white/[0.06]">
            {viewingVersion?.contenu}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog New */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              Nouvelle version du manuel
            </DialogTitle>
            <DialogDescription>Creez une nouvelle version qui remplacera la version actuelle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Resume des modifications *</Label>
              <Input value={newVersion.resume} onChange={e => setNewVersion(p => ({ ...p, resume: e.target.value }))} placeholder="Ex: Mise a jour procedure gel des avoirs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Contenu</Label>
              <Textarea value={newVersion.contenu} onChange={e => setNewVersion(p => ({ ...p, contenu: e.target.value }))} rows={8} placeholder="Contenu du manuel..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewDialog(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleNewVersion} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Creer la version
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
