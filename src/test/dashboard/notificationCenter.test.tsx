import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardNotificationCenter from "@/components/dashboard/DashboardNotificationCenter";

const sampleNotifications = [
  {
    id: "1",
    titre: "Alerte PPE",
    message: "Client SCI Dupont détecté comme PPE",
    type: "conformite" as const,
    lue: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    titre: "Revue échue",
    message: "Revue annuelle de SARL Tech est en retard",
    type: "revue" as const,
    lue: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "3",
    titre: "Mise à jour système",
    message: "Nouvelle version disponible",
    type: "systeme" as const,
    lue: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const defaultProps = {
  notifications: sampleNotifications,
  onMarkAsRead: vi.fn(),
  onMarkAllAsRead: vi.fn(),
  isLoading: false,
};

describe("DashboardNotificationCenter", () => {
  it("renders bell icon trigger button", () => {
    render(<DashboardNotificationCenter {...defaultProps} />);
    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it("shows unread count badge when notifications exist", () => {
    render(<DashboardNotificationCenter {...defaultProps} />);
    // 2 unread notifications (id 1 and 3)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("no badge when all notifications are read", () => {
    const allRead = sampleNotifications.map((n) => ({ ...n, lue: true }));
    render(
      <DashboardNotificationCenter {...defaultProps} notifications={allRead} />
    );
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("opens popover on click", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows 'Notifications' header in popover", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    const header = screen.getByText("Notifications");
    expect(header.tagName).toBe("H3");
  });

  it("shows notification titles", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("Alerte PPE")).toBeInTheDocument();
    expect(screen.getByText("Revue échue")).toBeInTheDocument();
    expect(screen.getByText("Mise à jour système")).toBeInTheDocument();
  });

  it("shows notification messages", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(
      screen.getByText("Client SCI Dupont détecté comme PPE")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Revue annuelle de SARL Tech est en retard")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nouvelle version disponible")
    ).toBeInTheDocument();
  });

  it("shows 'Aucune notification' when empty", async () => {
    const user = userEvent.setup();
    render(
      <DashboardNotificationCenter
        {...defaultProps}
        notifications={[]}
      />
    );
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("Aucune notification")).toBeInTheDocument();
  });

  it("shows 'Tout marquer comme lu' button", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(
      screen.getByRole("button", { name: /tout marquer comme lu/i })
    ).toBeInTheDocument();
  });

  it("calls onMarkAsRead when clicking an unread notification", async () => {
    const onMarkAsRead = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardNotificationCenter
        {...defaultProps}
        onMarkAsRead={onMarkAsRead}
      />
    );
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(screen.getByText("Alerte PPE"));
    expect(onMarkAsRead).toHaveBeenCalledWith("1");
  });

  it("calls onMarkAllAsRead when clicking 'Tout marquer comme lu'", async () => {
    const onMarkAllAsRead = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardNotificationCenter
        {...defaultProps}
        onMarkAllAsRead={onMarkAllAsRead}
      />
    );
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(
      screen.getByRole("button", { name: /tout marquer comme lu/i })
    );
    expect(onMarkAllAsRead).toHaveBeenCalledOnce();
  });

  it("shows loading skeleton when isLoading=true", async () => {
    const user = userEvent.setup();
    render(
      <DashboardNotificationCenter {...defaultProps} isLoading={true} />
    );
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    // Skeleton renders in a portal, query the whole document
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // Should not show any notification titles
    expect(screen.queryByText("Alerte PPE")).not.toBeInTheDocument();
  });

  it("unread notifications have visual distinction (border accent or bold)", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));

    // Unread notification title should be font-semibold
    const unreadTitle = screen.getByText("Alerte PPE");
    expect(unreadTitle.className).toContain("font-semibold");

    // Read notification title should be font-medium (not semibold)
    const readTitle = screen.getByText("Revue échue");
    expect(readTitle.className).toContain("font-medium");
    expect(readTitle.className).not.toContain("font-semibold");

    // Unread notification container should have border-l-2 class
    const unreadButton = unreadTitle.closest("button");
    expect(unreadButton?.className).toContain("border-l-2");
  });

  it("shows time ago format", async () => {
    const user = userEvent.setup();
    render(<DashboardNotificationCenter {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));

    // First notification: just now
    expect(screen.getByText("à l'instant")).toBeInTheDocument();
    // Second notification: 1 hour ago
    expect(screen.getByText("il y a 1 h")).toBeInTheDocument();
    // Third notification: yesterday
    expect(screen.getByText("hier")).toBeInTheDocument();
  });
});
