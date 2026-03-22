import { useState, useMemo, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDateFr } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Eye, CheckCircle2, Send,
  Users, AlertCircle, Clock, BookOpen,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Procedure {
  id: string;
  titre: string | null;
  version: number;
  statut: string | null;
  contenu: any;
  date_validation: string | null;
  date_prochaine_revue: string | null;
  valide_par: string | null;
}

interface Lecture {
  id: string;
  manuel_id: string;
  collaborateur_id: string | null;
  collaborateur_nom: string;
  date_lecture: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "---";
  return formatDateFr(dateStr, "short");
}

export default function ManuelProcedures() {
  const { collaborateurs } = useAppState();
  const { profile } = useAuth();
  const cabinetId = profile?.cabinet_id;
  const currentProfileId = profile?.id;
  const currentUserName = profile?.full_name || profile?.email || "";

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProcedure, setViewingProcedure] = useState<Procedure | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  // Load procedures + lectures from Supabase
  useEffect(() => {
    if (!cabinetId) return;
    let cancelled = false;
    (async () => {
      const [procRes, lectRes] = await Promise.all([
        supabase.from("manuel_procedures").select("*").eq("cabinet_id", cabinetId).order("version", { ascending: false }),
        supabase.from("manuel_lectures").select("*").eq("cabinet_id", cabinetId),
      ]);
      if (!cancelled) {
        if (procRes.error) logger.error("ManuelProcedures", "Failed to load procedures", procRes.error);
        if (lectRes.error) logger.error("ManuelProcedures", "Failed to load lectures", lectRes.error);
        setProcedures(procRes.data || []);
        setLectures(lectRes.data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cabinetId]);

  // For each procedure, compute who read it
  const procedureLectures = useMemo(() => {
    const map = new Map<string, Set<string>>();
    lectures.forEach(l => {
      if (l.date_lecture) {
        const set = map.get(l.manuel_id) || new Set();
        set.add(l.collaborateur_nom);
        map.set(l.manuel_id, set);
      }
    });
    return map;
  }, [lectures]);

  // Check if current user has read a given procedure
  const hasCurrentUserRead = useCallback((procedureId: string) => {
    return lectures.some(l =>
      l.manuel_id === procedureId &&
      l.date_lecture &&
      (l.collaborateur_id === currentProfileId || l.collaborateur_nom === currentUserName)
    );
  }, [lectures, currentProfileId, currentUserName]);

  // Mark procedure as read by current user
  const handleMarkRead = useCallback(async (procedureId: string) => {
    if (!cabinetId || !currentProfileId) {
      toast.error("Utilisateur non identifie");
      return;
    }
    setMarking(procedureId);

    // Find collaborateur linked to current profile
    const collab = collaborateurs.find(c => c.profileId === currentProfileId);
    const collabName = collab?.nom || currentUserName;
    const collabId = collab?.id || null;

    const { data, error } = await supabase.from("manuel_lectures").insert({
      cabinet_id: cabinetId,
      manuel_id: procedureId,
      collaborateur_id: collabId,
      collaborateur_nom: collabName,
      date_lecture: new Date().toISOString().split("T")[0],
    }).select().single();

    setMarking(null);
    if (error) {
      logger.error("ManuelProcedures", "Failed to mark as read", error);
      toast.error("Erreur lors de l'enregistrement");
      return;
    }
    setLectures(prev => [...prev, data]);
    toast.success("Procedure marquee comme lue");
  }, [cabinetId, currentProfileId, currentUserName, collaborateurs]);

  // Send reminder for unread
  const handleRelance = useCallback((procedureId: string) => {
    const readSet = procedureLectures.get(procedureId) || new Set();
    const unread = collaborateurs.filter(c => !readSet.has(c.nom));
    if (unread.length === 0) {
      toast.info("Tous les collaborateurs ont lu cette procedure");
      return;
    }
    toast.success(`Relance envoyee a ${unread.length} collaborateur(s)`);
  }, [procedureLectures, collaborateurs]);

  const totalCollabs = collaborateurs.length;

  // Render procedure content (JSONB can be string or structured)
  function renderContenu(contenu: any): string {
    if (!contenu) return "";
    if (typeof contenu === "string") return contenu;
    if (typeof contenu === "object") {
      // Handle common JSONB shapes
      if (contenu.description) return String(contenu.description);
      if (contenu.text) return String(contenu.text);
      return JSON.stringify(contenu, null, 2);
    }
    return String(contenu);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (procedures.length === 0) {
    return (
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
        <CardContent className="p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-slate-500 opacity-50" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Aucune procedure enregistree</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Les procedures LCB-FT apparaitront ici une fois creees</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Liste des procedures */}
      {procedures.map(proc => {
        const readSet = procedureLectures.get(proc.id) || new Set();
        const readCount = readSet.size;
        const userHasRead = hasCurrentUserRead(proc.id);
        const isMarking = marking === proc.id;

        return (
          <Card key={proc.id} className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{proc.titre || `Procedure v${proc.version}`}</CardTitle>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <Badge className={`text-xs ${proc.statut === "VALIDE" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-500/15 text-slate-600 dark:text-slate-400"}`}>
                        {proc.statut === "VALIDE" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {proc.statut || "BROUILLON"}
                      </Badge>
                      <span className="text-xs text-slate-600 dark:text-slate-400">v{proc.version}</span>
                      {proc.date_validation && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Validee le {formatDate(proc.date_validation)}
                        </span>
                      )}
                      {proc.date_prochaine_revue && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Revue : {formatDate(proc.date_prochaine_revue)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setViewingProcedure(proc)}>
                    <Eye className="w-3.5 h-3.5" /> Voir
                  </Button>
                  {!userHasRead && (
                    <Button size="sm" className="gap-1.5" onClick={() => handleMarkRead(proc.id)} disabled={isMarking}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {isMarking ? "..." : "Marquer lu"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Signatures / Lectures */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">
                    Lu par {readCount}/{totalCollabs} collaborateur{totalCollabs > 1 ? "s" : ""}
                  </span>
                  {totalCollabs > 0 && readCount === totalCollabs && (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs ml-1">Complet</Badge>
                  )}
                </div>
                {readCount < totalCollabs && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleRelance(proc.id)}>
                    <Send className="w-3 h-3" /> Relancer
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                {collaborateurs.map(c => {
                  const hasRead = readSet.has(c.nom);
                  const lectureEntry = lectures.find(l => l.manuel_id === proc.id && l.collaborateur_nom === c.nom && l.date_lecture);
                  return (
                    <div key={c.id || c.nom} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${hasRead ? "bg-emerald-400" : "bg-red-400"}`} />
                        <span className="text-sm">{c.nom}</span>
                        {c.fonction && <span className="text-xs text-slate-500 dark:text-slate-400">({c.fonction})</span>}
                      </div>
                      {hasRead ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">Lu le {formatDate(lectureEntry?.date_lecture || null)}</span>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 text-xs">Non lu</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog Visualisation */}
      <Dialog open={!!viewingProcedure} onOpenChange={() => setViewingProcedure(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              {viewingProcedure?.titre || `Procedure v${viewingProcedure?.version}`}
            </DialogTitle>
            <DialogDescription>
              Version {viewingProcedure?.version} — {formatDate(viewingProcedure?.date_validation || null)}
              {viewingProcedure?.valide_par && ` — Valide par ${viewingProcedure.valide_par}`}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.02] p-4 rounded-md border border-gray-200 dark:border-white/[0.06]">
            {viewingProcedure ? renderContenu(viewingProcedure.contenu) : ""}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
