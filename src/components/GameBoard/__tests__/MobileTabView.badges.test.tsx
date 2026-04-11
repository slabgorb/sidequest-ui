/**
 * Story 33-11: Tab notification badges
 *
 * Tests for inline dot badges on Knowledge / Gallery / Map / Inventory tabs
 * when their content updates while the tab is inactive.
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
  const result = render(
    <MobileTabView
      renderWidget={renderWidgetStub}
      availableWidgets={args.availableWidgets ?? ALL_AVAILABLE}
      contentSignals={args.contentSignals}
    />,
  );
  const rerenderWith = (
    contentSignals: Partial<Record<WidgetId, number>>,
    availableWidgets: Set<WidgetId> = args.availableWidgets ?? ALL_AVAILABLE,
  ) =>
    result.rerender(
      <MobileTabView
        renderWidget={renderWidgetStub}
        availableWidgets={availableWidgets}
        contentSignals={contentSignals}
      />,
    );
  return { ...result, rerenderWith };
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
 */
function getTabButton(label: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(label, "i") });
}

// ─────────────────────────────────────────────────────────────

describe("MobileTabView — tab notification badges (Story 33-11)", () => {
  // AC-1: No badges initially
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

  // AC-2: Badge appears on Knowledge tab when `world_learned` arrives
  it("renders Knowledge badge when knowledge signal increments while tab inactive", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    expect(queryBadge("knowledge")).toBeNull();

    // Simulate a new world_learned event: parent bumps the signal.
    rerenderWith({ knowledge: 1 });

    expect(queryBadge("knowledge")).not.toBeNull();
  });

  // AC-3: Badge appears on Gallery tab when scene images arrive
  it("renders Gallery badge when gallery signal increments while tab inactive", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { gallery: 0 } });
    expect(queryBadge("gallery")).toBeNull();

    rerenderWith({ gallery: 1 });

    expect(queryBadge("gallery")).not.toBeNull();
  });

  // AC-4: Secondary targets — Map and Inventory
  it("renders Map badge when map signal increments", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { map: 0 } });
    expect(queryBadge("map")).toBeNull();
    rerenderWith({ map: 1 });
    expect(queryBadge("map")).not.toBeNull();
  });

  it("renders Inventory badge when inventory signal increments", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { inventory: 0 } });
    expect(queryBadge("inventory")).toBeNull();
    rerenderWith({ inventory: 1 });
    expect(queryBadge("inventory")).not.toBeNull();
  });

  // AC-5: Badge clears when the user clicks that tab
  it("clears Knowledge badge immediately when the Knowledge tab is clicked", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerenderWith({ knowledge: 1 });
    expect(queryBadge("knowledge")).not.toBeNull();

    fireEvent.click(getTabButton("Journal")); // Knowledge tab label in TABS is "Journal"
    expect(queryBadge("knowledge")).toBeNull();
  });

  it("clears Gallery badge immediately when the Gallery tab is clicked", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { gallery: 0 } });
    rerenderWith({ gallery: 1 });
    expect(queryBadge("gallery")).not.toBeNull();

    fireEvent.click(getTabButton("Gallery"));
    expect(queryBadge("gallery")).toBeNull();
  });

  // AC-6: Active tab never gets a badge — "updated since last time that
  // tab was active" means the currently-active tab has, by definition,
  // already been seen.
  it("does NOT badge the currently active tab when its signal changes", () => {
    // Narrative is the default active tab on mount. Click Knowledge to make
    // it active, then bump the knowledge signal — the badge should NOT
    // appear because the user is already looking at it.
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    fireEvent.click(getTabButton("Journal")); // switch to Knowledge tab

    rerenderWith({ knowledge: 1 });

    expect(queryBadge("knowledge")).toBeNull();
  });

  // AC-7: Excluded tabs — Character and Audio never badge
  it("never renders a badge on the Character tab, even if signalled", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { character: 0 } });
    rerenderWith({ character: 1 });
    expect(queryBadge("character")).toBeNull();
  });

  it("never renders a badge on the Audio tab, even if signalled", () => {
    // Audio is not currently in the mobile TABS list, but the AC explicitly
    // excludes it — this test guards against future regressions if Audio
    // gets added back to mobile.
    const withAudio = new Set<WidgetId>([...ALL_AVAILABLE, "audio"]);
    const { rerenderWith } = renderTabView({
      availableWidgets: withAudio,
      contentSignals: { audio: 0 },
    });
    rerenderWith({ audio: 1 }, withAudio);
    expect(queryBadge("audio")).toBeNull();
  });

  // AC-8: Badge is rendered INLINE after the label text, not absolutely
  // positioned — AC explicitly calls this out to avoid clipping.
  it("renders the badge inline (no 'absolute' or 'fixed' positioning, on itself or wrapper)", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerenderWith({ knowledge: 1 });
    const badge = screen.getByTestId("tab-badge-knowledge");

    // Guard: the AC calls out that absolute/fixed positioning clips against
    // the tab bar's bottom edge. Reject any utility class variant of
    // `absolute` or `fixed` on the badge itself OR its immediate wrapper
    // (either layer could remove it from the inline flow).
    const positioned = /(^|\s)(absolute|fixed)(\s|$)/;
    expect(badge.className).not.toMatch(positioned);
    const wrapper = badge.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).not.toMatch(positioned);
  });

  it("renders the badge as a descendant of the tab button (sibling of the label)", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerenderWith({ knowledge: 1 });
    const badge = queryBadge("knowledge");
    expect(badge).not.toBeNull();
    // The badge must live inside the button that contains the "Journal"
    // label — that proves it's attached to the tab itself, not floating in
    // an unrelated container.
    const button = getTabButton("Journal");
    expect(button.contains(badge)).toBe(true);
  });

  // AC-9: Badge stays when unrelated tabs' signals change
  it("leaves existing Knowledge badge intact when a different tab's signal changes", () => {
    const { rerenderWith } = renderTabView({
      contentSignals: { knowledge: 0, gallery: 0 },
    });
    rerenderWith({ knowledge: 1, gallery: 0 });
    expect(queryBadge("knowledge")).not.toBeNull();
    expect(queryBadge("gallery")).toBeNull();

    rerenderWith({ knowledge: 1, gallery: 1 });
    expect(queryBadge("knowledge")).not.toBeNull();
    expect(queryBadge("gallery")).not.toBeNull();
  });

  // AC-10: Signal re-render with same value does not create a badge
  // (re-renders should not be mistaken for content updates).
  it("does not create a badge when rerendered with the same signal value", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 5 } });
    rerenderWith({ knowledge: 5 });
    expect(queryBadge("knowledge")).toBeNull();
  });

  // AC pin: "changes" in the AC is bidirectional — inventory items
  // decrease when consumed, gold decreases on purchase. A signal
  // decrease must also fire a badge so the player notices the shift.
  // This pins the implementation's "any change, not just rises"
  // semantics against accidental narrowing.
  it("renders a badge when a signal value decreases (not only increases)", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { inventory: 5 } });
    rerenderWith({ inventory: 3 });
    expect(queryBadge("inventory")).not.toBeNull();
  });

  // Re-activation path: badge fires on inactive tab, user clicks to
  // dismiss, then a new signal lands while they are still on that tab.
  // The "active tab never badges" rule must apply on this second arrival
  // too — the user is already looking at the tab, so the second update
  // has also been "seen" as it arrives.
  it("does not re-badge an active tab when another signal fires after the initial clear", () => {
    const { rerenderWith } = renderTabView({ contentSignals: { knowledge: 0 } });
    rerenderWith({ knowledge: 1 });
    expect(queryBadge("knowledge")).not.toBeNull();

    fireEvent.click(getTabButton("Journal")); // knowledge is now active, badge cleared
    expect(queryBadge("knowledge")).toBeNull();

    rerenderWith({ knowledge: 2 });
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

  it("MobileTabViewProps accepts a `contentSignals` prop at compile time", () => {
    // Compile-time guard: if the prop is removed from MobileTabViewProps,
    // this object literal fails to satisfy the component's prop type and
    // TypeScript rejects the file. This is stronger than a raw-source
    // regex — it survives interface extraction and rename refactors.
    const props: Parameters<typeof MobileTabView>[0] = {
      renderWidget: renderWidgetStub,
      availableWidgets: ALL_AVAILABLE,
      contentSignals: { knowledge: 0, gallery: 0, map: 0, inventory: 0 },
    };
    expect(props.contentSignals).toBeDefined();
  });

  it("GameBoard forwards contentSignals as a JSX prop to MobileTabView", async () => {
    // Integration wiring check: GameBoard must forward contentSignals as
    // a JSX prop to <MobileTabView>. The regex must NOT match the
    // `const contentSignals = useMemo(...)` assignment line — only the
    // JSX prop itself. If the JSX prop is deleted, this test must fail.
    const src = (await import("@/components/GameBoard/GameBoard?raw")) as unknown as {
      default: string;
    };
    // Look for `contentSignals={contentSignals}` specifically — the
    // JSX prop pass, not the variable declaration. The `{contentSignals}`
    // binding side disambiguates the JSX call site from the useMemo
    // assignment (which is `const contentSignals =`, not `={`).
    expect(src.default).toMatch(/contentSignals=\{contentSignals\}/);
    // Belt-and-suspenders: the same prop must appear inside a
    // <MobileTabView ...> JSX tag, not in some unrelated location.
    expect(src.default).toMatch(/<MobileTabView[\s\S]*?contentSignals=\{contentSignals\}[\s\S]*?>/);
  });
});
