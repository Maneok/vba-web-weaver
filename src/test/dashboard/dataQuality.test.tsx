import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import DashboardDataQuality from "@/components/dashboard/DashboardDataQuality";

const makeCategory = (overrides: Partial<{
  label: string;
  total: number;
  filled: number;
}> = {}) => ({
  label: overrides.label ?? "Identité",
  total: overrides.total ?? 10,
  filled: overrides.filled ?? 8,
  icon: React.createElement("span", null, "icon"),
});

describe("DashboardDataQuality", () => {
  it("affiche le squelette de chargement quand isLoading=true", () => {
    const { container } = render(
      <DashboardDataQuality categories={[]} isLoading={true} />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("affiche l'état vide quand categories est vide", () => {
    render(<DashboardDataQuality categories={[]} isLoading={false} />);
    expect(screen.getByText("Aucune donnée à analyser")).toBeInTheDocument();
  });

  it("affiche le titre 'Qualité des données'", () => {
    const categories = [makeCategory()];
    render(<DashboardDataQuality categories={categories} isLoading={false} />);
    expect(screen.getByText("Qualité des données")).toBeInTheDocument();
  });

  it("affiche le pourcentage global de qualité", () => {
    const categories = [
      makeCategory({ total: 10, filled: 8 }),
      makeCategory({ label: "Adresse", total: 10, filled: 6 }),
    ];
    render(<DashboardDataQuality categories={categories} isLoading={false} />);
    // overall = (8+6)/(10+10) = 70%
    const badges = screen.getAllByText("70%");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche chaque catégorie avec son label et son compteur", () => {
    const categories = [
      makeCategory({ label: "Identité", total: 20, filled: 15 }),
      makeCategory({ label: "Documents", total: 10, filled: 3 }),
    ];
    render(<DashboardDataQuality categories={categories} isLoading={false} />);
    expect(screen.getByText("Identité")).toBeInTheDocument();
    expect(screen.getByText("15/20")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });

  it("utilise la couleur verte pour un taux >= 80%", () => {
    const categories = [makeCategory({ total: 10, filled: 9 })]; // 90%
    const { container } = render(
      <DashboardDataQuality categories={categories} isLoading={false} />
    );
    const greenBar = container.querySelector('[class*="bg-emerald-500"]');
    expect(greenBar).toBeInTheDocument();
  });

  it("utilise la couleur rouge pour un taux < 50%", () => {
    const categories = [makeCategory({ total: 10, filled: 3 })]; // 30%
    const { container } = render(
      <DashboardDataQuality categories={categories} isLoading={false} />
    );
    const redBar = container.querySelector('[class*="bg-red-500"]');
    expect(redBar).toBeInTheDocument();
  });

  it("affiche 'Complet' quand une catégorie est à 100%", () => {
    const categories = [makeCategory({ total: 10, filled: 10 })];
    render(<DashboardDataQuality categories={categories} isLoading={false} />);
    expect(screen.getByText("Complet")).toBeInTheDocument();
  });

  it("affiche les barres de progression avec le rôle progressbar", () => {
    const categories = [makeCategory()];
    const { container } = render(
      <DashboardDataQuality categories={categories} isLoading={false} />
    );
    const progressbars = container.querySelectorAll('[role="progressbar"]');
    expect(progressbars.length).toBe(1);
  });

  it("utilise la couleur ambre pour un taux entre 50% et 79%", () => {
    const categories = [makeCategory({ total: 10, filled: 6 })]; // 60%
    const { container } = render(
      <DashboardDataQuality categories={categories} isLoading={false} />
    );
    const amberBar = container.querySelector('[class*="bg-amber-500"]');
    expect(amberBar).toBeInTheDocument();
  });
});
