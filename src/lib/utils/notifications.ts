/**
 * Notification building and formatting utilities.
 */

export interface AppNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Create a notification object with defaults */
export function createNotification(
  params: Pick<AppNotification, "type" | "title" | "message"> & Partial<AppNotification>
): AppNotification {
  return {
    id: params.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: params.type,
    title: params.title,
    message: params.message,
    timestamp: params.timestamp ?? new Date().toISOString(),
    read: params.read ?? false,
    actionUrl: params.actionUrl,
    metadata: params.metadata,
  };
}

/** Determine notification priority from type and context */
export function getNotificationPriority(notification: AppNotification): {
  priority: "critique" | "haute" | "normale" | "basse";
  sortOrder: number;
} {
  if (notification.type === "error") {
    return { priority: "critique", sortOrder: 0 };
  }
  if (notification.type === "warning") {
    return { priority: "haute", sortOrder: 1 };
  }
  if (notification.type === "success") {
    return { priority: "normale", sortOrder: 2 };
  }
  return { priority: "basse", sortOrder: 3 };
}

/** Group notifications by date (today, yesterday, this week, older) */
export function groupNotifications(notifications: AppNotification[]): Record<string, AppNotification[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, AppNotification[]> = {
    "Aujourd'hui": [],
    "Hier": [],
    "Cette semaine": [],
    "Plus ancien": [],
  };

  for (const notif of notifications) {
    const date = new Date(notif.timestamp);
    if (date >= today) {
      groups["Aujourd'hui"].push(notif);
    } else if (date >= yesterday) {
      groups["Hier"].push(notif);
    } else if (date >= weekAgo) {
      groups["Cette semaine"].push(notif);
    } else {
      groups["Plus ancien"].push(notif);
    }
  }

  // Remove empty groups
  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key];
  }

  return groups;
}

/** Format notification message with relative time */
export function formatNotificationMessage(notification: AppNotification): {
  displayTitle: string;
  displayTime: string;
  displayType: string;
} {
  const now = Date.now();
  const ts = new Date(notification.timestamp).getTime();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);

  let displayTime: string;
  if (diffMin < 1) displayTime = "A l'instant";
  else if (diffMin < 60) displayTime = `Il y a ${diffMin} min`;
  else if (diffH < 24) displayTime = `Il y a ${diffH}h`;
  else displayTime = new Date(notification.timestamp).toLocaleDateString("fr-FR");

  const typeLabels: Record<string, string> = {
    info: "Information",
    warning: "Attention",
    error: "Erreur",
    success: "Succes",
  };

  return {
    displayTitle: notification.title,
    displayTime,
    displayType: typeLabels[notification.type] ?? "Notification",
  };
}
