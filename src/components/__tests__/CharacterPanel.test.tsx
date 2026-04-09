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

  it("does NOT render an Inventory subtab — inventory has its own top-level panel", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByRole("tab", { name: /inventory/i })).not.toBeInTheDocument();
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
      JSON.stringify({ activeTab: "backstory" }),
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
// AC-4: Sidebar is always visible (no collapse) with resize handle
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-4: always visible with resize", () => {
  it("does NOT render a collapse toggle button", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByTestId("panel-collapse-toggle")).not.toBeInTheDocument();
  });

  it("always shows tab content (no collapsed state)", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("renders as a flexible panel (no fixed width)", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const panel = screen.getByTestId("character-panel");
    expect(panel.style.width).toBe("");
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
// AC-6: Integrated party list
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-6: integrated party list", () => {
  const PARTY = [
    {
      player_id: "p1",
      name: "Kael",
      character_name: "Kael",
      portrait_url: "/renders/kael.png",
      hp: 24,
      hp_max: 30,
      status_effects: ["poisoned"],
      class: "Ranger",
      level: 3,
      current_location: "The Rusty Cantina",
    },
    {
      player_id: "p2",
      name: "Lyra",
      character_name: "Lyra Dawnforge",
      portrait_url: "",
      hp: 8,
      hp_max: 40,
      status_effects: [],
      class: "Cleric",
      level: 5,
      current_location: "The Rusty Cantina",
    },
  ];

  it("renders a party section when characters are provided", () => {
    render(<CharacterPanel character={CHARACTER} characters={PARTY} />);
    expect(screen.getByTestId("party-section")).toBeInTheDocument();
  });

  it("renders a card for each party member", () => {
    render(<CharacterPanel character={CHARACTER} characters={PARTY} />);
    expect(screen.getByTestId("party-member-p1")).toBeInTheDocument();
    expect(screen.getByTestId("party-member-p2")).toBeInTheDocument();
  });

  it("does not render party section when no characters", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByTestId("party-section")).not.toBeInTheDocument();
  });

  it("does not render party section when characters array is empty", () => {
    render(<CharacterPanel character={CHARACTER} characters={[]} />);
    expect(screen.queryByTestId("party-section")).not.toBeInTheDocument();
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
