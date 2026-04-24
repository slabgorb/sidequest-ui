import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CharacterPanel } from "../CharacterPanel";
import type { CharacterSheetData } from "../CharacterSheet";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CHARACTER: CharacterSheetData = {
  name: "Kael",
  class: "Ranger",
  race: "Wood Elf",
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

  it("renders portrait placeholder with initials when no portrait_url", () => {
    const noPortrait = { ...CHARACTER, portrait_url: undefined };
    render(<CharacterPanel character={noPortrait} />);
    const placeholder = screen.getByTestId("character-portrait-placeholder");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveTextContent("K");
  });

  it("does not render placeholder when portrait_url is present", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(
      screen.queryByTestId("character-portrait-placeholder"),
    ).not.toBeInTheDocument();
  });

  it("does NOT display per-character location (single source of truth is the top header)", () => {
    render(<CharacterPanel character={CHARACTER} />);
    // The character.current_location field is set once at chargen and was
    // never updated as the player moved, leading to stale location displays.
    // The top-level location header is now the single source of truth.
    expect(screen.queryByText("The Rusty Cantina")).not.toBeInTheDocument();
  });

  it("renders level", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-1b (33-7): Enriched character header — portrait · name · subtitle · level badge
// ---------------------------------------------------------------------------

describe("CharacterPanel — 33-7: enriched header", () => {
  it("renders a character-header row with portrait, subtitle, and level badge", () => {
    render(<CharacterPanel character={CHARACTER} genreSlug="low_fantasy" />);
    // Query by role/testid rather than child count — protects the semantic
    // contract (three meaningful elements) without coupling to DOM structure.
    expect(screen.getByTestId("character-header")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Kael" })).toBeInTheDocument();
    expect(screen.getByTestId("character-subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("character-level-badge")).toBeInTheDocument();
  });

  it("level badge shows exactly 'Lv N' as a compact chip", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const badge = screen.getByTestId("character-level-badge");
    expect(badge).toBeInTheDocument();
    // Exact match: substring would let "Lv 3000" or "Lv 3 ★" pass incorrectly.
    expect(badge).toHaveTextContent(/^Lv 3$/);
  });

  it("placeholder renders two-character initials for a two-word name", () => {
    const twoWord = { ...CHARACTER, name: "Lyra Dawnforge", portrait_url: undefined };
    render(<CharacterPanel character={twoWord} />);
    const placeholder = screen.getByTestId("character-portrait-placeholder");
    expect(placeholder).toHaveTextContent(/^LD$/);
  });

  // Playtest 2026-04-23: subtitle is class · race (character identity), NOT
  // class · genre (rulebook). Showing the genre slug here ("Beastkin · Mutant
  // Wasteland") conflated two separate concepts and confused the user.
  it("subtitle combines class and race display names with ·", () => {
    render(<CharacterPanel character={CHARACTER} genreSlug="mutant_wasteland" />);
    expect(screen.getByText(/Ranger · Wood Elf/)).toBeInTheDocument();
  });

  it("subtitle falls back to class-only when race is absent", () => {
    const { race: _race, ...withoutRace } = CHARACTER;
    render(<CharacterPanel character={withoutRace} genreSlug="mutant_wasteland" />);
    // Even with a genreSlug present, the subtitle must NOT include genre.
    const subtitle = screen.getByTestId("character-subtitle");
    expect(subtitle.textContent).toBe("Ranger");
    expect(subtitle.textContent).not.toContain("·");
    expect(subtitle.textContent).not.toMatch(/Mutant|Wasteland/);
  });

  it("portrait slot is 48px (w-12 h-12) for both img and placeholder", () => {
    const { rerender } = render(<CharacterPanel character={CHARACTER} />);
    const img = screen.getByRole("img");
    expect(img.className).toContain("w-12");
    expect(img.className).toContain("h-12");
    expect(img.className).toContain("rounded-full");

    rerender(
      <CharacterPanel character={{ ...CHARACTER, portrait_url: undefined }} />,
    );
    const placeholder = screen.getByTestId("character-portrait-placeholder");
    expect(placeholder.className).toContain("w-12");
    expect(placeholder.className).toContain("h-12");
    expect(placeholder.className).toContain("rounded-full");
  });

  it("name uses accent color (var --primary) and truncates", () => {
    render(<CharacterPanel character={CHARACTER} />);
    const name = screen.getByRole("heading", { level: 2, name: "Kael" });
    expect(name.className).toContain("text-[var(--primary)]");
    expect(name.className).toContain("truncate");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Tabbed sections for character info
// ---------------------------------------------------------------------------

describe("CharacterPanel — AC-2: tabbed sections", () => {
  it("renders tab buttons for Stats and Abilities", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /stats/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /abilities/i })).toBeInTheDocument();
  });

  it("does NOT render a Backstory subtab — backstory lives in the top-level Lore panel", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByRole("tab", { name: /backstory/i })).not.toBeInTheDocument();
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
      JSON.stringify({ activeTab: "abilities" }),
    );
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /abilities/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to Stats when localStorage has a stale tab id (e.g. removed Backstory)", () => {
    localStorage.setItem(
      "sq-character-panel",
      JSON.stringify({ activeTab: "backstory" }),
    );
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.getByRole("tab", { name: /stats/i })).toHaveAttribute(
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

  it("renders inline HP per party row sourced from CharacterSummary.hp/hp_max", () => {
    render(<CharacterPanel character={CHARACTER} characters={PARTY} />);
    // Kael at 24/30 — full opacity tone
    const kaelHp = screen.getByTestId("party-member-hp-p1");
    expect(kaelHp).toHaveTextContent("HP 24/30");
    // Lyra at 8/40 = 20% — at or below the 25% threshold, should show
    // destructive tone class for at-a-glance "in trouble" signaling.
    const lyraHp = screen.getByTestId("party-member-hp-p2");
    expect(lyraHp).toHaveTextContent("HP 8/40");
    expect(lyraHp.className).toMatch(/destructive/);
  });

  it("hides inline HP for genres that don't model HP (both 0)", () => {
    const NO_HP_PARTY = [
      {
        ...PARTY[0],
        player_id: "p3",
        hp: 0,
        hp_max: 0,
      },
    ];
    render(<CharacterPanel character={CHARACTER} characters={NO_HP_PARTY} />);
    expect(screen.queryByTestId("party-member-hp-p3")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HP badge in the header — Sebastien-axis (mechanical visibility)
// ---------------------------------------------------------------------------

describe("CharacterPanel — HP badge in header", () => {
  it("renders HP badge when hp + hp_max are present", () => {
    render(
      <CharacterPanel
        character={{ ...CHARACTER, hp: 18, hp_max: 30 }}
      />,
    );
    const badge = screen.getByTestId("character-hp-badge");
    expect(badge).toHaveTextContent("HP 18/30");
    expect(badge).toHaveAttribute("aria-label", "Hit points 18 of 30");
  });

  it("flags HP badge as destructive when current is at/below 25% of max", () => {
    render(
      <CharacterPanel
        character={{ ...CHARACTER, hp: 5, hp_max: 30 }}
      />,
    );
    const badge = screen.getByTestId("character-hp-badge");
    expect(badge.className).toMatch(/destructive/);
  });

  it("does not render HP badge when hp/hp_max are absent (genres without HP)", () => {
    render(<CharacterPanel character={CHARACTER} />);
    expect(screen.queryByTestId("character-hp-badge")).not.toBeInTheDocument();
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
