import React from "react";

interface DashboardAccessibilityProps {
  children: React.ReactNode;
  announcements: string[];
}

export default function DashboardAccessibility({
  children,
  announcements,
}: DashboardAccessibilityProps) {
  const latestAnnouncement = announcements.length > 0
    ? announcements[announcements.length - 1]
    : "";

  return (
    <>
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Aller au contenu principal
      </a>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {latestAnnouncement}
      </div>

      <div id="dashboard-main">
        {children}
      </div>
    </>
  );
}
