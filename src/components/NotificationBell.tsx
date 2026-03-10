import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, CreditCard, Clock, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lue: boolean;
  created_at: string;
  lien?: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function getNotifIcon(type: string) {
  switch (type) {
    case "SUSPENSION":
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    case "PAIEMENT":
      return <CreditCard className="h-4 w-4 text-emerald-400" />;
    case "TRIAL":
      return <Clock className="h-4 w-4 text-amber-400" />;
    default:
      return <Bell className="h-4 w-4 text-blue-400" />;
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("lue", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications((data as Notification[]) ?? []);
    } catch (err) {
      logger.debug("Notifications", "fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true })
        .eq("id", id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      toast({ title: "Erreur", description: "Impossible de marquer comme lu", variant: "destructive" });
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (notifications.length === 0) return;
    try {
      const ids = notifications.map(n => n.id);
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true })
        .in("id", ids);
      if (error) throw error;
      setNotifications([]);
    } catch {
      toast({ title: "Erreur", description: "Impossible de tout marquer comme lu", variant: "destructive" });
    }
  }, [notifications]);

  const handleNotifClick = useCallback((n: Notification) => {
    if (n.lien) {
      navigate(n.lien);
      setOpen(false);
    }
  }, [navigate]);

  const unreadCount = notifications.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          aria-label={`Notifications (${unreadCount} non lues)`}
        >
          <Bell className="h-4 w-4 text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-slate-900 border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 1 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Tout marquer comme lu"
              >
                <CheckCheck className="h-3 w-3" /> Tout lire
              </button>
            )}
            <button
              onClick={() => { navigate("/notifications"); setOpen(false); }}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              Voir tout
            </button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto" role="list">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="h-5 w-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Chargement...</p>
            </div>
          ) : unreadCount === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune notification</p>
              <p className="text-xs text-slate-600 mt-1">Tout est a jour</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                role="listitem"
                className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] group ${n.lien ? "cursor-pointer" : ""}`}
                onClick={() => handleNotifClick(n)}
              >
                <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{n.titre}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{formatRelativeTime(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => markAsRead(n.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-white/[0.06]"
                  aria-label="Marquer comme lu"
                  title="Marquer comme lu"
                >
                  <Check className="h-3.5 w-3.5 text-slate-500 hover:text-emerald-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
