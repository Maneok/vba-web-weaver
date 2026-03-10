import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardCockpit from "@/components/dashboard/DashboardCockpit";
import type { CockpitSummary, CockpitUrgency } from "@/lib/cockpitEngine";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Build a CockpitSummary with sensible defaults; only urgencies need to be specified. */
function buildCockpit(urgencies: CockpitUrgency[] = []): CockpitSummary {
  return {
    totalClients: 0,
    clientsActifs: 0,
    totalHonoraires: 0,
    urgencies,
    revisionsRetard: [],
    cniPerimees: [],
    incoherencesScoring: [],
    lignesFantomes: [],
    formationsAFaire: [],
    alertesNonTraitees: [],
    kycIncomplets: [],
    documentManquants: [],
    anomaliesCapital: [],
    doublonsPotentiels: [],
    beManquants: [],
    tauxFormation: 0,
    tauxKycComplet: 0,
    scoreMoyen: 0,
    alertesEnRetard: 0,
  };
}

function makeUrgency(overrides: Partial<CockpitUrgency> = {}): CockpitUrgency {
  return {
    type: "revision",
    severity: "warning",
    title: "Test urgency",
    detail: "Some detail",
    ...overrides,
  };
}

function renderCockpit(cockpit: CockpitSummary, isLoading = false) {
  return render(
    <MemoryRouter>
      <DashboardCockpit cockpit={cockpit} isLoading={isLoading} />
    </MemoryRouter>
  );
}

