import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DashboardSearch from "@/components/dashboard/DashboardSearch";
import type { Client, AlerteRegistre } from "@/lib/types";

// ── Polyfill scrollIntoView for jsdom ──────────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ── Mock navigate ──────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Sample data ────────────────────────────────────────────────

const sampleClients: Partial<Client>[] = [
  { ref: "CLI-26-001", raisonSociale: "SCI Dupont", siren: "123456789", dirigeant: "Jean Dupont" },
  { ref: "CLI-26-002", raisonSociale: "SARL Tech", siren: "987654321", dirigeant: "Marie Martin" },
  { ref: "CLI-26-003", raisonSociale: "SAS Innovation", siren: "111222333", dirigeant: "Paul Durand" },
  { ref: "CLI-26-004", raisonSociale: "EURL Services", siren: "444555666", dirigeant: "Anne Leroy" },
  { ref: "CLI-26-005", raisonSociale: "SCI Pierre", siren: "777888999", dirigeant: "Luc Bernard" },
  { ref: "CLI-26-006", raisonSociale: "SARL Dupont Fils", siren: "101010101", dirigeant: "Marc Dupont" },
  { ref: "CLI-26-007", raisonSociale: "SAS Alpha", siren: "202020202", dirigeant: "Claire Moreau" },
  { ref: "CLI-26-008", raisonSociale: "SCI Beta", siren: "303030303", dirigeant: "Hugo Simon" },
  { ref: "CLI-26-009", raisonSociale: "SARL Gamma", siren: "404040404", dirigeant: "Julie Petit" },
  { ref: "CLI-26-010", raisonSociale: "SAS Delta", siren: "505050505", dirigeant: "Thomas Roux" },
];

const sampleAlertes: Partial<AlerteRegistre>[] = [
  {
    date: "2025-03-10",
    clientConcerne: "SCI Dupont",
    categorie: "CRITIQUE",
    details: "Transaction suspecte",
    actionPrise: "Signalement",
    responsable: "J. Martin",
    qualification: "Suspecte",
    statut: "EN COURS",
    dateButoir: "2025-04-10",
    typeDecision: "INTERNE",
    validateur: "A. Chef",
    priorite: "CRITIQUE",
  },
  {
    date: "2025-03-08",
    clientConcerne: "SARL Tech",
    categorie: "HAUTE",
    details: "PPE détectée",
    actionPrise: "Vigilance renforcée",
    responsable: "M. Dupont",
    qualification: "Confirmée",
    statut: "CLOS",
    dateButoir: "2025-03-15",
    typeDecision: "INTERNE",
    validateur: "B. Chef",
    priorite: "HAUTE",
  },
];

// ── Helpers ────────────────────────────────────────────────────

function renderSearch(
  clients = sampleClients.slice(0, 2) as Client[],
  alertes = sampleAlertes as AlerteRegistre[],
) {
  return render(
    <MemoryRouter>
      <DashboardSearch clients={clients} alertes={alertes} />
    </MemoryRouter>,
  );
}

function getInput() {
  return screen.getByPlaceholderText("Rechercher un client, alerte...");
}

