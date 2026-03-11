import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardPrintHeader from "@/components/dashboard/DashboardPrintHeader";
import DashboardPrintFooter from "@/components/dashboard/DashboardPrintFooter";

describe("DashboardPrintHeader", () => {
  const defaultProps = {
    cabinetName: "Cabinet Dupont & Associés",
    userName: "Jean Martin",
    date: "11/03/2026",
  };

  it("affiche le nom du cabinet", () => {
    render(<DashboardPrintHeader {...defaultProps} />);
    expect(screen.getByText("Cabinet Dupont & Associés")).toBeInTheDocument();
  });

  it("affiche 'Tableau de bord — Conformité LCB-FT'", () => {
    render(<DashboardPrintHeader {...defaultProps} />);
    expect(
      screen.getByText("Tableau de bord — Conformité LCB-FT")
    ).toBeInTheDocument();
  });

  it("affiche 'Généré par' suivi du nom de l'utilisateur", () => {
    render(<DashboardPrintHeader {...defaultProps} />);
    expect(screen.getByText("Généré par Jean Martin")).toBeInTheDocument();
  });

  it("affiche 'CONFIDENTIEL — Usage interne uniquement'", () => {
    render(<DashboardPrintHeader {...defaultProps} />);
    expect(
      screen.getByText("CONFIDENTIEL — Usage interne uniquement")
    ).toBeInTheDocument();
  });

  it("affiche la date fournie", () => {
    render(<DashboardPrintHeader {...defaultProps} />);
    expect(screen.getByText("11/03/2026")).toBeInTheDocument();
  });

  it("utilise la classe hidden print:block", () => {
    const { container } = render(<DashboardPrintHeader {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("hidden");
    expect(root.className).toContain("print:block");
  });
});

describe("DashboardPrintFooter", () => {
  it("affiche 'CONFIDENTIEL — {cabinetName}'", () => {
    render(<DashboardPrintFooter cabinetName="Cabinet Test" />);
    expect(screen.getByText("CONFIDENTIEL — Cabinet Test")).toBeInTheDocument();
  });

  it("affiche 'Page générée automatiquement par GRIMY'", () => {
    render(<DashboardPrintFooter cabinetName="Cabinet Test" />);
    expect(
      screen.getByText("Page générée automatiquement par GRIMY")
    ).toBeInTheDocument();
  });

  it("utilise la classe hidden print:block", () => {
    const { container } = render(
      <DashboardPrintFooter cabinetName="Cabinet Test" />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("hidden");
    expect(root.className).toContain("print:block");
  });

  it("affiche la date d'impression au format français", () => {
    render(<DashboardPrintFooter cabinetName="Cabinet Test" />);
    // The component renders "Imprimé le DD/MM/YYYY à HH:MM"
    const printedText = screen.getByText(/Imprimé le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/);
    expect(printedText).toBeInTheDocument();
  });
});
