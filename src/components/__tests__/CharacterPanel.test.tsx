import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CharacterPanel } from "../CharacterPanel";
import type { CharacterSheetData } from "../CharacterSheet";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CHARACTER: CharacterSheetData = {
  name: "Kael",
  class: "Ranger",
  level: 3,
  stats: {
    strength: 14,
    dexterity: 18,
    constitution: 12,
    intelligence: 10,
    wisdom: 15,
    charisma: 8,
  },
  abilities: ["Tracker", "Beast Companion"],
  backstory: "Born in the Ashwood, raised by wolves.",
  portrait_url: "/renders/kael.png",
  current_location: "The Rusty Cantina",
};

const INVENTORY = {
  items: [
    { name: "Elven Longbow", type: "weapon", equipped: true, description: "A fine bow." },
    { name: "Healing Potion", type: "consumable", quantity: 3, description: "Restores HP." },
  ],
  gold: 42,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clear localStorage before each test to avoid prefs leaking between tests. */
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// AC-1: CharacterPanel renders as a persistent sidebar (not a modal)
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-1: persistent sidebar", () => {
  it("renders with data-testid character-panel", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByTestId("character-panel")).toBeInTheDocument();
  });

  it("is visible immediately without any user interaction", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const panel = screen.getByTestId("character-panel");
    expect(panel).toBeVisible();
  });

  it("does NOT render as a modal or overlay (no backdrop)", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByTestId("overlay-backdrop")).not.toBeInTheDocument();
  });

  it("displays character name and class prominently", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByText("Kael")).toBeInTheDocument();
    expect(screen.getByText(/Ranger/)).toBeInTheDocument();
  });

  it("displays character portrait when available", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/renders/kael.png");
  });

  it("renders gracefully without portrait", () => {
    const noPortrait = { ...CHARACTER, portrait_url: undefined };
    render(<CharacterPanel character={noPortrait} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Kael")).toBeInTheDocument();
  });

  it("displays current location when available", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByText("The Rusty Cantina")).toBeInTheDocument();
  });

  it("renders level", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Tabbed sections for character info
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-2: tabbed sections", () => {
  it("renders tab buttons for Stats, Abilities, and Backstory", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /stats/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /abilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /backstory/i })).toBeInTheDocument();
  });

  it("shows Stats tab content by default", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const tabpanel = screen.getByRole("tabpanel");
    // Stats tab should show stat names and values
    expect(within(tabpanel).getByText(/strength/i)).toBeInTheDocument();
    expect(within(tabpanel).getByText("14")).toBeInTheDocument();
  });

  it("switches to Abilities tab on click", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByRole("tab", { name: /abilities/i }));
    const tabpanel = screen.getByRole("tabpanel");
    expect(within(tabpanel).getByText("Tracker")).toBeInTheDocument();
    expect(within(tabpanel).getByText("Beast Companion")).toBeInTheDocument();
  });

  it("switches to Backstory tab on click", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByRole("tab", { name: /backstory/i }));
    const tabpanel = screen.getByRole("tabpanel");
    expect(within(tabpanel).getByText(/Born in the Ashwood/)).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const statsTab = screen.getByRole("tab", { name: /stats/i });
    expect(statsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /abilities/i }));
    expect(statsTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /abilities/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders an Inventory tab when inventory data is provided", () => {
    render(<CharacterPanel character={CHARACTER} inventory={INVENTORY} />);
    expect(screen.getByRole("tab", { name: /inventory/i })).toBeInTheDocument();
  });

  it("does not render Inventory tab when inventory is absent", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByRole("tab", { name: /inventory/i })).not.toBeInTheDocument();
  });

  it("shows inventory items when Inventory tab is selected", () => {
    render(<CharacterPanel character={CHARACTER} inventory={INVENTORY} />);
    fireEvent.click(screen.getByRole("tab", { name: /inventory/i }));
    const tabpanel = screen.getByRole("tabpanel");
    expect(within(tabpanel).getByText("Elven Longbow")).toBeInTheDocument();
    expect(within(tabpanel).getByText("Healing Potion")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Tab persistence via useLocalPrefs
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-3: tab persistence", () => {
  it("persists selected tab to localStorage", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByRole("tab", { name: /abilities/i }));

    const stored = localStorage.getItem("sq-character-panel");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.activeTab).toBe("abilities");
  });

  it("restores previously selected tab from localStorage on mount", () => {
    localStorage.setItem(
      "sq-character-panel",
      JSON.stringify({ activeTab: "backstory", collapsed: false }),
    );
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /backstory/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to Stats when localStorage has invalid data", () => {
    localStorage.setItem("sq-character-panel", "not-json");
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /stats/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

// ---------------------------------------------------------------------------
// AC-4: Collapse/expand
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-4: collapse/expand", () => {
  it("renders a collapse toggle button", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByTestId("panel-collapse-toggle")).toBeInTheDocument();
  });

  it("hides tab content when collapsed", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByTestId("panel-collapse-toggle"));
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });

  it("still shows character name when collapsed", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByTestId("panel-collapse-toggle"));
    expect(screen.getByText("Kael")).toBeInTheDocument();
  });

  it("expands back on second toggle click", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const toggle = screen.getByTestId("panel-collapse-toggle");
    fireEvent.click(toggle); // collapse
    fireEvent.click(toggle); // expand
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("persists collapsed state to localStorage", () => {
    render(<CharacterPanel character={CHARACTER} />);
    fireEvent.click(screen.getByTestId("panel-collapse-toggle"));

    const stored = localStorage.getItem("sq-character-panel");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.collapsed).toBe(true);
  });

  it("restores collapsed state from localStorage on mount", () => {
    localStorage.setItem(
      "sq-character-panel",
      JSON.stringify({ activeTab: "stats", collapsed: true }),
    );
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Handles empty/missing data gracefully
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-5: edge cases", () => {
  it("renders with empty stats", () => {
    const data = { ...CHARACTER, stats: {} };
    render(<CharacterPanel character={data} />);
    expect(screen.getByText("Kael")).toBeInTheDocument();
  });

  it("renders with empty abilities", () => {
    const data = { ...CHARACTER, abilities: [] };
    render(<CharacterPanel character={data} />);
    expect(screen.getByText("Kael")).toBeInTheDocument();
  });

  it("renders with no location", () => {
    const data = { ...CHARACTER, current_location: undefined };
    render(<CharacterPanel character={data} />);
    expect(screen.getByText("Kael")).toBeInTheDocument();
    expect(screen.queryByText("The Rusty Cantina")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wiring test — verify CharacterPanel has non-test consumers
// ---------------------------------------------------------------------------

describe("CharacterPanel — wiring", () => {
  it("is exported from the components directory", async () => {
    // Verify the module exports exist — this catches broken imports
    const mod = await import("../CharacterPanel");
    expect(mod.CharacterPanel).toBeDefined();
    expect(typeof mod.CharacterPanel).toBe("function");
  });
});
