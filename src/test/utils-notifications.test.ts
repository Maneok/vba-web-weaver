/**
 * Tests for src/lib/utils/notifications.ts
 * Features #35-38: createNotification, getNotificationPriority, groupNotifications, formatNotificationMessage
 */
import { createNotification, getNotificationPriority, groupNotifications, formatNotificationMessage, type AppNotification } from "@/lib/utils/notifications";

describe("Feature #35: createNotification", () => {
  it("creates with defaults", () => {
    const n = createNotification({ type: "info", title: "Test", message: "Msg" });
    expect(n.id).toBeTruthy();
    expect(n.read).toBe(false);
    expect(n.timestamp).toBeTruthy();
    expect(n.type).toBe("info");
  });
  it("respects overrides", () => {
    const n = createNotification({ type: "error", title: "T", message: "M", read: true, id: "custom-id" });
    expect(n.id).toBe("custom-id");
    expect(n.read).toBe(true);
  });
});

describe("Feature #36: getNotificationPriority", () => {
  it("error → critique", () => {
    const n = createNotification({ type: "error", title: "", message: "" });
    expect(getNotificationPriority(n).priority).toBe("critique");
  });
  it("warning → haute", () => {
    const n = createNotification({ type: "warning", title: "", message: "" });
    expect(getNotificationPriority(n).priority).toBe("haute");
  });
  it("success → normale", () => {
    const n = createNotification({ type: "success", title: "", message: "" });
    expect(getNotificationPriority(n).priority).toBe("normale");
  });
  it("info → basse", () => {
    const n = createNotification({ type: "info", title: "", message: "" });
    expect(getNotificationPriority(n).priority).toBe("basse");
  });
  it("sortOrder: error < warning < success < info", () => {
    const e = getNotificationPriority(createNotification({ type: "error", title: "", message: "" }));
    const w = getNotificationPriority(createNotification({ type: "warning", title: "", message: "" }));
    const i = getNotificationPriority(createNotification({ type: "info", title: "", message: "" }));
    expect(e.sortOrder).toBeLessThan(w.sortOrder);
    expect(w.sortOrder).toBeLessThan(i.sortOrder);
  });
});

describe("Feature #37: groupNotifications", () => {
  it("groups by date categories", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 3 * 86400000);
    const old = new Date(now.getTime() - 30 * 86400000);

    const notifs: AppNotification[] = [
      createNotification({ type: "info", title: "1", message: "", timestamp: now.toISOString() }),
      createNotification({ type: "info", title: "2", message: "", timestamp: yesterday.toISOString() }),
      createNotification({ type: "info", title: "3", message: "", timestamp: weekAgo.toISOString() }),
      createNotification({ type: "info", title: "4", message: "", timestamp: old.toISOString() }),
    ];

    const groups = groupNotifications(notifs);
    expect(groups["Aujourd'hui"]).toHaveLength(1);
    expect(groups["Hier"]).toHaveLength(1);
    expect(groups["Cette semaine"]).toHaveLength(1);
    expect(groups["Plus ancien"]).toHaveLength(1);
  });
  it("omits empty groups", () => {
    const groups = groupNotifications([
      createNotification({ type: "info", title: "", message: "", timestamp: new Date().toISOString() }),
    ]);
    expect(groups["Hier"]).toBeUndefined();
  });
});

describe("Feature #38: formatNotificationMessage", () => {
  it("formats recent notification with relative time", () => {
    const n = createNotification({
      type: "info", title: "Alert", message: "Test",
      timestamp: new Date().toISOString(),
    });
    const result = formatNotificationMessage(n);
    expect(result.displayTitle).toBe("Alert");
    expect(result.displayTime).toMatch(/instant|min/);
    expect(result.displayType).toBe("Information");
  });
  it("formats old notification with date", () => {
    const n = createNotification({
      type: "warning", title: "Old", message: "",
      timestamp: "2025-01-01T10:00:00Z",
    });
    const result = formatNotificationMessage(n);
    expect(result.displayType).toBe("Attention");
  });
  it("formats error type", () => {
    const n = createNotification({ type: "error", title: "", message: "" });
    expect(formatNotificationMessage(n).displayType).toBe("Erreur");
  });
});
