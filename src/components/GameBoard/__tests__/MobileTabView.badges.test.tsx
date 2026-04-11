/**
 * Story 33-11: Tab notification badges
 *
 * Failing tests (RED state) for inline dot badges on Knowledge / Gallery /
 * Map / Inventory tabs when their content updates while the tab is inactive.
 *
 * Contract:
 *   - MobileTabView accepts an optional `contentSignals` prop of shape
 *     `Partial<Record<WidgetId, number>>`.
 *   - Each value is a version/counter — when a value increases while the
 *     corresponding tab is NOT the active tab, a dot badge renders inline
 *     after that tab's label.
 *   - Badge clears immediately when the user clicks the tab.
 *   - Badge state is component-local (ephemeral, not Redux).
 *   - Excluded tabs: character, audio (never badge, even if signalled).
 *   - Badge markup must be inline — not absolutely positioned — to avoid
 *     clipping against the bottom-edge tab bar.
 *
 * Mockup: .playwright-mcp/mockups/epic-33-panel-improvements.html#s33-11
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MobileTabView } from "../MobileTabView";
import type { WidgetId } from "../widgetRegistry";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const ALL_AVAILABLE: Set<WidgetId> = new Set([
  "narrative",
  "character",
  "map",
  "inventory",
  "gallery",
  "knowledge",
]);

const renderWidgetStub = (id: WidgetId) => (
  <div data-testid={`widget-content-${id}`}>content:{id}</div>
);

interface RenderArgs {
  contentSignals?: Partial<Record<WidgetId, number>>;
  availableWidgets?: Set<WidgetId>;
}

function renderTabView(args: RenderArgs = {}) {
  const props = {
    renderWidget: renderWidgetStub,
    availableWidgets: args.availableWidgets ?? ALL_AVAILABLE,
    // `contentSignals` is the new prop being introduced by this story.
    // Cast allows the failing tests to compile before Dev adds the prop
    // declaration on MobileTabViewProps. Remove the cast in GREEN.
    ...(args.contentSignals !== undefined ? { contentSignals: args.contentSignals } : {}),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<MobileTabView {...(props as any)} />);
}

/**
 * Locate the dot badge marker for a given tab by testid convention.
 * Component contract: each badge is marked `data-testid="tab-badge-{id}"`.
 */
function queryBadge(id: WidgetId): HTMLElement | null {
  return screen.queryByTestId(`tab-badge-${id}`);
}

/**
 * Find the clickable tab button for a given tab id.
 * Each button corresponds to one entry in the TABS list; we identify it
 * by the label text that's visible inside the button.
 */
function getTabButton(label: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(label, "i") });
}

// ─────────────────────────────────────────────────────────────
// AC-1: No badges initially
// ─────────────────────────────────────────────────────────────

