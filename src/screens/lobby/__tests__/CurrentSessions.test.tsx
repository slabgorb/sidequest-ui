import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CurrentSessions } from "@/screens/lobby/CurrentSessions";
import type { ActiveSession } from "@/screens/lobby/useSessions";

const TWO_PLAYER_SESSION: ActiveSession = {
  session_key: "spaghetti_western:dust_and_lead",
  session_id: "DEADBEEF-0001",
  genre: "spaghetti_western",
  world: "dust_and_lead",
  players: [
    { player_id: "p1", display_name: "Keith" },
    { player_id: "p2", display_name: "Marcus" },
  ],
  current_turn: 47,
  current_location: "Sangre Crossing",
  turn_mode: "free_play",
};

describe("CurrentSessions", () => {
  it("renders nothing when the session list is empty", () => {
    const { container } = render(<CurrentSessions sessions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders player display names joined by middots", () => {
    render(<CurrentSessions sessions={[TWO_PLAYER_SESSION]} />);
    // Names rendered together in a single span.
    expect(screen.getByText(/Keith · Marcus/)).toBeInTheDocument();
  });

  it("renders the current turn number", () => {
    render(<CurrentSessions sessions={[TWO_PLAYER_SESSION]} />);
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("renders the current location when present", () => {
    render(<CurrentSessions sessions={[TWO_PLAYER_SESSION]} />);
    expect(screen.getByText(/Sangre Crossing/)).toBeInTheDocument();
  });

  it("hides the free_play mode label (saying it tells the player nothing)", () => {
    render(<CurrentSessions sessions={[TWO_PLAYER_SESSION]} />);
    expect(screen.queryByText(/free play/i)).toBeNull();
  });

  it("shows 'sealed turn' for structured mode", () => {
    const session = { ...TWO_PLAYER_SESSION, turn_mode: "structured" };
    render(<CurrentSessions sessions={[session]} />);
    expect(screen.getByText(/sealed turn/i)).toBeInTheDocument();
  });

  it("shows 'cutscene' for cinematic mode", () => {
    const session = { ...TWO_PLAYER_SESSION, turn_mode: "cinematic" };
    render(<CurrentSessions sessions={[session]} />);
    expect(screen.getByText(/cutscene/i)).toBeInTheDocument();
  });

  it("renders one row per active session", () => {
    const second: ActiveSession = {
      ...TWO_PLAYER_SESSION,
      session_id: "DEADBEEF-0002",
      session_key: "spaghetti_western:dust_and_lead",
      players: [{ player_id: "p3", display_name: "Sam" }],
      current_turn: 1,
    };
    render(<CurrentSessions sessions={[TWO_PLAYER_SESSION, second]} />);
    expect(screen.getByText(/Keith · Marcus/)).toBeInTheDocument();
    expect(screen.getByText(/^Sam$/)).toBeInTheDocument();
  });
});
