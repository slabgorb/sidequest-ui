import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WatcherEvent } from "@/types/watcher";

// ══════════════════════════════════════════════════════════════════════════════
// Playtest 2026-04-23 regression — GM dashboard deaf despite live server.
//
// Bug: the server emitted ~160 spans/turn but the dashboard's Timeline /
// Subsystems / Lore tabs stayed empty. Root cause was server-side (hub
// singleton replaced on every uvicorn --reload), but the UI had no test
// proving the dashboard parses the canonical `turn_complete` payload shape
// and surfaces it as an incremented Turns counter.
//
// This is the wiring test: synthesize the exact shape the server sends,
// feed it through useWatcherSocket, assert the header updates.
// ══════════════════════════════════════════════════════════════════════════════

// Stub the socket hook so we can drive events synchronously without a real WS.
const onEventCapture: { fn: ((e: WatcherEvent) => void) | null } = {
  fn: null,
};

vi.mock("@/hooks/useWatcherSocket", () => ({
  useWatcherSocket: ({
    onEvent,
  }: {
    onEvent: (e: WatcherEvent) => void;
  }) => {
    onEventCapture.fn = onEvent;
    return { connected: true };
  },
}));

// The dashboard also fetches /api/debug/state on mount; stub it to no-op.
beforeEach(() => {
  vi.spyOn(global, "fetch").mockImplementation(async () =>
    new Response("[]", { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  onEventCapture.fn = null;
});

// Defer import until mocks are installed.
async function loadDashboard() {
  const mod = await import("../DashboardApp");
  return mod.DashboardApp;
}

describe("DashboardApp event parsing (playtest 2026-04-23)", () => {
  it("increments Turns counter when a turn_complete event arrives", async () => {
    const DashboardApp = await loadDashboard();
    render(<DashboardApp />);

    // Header starts at Turns: 0
    expect(screen.getByText(/Turns:/i).textContent).toMatch(/Turns:\s*0/);

    const event: WatcherEvent = {
      timestamp: "2026-04-23T17:00:00.000Z",
      component: "orchestrator",
      event_type: "turn_complete",
      severity: "info",
      fields: {
        turn_id: 1,
        turn_number: 1,
        agent_name: "narrator",
        agent_duration_ms: 20192,
        player_id: "116f74b2",
        genre: "mutant_wasteland",
        world: "flickering_reach",
      },
    };

    expect(onEventCapture.fn).not.toBeNull();
    act(() => {
      onEventCapture.fn!(event);
    });

    expect(screen.getByText(/Turns:/i).textContent).toMatch(/Turns:\s*1/);
  });

  it("routes agent_span_close events through the reducer without incrementing Turns", async () => {
    const DashboardApp = await loadDashboard();
    render(<DashboardApp />);

    const spanClose: WatcherEvent = {
      timestamp: "2026-04-23T17:00:01.000Z",
      component: "sidequest-server",
      event_type: "agent_span_close",
      severity: "info",
      fields: {
        name: "turn.agent_llm.inference",
        duration_ms: 15000,
      },
    };

    // Switch to Console tab (index 4) first so the Console renders the
    // event on arrival. Tabs are clickable <div>s, not <button>s — use
    // the label text.
    act(() => {
      screen.getByText(/Console/i).click();
    });

    act(() => {
      onEventCapture.fn!(spanClose);
    });

    // agent_span_close does NOT increment turns — that's turn_complete only.
    expect(screen.getByText(/Turns:/i).textContent).toMatch(/Turns:\s*0/);
    // But it DOES land in allEvents → the Console tab surfaces it.
    expect(
      screen.getByText(/turn\.agent_llm\.inference/),
    ).toBeInTheDocument();
  });
});
