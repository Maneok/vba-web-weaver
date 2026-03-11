import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DataFreshnessIndicator from "@/components/dashboard/DataFreshnessIndicator";

describe("DataFreshnessIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche 'À l'instant' pour un refresh < 1 minute", () => {
    const now = new Date();
    render(<DataFreshnessIndicator lastRefresh={now} />);
    expect(screen.getByText("À l'instant")).toBeInTheDocument();
  });

  it("affiche 'Il y a 1 minute' pour un refresh d'1 minute", () => {
    const oneMinAgo = new Date(Date.now() - 60000);
    render(<DataFreshnessIndicator lastRefresh={oneMinAgo} />);
    expect(screen.getByText("Il y a 1 minute")).toBeInTheDocument();
  });

  it("affiche 'Il y a N minutes' pour un refresh récent", () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60000);
    render(<DataFreshnessIndicator lastRefresh={threeMinAgo} />);
    expect(screen.getByText("Il y a 3 minutes")).toBeInTheDocument();
  });

  it("affiche 'Il y a 1 heure' pour un refresh d'1 heure", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60000);
    render(<DataFreshnessIndicator lastRefresh={oneHourAgo} />);
    expect(screen.getByText("Il y a 1 heure")).toBeInTheDocument();
  });

  it("affiche 'Il y a N heures' pour un refresh ancien", () => {
    const twoHoursAgo = new Date(Date.now() - 120 * 60000);
    render(<DataFreshnessIndicator lastRefresh={twoHoursAgo} />);
    expect(screen.getByText("Il y a 2 heures")).toBeInTheDocument();
  });

  it("n'est pas stale si refresh < seuil", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60000);
    const { container } = render(<DataFreshnessIndicator lastRefresh={twoMinAgo} staleThresholdMinutes={5} />);
    expect(container.querySelector(".text-orange-500")).toBeNull();
  });

  it("est stale si refresh >= seuil", () => {
    const sixMinAgo = new Date(Date.now() - 6 * 60000);
    const { container } = render(<DataFreshnessIndicator lastRefresh={sixMinAgo} staleThresholdMinutes={5} />);
    expect(container.querySelector(".text-orange-500")).not.toBeNull();
  });

  it("est toujours stale si refresh > 1 heure", () => {
    const twoHoursAgo = new Date(Date.now() - 120 * 60000);
    const { container } = render(<DataFreshnessIndicator lastRefresh={twoHoursAgo} />);
    expect(container.querySelector(".text-orange-500")).not.toBeNull();
  });

  it("a un aria-label correct", () => {
    const now = new Date();
    render(<DataFreshnessIndicator lastRefresh={now} />);
    expect(screen.getByLabelText(/données mises à jour/i)).toBeInTheDocument();
  });

  it("seuil par défaut à 5 minutes", () => {
    const fourMinAgo = new Date(Date.now() - 4 * 60000);
    const { container } = render(<DataFreshnessIndicator lastRefresh={fourMinAgo} />);
    // 4 min < 5 min threshold: not stale
    expect(container.querySelector(".text-orange-500")).toBeNull();
  });
});
