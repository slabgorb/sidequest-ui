import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MultiplayerTurnBanner } from "../MultiplayerTurnBanner";

describe("MultiplayerTurnBanner", () => {
  it("renders nothing in single-player", () => {
    const { container } = render(
      <MultiplayerTurnBanner
        isMultiplayer={false}
        wsConnected={true}
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'you have the floor' when local is the active player", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        activePlayerId="p1"
        activePlayerName="Laverne"
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const banner = screen.getByTestId("multiplayer-turn-banner");
    expect(banner).toHaveAttribute("data-tone", "you");
    expect(banner).toHaveTextContent(/you have the floor/i);
  });

  it("shows peer's turn when activePlayer is not local", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        activePlayerId="p2"
        activePlayerName="Shirley"
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const banner = screen.getByTestId("multiplayer-turn-banner");
    expect(banner).toHaveAttribute("data-tone", "peer");
    expect(banner).toHaveTextContent(/it's shirley's turn/i);
  });

  it("shows 'waiting for the narrator' when thinking + local not active", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        thinking={true}
        activePlayerId="p2"
        activePlayerName="Shirley"
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const banner = screen.getByTestId("multiplayer-turn-banner");
    expect(banner).toHaveAttribute("data-tone", "thinking");
    expect(banner).toHaveTextContent(/waiting for the narrator/i);
  });

  it("shows 'waiting for the narrator' when actor is thinking AND active (ADR-036)", () => {
    // Playtest 2026-04-25 regression guard: once the server emits
    // TURN_STATUS{status="active"} on PLAYER_ACTION receipt, the actor's
    // tab receives it too — so localIsActive=true alongside thinking=true.
    // Banner must still show tone="thinking" (the actor knows they
    // submitted; "Waiting for the narrator…" is the correct cue), not
    // "you have the floor" (which would lie about the wait).
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        thinking={true}
        activePlayerId="p1"
        activePlayerName="Laverne"
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const banner = screen.getByTestId("multiplayer-turn-banner");
    expect(banner).toHaveAttribute("data-tone", "thinking");
    expect(banner).toHaveTextContent(/waiting for the narrator/i);
  });

  it("renders a heartbeat dot in green when connected", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const dot = screen.getByTestId("ws-heartbeat-dot");
    expect(dot.className).toMatch(/bg-emerald-500/);
    expect(dot.className).toMatch(/animate-pulse/);
  });

  it("falls back to 'You have the floor' when no local character name", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        localPlayerId="p1"
      />,
    );
    expect(screen.getByText(/you have the floor/i)).toBeInTheDocument();
  });

  it("uses role='status' + aria-live='polite' for screen reader announcements", () => {
    render(
      <MultiplayerTurnBanner
        isMultiplayer={true}
        wsConnected={true}
        activePlayerName="Shirley"
        activePlayerId="p2"
        localPlayerId="p1"
        localCharacterName="Laverne"
      />,
    );
    const banner = screen.getByTestId("multiplayer-turn-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
