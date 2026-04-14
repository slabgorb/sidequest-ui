/**
 * ScrapbookGallery — pure presentational tests for the diegetic image scrapbook.
 *
 * Story 33-17: Gallery becomes a turn-attributed, chapter-grouped scrapbook
 * with NPC/world-fact chips, grid/list view toggle, compact 3-col mode at 6+
 * images, scene-type badges, and a narrative empty state.
 *
 * Per CLAUDE.md: tests mock what the widget renders from, not the provider.
 * ScrapbookGallery takes a `readonly ScrapbookEntry[]` prop; the wrapper
 * ImageGalleryWidget is tested separately for the useImageBus() hookup.
 *
 * Graceful degradation is load-bearing: 33-18 hasn't shipped, so tests cover
 * rendering when scene_name / narrative_beat / scene_type / npcs / world_facts
 * / chapter are absent from the current payload shape.
 */
import { render, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  ScrapbookGallery,
  type ScrapbookEntry,
} from "../ScrapbookGallery";

function baseEntry(overrides: Partial<ScrapbookEntry> = {}): ScrapbookEntry {
  return {
    url: "https://example.invalid/img.webp",
    timestamp: 0,
    isHandout: false,
    ...overrides,
  };
}

function enrichedEntry(overrides: Partial<ScrapbookEntry> = {}): ScrapbookEntry {
  return baseEntry({
    render_id: "r-1",
    turn_number: 1,
    scene_name: "The Mouth of Mawdeep",
    narrative_beat: "Cold air rushes up from the throat of the cave.",
    scene_type: "establishing",
    chapter: "Into the Dark",
    location: "Mawdeep Entrance",
    world_facts: ["bioluminescent moss", "a rusted winch"],
    npcs: [
      { name: "Grell", role: "hostile" },
      { name: "Aster", role: "friendly" },
      { name: "A huddled stranger", role: "neutral" },
    ],
    ...overrides,
  });
}

describe("ScrapbookGallery — empty state", () => {
  it("renders the narrative empty state when images is empty", () => {
    const { getByTestId } = render(<ScrapbookGallery images={[]} />);
    const empty = getByTestId("scrapbook-empty");
    expect(empty.textContent).toContain(
      "No scenes yet — the world will fill these pages.",
    );
  });

  it("does not render scene count header when empty", () => {
    const { queryByTestId } = render(<ScrapbookGallery images={[]} />);
    expect(queryByTestId("scrapbook-scene-count")).toBeNull();
  });
});

describe("ScrapbookGallery — scene count header", () => {
  it("shows 'N scenes' in the header when populated", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({ render_id: "r-1", turn_number: 1 }),
      enrichedEntry({ render_id: "r-2", turn_number: 2 }),
      enrichedEntry({ render_id: "r-3", turn_number: 3 }),
    ];
    const { getByTestId } = render(<ScrapbookGallery images={images} />);
    expect(getByTestId("scrapbook-scene-count").textContent).toContain("3 scenes");
  });
});

describe("ScrapbookGallery — turn badge", () => {
  it("renders 'Turn N' badge overlaid on each image", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({ render_id: "r-1", turn_number: 4 }),
    ];
    const { getByTestId } = render(<ScrapbookGallery images={images} />);
    const badge = getByTestId("scrapbook-turn-badge-r-1");
    expect(badge.textContent).toContain("Turn 4");
  });

  it("omits the turn badge entirely when turn_number is undefined (graceful degradation)", () => {
    const images: ScrapbookEntry[] = [
      baseEntry({ render_id: "r-1" }), // no turn_number
    ];
    const { queryByTestId } = render(<ScrapbookGallery images={images} />);
    expect(queryByTestId("scrapbook-turn-badge-r-1")).toBeNull();
  });
});

describe("ScrapbookGallery — legend bar", () => {
  it("renders scene_name as title and narrative_beat as caption", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({
        render_id: "r-1",
        scene_name: "The Throat",
        narrative_beat: "Drips echo somewhere below.",
      }),
    ];
    const { getByTestId } = render(<ScrapbookGallery images={images} />);
    const legend = getByTestId("scrapbook-legend-r-1");
    expect(within(legend).getByTestId("scrapbook-title-r-1").textContent).toBe(
      "The Throat",
    );
    expect(
      within(legend).getByTestId("scrapbook-caption-r-1").textContent,
    ).toBe("Drips echo somewhere below.");
  });

  it("falls back to caption field as title when scene_name is absent", () => {
    const images: ScrapbookEntry[] = [
      baseEntry({
        render_id: "r-1",
        caption: "A crumbling doorway",
      }),
    ];
    const { getByTestId } = render(<ScrapbookGallery images={images} />);
    expect(getByTestId("scrapbook-title-r-1").textContent).toBe(
      "A crumbling doorway",
    );
  });

  it("hides the caption line entirely when narrative_beat is absent and no caption fallback exists", () => {
    const images: ScrapbookEntry[] = [
      baseEntry({ render_id: "r-1" }),
    ];
    const { queryByTestId } = render(<ScrapbookGallery images={images} />);
    expect(queryByTestId("scrapbook-caption-r-1")).toBeNull();
  });
});

