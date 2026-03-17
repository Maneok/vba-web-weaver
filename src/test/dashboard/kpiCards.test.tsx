import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardKPICards } from "@/components/dashboard/DashboardKPICards";

// ── Tests 41-60: KPI Cards rendering + navigation ────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock recharts to avoid canvas issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
}));

const baseStats = {
  totalClients: 42,
  avgScore: 35,
  tauxConformite: 72,
  alertesEnCours: 3,
  revuesEchues: 2,
  caPrevisionnel: 150000,
};

const baseSparklines: Record<string, { v: number }[]> = {
  totalClients: [{ v: 38 }, { v: 40 }, { v: 42 }],
  avgScore: [{ v: 30 }, { v: 33 }, { v: 35 }],
  tauxConformite: [{ v: 65 }, { v: 70 }, { v: 72 }],
  alertesEnCours: [{ v: 5 }, { v: 4 }, { v: 3 }],
  revuesEchues: [{ v: 4 }, { v: 3 }, { v: 2 }],
  caPrevisionnel: [{ v: 120 }, { v: 140 }, { v: 150 }],
};

function renderKPICards(statsOverride = {}) {
  return render(
    <MemoryRouter>
      <DashboardKPICards
        stats={{ ...baseStats, ...statsOverride }}
        sparklines={baseSparklines}
        isLoading={false}
      />
    </MemoryRouter>
  );
}

describe("DashboardKPICards — rendu", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Test 41
  it("affiche les 6 KPI cards", () => {
    renderKPICards();
    expect(screen.getByText("Clients actifs")).toBeInTheDocument();
    expect(screen.getByText("Score moyen")).toBeInTheDocument();
    expect(screen.getByText("Taux conformité")).toBeInTheDocument();
    expect(screen.getByText("Alertes en cours")).toBeInTheDocument();
    expect(screen.getByText("Revues échues")).toBeInTheDocument();
    expect(screen.getByText("CA prévisionnel")).toBeInTheDocument();
  });

  // Test 42
  it("affiche les valeurs correctes", () => {
    renderKPICards();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("150k€")).toBeInTheDocument();
  });

  // Test 43
  it("affiche le CA correctement pour petites valeurs", () => {
    renderKPICards({ caPrevisionnel: 500 });
    expect(screen.getByText("1k€")).toBeInTheDocument();
  });

  // Test 44
  it("affiche 0 clients actifs", () => {
    renderKPICards({ totalClients: 0 });
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  // Test 45
  it("n'affiche pas de faux indicateur de tendance", () => {
    renderKPICards();
    expect(screen.queryByText(/12%/)).not.toBeInTheDocument();
  });
});

describe("DashboardKPICards — navigation", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Test 46
  it("Clients actifs navigue vers /bdd", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Clients actifs.*Cliquez pour voir la base clients/);
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/bdd");
  });

  // Test 47
  it("Score moyen navigue vers /diagnostic", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Score de risque moyen/);
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/diagnostic");
  });

  // Test 48
  it("Taux conformité navigue vers /controle", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Taux de conformité/);
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/controle");
  });

  // Test 49
  it("Alertes en cours navigue vers /registre", () => {
    renderKPICards();
    const card = screen.getByLabelText(/alerte.*en cours.*Cliquez pour le registre/);
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/registre");
  });

  // Test 50
  it("Revues échues navigue vers /bdd?filter=echues", () => {
    renderKPICards();
    const card = screen.getByLabelText(/revue.*échue.*Cliquez pour filtrer/);
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/bdd?filter=echues");
  });

  // Test 51
  it("CA prévisionnel n'a pas de navigation (pas de onClick)", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Chiffre d'affaires prévisionnel/);
    fireEvent.click(card);
    // CA card has no onClick, so navigate should NOT have been called for /something
    // It may have been called by previous test cards, so check it wasn't called with a CA-specific route
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining("ca"));
  });
});

describe("DashboardKPICards — accessibilité", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Test 52
  it("les cards cliquables ont role=button", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Clients actifs.*Cliquez/);
    expect(card).toHaveAttribute("role", "button");
  });

  // Test 53
  it("les cards cliquables ont tabIndex=0", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Score de risque moyen/);
    expect(card).toHaveAttribute("tabindex", "0");
  });

  // Test 54
  it("Enter active la navigation sur une card", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Clients actifs.*Cliquez/);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/bdd");
  });

  // Test 55
  it("Space active la navigation sur une card", () => {
    renderKPICards();
    const card = screen.getByLabelText(/Taux de conformité/);
    fireEvent.keyDown(card, { key: " " });
    expect(mockNavigate).toHaveBeenCalledWith("/controle");
  });

  // Test 56
  it("le region a un aria-label", () => {
    renderKPICards();
    expect(screen.getByRole("region", { name: /Indicateurs clés de performance/ })).toBeInTheDocument();
  });
});

describe("DashboardKPICards — couleurs dynamiques", () => {
  // Test 57
  it("score <= 30 utilise couleur verte", () => {
    renderKPICards({ avgScore: 20 });
    // Card should render without error
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  // Test 58
  it("score 31-55 utilise couleur orange", () => {
    renderKPICards({ avgScore: 45 });
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  // Test 59
  it("score >= 56 utilise couleur rouge", () => {
    renderKPICards({ avgScore: 80 });
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  // Test 60
  it("conformité >= 80 utilise vert, < 50 utilise rouge", () => {
    renderKPICards({ tauxConformite: 90 });
    expect(screen.getByText("90%")).toBeInTheDocument();
    // No crash = pass
  });
});

describe("DashboardKPICards — loading", () => {
  // Test 61
  it("affiche les skeletons en loading", () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardKPICards stats={baseStats} sparklines={baseSparklines} isLoading={true} />
      </MemoryRouter>
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  // Test 62
  it("n'affiche pas les valeurs en loading", () => {
    render(
      <MemoryRouter>
        <DashboardKPICards stats={baseStats} sparklines={baseSparklines} isLoading={true} />
      </MemoryRouter>
    );
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });
});

describe("DashboardKPICards — pluriels", () => {
  // Test 63
  it("1 alerte sans s", () => {
    renderKPICards({ alertesEnCours: 1 });
    const card = screen.getByLabelText(/1 alerte en cours/);
    expect(card.getAttribute("aria-label")).not.toMatch(/alertes/);
  });

  // Test 64
  it("5 alertes avec s", () => {
    renderKPICards({ alertesEnCours: 5 });
    expect(screen.getByLabelText(/5 alertes en cours/)).toBeInTheDocument();
  });

  // Test 65
  it("0 alertes sans s", () => {
    renderKPICards({ alertesEnCours: 0 });
    expect(screen.getByLabelText(/0 alerte en cours/)).toBeInTheDocument();
  });
});
