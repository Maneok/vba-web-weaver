import { render, screen } from "@testing-library/react";
import DashboardAccessibility from "@/components/dashboard/DashboardAccessibility";

describe("DashboardAccessibility", () => {
  it("renders children correctly", () => {
    render(
      <DashboardAccessibility announcements={[]}>
        <p>Dashboard content</p>
      </DashboardAccessibility>
    );
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("shows skip link with 'Aller au contenu principal'", () => {
    render(
      <DashboardAccessibility announcements={[]}>
        <div />
      </DashboardAccessibility>
    );
    expect(screen.getByText("Aller au contenu principal")).toBeInTheDocument();
  });

  it("skip link targets #dashboard-main", () => {
    render(
      <DashboardAccessibility announcements={[]}>
        <div />
      </DashboardAccessibility>
    );
    const link = screen.getByText("Aller au contenu principal");
    expect(link).toHaveAttribute("href", "#dashboard-main");
  });

  it("creates a div with id='dashboard-main'", () => {
    const { container } = render(
      <DashboardAccessibility announcements={[]}>
        <div />
      </DashboardAccessibility>
    );
    expect(container.querySelector("#dashboard-main")).toBeInTheDocument();
  });

  it("shows latest announcement in aria-live region", () => {
    const { container } = render(
      <DashboardAccessibility announcements={["Premier", "Deuxième", "Dernier"]}>
        <div />
      </DashboardAccessibility>
    );
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Dernier");
  });

  it("shows empty aria-live region when no announcements", () => {
    const { container } = render(
      <DashboardAccessibility announcements={[]}>
        <div />
      </DashboardAccessibility>
    );
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");
  });

  it("only shows the latest announcement, not all", () => {
    const { container } = render(
      <DashboardAccessibility announcements={["Premier", "Deuxième", "Dernier"]}>
        <div />
      </DashboardAccessibility>
    );
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toHaveTextContent("Dernier");
    expect(liveRegion).not.toHaveTextContent("Premier");
    expect(liveRegion).not.toHaveTextContent("Deuxième");
  });
});