describe("DashboardCockpit", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // 1. Loading skeleton
  it("shows loading skeleton when isLoading=true", () => {
    renderCockpit(buildCockpit(), true);
    const container = screen.getByLabelText("Chargement du cockpit LCB-FT");
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute("aria-busy", "true");
  });

  // 2. Empty state
  it('shows "Aucune anomalie detectee" and "Conformite OK" when urgencies is empty', () => {
    renderCockpit(buildCockpit([]));
    expect(screen.getByText("Aucune anomalie détectée")).toBeInTheDocument();
    expect(screen.getByText("Conformité OK")).toBeInTheDocument();
  });

  // 3. Displays urgency items
  it("displays urgency items with title and detail", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ title: "Client X — Revision en retard", detail: "Butoir depasse de 10 jours" }),
      makeUrgency({ title: "Client Y — CNI expiree", detail: "Expire le 2025-01-01", severity: "critique" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("Client X — Revision en retard")).toBeInTheDocument();
    expect(screen.getByText("Butoir depasse de 10 jours")).toBeInTheDocument();
    expect(screen.getByText("Client Y — CNI expiree")).toBeInTheDocument();
    expect(screen.getByText("Expire le 2025-01-01")).toBeInTheDocument();
  });

  // 4. Severity badges with correct counts
  it("shows severity badges with correct counts", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ severity: "critique" }),
      makeUrgency({ severity: "critique" }),
      makeUrgency({ severity: "warning" }),
      makeUrgency({ severity: "info" }),
      makeUrgency({ severity: "info" }),
      makeUrgency({ severity: "info" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("2 critiques")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("3 infos")).toBeInTheDocument();
  });

  // 5. Pulsing dot for critique severity
  it("shows pulsing dot for critique severity", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ severity: "critique", title: "Critique item" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    const dot = screen.getByTitle("Sévérité : critique");
    expect(dot.className).toContain("animate-pulse");
    expect(dot.className).toContain("bg-red-500");
  });

  // 6. Clickable items navigate to client page
  it("navigates to /client/{ref} when clicking on a clickable item", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ ref: "CLI-26-001", title: "Client with ref" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    const button = screen.getByLabelText("Client with ref — cliquer pour voir le client CLI-26-001");
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/client/CLI-26-001");
  });

  // 7. Non-clickable items don't have cursor-pointer
  it("does not apply cursor-pointer to items without ref", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ ref: undefined, title: "No ref item" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    const item = screen.getByLabelText("No ref item");
    expect(item.className).not.toContain("cursor-pointer");
    expect(item.tagName).toBe("DIV");
  });

  // 8. "Voir les N autres" button appears when more than 8 items
  it('shows "Voir les N autres" button when more than 8 items', () => {
    const urgencies = Array.from({ length: 12 }, (_, i) =>
      makeUrgency({ title: `Item ${i}` })
    );
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("Voir les 4 autres")).toBeInTheDocument();
    // Only 8 visible items
    expect(screen.queryByText("Item 8")).not.toBeInTheDocument();
  });

  // 9. Clicking "Voir les N autres" expands the list
  it("expands the list when clicking the expand button", () => {
    const urgencies = Array.from({ length: 10 }, (_, i) =>
      makeUrgency({ title: `Expand item ${i}` })
    );
    renderCockpit(buildCockpit(urgencies));
    expect(screen.queryByText("Expand item 9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Voir les 2 autres"));
    expect(screen.getByText("Expand item 9")).toBeInTheDocument();
  });

  // 10. Clicking "Reduire la liste" collapses the list
  it("collapses the list when clicking the collapse button", () => {
    const urgencies = Array.from({ length: 10 }, (_, i) =>
      makeUrgency({ title: `Collapse item ${i}` })
    );
    renderCockpit(buildCockpit(urgencies));
    fireEvent.click(screen.getByText("Voir les 2 autres"));
    expect(screen.getByText("Collapse item 9")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Réduire la liste"));
    expect(screen.queryByText("Collapse item 9")).not.toBeInTheDocument();
  });

  // 11. Correct plural for "critiques" vs "critique"
  it('shows singular "critique" for count of 1', () => {
    const urgencies: CockpitUrgency[] = [makeUrgency({ severity: "critique" })];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("1 critique")).toBeInTheDocument();
    expect(screen.queryByText("1 critiques")).not.toBeInTheDocument();
  });

  it('shows plural "critiques" for count > 1', () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ severity: "critique" }),
      makeUrgency({ severity: "critique" }),
      makeUrgency({ severity: "critique" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("3 critiques")).toBeInTheDocument();
  });

  // 12. Shows "Cockpit LCB-FT" heading
  it('shows "Cockpit LCB-FT" heading', () => {
    renderCockpit(buildCockpit());
    expect(screen.getByText("Cockpit LCB-FT")).toBeInTheDocument();
  });

  // 13. Correct aria-labels
  it("has correct aria-labels on the main container", () => {
    renderCockpit(buildCockpit());
    expect(screen.getByLabelText("Cockpit LCB-FT")).toBeInTheDocument();
  });

  it('has "Liste des anomalies cockpit" aria-label on the urgency list', () => {
    const urgencies: CockpitUrgency[] = [makeUrgency()];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByLabelText("Liste des anomalies cockpit")).toBeInTheDocument();
  });

  it('has "Resume des anomalies" aria-label on the badge summary', () => {
    const urgencies: CockpitUrgency[] = [makeUrgency()];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByLabelText("Résumé des anomalies")).toBeInTheDocument();
  });

  // 14. When all urgencies are info, no critique/warning badges shown
  it("does not show critique or warning badges when all urgencies are info", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ severity: "info" }),
      makeUrgency({ severity: "info" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    expect(screen.getByText("2 infos")).toBeInTheDocument();
    expect(screen.queryByText(/critique/)).not.toBeInTheDocument();
    expect(screen.queryByText(/warning/)).not.toBeInTheDocument();
  });

  // 15. Handles urgencies being undefined/null gracefully (uses ?? [])
  it("handles urgencies being undefined gracefully", () => {
    const cockpit = buildCockpit();
    // Force urgencies to undefined to simulate bad data
    (cockpit as any).urgencies = undefined;
    renderCockpit(cockpit);
    expect(screen.getByText("Aucune anomalie détectée")).toBeInTheDocument();
    expect(screen.getByText("Conformité OK")).toBeInTheDocument();
  });

  it("handles urgencies being null gracefully", () => {
    const cockpit = buildCockpit();
    (cockpit as any).urgencies = null;
    renderCockpit(cockpit);
    expect(screen.getByText("Aucune anomalie détectée")).toBeInTheDocument();
  });

  // Additional: no expand button when exactly 8 items
  it("does not show expand button when exactly 8 items", () => {
    const urgencies = Array.from({ length: 8 }, (_, i) =>
      makeUrgency({ title: `Exact item ${i}` })
    );
    renderCockpit(buildCockpit(urgencies));
    expect(screen.queryByText(/Voir les/)).not.toBeInTheDocument();
  });

  // Additional: clickable items render as buttons, non-clickable as divs
  it("renders clickable items as <button> and non-clickable as <div>", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ ref: "CLI-26-010", title: "Clickable" }),
      makeUrgency({ ref: undefined, title: "Not clickable" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    const clickable = screen.getByLabelText("Clickable — cliquer pour voir le client CLI-26-010");
    const notClickable = screen.getByLabelText("Not clickable");
    expect(clickable.tagName).toBe("BUTTON");
    expect(notClickable.tagName).toBe("DIV");
  });

  // Additional: warning dot is not pulsing
  it("does not show pulsing dot for warning severity", () => {
    const urgencies: CockpitUrgency[] = [
      makeUrgency({ severity: "warning", title: "Warning item" }),
    ];
    renderCockpit(buildCockpit(urgencies));
    const dot = screen.getByTitle("Sévérité : warning");
    expect(dot.className).toContain("bg-orange-500");
    expect(dot.className).not.toContain("animate-pulse");
  });
});
