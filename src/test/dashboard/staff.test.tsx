import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardStaff from "@/components/dashboard/DashboardStaff";
import type { Collaborateur } from "@/lib/types";

// Helper to create a date string N months ago
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function makeCollaborateur(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: crypto.randomUUID(),
    nom: "Jean Dupont",
    fonction: "Expert-comptable",
    referentLcb: false,
    suppleant: "",
    niveauCompetence: "Confirmé",
    dateSignatureManuel: "2025-01-01",
    derniereFormation: monthsAgo(3),
    statutFormation: "À jour",
    email: "jean@example.com",
    ...overrides,
  };
}

describe("DashboardStaff", () => {
  it("shows loading skeleton when isLoading=true", () => {
    const { container } = render(
      <DashboardStaff collaborateurs={[]} isLoading={true} />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty message when collaborateurs is empty", () => {
    render(<DashboardStaff collaborateurs={[]} isLoading={false} />);
    expect(screen.getByText("Aucun collaborateur enregistré")).toBeInTheDocument();
  });

  it("shows 'Équipe & formations' heading", () => {
    const collabs = [makeCollaborateur()];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("Équipe & formations")).toBeInTheDocument();
  });

  it("shows total collaborateur count", () => {
    const collabs = [
      makeCollaborateur({ nom: "Alice Martin" }),
      makeCollaborateur({ nom: "Bob Durand" }),
      makeCollaborateur({ nom: "Claire Petit" }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("3 collaborateurs")).toBeInTheDocument();
  });

  it("shows singular 'collaborateur' when only one", () => {
    render(
      <DashboardStaff collaborateurs={[makeCollaborateur()]} isLoading={false} />
    );
    expect(screen.getByText("1 collaborateur")).toBeInTheDocument();
  });

  it("shows 'formés' count for collaborateurs with recent formation", () => {
    const collabs = [
      makeCollaborateur({ nom: "A B", derniereFormation: monthsAgo(2) }),
      makeCollaborateur({ nom: "C D", derniereFormation: monthsAgo(5) }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("2 formés")).toBeInTheDocument();
  });

  it("shows 'à former' count for expired formations", () => {
    const collabs = [
      makeCollaborateur({ nom: "A B", derniereFormation: monthsAgo(2) }),
      makeCollaborateur({ nom: "C D", derniereFormation: monthsAgo(20) }),
      makeCollaborateur({ nom: "E F", derniereFormation: "" }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("2 à former")).toBeInTheDocument();
  });

  it("highlights 'Référent LCB-FT' with name", () => {
    const collabs = [
      makeCollaborateur({ nom: "Marie Leroy", referentLcb: true }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("Référent LCB-FT :")).toBeInTheDocument();
    const matches = screen.getAllByText("Marie Leroy");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows collaborateur names in the list", () => {
    const collabs = [
      makeCollaborateur({ nom: "Alice Martin" }),
      makeCollaborateur({ nom: "Bob Durand" }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
  });

  it("shows initials avatar from name parts", () => {
    const collabs = [makeCollaborateur({ nom: "Alice Martin" })];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("shows training status badge 'À jour' for recent formation", () => {
    const collabs = [
      makeCollaborateur({ nom: "A B", derniereFormation: monthsAgo(3) }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("À jour")).toBeInTheDocument();
  });

  it("shows training status badge 'Expirée' for old/missing formation", () => {
    const collabs = [
      makeCollaborateur({ nom: "A B", derniereFormation: monthsAgo(24) }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("Expirée")).toBeInTheDocument();
  });

  it("shows max 6 collaborateurs (MAX_VISIBLE)", () => {
    const collabs = Array.from({ length: 8 }, (_, i) =>
      makeCollaborateur({ nom: `Collab ${i + 1}` })
    );
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    const list = screen.getByRole("list", { name: "Liste des collaborateurs" });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(6);
  });

  it("shows '+ N autres collaborateurs' overflow text", () => {
    const collabs = Array.from({ length: 9 }, (_, i) =>
      makeCollaborateur({ nom: `Collab ${i + 1}` })
    );
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("+ 3 autres collaborateurs")).toBeInTheDocument();
  });

  it("shows 'Référent' badge next to référent name in the list", () => {
    const collabs = [
      makeCollaborateur({ nom: "Marie Leroy", referentLcb: true }),
      makeCollaborateur({ nom: "Jean Dupont" }),
    ];
    render(<DashboardStaff collaborateurs={collabs} isLoading={false} />);
    expect(screen.getByText("Référent")).toBeInTheDocument();
  });
});
