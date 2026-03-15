import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import type { LogEntry } from "@/lib/types";

// ── Tests: ActivityFeed ────────────────────────────────

const sampleLogs: LogEntry[] = [
  { horodatage: new Date().toISOString(), utilisateur: "Jean Martin", refClient: "CLI-26-001", typeAction: "CREATION", details: "Création du dossier SCI Dupont" },
  { horodatage: new Date(Date.now() - 3600000).toISOString(), utilisateur: "Marie Dupont", refClient: "CLI-26-002", typeAction: "REVUE/MAJ", details: "Mise à jour KYC SARL Tech" },
  { horodatage: new Date(Date.now() - 7200000).toISOString(), utilisateur: "Admin", refClient: "", typeAction: "CONNEXION", details: "Connexion depuis 192.168.1.1" },
];

describe("ActivityFeed — rendu", () => {
  it("affiche le titre avec accents", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    expect(screen.getByText("Activité récente")).toBeInTheDocument();
  });

  it("affiche le message vide quand pas de logs", () => {
    render(<ActivityFeed logs={[]} />);
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument();
  });

  it("affiche les détails des logs", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    expect(screen.getAllByText("Création du dossier SCI Dupont").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche tous les logs passés en props", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(3);
  });
});

describe("ActivityFeed — loading", () => {
  it("affiche des skeletons en loading", () => {
    const { container } = render(<ActivityFeed logs={[]} loading={true} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
