import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import type { LogEntry } from "@/lib/types";

// ── Tests 90-95: ActivityFeed ────────────────────────────────

const sampleLogs: LogEntry[] = [
  { horodatage: new Date().toISOString(), utilisateur: "Jean Martin", refClient: "CLI-26-001", typeAction: "CREATION", details: "Création du dossier SCI Dupont" },
  { horodatage: new Date(Date.now() - 3600000).toISOString(), utilisateur: "Marie Dupont", refClient: "CLI-26-002", typeAction: "REVUE/MAJ", details: "Mise à jour KYC SARL Tech" },
  { horodatage: new Date(Date.now() - 7200000).toISOString(), utilisateur: "Admin", refClient: "", typeAction: "CONNEXION", details: "Connexion depuis 192.168.1.1" },
];

describe("ActivityFeed — rendu", () => {
  // Test 90
  it("affiche le titre avec accents", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    expect(screen.getByText("Activité récente")).toBeInTheDocument();
  });

  // Test 91
  it("affiche le message vide quand pas de logs", () => {
    render(<ActivityFeed logs={[]} />);
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument();
    expect(screen.getByText("Les actions effectuées apparaîtront ici")).toBeInTheDocument();
  });

  // Test 92
  it("affiche le compteur d'actions", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    expect(screen.getByText("(3 dernières actions)")).toBeInTheDocument();
  });

  // Test 93
  it("affiche les détails des logs", () => {
    render(<ActivityFeed logs={sampleLogs} />);
    expect(screen.getAllByText("Création du dossier SCI Dupont").length).toBeGreaterThanOrEqual(1);
  });

  // Test 94
  it("affiche max 10 logs", () => {
    const manyLogs = Array.from({ length: 15 }, (_, i) => ({
      horodatage: new Date(Date.now() - i * 60000).toISOString(),
      utilisateur: `User ${i}`,
      refClient: "",
      typeAction: "CREATION",
      details: `Action ${i}`,
    }));
    render(<ActivityFeed logs={manyLogs} />);
    expect(screen.getByText("(10 dernières actions)")).toBeInTheDocument();
  });
});

describe("ActivityFeed — loading", () => {
  // Test 95
  it("affiche des skeletons en loading", () => {
    const { container } = render(<ActivityFeed logs={[]} loading={true} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
