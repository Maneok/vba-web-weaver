import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardGoals from "@/components/dashboard/DashboardGoals";

const makeGoal = (overrides: Partial<{
  id: string;
  label: string;
  current: number;
  target: number;
  description: string;
}> = {}) => ({
  id: overrides.id ?? "g1",
  label: overrides.label ?? "Taux KYC",
  current: overrides.current ?? 50,
  target: overrides.target ?? 100,
  description: overrides.description ?? "Description objectif",
});

describe("DashboardGoals", () => {
  it("affiche le squelette de chargement quand isLoading=true", () => {
    const { container } = render(
      <DashboardGoals goals={[]} isLoading={true} />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("affiche l'état vide 'Aucun objectif défini' quand goals est vide", () => {
    render(<DashboardGoals goals={[]} isLoading={false} />);
    expect(screen.getByText("Aucun objectif défini")).toBeInTheDocument();
  });

  it("affiche le titre 'Objectifs de conformité'", () => {
    render(<DashboardGoals goals={[makeGoal()]} isLoading={false} />);
    expect(screen.getByText("Objectifs de conformité")).toBeInTheDocument();
  });

  it("affiche les labels des objectifs", () => {
    const goals = [
      makeGoal({ id: "g1", label: "Taux KYC" }),
      makeGoal({ id: "g2", label: "Lettres signées" }),
    ];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.getByText("Taux KYC")).toBeInTheDocument();
    expect(screen.getByText("Lettres signées")).toBeInTheDocument();
  });

  it("affiche les barres de progression", () => {
    const goals = [makeGoal({ current: 60, target: 100 })];
    const { container } = render(
      <DashboardGoals goals={goals} isLoading={false} />
    );
    const bar = container.querySelector(".rounded-full.bg-muted");
    expect(bar).toBeInTheDocument();
    const inner = bar?.querySelector("div");
    expect(inner).toHaveStyle({ width: "60%" });
  });

  it("affiche le badge 'Atteint' quand current >= target", () => {
    const goals = [makeGoal({ current: 100, target: 80 })];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.getByText("Atteint")).toBeInTheDocument();
  });

  it("n'affiche pas le badge 'Atteint' quand current < target", () => {
    const goals = [makeGoal({ current: 50, target: 80 })];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.queryByText("Atteint")).not.toBeInTheDocument();
  });

  it("affiche le résumé X/Y objectifs atteints", () => {
    const goals = [
      makeGoal({ id: "g1", current: 100, target: 80 }),
      makeGoal({ id: "g2", current: 30, target: 80 }),
      makeGoal({ id: "g3", current: 90, target: 90 }),
    ];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText(/objectifs atteints/)).toBeInTheDocument();
  });

  it("utilise la couleur verte quand l'objectif est atteint", () => {
    const goals = [makeGoal({ current: 100, target: 80 })];
    const { container } = render(
      <DashboardGoals goals={goals} isLoading={false} />
    );
    const progressBar = container.querySelector(".bg-green-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("utilise la couleur rouge quand l'objectif est loin de la cible", () => {
    const goals = [makeGoal({ current: 10, target: 100 })];
    const { container } = render(
      <DashboardGoals goals={goals} isLoading={false} />
    );
    const progressBar = container.querySelector(".bg-red-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("affiche le texte current% et target%", () => {
    const goals = [makeGoal({ current: 42, target: 85 })];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.getByText("42% / 85%")).toBeInTheDocument();
  });

  it("utilise la couleur ambrée quand current est entre 75% et 100% de target", () => {
    const goals = [makeGoal({ current: 80, target: 100 })];
    const { container } = render(
      <DashboardGoals goals={goals} isLoading={false} />
    );
    const progressBar = container.querySelector(".bg-amber-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("affiche la description de chaque objectif", () => {
    const goals = [makeGoal({ description: "Objectif prioritaire Q1" })];
    render(<DashboardGoals goals={goals} isLoading={false} />);
    expect(screen.getByText("Objectif prioritaire Q1")).toBeInTheDocument();
  });
});