async function typeAndWait(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(getInput(), text);
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe("DashboardSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Renders search input with placeholder
  it("renders search input with correct placeholder", () => {
    renderSearch();
    expect(getInput()).toBeInTheDocument();
  });

  // 2. Shows clear button when query is non-empty
  it("shows clear button when query is non-empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    expect(screen.queryByLabelText("Effacer la recherche")).not.toBeInTheDocument();
    await user.type(getInput(), "test");
    expect(screen.getByLabelText("Effacer la recherche")).toBeInTheDocument();
  });

  // 3. Clears query when clear button clicked
  it("clears query when clear button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await user.type(getInput(), "Dupont");
    expect(getInput()).toHaveValue("Dupont");
    await user.click(screen.getByLabelText("Effacer la recherche"));
    expect(getInput()).toHaveValue("");
  });

  // 4. No results shown for queries less than 2 characters
  it("does not show results for queries shorter than 2 characters", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await user.type(getInput(), "D");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument();
  });

  // 5. Shows "Aucun résultat" when no matches found
  it('shows "Aucun résultat" when no matches found', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await typeAndWait(user, "xyznonexistent");
    expect(screen.getByText(/Aucun résultat/)).toBeInTheDocument();
  });

  // 6. Finds clients by raisonSociale
  it("finds clients by raisonSociale", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Pass only clients (no alertes) to avoid duplicate "SCI Dupont" matches
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "Dupont");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("SCI Dupont")).toBeInTheDocument();
  });

  // 7. Finds clients by ref
  it("finds clients by ref (e.g., CLI-26-001)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "CLI-26-001");
    expect(screen.getByText("SCI Dupont")).toBeInTheDocument();
  });

  // 8. Finds clients by SIREN
  it("finds clients by SIREN", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "987654321");
    expect(screen.getByText("SARL Tech")).toBeInTheDocument();
  });

  // 9. Finds alertes by clientConcerne
  it("finds alertes by clientConcerne", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch([], sampleAlertes as AlerteRegistre[]);
    await typeAndWait(user, "SCI Dupont");
    expect(screen.getByText("CRITIQUE")).toBeInTheDocument();
  });

  // 10. Shows max 8 results
  it("shows a maximum of 8 results", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients as Client[], sampleAlertes as AlerteRegistre[]);
    await typeAndWait(user, "CLI-26");
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBeLessThanOrEqual(8);
  });

  // 11. Clicking a client result navigates to /client/{ref}
  it("navigates to /client/{ref} when clicking a client result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "Dupont");
    await user.click(screen.getByText("SCI Dupont"));
    expect(mockNavigate).toHaveBeenCalledWith("/client/CLI-26-001");
  });

  // 12. Clicking an alerte result navigates to /registre
  it("navigates to /registre when clicking an alerte result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch([], sampleAlertes as AlerteRegistre[]);
    await typeAndWait(user, "SARL Tech");
    await user.click(screen.getByText("SARL Tech"));
    expect(mockNavigate).toHaveBeenCalledWith("/registre");
  });

  // 13. Escape key closes the dropdown
  it("closes the dropdown when Escape is pressed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await typeAndWait(user, "Dupont");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  // 14. ArrowDown / ArrowUp navigates results
  it("navigates results with ArrowDown and ArrowUp", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await typeAndWait(user, "Dupont");
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    // Initially no option is selected
    options.forEach((opt) => expect(opt).toHaveAttribute("aria-selected", "false"));

    // ArrowDown selects first item
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // ArrowDown again selects second item (if exists)
    if (options.length > 1) {
      await user.keyboard("{ArrowDown}");
      expect(options[0]).toHaveAttribute("aria-selected", "false");
      expect(options[1]).toHaveAttribute("aria-selected", "true");
    }

    // ArrowUp goes back
    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  // 15. Enter selects the active result
  it("selects the active result when Enter is pressed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "Dupont");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/client/CLI-26-001");
  });

  // 16. Has correct ARIA attributes
  it("has correct ARIA attributes (role=combobox, aria-expanded, aria-controls)", () => {
    renderSearch();
    const input = getInput();
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-controls", "dashboard-search-listbox");
  });

  // 16b. aria-expanded becomes true when dropdown is open
  it("sets aria-expanded to true when dropdown opens", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await typeAndWait(user, "Dupont");
    expect(getInput()).toHaveAttribute("aria-expanded", "true");
  });

  // 17. Closes dropdown on outside click
  it("closes dropdown on outside click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = renderSearch();
    await typeAndWait(user, "Dupont");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Click outside the component
    await user.click(container.parentElement!);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  // 18. Clears query and closes dropdown after selecting a result
  it("clears the input after selecting a result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch(sampleClients.slice(0, 2) as Client[], []);
    await typeAndWait(user, "Dupont");
    await user.click(screen.getByText("SCI Dupont"));
    expect(getInput()).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  // 19. ArrowDown wraps from last to first
  it("wraps ArrowDown from last result to first", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch([], sampleAlertes as AlerteRegistre[]);
    await typeAndWait(user, "Dupont");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    // Navigate to last item
    for (let i = 0; i < options.length; i++) {
      await user.keyboard("{ArrowDown}");
    }
    // One more ArrowDown should wrap to first
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  // 20. aria-activedescendant is updated on keyboard navigation
  it("updates aria-activedescendant on keyboard navigation", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSearch();
    await typeAndWait(user, "Dupont");
    const input = getInput();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "search-result-0");
  });
});
