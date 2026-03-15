import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Plus, Send, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Broadcast {
  id: string;
  titre: string;
  message: string;
  type: string;
  created_at: string;
  cabinet_id: string | null;
}

const targetLabels: Record<string, string> = {
  all: "Tous les cabinets",
  trialing: "Seulement trials",
  active: "Seulement actifs",
  suspended: "Seulement suspendus",
};

export default function AdminBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");

  const loadBroadcasts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Load past broadcast notifications (system-wide type 'BROADCAST')
      const { data, error } = await supabase
        .from("notifications")
        .select("id, titre, message, type, created_at, cabinet_id")
        .eq("type", "BROADCAST")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setBroadcasts((data ?? []) as unknown as Broadcast[]);
      if (showRefresh) toast.success("Annonces actualisees");
    } catch (err) {
      console.error("[AdminBroadcasts] Load error:", err);
      toast.error("Erreur lors du chargement des annonces");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast.error("Veuillez remplir le titre et le message");
      return;
    }
    setSending(true);
    try {
      // Get target cabinet IDs based on filter
      let cabinetIds: string[] = [];
      if (target === "all") {
        const { data } = await supabase.from("cabinet_subscriptions").select("cabinet_id");
        cabinetIds = (data ?? []).map((d) => d.cabinet_id);
      } else {
        const statusMap: Record<string, string> = { trialing: "trialing", active: "active", suspended: "suspended" };
        const { data } = await supabase.from("cabinet_subscriptions").select("cabinet_id").eq("status", statusMap[target] ?? target);
        cabinetIds = (data ?? []).map((d) => d.cabinet_id);
      }

      if (cabinetIds.length === 0) {
        toast.warning("Aucun cabinet correspondant a la cible selectionnee");
        setSending(false);
        return;
      }

      // Insert a notification for each target cabinet
      const notifications = cabinetIds.map((cabinet_id) => ({
        cabinet_id,
        type: "BROADCAST",
        titre: title,
        message: message,
        priority: "NORMALE",
        lue: false,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      toast.success(`Annonce envoyee a ${cabinetIds.length} cabinet(s)`);
      setDialogOpen(false);
      setTitle("");
      setMessage("");
      setTarget("all");
      loadBroadcasts();
    } catch (err) {
      console.error("[AdminBroadcasts] Send error:", err);
      toast.error("Erreur lors de l'envoi de l'annonce");
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Group broadcasts by title+message+created_at (within same minute = same broadcast)
  const groupedBroadcasts = broadcasts.reduce<Array<{ title: string; message: string; created_at: string; count: number }>>((acc, b) => {
    const key = `${b.titre}|${b.message}|${b.created_at.substring(0, 16)}`;
    const existing = acc.find((g) => `${g.title}|${g.message}|${g.created_at.substring(0, 16)}` === key);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ title: b.titre, message: b.message, created_at: b.created_at, count: 1 });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => loadBroadcasts(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser
        </button>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Nouvelle annonce
        </button>
      </div>

      {/* Broadcasts List */}
      {groupedBroadcasts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <Megaphone className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune annonce envoyee</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBroadcasts.map((b, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-200">{b.title}</h4>
                  <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{b.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-blue-300">{b.count} destinataire(s)</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-3">{formatDate(b.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Broadcast Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle annonce</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300">Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de l'annonce"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Contenu de l'annonce..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1 resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Cible</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 mt-1"
              >
                <option value="all">Tous les cabinets</option>
                <option value="trialing">Seulement trials</option>
                <option value="active">Seulement actifs</option>
                <option value="suspended">Seulement suspendus</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Envoi..." : "Envoyer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
