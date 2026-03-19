import { useState } from "react";
import { Bell, ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateFr } from "@/lib/dateUtils";

interface Notification {
  id: string;
  titre: string;
  message: string;
  type: "systeme" | "conformite" | "revue" | "alerte";
  lue: boolean;
  created_at: string;
}

interface DashboardNotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  isLoading: boolean;
}

const TYPE_ICONS: Record<Notification["type"], React.ElementType> = {
  systeme: Bell,
  conformite: ShieldAlert,
  revue: Clock,
  alerte: AlertTriangle,
};

const TYPE_COLORS: Record<Notification["type"], string> = {
  systeme: "text-blue-500",
  conformite: "text-orange-500",
  revue: "text-violet-500",
  alerte: "text-red-500",
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffDays === 1) return "hier";
  return formatDateFr(date, "dayMonth");
}

export default function DashboardNotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  isLoading,
}: DashboardNotificationCenterProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.lue).length;

  const sorted = [...notifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.lue) {
      onMarkAsRead(notification.id);
    }
    setExpandedId((prev) => (prev === notification.id ? null : notification.id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs font-semibold"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((notification) => {
                const Icon = TYPE_ICONS[notification.type];
                const iconColor = TYPE_COLORS[notification.type];
                const isExpanded = expandedId === notification.id;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3",
                      !notification.lue && "border-l-2 border-primary bg-muted/30"
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0", iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-tight",
                          !notification.lue ? "font-semibold" : "font-medium"
                        )}
                      >
                        {notification.titre}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {isExpanded
                          ? notification.message
                          : notification.message.length > 80
                            ? notification.message.slice(0, 80) + "…"
                            : notification.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {!isLoading && sorted.length > 0 && unreadCount > 0 && (
          <div className="border-t border-border px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={onMarkAllAsRead}
            >
              Tout marquer comme lu
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
