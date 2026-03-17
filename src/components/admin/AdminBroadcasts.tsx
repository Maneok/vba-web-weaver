import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Plus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  target: string;
  recipients_count: number;
  created_at: string;
  sent_by: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function loadBroadcasts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_broadcasts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBroadcasts((data ?? []) as unknown as Broadcast[]);
    } catch (err) {
      console.error("[AdminBroadcasts] Load error:", err);
      toast.error("Erreur lors du chargement des annonces");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast.error("Veuillez remplir le titre et le message");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc("admin_send_broadcast", {
        p_title: title,
        p_message: message,
        p_target: target,
      });
      if (error) throw error;
      toast.success("Annonce envoyee avec succes");
      setDialogOpen(false);
      setTitle("");
      setMessage("");
      setTarget("all");
      loadBroadcasts();
    } catch (err) {
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
      {/* New Broadcast Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Nouvelle annonce
        </button>
      </div>

      {/* Broadcasts List */}
      {broadcasts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <Megaphone className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune annonce envoyee</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-200">{b.title}</h4>
                  <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{b.message}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                    {targetLabels[b.target] ?? b.target}
                  </span>
                  <p className="text-xs text-slate-500">{b.recipients_count} destinataire(s)</p>
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
            <DialogDescription>Redigez une annonce a diffuser aux cabinets.</DialogDescription>
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
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-45 transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Envoi..." : "Envoyer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
