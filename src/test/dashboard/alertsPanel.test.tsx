import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import type { AlerteRegistre } from "@/lib/types";

// ── Tests 66-78: AlertsPanel ─────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const sampleAlertes: AlerteRegistre[] = [
  {
    date: "2025-03-10",
    clientConcerne: "SCI Dupont",
    categorie: "Opération atypique",
    details: "Transaction suspecte",
    actionPrise: "Signalement",
    responsable: "J. Martin",
    qualification: "Suspecte",
    statut: "EN COURS",
    dateButoir: "2025-04-10",
    typeDecision: "INTERNE",
    validateur: "A. Chef",
    priorite: "HAUTE",
  },
  {
    date: "2025-03-08",
    clientConcerne: "SARL Tech",
    categorie: "PPE détectée",
    details: "Dirigeant PPE",
    actionPrise: "Vigilance renforcée",
    responsable: "M. Dupont",
    qualification: "Confirmée",
    statut: "CLOS",
    dateButoir: "2025-03-15",
    typeDecision: "INTERNE",
    validateur: "A. Chef",
    priorite: "MOYENNE",
  },
  {
    date: "2025-03-11",
    clientConcerne: "Cabinet Urgent",
    categorie: "Gel d'avoirs",
    details: "Match sanctions",
    actionPrise: "Déclaration TRACFIN",
    responsable: "M. Dupont",
    qualification: "Confirmée",
    statut: "TRACFIN",
    dateButoir: "2025-03-12",
    typeDecision: "TRACFIN",
    validateur: "Directeur",
    priorite: "CRITIQUE",
  },
];

describe("AlertsPanel — rendu", () => {
  beforeEach(() => mockNavigate.mockClear());

  // Test 66
  it("affiche le titre avec accents", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    expect(screen.getByText("Alertes récentes")).toBeInTheDocument();
  });

  // Test 67
  it("affiche le compteur d'alertes ouvertes", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    // 2 open alerts (EN COURS + TRACFIN), 1 CLOS
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  // Test 68
  it("affiche le message vide quand pas d'alertes", () => {
    render(<MemoryRouter><AlertsPanel alertes={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucune alerte récente")).toBeInTheDocument();
    expect(screen.getByText("Les alertes LCB-FT apparaîtront ici")).toBeInTheDocument();
  });

  // Test 69
  it("affiche max 5 alertes", () => {
    const manyAlertes = Array.from({ length: 10 }, (_, i) => ({
      ...sampleAlertes[0],
      clientConcerne: `Client ${i}`,
      date: `2025-03-${String(i + 1).padStart(2, "0")}`,
    }));
    render(<MemoryRouter><AlertsPanel alertes={manyAlertes} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
  });

  // Test 70
  it("affiche les badges de statut corrects", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("Clos")).toBeInTheDocument();
    expect(screen.getByText("TRACFIN")).toBeInTheDocument();
  });
});

describe("AlertsPanel — navigation", () => {
  beforeEach(() => mockNavigate.mockClear());

  // Test 71
  it("le bouton Voir tout navigue vers /registre", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const btn = screen.getByLabelText("Voir toutes les alertes dans le registre");
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith("/registre");
  });

  // Test 72
  it("cliquer sur une alerte navigue vers /registre", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    fireEvent.click(items[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/registre");
  });
});

describe("AlertsPanel — tri et priorité", () => {
  beforeEach(() => mockNavigate.mockClear());

  // Test 73
  it("les alertes ouvertes apparaissent avant les fermées", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    // First item should be an open alert, not CLOS
    const firstItemText = items[0].textContent;
    expect(firstItemText).not.toContain("Clos");
  });

  // Test 74
  it("les alertes CRITIQUE apparaissent en premier", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    // CRITIQUE (Cabinet Urgent) should come first
    expect(items[0].textContent).toContain("Cabinet Urgent");
  });
});

describe("AlertsPanel — loading", () => {
  // Test 75
  it("affiche les skeletons en loading", () => {
    const { container } = render(<MemoryRouter><AlertsPanel alertes={[]} loading={true} /></MemoryRouter>);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  // Test 76
  it("n'affiche pas le titre en loading", () => {
    render(<MemoryRouter><AlertsPanel alertes={[]} loading={true} /></MemoryRouter>);
    expect(screen.queryByText("Alertes récentes")).not.toBeInTheDocument();
  });
});

describe("AlertsPanel — filtres", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("affiche les boutons de filtre quand il y a des alertes", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    expect(screen.getByText(/Tout \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/En cours \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Clos \(1\)/)).toBeInTheDocument();
  });

  it("filtre les alertes en cours", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const enCoursBtn = screen.getByText(/En cours \(2\)/);
    fireEvent.click(enCoursBtn);
    const items = screen.getAllByRole("listitem");
    items.forEach(item => {
      expect(item.textContent).not.toContain("Clos");
    });
  });

  it("filtre les alertes closes", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const closBtn = screen.getByText(/Clos \(1\)/);
    fireEvent.click(closBtn);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("SARL Tech");
  });

  it("le filtre Tout affiche toutes les alertes", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    // Click "En cours" first
    fireEvent.click(screen.getByText(/En cours \(2\)/));
    // Then click "Tout"
    fireEvent.click(screen.getByText(/Tout \(3\)/));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("n'affiche pas les filtres sans alertes", () => {
    render(<MemoryRouter><AlertsPanel alertes={[]} /></MemoryRouter>);
    expect(screen.queryByText(/Tout \(/)).not.toBeInTheDocument();
  });

  it("le bouton de filtre actif a l'attribut aria-pressed", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const toutBtn = screen.getByText(/Tout \(3\)/);
    expect(toutBtn).toHaveAttribute("aria-pressed", "true");
    const enCoursBtn = screen.getByText(/En cours \(2\)/);
    expect(enCoursBtn).toHaveAttribute("aria-pressed", "false");
  });
});

describe("AlertsPanel — accessibilité", () => {
  // Test 77
  it("le bouton Voir tout a un aria-label descriptif", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    expect(screen.getByLabelText("Voir toutes les alertes dans le registre")).toBeInTheDocument();
  });

  // Test 78
  it("les items ont un aria-label descriptif", () => {
    render(<MemoryRouter><AlertsPanel alertes={sampleAlertes} /></MemoryRouter>);
    const items = screen.getAllByRole("listitem");
    items.forEach(item => {
      expect(item).toHaveAttribute("aria-label");
    });
  });
});
