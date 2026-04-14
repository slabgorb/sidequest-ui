/**
 * DiceSpikePage — Standalone harness for DiceOverlay diagnosis.
 *
 * Access via: http://localhost:5173/?dice-spike
 *
 * Story 34-12: reproducing "dice flashes then disappears" without needing
 * a full game session in confrontation mode. Mounts the real lazy-loaded
 * DiceOverlay with mock props and exposes buttons to drive each state
 * transition independently, so we can bisect which transition breaks.
 *
 * Transitions to test:
 *   1. idle → request        (PickupDie mounts, should be visible+draggable)
 *   2. request → local throw (user drags, PhysicsDie takes over with local params)
 *   3. request → server replay (server DiceResult arrives, Physics remounts with seed params)
 */

import { Suspense, lazy, useCallback, useState } from "react";
import type {
  DiceRequestPayload,
  DiceResultPayload,
  DiceThrowParams,
} from "@/types/payloads";

const DiceOverlay = lazy(() => import("./DiceOverlay"));

const MOCK_PLAYER_ID = "spike-player";
const OTHER_PLAYER_ID = "spike-other-player";

function makeRequest(rollingPlayerId: string): DiceRequestPayload {
  return {
    request_id: `spike-${Date.now()}`,
    rolling_player_id: rollingPlayerId,
    character_name: "Spike",
    dice: [{ sides: 20, count: 1 }],
    modifier: 1,
    stat: "influence",
    difficulty: 14,
    context: "dice-spike harness",
  };
}

function makeResult(request: DiceRequestPayload, face: number): DiceResultPayload {
  const total = face + request.modifier;
  return {
    request_id: request.request_id,
    rolling_player_id: request.rolling_player_id,
    character_name: request.character_name,
    rolls: [{ spec: { sides: 20, count: 1 }, faces: [face] }],
    modifier: request.modifier,
    total,
    difficulty: request.difficulty,
    outcome:
      face === 20
        ? "CritSuccess"
        : face === 1
          ? "CritFail"
          : total >= request.difficulty
            ? "Success"
            : "Fail",
    // Harness-only — real seeds come from the server. Plain safe-integer literal.
    seed: 42,
    throw_params: {
      velocity: [-0.6, 0.3, -0.5],
      angular: [1.5, 2.0, 0.8],
      position: [0.5, 0.5],
    },
  };
}

export default function DiceSpikePage() {
  const [diceRequest, setDiceRequest] = useState<DiceRequestPayload | null>(null);
  const [diceResult, setDiceResult] = useState<DiceResultPayload | null>(null);
  const [thrownLocally, setThrownLocally] = useState(false);

  const onRequest = useCallback(() => {
    console.log("[spike] → request as rolling player (PickupDie)");
    setDiceResult(null);
    setThrownLocally(false);
    setDiceRequest(makeRequest(MOCK_PLAYER_ID));
  }, []);

  const onRequestAsSpectator = useCallback(() => {
    console.log("[spike] → request as spectator (another player rolls)");
    setDiceResult(null);
    setThrownLocally(false);
    setDiceRequest(makeRequest(OTHER_PLAYER_ID));
  }, []);

  const onReplay = useCallback(
    (face: number) => {
      if (!diceRequest) {
        console.warn("[spike] no request — click Request first");
        return;
      }
      console.log(`[spike] → replay (face=${face})`);
      setDiceResult(makeResult(diceRequest, face));
    },
    [diceRequest],
  );

  const isSpectator =
    !!diceRequest && diceRequest.rolling_player_id !== MOCK_PLAYER_ID;

  const onReset = useCallback(() => {
    console.log("[spike] → reset");
    setDiceRequest(null);
    setDiceResult(null);
    setThrownLocally(false);
  }, []);

  // Rolling player's die settled. In production this payload goes on the
  // wire as DICE_THROW with the face; the server echoes a DiceResult back.
  // The harness doesn't talk to a server, so we synthesise the DiceResult
  // locally using the reported face — same shape the server would produce.
  // This exercises the result-panel display path so we can confirm the
  // face round-trips from physics → handleSettle → onThrow → DiceResult.
  const handleThrow = useCallback(
    (params: DiceThrowParams, face: number[]) => {
      console.log(
        `[spike] DiceOverlay.onThrow — face=${JSON.stringify(face)} velocity=${JSON.stringify(params.velocity)}`,
      );
      setThrownLocally(true);
      if (!diceRequest) return;
      const rolled = face[0] ?? 0;
      const total = rolled + diceRequest.modifier;
      setDiceResult({
        request_id: diceRequest.request_id,
        rolling_player_id: diceRequest.rolling_player_id,
        character_name: diceRequest.character_name,
        rolls: [{ spec: { sides: 20, count: 1 }, faces: [rolled] }],
        modifier: diceRequest.modifier,
        total,
        difficulty: diceRequest.difficulty,
        outcome:
          rolled === 20
            ? "CritSuccess"
            : rolled === 1
              ? "CritFail"
              : total >= diceRequest.difficulty
                ? "Success"
                : "Fail",
        // Harness-only — real seeds come from the server. Plain safe-integer literal.
        seed: 42,
        throw_params: params,
      });
    },
    [diceRequest],
  );

  const role = !diceRequest
    ? "idle"
    : diceRequest.rolling_player_id === MOCK_PLAYER_ID
      ? "rolling"
      : "spectator";
  const state = !diceRequest
    ? "idle"
    : diceResult
      ? "replay"
      : thrownLocally
        ? "local-thrown"
        : "request (pickup)";

  return (
    <>
      {/* Control panel — fixed, always on top so it works even when overlay covers screen */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 2000,
          background: "rgba(20,20,25,0.92)",
          color: "#e8e0d0",
          padding: "12px 14px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 220,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13 }}>Dice Spike Harness (34-12)</div>
        <div style={{ color: "#8a7a6a" }}>
          role: {role} &nbsp;·&nbsp; state: {state}
        </div>
        {/* Blur after click so space-bar doesn't re-activate the last button
            and interfere with useDiceThrowGesture's space-to-throw keyboard
            fallback. */}
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          onClick={(e) => (e.target as HTMLElement).blur?.()}
        >
          <button onClick={onRequest}>Request (as rolling player)</button>
          <button onClick={onRequestAsSpectator}>Request (as spectator)</button>
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          onClick={(e) => (e.target as HTMLElement).blur?.()}
        >
          <button onClick={() => onReplay(12)} disabled={!isSpectator}>
            Replay (fail, 12)
          </button>
          <button onClick={() => onReplay(18)} disabled={!isSpectator}>
            Replay (success, 18)
          </button>
          <button onClick={() => onReplay(20)} disabled={!isSpectator}>
            Replay (crit, 20)
          </button>
          <button onClick={onReset}>Reset</button>
        </div>
        <div style={{ color: "#6a5a4a", fontSize: 11, lineHeight: 1.4 }}>
          <b>Rolling player:</b> drag or press space → settles →
          onThrow fires with face → result panel populates<br />
          <b>Spectator:</b> click Replay → seed-driven physics re-animates<br />
          Replay buttons only work in spectator role — rolling player
          already watched their own physics.
        </div>
      </div>

      {/* The real overlay, lazy-loaded the same way App.tsx loads it */}
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
            Loading dice bundle…
          </div>
        }
      >
        <DiceOverlay
          key={diceRequest?.request_id ?? "idle"}
          diceRequest={diceRequest}
          diceResult={diceResult}
          playerId={MOCK_PLAYER_ID}
          onThrow={handleThrow}
        />
      </Suspense>
    </>
  );
}