describe("ScrapbookGallery — scene type badge", () => {
  it("renders scene_type badge when present", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({ render_id: "r-1", scene_type: "encounter" }),
    ];
    const { getByTestId } = render(<ScrapbookGallery images={images} />);
    const badge = getByTestId("scrapbook-scene-type-r-1");
    expect(badge.textContent?.toLowerCase()).toContain("encounter");
    expect(badge.getAttribute("data-scene-type")).toBe("encounter");
  });

  it("omits the scene_type badge when absent", () => {
    const images: ScrapbookEntry[] = [baseEntry({ render_id: "r-1" })];
    const { queryByTestId } = render(<ScrapbookGallery images={images} />);
    expect(queryByTestId("scrapbook-scene-type-r-1")).toBeNull();
  });
});

describe("ScrapbookGallery — NPC chips", () => {
  it("renders one chip per NPC with a data-npc-role attribute matching the role", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({
        render_id: "r-1",
        npcs: [
          { name: "Grell", role: "hostile" },
          { name: "Aster", role: "friendly" },
          { name: "Stranger", role: "neutral" },
        ],
      }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const chips = container.querySelectorAll(
      '[data-testid^="scrapbook-npc-chip-r-1"]',
    );
    expect(chips).toHaveLength(3);

    const hostile = container.querySelector(
      '[data-testid="scrapbook-npc-chip-r-1-Grell"]',
    );
    expect(hostile?.getAttribute("data-npc-role")).toBe("hostile");

    const friendly = container.querySelector(
      '[data-testid="scrapbook-npc-chip-r-1-Aster"]',
    );
    expect(friendly?.getAttribute("data-npc-role")).toBe("friendly");

    const neutral = container.querySelector(
      '[data-testid="scrapbook-npc-chip-r-1-Stranger"]',
    );
    expect(neutral?.getAttribute("data-npc-role")).toBe("neutral");
  });

  it("renders no NPC chips when npcs is absent or empty", () => {
    const images: ScrapbookEntry[] = [baseEntry({ render_id: "r-1" })];
    const { container } = render(<ScrapbookGallery images={images} />);
    const chips = container.querySelectorAll(
      '[data-testid^="scrapbook-npc-chip-r-1"]',
    );
    expect(chips).toHaveLength(0);
  });
});

describe("ScrapbookGallery — world facts chips", () => {
  it("renders one chip per world fact", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({
        render_id: "r-1",
        world_facts: ["moss glow", "rusted winch", "skeletal arch"],
      }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const chips = container.querySelectorAll(
      '[data-testid^="scrapbook-fact-chip-r-1"]',
    );
    expect(chips).toHaveLength(3);
  });

  it("renders no fact chips when world_facts is absent", () => {
    const images: ScrapbookEntry[] = [baseEntry({ render_id: "r-1" })];
    const { container } = render(<ScrapbookGallery images={images} />);
    const chips = container.querySelectorAll(
      '[data-testid^="scrapbook-fact-chip-r-1"]',
    );
    expect(chips).toHaveLength(0);
  });
});

describe("ScrapbookGallery — view toggle (grid/list)", () => {
  function threeEntries(): ScrapbookEntry[] {
    return [
      enrichedEntry({ render_id: "r-1", turn_number: 1 }),
      enrichedEntry({ render_id: "r-2", turn_number: 2 }),
      enrichedEntry({ render_id: "r-3", turn_number: 3 }),
    ];
  }

  it("defaults to grid view on mount", () => {
    const { getByTestId } = render(
      <ScrapbookGallery images={threeEntries()} />,
    );
    expect(getByTestId("scrapbook-root").getAttribute("data-view")).toBe(
      "grid",
    );
  });

  it("switches to list view when the list toggle is clicked", () => {
    const { getByTestId, getByRole } = render(
      <ScrapbookGallery images={threeEntries()} />,
    );
    fireEvent.click(getByRole("button", { name: /list view/i }));
    expect(getByTestId("scrapbook-root").getAttribute("data-view")).toBe(
      "list",
    );
  });

  it("switches back to grid view when the grid toggle is clicked", () => {
    const { getByTestId, getByRole } = render(
      <ScrapbookGallery images={threeEntries()} />,
    );
    fireEvent.click(getByRole("button", { name: /list view/i }));
    fireEvent.click(getByRole("button", { name: /grid view/i }));
    expect(getByTestId("scrapbook-root").getAttribute("data-view")).toBe(
      "grid",
    );
  });
});

