import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UpcomingDeadlines, type Deadline } from "@/components/dashboard/UpcomingDeadlines";

// ── Tests 79-88: UpcomingDeadlines ───────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

describe("UpcomingDeadlines — rendu", () => {
  beforeEach(() => mockNavigate.mockClear());

  // Test 79
  it("affiche le titre avec accents", () => {
    render(<MemoryRouter><UpcomingDeadlines deadlines={[]} /></MemoryRouter>);
    expect(screen.getByText("Prochaines échéances")).toBeInTheDocument();
  });

  // Test 80
  it("affiche le message vide quand pas d'échéances", () => {
    render(<MemoryRouter><UpcomingDeadlines deadlines={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucune échéance à venir")).toBeInTheDocument();
    expect(screen.getByText("Les revues et formations à venir apparaîtront ici")).toBeInTheDocument();
  });

  // Test 81
  it("affiche le badge 'En retard' pour dates passées", () => {
    const deadlines: Deadline[] = [{
      id: "revue-1",
      title: "Revue Client A",
      date: pastDate(10),
      type: "revue",
      clientRef: "CLI-26-001",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    expect(screen.getByText("En retard")).toBeInTheDocument();
  });

  // Test 82
  it("affiche 'Urgent' pour échéances <= 7 jours", () => {
    const deadlines: Deadline[] = [{
      id: "revue-2",
      title: "Revue Client B",
      date: futureDate(3),
      type: "revue",
      clientRef: "CLI-26-002",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  // Test 83
  it("n'affiche ni Urgent ni En retard pour > 7 jours", () => {
    const deadlines: Deadline[] = [{
      id: "revue-3",
      title: "Revue Client C",
      date: futureDate(30),
      type: "revue",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    expect(screen.queryByText("Urgent")).not.toBeInTheDocument();
    expect(screen.queryByText("En retard")).not.toBeInTheDocument();
  });

  // Test 84
  it("affiche le badge compteur", () => {
    const deadlines: Deadline[] = [
      { id: "1", title: "Revue A", date: futureDate(5), type: "revue" },
      { id: "2", title: "Revue B", date: futureDate(10), type: "revue" },
      { id: "3", title: "Formation C", date: futureDate(15), type: "formation" },
    ];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // Test 85
  it("affiche max 5 échéances", () => {
    const deadlines: Deadline[] = Array.from({ length: 8 }, (_, i) => ({
      id: `d-${i}`,
      title: `Deadline ${i}`,
      date: futureDate(i + 1),
      type: "revue" as const,
    }));
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

describe("UpcomingDeadlines — navigation", () => {
  beforeEach(() => mockNavigate.mockClear());

  // Test 86
  it("cliquer sur une revue avec clientRef navigue vers /client/:ref", () => {
    const deadlines: Deadline[] = [{
      id: "revue-1",
      title: "Revue Client A",
      date: futureDate(5),
      type: "revue",
      clientRef: "CLI-26-001",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    const item = screen.getByRole("listitem");
    fireEvent.click(item);
    expect(mockNavigate).toHaveBeenCalledWith("/client/CLI-26-001");
  });

  // Test 87
  it("cliquer sur une formation navigue vers /gouvernance", () => {
    const deadlines: Deadline[] = [{
      id: "formation-1",
      title: "Formation Dupont",
      date: futureDate(10),
      type: "formation",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    const item = screen.getByRole("listitem");
    fireEvent.click(item);
    expect(mockNavigate).toHaveBeenCalledWith("/gouvernance");
  });

  // Test 88
  it("cliquer sur une revue sans clientRef navigue vers /bdd", () => {
    const deadlines: Deadline[] = [{
      id: "revue-no-ref",
      title: "Revue sans ref",
      date: futureDate(5),
      type: "revue",
    }];
    render(<MemoryRouter><UpcomingDeadlines deadlines={deadlines} /></MemoryRouter>);
    const item = screen.getByRole("listitem");
    fireEvent.click(item);
    expect(mockNavigate).toHaveBeenCalledWith("/bdd");
  });
});

describe("UpcomingDeadlines — loading", () => {
  // Test 89
  it("affiche des skeletons en loading", () => {
    const { container } = render(<MemoryRouter><UpcomingDeadlines deadlines={[]} loading={true} /></MemoryRouter>);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
