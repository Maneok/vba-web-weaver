import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";

// ── Tests 96-100: ComplianceGauge ────────────────────────────

const sampleItems = [
  { label: "Identification clients", value: 85, description: "Screening complet" },
  { label: "Documents KYC", value: 60, description: "CNI renseignée" },
  { label: "Lettres de mission", value: 30, description: "LM signées" },
  { label: "Formation collaborateurs", value: 100, description: "Formations < 12 mois" },
  { label: "Contrôle qualité", value: 0, description: "Contrôles réalisés" },
];

describe("ComplianceGauge — rendu", () => {
  // Test 96
  it("affiche le titre avec accents", () => {
    render(<ComplianceGauge items={sampleItems} />);
    expect(screen.getByText("Indicateurs de conformité")).toBeInTheDocument();
  });

  // Test 97
  it("affiche la moyenne", () => {
    render(<ComplianceGauge items={sampleItems} />);
    // Moyenne = (85+60+30+100+0)/5 = 55%
    expect(screen.getByText("Moyenne : 55%")).toBeInTheDocument();
  });

  // Test 98
  it("affiche les labels de statut", () => {
    render(<ComplianceGauge items={sampleItems} />);
    // 85% = Conforme, 60% = À améliorer, 30% = Non conforme, 100% = Conforme, 0% = Non conforme
    const conformes = screen.getAllByText("Conforme");
    expect(conformes.length).toBe(2); // 85% and 100%
    expect(screen.getByText("À améliorer")).toBeInTheDocument(); // 60%
    const nonConformes = screen.getAllByText("Non conforme");
    expect(nonConformes.length).toBe(2); // 30% and 0%
  });

  // Test 99
  it("affiche les barres de progression avec aria", () => {
    render(<ComplianceGauge items={sampleItems} />);
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(5);
    // Check first bar has correct value
    const firstBar = progressBars[0];
    expect(firstBar).toHaveAttribute("aria-valuenow", "85");
    expect(firstBar).toHaveAttribute("aria-valuemin", "0");
    expect(firstBar).toHaveAttribute("aria-valuemax", "100");
  });

  // Test 100
  it("clamp les valeurs > 100 et < 0", () => {
    const items = [
      { label: "Over 100", value: 150, description: "Test" },
      { label: "Under 0", value: -20, description: "Test" },
    ];
    render(<ComplianceGauge items={items} />);
    const progressBars = screen.getAllByRole("progressbar");
    // Should be clamped
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("ComplianceGauge — loading", () => {
  // Test bonus
  it("affiche des skeletons en loading", () => {
    const { container } = render(<ComplianceGauge items={[]} loading={true} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
