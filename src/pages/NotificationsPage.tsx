import { useState, useEffect, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Bell, AlertTriangle, CreditCard, Clock, Check, CheckCheck, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import { timeAgo, formatDateTimeFR } from "@/lib/dateUtils";

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lue: boolean;
  created_at: string;
  lien?: string;
}

type FilterType = "all" | "unread" | "urgent";

const PAGE_SIZE = 20;

function getNotifIcon(type: string) {
  switch (type) {
    case "SUSPENSION":
      return <AlertTriangle className="h-5 w-5 text-red-400" />;
    case "PAIEMENT":
      return <CreditCard className="h-5 w-5 text-emerald-400" />;
    case "TRIAL":
      return <Clock className="h-5 w-5 text-amber-400" />;
    default:
      return <Bell className="h-5 w-5 text-blue-400" />;
  }
}

function getTypeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    SUSPENSION: { label: "Suspension", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    PAIEMENT: { label: "Paiement", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    TRIAL: { label: "Essai", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  };
  const info = map[type] ?? { label: type, className: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
  return <Badge variant="outline" className={`text-[10px] ${info.className}`}>{info.label}</Badge>;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { session } = useAuth();

  useDocumentTitle("Notifications");

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!session) return;
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      let query = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (filter === "unread") {
        query = query.eq("lue", false);
      } else if (filter === "urgent") {
        query = query.eq("type", "SUSPENSION");
      }

      const { data, error } = await query;
      if (error) throw error;

      const results = (data as Notification[]) ?? [];
      setHasMore(results.length === PAGE_SIZE);

      if (reset || currentPage === 0) {
        setNotifications(results);
      } else {
        setNotifications(prev => [...prev, ...results]);
      }
    } catch {
      toast.error("Impossible de charger les notifications");
    } finally {
      setLoading(false);
    }
  }, [session, filter, page]);

  useEffect(() => {
    setPage(0);
    setNotifications([]);
    setSelectedId(null);
  }, [filter]);

  useEffect(() => {
    fetchNotifications(page === 0);
  }, [fetchNotifications, page]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true })
        .eq("id", id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch {
      toast.error("Impossible de marquer comme lu");
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.lue);
    if (unread.length === 0) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true })
        .in("id", unread.map(n => n.id));
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
      toast.success("Toutes les notifications ont ete marquees comme lues");
    } catch {
      toast.error("Impossible de tout marquer comme lu");
    }
  }, [notifications]);

  const selected = selectedId ? notifications.find(n => n.id === selectedId) : null;
  const unreadCount = notifications.filter(n => !n.lue).length;

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "unread", label: "Non lues" },
    { key: "urgent", label: "Urgentes" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est a jour"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        {filterButtons.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-6 w-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Chargement des notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucune notification</p>
            <p className="text-xs text-slate-600 mt-1">
              {filter !== "all" ? "Essayez un autre filtre" : "Vous n'avez aucune notification pour le moment"}
            </p>
          </div>
        ) : (
          <>
            {notifications.map(n => (
              <div
                key={n.id}
                className={`group flex items-start gap-4 px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors ${
                  !n.lue ? "bg-blue-500/[0.03]" : ""
                } ${selectedId === n.id ? "bg-white/[0.04] ring-1 ring-blue-500/20" : ""}`}
                onClick={() => setSelectedId(selectedId === n.id ? null : n.id)}
              >
                <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm ${!n.lue ? "font-semibold text-slate-100" : "font-medium text-slate-300"}`}>
                      {n.titre}
                    </p>
                    {!n.lue && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    {getTypeBadge(n.type)}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1.5">{timeAgo(n.created_at)}</p>

                  {/* Expanded detail */}
                  {selectedId === n.id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                      <p className="text-xs text-slate-400">{n.message}</p>
                      <p className="text-[10px] text-slate-600">{formatDateTimeFR(n.created_at)}</p>
                      <div className="flex items-center gap-2 pt-1">
                        {!n.lue && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          >
                            <Check className="h-3 w-3" /> Marquer comme lu
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!n.lue && selectedId !== n.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-all"
                    aria-label="Marquer comme lu"
                    title="Marquer comme lu"
                  >
                    <Check className="h-4 w-4 text-slate-500 hover:text-emerald-400" />
                  </button>
                )}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="p-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="text-xs text-slate-400"
                >
                  {loading ? "Chargement..." : "Charger plus"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