describe("MobileTabView — tab notification badges (Story 33-11)", () => {
  it("renders no badges on first mount when no contentSignals provided", () => {
    renderTabView();
    expect(queryBadge("knowledge")).toBeNull();
    expect(queryBadge("gallery")).toBeNull();
    expect(queryBadge("map")).toBeNull();
    expect(queryBadge("inventory")).toBeNull();
  });

  it("renders no badges on first mount when contentSignals already populated (baseline snapshot)", () => {
    // Initial signals should be treated as the baseline — no badges appear
    // until a value changes during the session.
    renderTabView({
      contentSignals: { knowledge: 5, gallery: 2, map: 1, inventory: 3 },
    });
    expect(queryBadge("knowledge")).toBeNull();
    expect(queryBadge("gallery")).toBeNull();
    expect(queryBadge("map")).toBeNull();
    expect(queryBadge("inventory")).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-2: Badge appears on Knowledge tab when `world_learned` arrives
  // ─────────────────────────────────────────────────────────────

  it("renders Knowledge badge when knowledge signal increments while tab inactive", () => {
    const { rerender } = renderTabView({
      contentSignals: { knowledge: 0 },
    });
    expect(queryBadge("knowledge")).toBeNull();

    // Simulate a new world_learned event: parent bumps the signal.
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1 } } as any)}
      />
    );

    expect(queryBadge("knowledge")).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-3: Badge appears on Gallery tab when scene images arrive
  // ─────────────────────────────────────────────────────────────

  it("renders Gallery badge when gallery signal increments while tab inactive", () => {
    const { rerender } = renderTabView({
      contentSignals: { gallery: 0 },
    });
    expect(queryBadge("gallery")).toBeNull();

    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { gallery: 1 } } as any)}
      />
    );

    expect(queryBadge("gallery")).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-4: Secondary targets — Map and Inventory
  // ─────────────────────────────────────────────────────────────

  it("renders Map badge when map signal increments", () => {
    const { rerender } = renderTabView({ contentSignals: { map: 0 } });
    expect(queryBadge("map")).toBeNull();
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { map: 1 } } as any)}
      />
    );
    expect(queryBadge("map")).not.toBeNull();
  });

  it("renders Inventory badge when inventory signal increments", () => {
    const { rerender } = renderTabView({ contentSignals: { inventory: 0 } });
    expect(queryBadge("inventory")).toBeNull();
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { inventory: 1 } } as any)}
      />
    );
    expect(queryBadge("inventory")).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-5: Badge clears when the user clicks that tab
  // ─────────────────────────────────────────────────────────────

  it("clears Knowledge badge immediately when the Knowledge tab is clicked", () => {
    const { rerender } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1 } } as any)}
      />
    );
    expect(queryBadge("knowledge")).not.toBeNull();

    fireEvent.click(getTabButton("Journal")); // Knowledge tab label in TABS is "Journal"
    expect(queryBadge("knowledge")).toBeNull();
  });

  it("clears Gallery badge immediately when the Gallery tab is clicked", () => {
    const { rerender } = renderTabView({ contentSignals: { gallery: 0 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { gallery: 1 } } as any)}
      />
    );
    expect(queryBadge("gallery")).not.toBeNull();

    fireEvent.click(getTabButton("Gallery"));
    expect(queryBadge("gallery")).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-6: Active tab never gets a badge — "updated since last time that
  // tab was active" means the currently-active tab has, by definition,
  // already been seen.
  // ─────────────────────────────────────────────────────────────

  it("does NOT badge the currently active tab when its signal changes", () => {
    // Narrative is the default active tab on mount. Click Knowledge to make
    // it active, then bump the knowledge signal — the badge should NOT
    // appear because the user is already looking at it.
    const { rerender } = renderTabView({ contentSignals: { knowledge: 0 } });
    fireEvent.click(getTabButton("Journal")); // switch to Knowledge tab

    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1 } } as any)}
      />
    );

    expect(queryBadge("knowledge")).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-7: Excluded tabs — Character and Audio never badge
  // ─────────────────────────────────────────────────────────────

  it("never renders a badge on the Character tab, even if signalled", () => {
    const { rerender } = renderTabView({ contentSignals: { character: 0 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { character: 1 } } as any)}
      />
    );
    expect(queryBadge("character")).toBeNull();
  });

  it("never renders a badge on the Audio tab, even if signalled", () => {
    // Audio is not currently in the mobile TABS list, but the AC explicitly
    // excludes it — this test guards against future regressions if Audio
    // gets added back to mobile.
    const withAudio = new Set<WidgetId>([...ALL_AVAILABLE, "audio"]);
    const { rerender } = renderTabView({
      availableWidgets: withAudio,
      contentSignals: { audio: 0 },
    });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={withAudio}
        {...({ contentSignals: { audio: 1 } } as any)}
      />
    );
    expect(queryBadge("audio")).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-8: Badge is rendered INLINE after the label text, not absolutely
  // positioned — AC explicitly calls this out to avoid clipping.
  // ─────────────────────────────────────────────────────────────

  it("renders the badge inline (no 'absolute' positioning class)", () => {
    const { rerender } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1 } } as any)}
      />
    );
    const badge = queryBadge("knowledge");
    expect(badge).not.toBeNull();
    // Guard: the AC calls out that absolute positioning clips against the
    // tab bar's bottom edge. Reject any utility class variant of `absolute`.
    const cls = badge!.className ?? "";
    expect(cls).not.toMatch(/(^|\s)absolute(\s|$)/);
  });

  it("renders the badge as a descendant of the tab button (sibling of the label)", () => {
    const { rerender } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1 } } as any)}
      />
    );
    const badge = queryBadge("knowledge");
    expect(badge).not.toBeNull();
    // The badge must live inside the button that contains the "Journal"
    // label — that proves it's attached to the tab itself, not floating in
    // an unrelated container.
    const button = getTabButton("Journal");
    expect(button.contains(badge)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-9: Badge stays when unrelated tabs' signals change
  // ─────────────────────────────────────────────────────────────

  it("leaves existing Knowledge badge intact when a different tab's signal changes", () => {
    const { rerender } = renderTabView({
      contentSignals: { knowledge: 0, gallery: 0 },
    });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1, gallery: 0 } } as any)}
      />
    );
    expect(queryBadge("knowledge")).not.toBeNull();
    expect(queryBadge("gallery")).toBeNull();

    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 1, gallery: 1 } } as any)}
      />
    );
    expect(queryBadge("knowledge")).not.toBeNull();
    expect(queryBadge("gallery")).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-10: Signal re-render with same value does not create a badge
  // (re-renders should not be mistaken for content updates).
  // ─────────────────────────────────────────────────────────────

  it("does not create a badge when rerendered with the same signal value", () => {
    const { rerender } = renderTabView({ contentSignals: { knowledge: 5 } });
    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={ALL_AVAILABLE}
        {...({ contentSignals: { knowledge: 5 } } as any)}
      />
    );
    expect(queryBadge("knowledge")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Wiring: MobileTabView accepts the `contentSignals` prop
// ─────────────────────────────────────────────────────────────

describe("MobileTabView — contentSignals prop contract (Story 33-11 wiring)", () => {
  it("MobileTabView is importable from @/components/GameBoard/MobileTabView", async () => {
    const mod = await import("@/components/GameBoard/MobileTabView");
    expect(typeof mod.MobileTabView).toBe("function");
  });

  it("MobileTabViewProps declares a `contentSignals` field", async () => {
    // Source-level guard: the prop must be declared on the interface so
    // GameBoard can pass it without `as any` once wired.
    const src = (await import("@/components/GameBoard/MobileTabView?raw")) as unknown as {
      default: string;
    };
    expect(src.default).toMatch(/contentSignals\s*\??\s*:/);
  });

  it("GameBoard passes contentSignals through to MobileTabView", async () => {
    // Integration wiring check: GameBoard must forward a contentSignals
    // prop when rendering MobileTabView, otherwise the badges will never
    // fire in production code paths.
    const src = (await import("@/components/GameBoard/GameBoard?raw")) as unknown as {
      default: string;
    };
    expect(src.default).toMatch(/contentSignals\s*=/);
  });
});
