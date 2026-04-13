/**
 * DiceSpikePage — Standalone test page for the dice overlay.
 *
 * Access via: http://localhost:5173/?dice-spike
 * Renders DiceOverlay directly with a fixture DiceRequest so the UI can
 * be exercised without a live game session. Not wired into the game UI.
 */

import { Suspense, lazy, useState } from "react";
import type { DiceRequestPayload, DiceResultPayload, DiceThrowParams } from "@/types/payloads";

const DiceOverlay = lazy(() => import("./DiceOverlay"));

const FIXTURE_REQUEST: DiceRequestPayload = {
  request_id: "spike-fixture",
  rolling_player_id: "spike-player",
  character_name: "Test Character",
  dice: [{ sides: 20, count: 1 }],
  modifier: 3,
  stat: "strength",
  difficulty: 15,
  context: "dice spike — standalone overlay test",
};

export default function DiceSpikePage() {
  const [diceResult] = useState<DiceResultPayload | null>(null);

  const handleThrow = (params: DiceThrowParams) => {
    console.debug("[dice-spike] onThrow", params);
  };

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#111",
            color: "#8a7a6a",
            fontFamily: "serif",
            fontSize: 18,
          }}
        >
          Loading dice...
        </div>
      }
    >
      <DiceOverlay
        diceRequest={FIXTURE_REQUEST}
        diceResult={diceResult}
        playerId="spike-player"
        onThrow={handleThrow}
      />
    </Suspense>
  );
}
