/**
 * Wiring test — verifies the running header location chip derives from
 * PARTY_STATUS (per-PC `current_location`) rather than only from
 * CHAPTER_MARKER messages.
 *
 * Per CLAUDE.md "Every Test Suite Needs a Wiring Test": this drives the chip
 * through the actual top-level GameBoard component and asserts the chip text
 * updates when the party-status snapshot moves to a new location, *without*
 * any page refresh or remount. This guards the S2-UX (c) cache-invalidation
 * regression where the chip showed a stale "BRIDGE — OUTER COYOTE STAR"
 * even after the prose moved to Docking Crescent.
 *
 * Same file also asserts the S2-UX (d) banner-cluster dedupe — the redundant
 * `[ Paul's turn ]` chip is no longer rendered when there are no per-player
 * turn entries.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GameBoard, type GameBoardProps } from "../GameBoard";
import { ImageBusProvider } from "@/providers/ImageBusProvider";
import type { CharacterSummary } from "@/types/party";

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  // Force desktop breakpoint so the desktop GameBoard layout (with the
  // running-header div above the dockview workspace) renders. The default
  // test-setup forces mobile, which routes GameBoard through MobileTabView
  // and skips the top header entirely.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("min-width: 1200px"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

function makeChar(player_id: string, current_location: string): CharacterSummary {
  return {
    player_id,
    name: player_id,
    character_name: player_id,
    portrait_url: "",
    hp: 10,
    hp_max: 10,
    status_effects: [],
    class: "Pilot",
    level: 1,
    current_location,
  };
}

function renderBoard(props: Partial<GameBoardProps>) {
  const defaults: GameBoardProps = {
    messages: [],
    characters: [makeChar("p1", "Bridge")],
    onSend: vi.fn(),
    disabled: false,
    currentPlayerId: "p1",
  };
  const merged = { ...defaults, ...props };
  return render(
    <ImageBusProvider messages={merged.messages}>
      <GameBoard {...merged} />
    </ImageBusProvider>,
  );
}

describe("GameBoard running header — S2-UX (c) wiring", () => {
  it("renders the running-header chip with the local player's current_location", () => {
    renderBoard({
      characters: [makeChar("p1", "Docking Crescent")],
      currentPlayerId: "p1",
    });
    const header = screen.getByTestId("running-header");
    expect(header).toHaveTextContent("Docking Crescent");
  });

  it("updates the chip when party state moves to a new location (no remount, no refresh)", () => {
    const { rerender } = renderBoard({
      characters: [makeChar("p1", "Bridge — Outer Coyote Star")],
      currentPlayerId: "p1",
    });
    expect(screen.getByTestId("running-header")).toHaveTextContent(
      "Bridge — Outer Coyote Star",
    );

    // PARTY_STATUS arrives with a new location for the local player. The chip
    // must reflect it on the very next render, with no other state changes.
    rerender(
      <ImageBusProvider messages={[]}>
        <GameBoard
          messages={[]}
          characters={[makeChar("p1", "Docking Crescent")]}
          onSend={vi.fn()}
          disabled={false}
          currentPlayerId="p1"
        />
      </ImageBusProvider>,
    );
    expect(screen.getByTestId("running-header")).toHaveTextContent(
      "Docking Crescent",
    );
    // And the stale value is gone.
    expect(screen.getByTestId("running-header")).not.toHaveTextContent(
      "Bridge — Outer Coyote Star",
    );
  });
});

describe("GameBoard turn indicator — S2-UX (d) banner-cluster dedupe", () => {
  it("does NOT render the redundant `[ Paul's turn ]` chip when there are no per-player turn entries", () => {
    // The bottom turn-indicator strip used to render the plain text
    // "[ Paul's turn ]" / "[ Your turn ]" whenever activePlayerName was set.
    // That signal was already carried by:
    //   - the MultiplayerTurnBanner above the InputBar,
    //   - the CharacterPanel party-section ACTING badge,
    //   - the InputBar placeholder ("Waiting for X…").
    // Four banners saying the same thing was the bug. The strip is now
    // reserved for the structured TurnStatusPanel ("Waiting on:" widget)
    // and only renders when turnStatusEntries are present.
    renderBoard({
      characters: [makeChar("p1", "Bridge"), makeChar("p2", "Bridge")],
      currentPlayerId: "p1",
      activePlayerName: "p2",
      activePlayerId: "p2",
      waitingForPlayer: "p2",
      turnStatusEntries: [],
    });
    expect(screen.queryByTestId("turn-indicator")).not.toBeInTheDocument();
  });

  it("structured TurnStatusPanel still renders when entries are present (chargen path preserved)", () => {
    renderBoard({
      characters: [makeChar("p1", "Bridge"), makeChar("p2", "Bridge")],
      currentPlayerId: "p1",
      activePlayerName: "p2",
      activePlayerId: "p2",
      turnStatusEntries: [
        { player_id: "p1", character_name: "Paul", status: "submitted" },
        { player_id: "p2", character_name: "John", status: "pending" },
      ],
    });
    expect(screen.getByTestId("turn-indicator")).toBeInTheDocument();
  });
});
