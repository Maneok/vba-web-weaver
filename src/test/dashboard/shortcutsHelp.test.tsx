import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardShortcutsHelp from "@/components/dashboard/DashboardShortcutsHelp";

describe("DashboardShortcutsHelp", () => {
  it("renders nothing visible when open=false", () => {
    render(<DashboardShortcutsHelp open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Raccourcis clavier")).not.toBeInTheDocument();
  });

  it("shows 'Raccourcis clavier' title when open=true", () => {
    render(<DashboardShortcutsHelp open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Raccourcis clavier")).toBeInTheDocument();
  });

  it("shows description text", () => {
    render(<DashboardShortcutsHelp open={true} onOpenChange={() => {}} />);
    expect(
      screen.getByText(
        "Liste des raccourcis clavier disponibles sur le tableau de bord."
      )
    ).toBeInTheDocument();
  });

  it("shows navigation section shortcuts", () => {
    render(<DashboardShortcutsHelp open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Nouveau client")).toBeInTheDocument();
    expect(screen.getByText("Registre alertes")).toBeInTheDocument();
    expect(screen.getByText("Rechercher")).toBeInTheDocument();
    expect(screen.getByText("Aide raccourcis")).toBeInTheDocument();
    expect(screen.getByText("Rafraîchir")).toBeInTheDocument();
  });

  it("shows dashboard section shortcuts", () => {
    render(<DashboardShortcutsHelp open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Aller au widget N")).toBeInTheDocument();
    expect(screen.getByText("Mode drag")).toBeInTheDocument();
  });

  it("shows general section with Escape shortcut", () => {
    render(<DashboardShortcutsHelp open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Général")).toBeInTheDocument();
    // "Fermer" appears twice: shortcut description + dialog close button sr-only
    const fermerElements = screen.getAllByText("Fermer");
    expect(fermerElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Escape")).toBeInTheDocument();
  });

  it("shows keyboard key badges as kbd elements", () => {
    render(
      <DashboardShortcutsHelp open={true} onOpenChange={() => {}} />
    );
    // Radix Dialog renders via portal into document.body
    const kbdElements = document.querySelectorAll("kbd");
    expect(kbdElements.length).toBeGreaterThanOrEqual(8);
    // Check specific keys exist
    const keyTexts = Array.from(kbdElements).map((el) => el.textContent);
    expect(keyTexts).toContain("Ctrl");
    expect(keyTexts).toContain("N");
    expect(keyTexts).toContain("Shift");
    expect(keyTexts).toContain("/");
    expect(keyTexts).toContain("?");
    expect(keyTexts).toContain("R");
    expect(keyTexts).toContain("1-5");
    expect(keyTexts).toContain("D");
    expect(keyTexts).toContain("Escape");
  });

  it("calls onOpenChange when dialog is closed", () => {
    const onOpenChange = vi.fn();
    render(<DashboardShortcutsHelp open={true} onOpenChange={onOpenChange} />);
    // Radix Dialog close button has sr-only text "Fermer"
    const closeButton = screen.getByRole("button", { name: "Fermer" });
    closeButton.click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