describe("ScrapbookGallery — compact mode at 6+ images", () => {
  function nEntries(n: number): ScrapbookEntry[] {
    return Array.from({ length: n }, (_, i) =>
      enrichedEntry({ render_id: `r-${i + 1}`, turn_number: i + 1 }),
    );
  }

  it("is not compact with 5 images", () => {
    const { getByTestId } = render(<ScrapbookGallery images={nEntries(5)} />);
    expect(getByTestId("scrapbook-root").getAttribute("data-compact")).toBe(
      "false",
    );
  });

  it("engages compact mode with 6 images", () => {
    const { getByTestId } = render(<ScrapbookGallery images={nEntries(6)} />);
    expect(getByTestId("scrapbook-root").getAttribute("data-compact")).toBe(
      "true",
    );
  });

  it("engages compact mode with more than 6 images", () => {
    const { getByTestId } = render(<ScrapbookGallery images={nEntries(12)} />);
    expect(getByTestId("scrapbook-root").getAttribute("data-compact")).toBe(
      "true",
    );
  });

  it("renders a condensed 'TN' turn badge in compact mode instead of 'Turn N'", () => {
    const { getByTestId } = render(<ScrapbookGallery images={nEntries(7)} />);
    // In compact mode, badge text for turn 3 should be "T3", not "Turn 3".
    const badge = getByTestId("scrapbook-turn-badge-r-3");
    expect(badge.textContent).toBe("T3");
  });

  it("hides the caption line in compact mode", () => {
    const { queryByTestId } = render(<ScrapbookGallery images={nEntries(7)} />);
    // Caption is hidden by CSS visibility or not rendered — either way,
    // the element should not be in the DOM in compact mode.
    expect(queryByTestId("scrapbook-caption-r-1")).toBeNull();
  });
});

describe("ScrapbookGallery — chapter grouping", () => {
  it("groups entries by chapter and renders dividers between distinct chapters", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({
        render_id: "r-1",
        turn_number: 1,
        chapter: "Into the Dark",
      }),
      enrichedEntry({
        render_id: "r-2",
        turn_number: 2,
        chapter: "Into the Dark",
      }),
      enrichedEntry({
        render_id: "r-3",
        turn_number: 3,
        chapter: "The Deep Halls",
      }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const dividers = container.querySelectorAll(
      '[data-testid^="scrapbook-chapter-divider"]',
    );
    // Two chapters → two dividers (one header per chapter).
    expect(dividers).toHaveLength(2);
    expect(dividers[0].textContent).toContain("Into the Dark");
    expect(dividers[1].textContent).toContain("The Deep Halls");
  });

  it("renders a single chapter divider when only one chapter is present", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({
        render_id: "r-1",
        turn_number: 1,
        chapter: "Into the Dark",
      }),
      enrichedEntry({
        render_id: "r-2",
        turn_number: 2,
        chapter: "Into the Dark",
      }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const dividers = container.querySelectorAll(
      '[data-testid^="scrapbook-chapter-divider"]',
    );
    expect(dividers).toHaveLength(1);
  });

  it("groups entries under an 'Unsorted' chapter when chapter is absent", () => {
    const images: ScrapbookEntry[] = [
      baseEntry({ render_id: "r-1", turn_number: 1 }),
      baseEntry({ render_id: "r-2", turn_number: 2 }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const dividers = container.querySelectorAll(
      '[data-testid^="scrapbook-chapter-divider"]',
    );
    expect(dividers).toHaveLength(1);
    expect(dividers[0].textContent?.toLowerCase()).toContain("unsorted");
  });
});

describe("ScrapbookGallery — chronological sort", () => {
  it("sorts entries by ascending turn_number regardless of input order", () => {
    const images: ScrapbookEntry[] = [
      enrichedEntry({ render_id: "r-3", turn_number: 3 }),
      enrichedEntry({ render_id: "r-1", turn_number: 1 }),
      enrichedEntry({ render_id: "r-2", turn_number: 2 }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const entryNodes = container.querySelectorAll(
      '[data-testid^="scrapbook-entry-r-"]',
    );
    const ids = Array.from(entryNodes).map((n) =>
      n.getAttribute("data-testid"),
    );
    expect(ids).toEqual([
      "scrapbook-entry-r-1",
      "scrapbook-entry-r-2",
      "scrapbook-entry-r-3",
    ]);
  });

  it("falls back to timestamp order when turn_number is absent", () => {
    const images: ScrapbookEntry[] = [
      baseEntry({ render_id: "r-b", timestamp: 10 }),
      baseEntry({ render_id: "r-a", timestamp: 5 }),
    ];
    const { container } = render(<ScrapbookGallery images={images} />);
    const entryNodes = container.querySelectorAll(
      '[data-testid^="scrapbook-entry-r-"]',
    );
    const ids = Array.from(entryNodes).map((n) =>
      n.getAttribute("data-testid"),
    );
    expect(ids).toEqual(["scrapbook-entry-r-a", "scrapbook-entry-r-b"]);
  });
});

describe("ScrapbookGallery — key stability (React rule #6)", () => {
  it("uses render_id as the React key, not the array index", async () => {
    // Source-level regression guard: CLAUDE.md lang-review rule #6 bans
    // key={index} on lists where items can be reordered. ScrapbookGallery
    // sorts chronologically, so index-keyed items will fragment state.
    const src = (await import("../ScrapbookGallery.tsx?raw")) as unknown as {
      default: string;
    };
    // Accept any of the common stable-id patterns; reject bare index keys.
    expect(src.default).not.toMatch(/key=\{i\}|key=\{idx\}|key=\{index\}/);
    expect(src.default).toMatch(/key=\{[^}]*render_id[^}]*\}/);
  });
});
