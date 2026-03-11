import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardCockpitFilters from "@/components/dashboard/DashboardCockpitFilters";

const defaultProps = {
  activeSeverity: "all" as const,
  activeCategory: "all" as const,
  onSeverityChange: vi.fn(),
  onCategoryChange: vi.fn(),
  counts: { critique: 3, warning: 7, info: 12 },
};

function renderFilters(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<DashboardCockpitFilters {...props} />);
}

describe("DashboardCockpitFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders severity filter buttons (Tout, Critique, Warning, Info)", () => {
    renderFilters();
    expect(screen.getByText("Tout", { selector: "[aria-label='Filtres de sévérité'] button" })).toBeInTheDocument();
    expect(screen.getByText("Critique")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("renders category filter buttons (Tout, Révisions, CNI, Scoring, KYC, Formations, BE, Documents, Alertes, Autres)", () => {
    renderFilters();
    const categoryGroup = screen.getByRole("group", { name: "Filtres par catégorie" });
    expect(categoryGroup).toBeInTheDocument();
    for (const label of ["Révisions", "CNI", "Scoring", "KYC", "Formations", "BE", "Documents", "Alertes", "Autres"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("active severity button has aria-pressed=true", () => {
    renderFilters({ activeSeverity: "critique" });
    expect(screen.getByText("Critique").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking severity button calls onSeverityChange", async () => {
    const user = userEvent.setup();
    const onSeverityChange = vi.fn();
    renderFilters({ onSeverityChange });

    await user.click(screen.getByText("Critique").closest("button")!);
    expect(onSeverityChange).toHaveBeenCalledWith("critique");
  });

  it("shows count in severity buttons", () => {
    renderFilters({ counts: { critique: 5, warning: 10, info: 2 } });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("active category button has aria-pressed=true", () => {
    renderFilters({ activeCategory: "kyc" });
    expect(screen.getByText("KYC").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking category button calls onCategoryChange", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    renderFilters({ onCategoryChange });

    await user.click(screen.getByText("Documents").closest("button")!);
    expect(onCategoryChange).toHaveBeenCalledWith("document");
  });

  it("has role='group' with aria-label for severity", () => {
    renderFilters();
    expect(screen.getByRole("group", { name: "Filtres de sévérité" })).toBeInTheDocument();
  });

  it("has role='group' with aria-label for category", () => {
    renderFilters();
    expect(screen.getByRole("group", { name: "Filtres par catégorie" })).toBeInTheDocument();
  });

  it("Critique button has red styling when active", () => {
    renderFilters({ activeSeverity: "critique" });
    const button = screen.getByText("Critique").closest("button")!;
    expect(button.className).toContain("bg-red-600");
    expect(button.className).toContain("text-white");
  });

  it("Info button has blue styling when active", () => {
    renderFilters({ activeSeverity: "info" });
    const button = screen.getByText("Info").closest("button")!;
    expect(button.className).toContain("bg-blue-500");
    expect(button.className).toContain("text-white");
  });

  it("inactive severity buttons do not have active styling", () => {
    renderFilters({ activeSeverity: "all" });
    const critiqueBtn = screen.getByText("Critique").closest("button")!;
    expect(critiqueBtn).toHaveAttribute("aria-pressed", "false");
    expect(critiqueBtn.className).not.toContain("bg-red-600");
  });
});
