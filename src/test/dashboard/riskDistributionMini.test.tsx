import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RiskDistributionMini from "@/components/dashboard/RiskDistributionMini";

describe("RiskDistributionMini", () => {
  it("affiche 'Aucun client' quand tout est à 0", () => {
    render(<RiskDistributionMini simplifiee={0} standard={0} renforcee={0} />);
    expect(screen.getByText("Aucun client")).toBeInTheDocument();
  });

  it("affiche une barre empilée avec des segments", () => {
    const { container } = render(<RiskDistributionMini simplifiee={10} standard={5} renforcee={2} />);
    const segments = container.querySelectorAll("[title]");
    expect(segments.length).toBeGreaterThanOrEqual(3);
  });

  it("affiche les compteurs dans la légende", () => {
    render(<RiskDistributionMini simplifiee={10} standard={5} renforcee={2} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("n'affiche pas de segment de barre si count = 0", () => {
    const { container } = render(<RiskDistributionMini simplifiee={10} standard={0} renforcee={5} />);
    // The bar has role="img" — standard segment (amber) should not be inside it
    const bar = container.querySelector("[role='img']");
    expect(bar).not.toBeNull();
    const amberInBar = bar!.querySelectorAll(".bg-amber-500");
    expect(amberInBar.length).toBe(0);
  });

  it("a un aria-label correct", () => {
    render(<RiskDistributionMini simplifiee={10} standard={5} renforcee={2} />);
    expect(screen.getByLabelText(/répartition rapide/i)).toBeInTheDocument();
  });

  it("gère un seul type de vigilance", () => {
    render(<RiskDistributionMini simplifiee={20} standard={0} renforcee={0} />);
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("le titre contient les pourcentages", () => {
    const { container } = render(<RiskDistributionMini simplifiee={50} standard={30} renforcee={20} />);
    const segment = container.querySelector("[title*='50%']");
    expect(segment).not.toBeNull();
  });
});
