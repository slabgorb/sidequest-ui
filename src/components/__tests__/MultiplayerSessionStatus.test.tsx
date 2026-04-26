/**
 * MultiplayerSessionStatus widget — playtest 2026-04-26 GAP coverage.
 *
 * Verifies the chargen-time MP session widget that surfaces (a) a copyable
 * share-link, (b) the player roster with per-player status, and (c) a
 * "Waiting on" line when at least one player hasn't finished chargen.
 *
 * Wiring is exercised by `slug-routing.test.tsx` (the widget is mounted
 * around CharacterCreation when sessionMode === "multiplayer"). This file
 * focuses on the component's own behavior in isolation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  MultiplayerSessionStatus,
  type SessionPlayerStatus,
} from "@/components/MultiplayerSessionStatus";

const SLUG = "2026-04-26-mawdeep-mp-2";

beforeEach(() => {
  // Component reads window.location.origin to build the share URL — happy
  // path in the jsdom test env is `http://localhost`. No mock needed unless
  // a specific origin is asserted.
});

describe("MultiplayerSessionStatus — share link", () => {
  it("renders the shareable URL using the current page origin", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Ralph", status: "ready", isSelf: true },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);
    const input = screen.getByLabelText(/shareable game url/i) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/play/${SLUG}`);
    expect(input).toHaveAttribute("readOnly");
  });

  it("provides a Copy button labeled for screen readers", () => {
    render(
      <MultiplayerSessionStatus
        slug={SLUG}
        players={[{ id: "Ralph", status: "ready", isSelf: true }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /copy shareable url/i }),
    ).toBeInTheDocument();
  });
});

describe("MultiplayerSessionStatus — roster", () => {
  it("lists every player with status and marks the local player as (you)", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Ralph", status: "ready", isSelf: true },
      { id: "Potsie", status: "in-chargen", isSelf: false },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);

    const ralphRow = screen.getByTestId("mp-roster-Ralph");
    expect(within(ralphRow).getByText(/\(you\)/i)).toBeInTheDocument();
    expect(within(ralphRow).getByText(/^ready$/i)).toBeInTheDocument();
    expect(ralphRow).toHaveAttribute("data-status", "ready");

    const potsieRow = screen.getByTestId("mp-roster-Potsie");
    expect(within(potsieRow).queryByText(/\(you\)/i)).toBeNull();
    expect(within(potsieRow).getByText(/^creating character$/i)).toBeInTheDocument();
    expect(potsieRow).toHaveAttribute("data-status", "in-chargen");
  });

  it("places the local player first in the roster regardless of id order", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Aaron", status: "in-chargen", isSelf: false },
      { id: "Zelda", status: "ready", isSelf: true },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAttribute("data-testid", "mp-roster-Zelda");
    expect(rows[1]).toHaveAttribute("data-testid", "mp-roster-Aaron");
  });
});

describe("MultiplayerSessionStatus — waiting-on line", () => {
  it("shows a 'Waiting on' line when at least one player is in-chargen", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Ralph", status: "ready", isSelf: true },
      { id: "Potsie", status: "in-chargen", isSelf: false },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);
    const waiting = screen.getByTestId("mp-waiting-on");
    expect(waiting).toHaveTextContent(/waiting on:/i);
    expect(waiting).toHaveTextContent("Potsie");
    expect(waiting).not.toHaveTextContent(/Ralph/);
  });

  it("annotates 'you' on the waiting-on line when self is mid-chargen", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Ralph", status: "in-chargen", isSelf: true },
      { id: "Potsie", status: "ready", isSelf: false },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);
    const waiting = screen.getByTestId("mp-waiting-on");
    expect(waiting).toHaveTextContent(/Ralph \(you\)/);
  });

  it("hides the 'Waiting on' line when everyone is ready", () => {
    const players: SessionPlayerStatus[] = [
      { id: "Ralph", status: "ready", isSelf: true },
      { id: "Potsie", status: "ready", isSelf: false },
    ];
    render(<MultiplayerSessionStatus slug={SLUG} players={players} />);
    expect(screen.queryByTestId("mp-waiting-on")).toBeNull();
  });
});
