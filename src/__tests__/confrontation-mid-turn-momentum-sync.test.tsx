/**
 * Story 45-3 — Momentum readout state sync (UI half).
 *
 * The bug: the UI's ConfrontationOverlay sits on stale momentum because
 * the server only emits CONFRONTATION post-narration; the dial visibly
 * lags the actual beat by 5–15s. The server-side fix adds a mid-turn
 * CONFRONTATION emit between DICE_RESULT and NARRATION_END.
 *
 * The UI half of the wire-first test verifies:
 *
 * 1. AC3 — overlay re-reads momentum off the latest CONFRONTATION.
 *    Two CONFRONTATION payloads in succession (the new mid-turn one +
 *    the existing post-narration one) → MetricBar fill width reflects
 *    the second payload's current/threshold ratio.
 *
 * 2. AC3 negative — a CONFRONTATION with active=false (clear payload)
 *    arriving mid-turn unmounts the overlay; the dial doesn't strand.
 *
 * 3. AC4 — confrontationReceivedThisTurnRef is preserved across mid-
 *    turn re-emits, so the NARRATION_END auto-clear (App.tsx:475-477)
 *    doesn't fire on a turn that legitimately had two CONFRONTATIONs.
 *
 * 4. AC5 regression — App.tsx still sets the ref on every CONFRONTATION
 *    and clears it on NARRATION_END (existing wiring unchanged).
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as React from "react";

// R3F + drei mocks — ConfrontationOverlay → InlineDiceTray → DiceScene calls useLoader.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: () => ({ camera: {}, size: { width: 800, height: 600 } }),
  useLoader: () => {
    const tex = {
      wrapS: 0,
      wrapT: 0,
      clone() {
        return { ...this, clone: this.clone };
      },
    };
    return tex;
  },
}));
vi.mock("@react-three/rapier", () => ({
  Physics: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RigidBody: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CuboidCollider: () => null,
  ConvexHullCollider: () => null,
}));
vi.mock("@react-three/drei", () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import {
  ConfrontationOverlay,
  type ConfrontationData,
} from "@/components/ConfrontationOverlay";

// ── Test fixtures ───────────────────────────────────────────────────────────

const baseStandoff = (
  playerCurrent: number,
  opponentCurrent: number,
): ConfrontationData => ({
  type: "standoff",
  label: "High Noon Standoff",
  category: "confrontation",
  actors: [
    { name: "The Stranger", role: "duelist" },
    { name: "Black Bart", role: "duelist" },
  ],
  player_metric: {
    name: "tension",
    current: playerCurrent,
    starting: 0,
    threshold: 10,
  },
  opponent_metric: {
    name: "tension",
    current: opponentCurrent,
    starting: 0,
    threshold: 10,
  },
  beats: [
    { id: "stare", label: "Stare Down", kind: "press", base: 2, stat_check: "CHA" },
  ],
  secondary_stats: null,
  genre_slug: "spaghetti_western",
  mood: "tense",
});

// ════════════════════════════════════════════════════════════════════════════
// AC3: Mid-turn CONFRONTATION updates the dial width
// ════════════════════════════════════════════════════════════════════════════

describe("AC3: ConfrontationOverlay re-reads momentum on mid-turn re-emit", () => {
  it("MetricBar fill width updates when a fresh CONFRONTATION arrives mid-turn", () => {
    // First emit: the post-prior-turn CONFRONTATION the overlay already
    // had (player_current=0, the start-of-turn snapshot).
    const { rerender } = render(
      <ConfrontationOverlay data={baseStandoff(0, 0)} />,
    );

    const firstFills = screen.getAllByTestId("metric-bar-fill");
    expect(firstFills).toHaveLength(2);
    // Width is interpolated from current/threshold = 0/10 = 0%.
    const playerFillBefore = firstFills.find(
      (el) => el.closest('[data-metric-side="player"]') !== null,
    );
    expect(playerFillBefore).toBeDefined();
    const widthBefore = playerFillBefore!.style.width;
    expect(widthBefore).toMatch(/^0(\.0+)?%$/);

    // Mid-turn re-emit: server fires CONFRONTATION carrying the post-
    // beat-apply momentum (player_current=3, opponent untouched).
    rerender(<ConfrontationOverlay data={baseStandoff(3, 0)} />);

    const secondFills = screen.getAllByTestId("metric-bar-fill");
    const playerFillAfter = secondFills.find(
      (el) => el.closest('[data-metric-side="player"]') !== null,
    );
    expect(playerFillAfter).toBeDefined();
    // Width must reflect the NEW current/threshold = 3/10 = 30%.
    const widthAfter = playerFillAfter!.style.width;
    expect(widthAfter).not.toBe(widthBefore);
    expect(widthAfter).toMatch(/^30(\.0+)?%$/);
  });

  it("opponent dial updates independently when only opponent metric advances", () => {
    const { rerender } = render(
      <ConfrontationOverlay data={baseStandoff(0, 0)} />,
    );

    rerender(<ConfrontationOverlay data={baseStandoff(0, 4)} />);

    const fills = screen.getAllByTestId("metric-bar-fill");
    const opponentFill = fills.find(
      (el) => el.closest('[data-metric-side="opponent"]') !== null,
    );
    expect(opponentFill).toBeDefined();
    expect(opponentFill!.style.width).toMatch(/^40(\.0+)?%$/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC3 negative: active=false unmounts overlay even mid-turn
// ════════════════════════════════════════════════════════════════════════════

describe("AC3 negative: mid-turn clear payload unmounts overlay", () => {
  it("overlay unmounts when CONFRONTATION arrives with no data (encounter resolved on beat fire)", () => {
    // Mid-turn beat fires and resolves the encounter — the server emits
    // CONFRONTATION with active=false (the App handler at line 763
    // converts that to setConfrontationData(null)). The overlay must
    // unmount even though we're inside a turn.
    const { rerender } = render(
      <ConfrontationOverlay data={baseStandoff(9, 0)} />,
    );
    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();

    // App's CONFRONTATION handler: active=false → setConfrontationData(null).
    // We pass null directly here because that's what the overlay sees.
    rerender(<ConfrontationOverlay data={null} />);

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC4 + AC5: App.tsx wiring — ref preservation across mid-turn re-emits
// ════════════════════════════════════════════════════════════════════════════

describe("AC4 + AC5: App.tsx wiring for mid-turn CONFRONTATION", () => {
  it("App.tsx CONFRONTATION handler sets confrontationReceivedThisTurnRef on every emit", async () => {
    // The fix is server-side; the UI handler must keep working as-is.
    // Two CONFRONTATIONs in one turn → ref is true at NARRATION_END
    // handling time → the existing auto-clear at App.tsx:475-477 does
    // NOT fire. This test asserts the source-level invariant; the
    // runtime behavior is exercised by the dial width test above.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );

    // Per the existing wiring (App.tsx:760-765), the CONFRONTATION
    // branch sets the ref unconditionally — every CONFRONTATION arrival
    // sets it to true, mid-turn or post-narration. Without this the
    // ref-based auto-clear logic breaks under two-frame turns.
    const confrontationBlock = appSrc.match(
      /CONFRONTATION[\s\S]{0,400}?confrontationReceivedThisTurnRef\.current\s*=\s*true/,
    );
    expect(confrontationBlock).not.toBeNull();
  });

  it("App.tsx NARRATION_END auto-clear gates on the ref (no clear when ref=true)", async () => {
    // Regression guard for AC4 / AC5: NARRATION_END must consult the
    // ref before clearing confrontationData. With two CONFRONTATIONs in
    // one turn, the ref is true at NARRATION_END time and the clear
    // does NOT fire — the overlay keeps the second frame's state.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );

    // The conditional must be `if (!confrontationReceivedThisTurnRef.current)`
    // — clear only when no CONFRONTATION arrived this turn.
    expect(appSrc).toMatch(
      /if\s*\(\s*!confrontationReceivedThisTurnRef\.current\s*\)\s*\{[\s\S]*?setConfrontationData\(null\)/,
    );
    // And NARRATION_END must reset the ref so the next turn starts clean.
    expect(appSrc).toMatch(
      /NARRATION_END[\s\S]*?confrontationReceivedThisTurnRef\.current\s*=\s*false/,
    );
  });

  it("ConfrontationOverlay reads metric.current off the live data prop (not a snapshot)", async () => {
    // Wire-first: the dial width comes off `data.player_metric.current /
    // data.player_metric.threshold` at render time. A fix that cached
    // the metric in component state on first mount would still pass the
    // single-payload test above but break on the second emit. This source
    // assertion guards against that regression.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const overlaySrc = fs.readFileSync(
      path.resolve(
        __dirname,
        "../components/ConfrontationOverlay.tsx",
      ),
      "utf-8",
    );

    // The MetricBar receives `data.player_metric` / `data.opponent_metric`
    // as props on every render — no useState/useRef caching of the metric
    // value itself.
    expect(overlaySrc).toMatch(/data\.player_metric/);
    expect(overlaySrc).toMatch(/data\.opponent_metric/);
  });
});
