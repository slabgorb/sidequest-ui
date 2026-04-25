import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EncounterTab, EncounterTimeline } from "../components/Dashboard/tabs/EncounterTab";
import type { EncounterEvent } from "../types/payloads";

const sample: EncounterEvent[] = [
  {
    seq: 1,
    kind: "ENCOUNTER_STARTED",
    payload: {
      encounter_type: "combat",
      player_metric_threshold: 10,
      opponent_metric_threshold: 10,
      turn: 1,
    },
    created_at: "2026-04-25T00:00:00Z",
  },
  {
    seq: 2,
    kind: "ENCOUNTER_BEAT_APPLIED",
    payload: {
      actor: "Sam",
      actor_side: "player",
      beat_id: "attack",
      beat_kind: "strike",
      outcome_tier: "Success",
      own_delta: 2,
      opponent_delta: 0,
      turn: 1,
    },
    created_at: "2026-04-25T00:00:01Z",
  },
  {
    seq: 3,
    kind: "ENCOUNTER_METRIC_ADVANCE",
    payload: { side: "player", delta_kind: "own", delta: 2, before: 0, after: 2, turn: 1 },
    created_at: "2026-04-25T00:00:02Z",
  },
  {
    seq: 4,
    kind: "ENCOUNTER_RESOLVED",
    payload: {
      outcome: "opponent_victory",
      final_player_metric: 4,
      final_opponent_metric: 11,
      triggering_side: "opponent",
      turn: 5,
    },
    created_at: "2026-04-25T00:00:10Z",
  },
];

describe("EncounterTimeline", () => {
  it("renders rows for each event kind with side and tier", () => {
    render(<EncounterTimeline events={sample} />);
    expect(screen.getByText(/Sam/)).toBeInTheDocument();
    expect(screen.getByText(/strike/)).toBeInTheDocument();
    expect(screen.getByText(/Success/)).toBeInTheDocument();
    expect(screen.getByText(/opponent_victory/)).toBeInTheDocument();
  });

  it("renders dial-pair view from STARTED through RESOLVED", () => {
    render(<EncounterTimeline events={sample} />);
    expect(screen.getByText(/Player metric:.*0/)).toBeInTheDocument();
    expect(screen.getByText(/Opponent metric:.*0/)).toBeInTheDocument();
  });
});

// Wiring test — confirms EncounterTab is exported and importable (not just
// the pure EncounterTimeline renderer).  Any test that passes proves the
// module can be imported and both named exports are accessible.
describe("EncounterTab wiring", () => {
  it("EncounterTab is exported from the module", () => {
    expect(EncounterTab).toBeDefined();
    expect(typeof EncounterTab).toBe("function");
  });

  it("renders no-session placeholder when slug is null", () => {
    render(<EncounterTab slug={null} />);
    expect(screen.getByText(/No active session/)).toBeInTheDocument();
  });
});
