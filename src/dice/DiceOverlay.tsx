/**
 * DiceOverlay — Production dice overlay driven by WebSocket protocol messages.
 *
 * Lifecycle: idle → DiceRequest → active (rolling or spectating) → DiceResult → settled → idle
 *
 * The overlay is invisible (not in DOM) when no DiceRequest is active.
 * When active, it renders a full-screen fixed overlay with:
 * - DC, stat, modifier, "you need X" display
 * - Three.js Canvas for 3D dice (rolling player) or spectator view
 * - aria-live region for screen reader announcements
 * - Result display with RollOutcome-driven data attributes
 *
 * Rolling vs spectator is determined by comparing playerId to
 * diceRequest.rolling_player_id.
 */

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { DiceScene, type ThrowParams } from "./DiceScene";
import type { DiceRequestPayload, DiceResultPayload, DiceThrowParams } from "@/types/payloads";

export interface DiceOverlayProps {
  diceRequest: DiceRequestPayload | null;
  diceResult: DiceResultPayload | null;
  playerId: string;
  onThrow: (params: DiceThrowParams) => void;
}

/** Format the modifier for display: "+3" or "-2". */
function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Build the aria-live announcement string per ADR-075. */
function buildAnnouncement(
  request: DiceRequestPayload,
  result: DiceResultPayload,
): string {
  const faces = result.rolls.flatMap((r) => r.faces).join(", ");
  return `${result.character_name} rolled ${result.total} (${faces} ${formatModifier(result.modifier)}) vs DC ${result.difficulty} — ${result.outcome}`;
}

export function DiceOverlay({ diceRequest, diceResult, playerId, onThrow }: DiceOverlayProps) {
  const [throwParams, setThrowParams] = useState<ThrowParams | null>(null);
  const [rollKey, setRollKey] = useState(0);

  const isRollingPlayer = diceRequest !== null && playerId === diceRequest.rolling_player_id;

  const handleSceneThrow = useCallback(
    (params: ThrowParams) => {
      if (!isRollingPlayer || !diceRequest) return;
      setThrowParams(params);
      setRollKey((k) => k + 1);
      // Convert DiceScene ThrowParams → wire DiceThrowParams
      onThrow({
        velocity: params.linearVelocity,
        angular: params.angularVelocity,
        position: [
          params.position[0] + 0.5,
          (params.position[2] + 0.8) / 1.6,
        ],
      });
    },
    [isRollingPlayer, diceRequest, onThrow],
  );

  const handleSettle = useCallback(() => {
    // Settle is now driven by DiceResult from server, not local physics
  }, []);

  if (!diceRequest) return null;

  const needed = diceRequest.difficulty - diceRequest.modifier;

  return (
    <div
      data-testid="dice-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        pointerEvents: isRollingPlayer ? "auto" : "none",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)",
      }}
    >
      {/* Dice tray info — DC, stat, modifier, character, context */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          color: "#e8e0d0",
          fontFamily: "serif",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 14, color: "#8a7a6a", letterSpacing: 1 }}>
          {diceRequest.context}
        </div>
        <div style={{ fontSize: 18 }}>
          <span>{diceRequest.character_name}</span>
          {" — "}
          <span style={{ textTransform: "capitalize" }}>{diceRequest.stat}</span>
          {" "}
          <span>{formatModifier(diceRequest.modifier)}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          DC {diceRequest.difficulty}
        </div>
        <div style={{ fontSize: 14, color: "#8a7a6a" }}>
          You need a {needed}
        </div>
      </div>

      {/* Three.js Canvas — only interactive for rolling player */}
      <Canvas
        shadows
        camera={{
          position: [0, 1.8, 1.2],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true, alpha: false }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <DiceScene
          throwParams={throwParams}
          rollKey={rollKey}
          onThrow={handleSceneThrow}
          onSettle={handleSettle}
        />
      </Canvas>

      {/* Result display — shown when DiceResult arrives */}
      {diceResult && (
        <div
          data-testid="dice-result"
          data-outcome={diceResult.outcome}
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          {/* Individual die faces */}
          <div style={{ display: "flex", gap: 8 }}>
            {diceResult.rolls.flatMap((group, gi) =>
              group.faces.map((face, fi) => (
                <span
                  key={`${gi}-${fi}`}
                  style={{
                    fontSize: 20,
                    color: "#e8e0d0",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontFamily: "serif",
                  }}
                >
                  {face}
                </span>
              )),
            )}
          </div>
          {/* Total */}
          <div
            style={{
              fontSize: diceResult.outcome === "CritSuccess" || diceResult.outcome === "CritFail" ? 48 : 36,
              fontWeight: 700,
              color:
                diceResult.outcome === "CritSuccess"
                  ? "#22c55e"
                  : diceResult.outcome === "CritFail"
                    ? "#ef4444"
                    : diceResult.outcome === "Success"
                      ? "#e8e0d0"
                      : "#9ca3af",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              fontFamily: "serif",
            }}
          >
            {diceResult.total}
          </div>
          {/* Outcome label */}
          <div
            style={{
              fontSize: 16,
              color: "#8a7a6a",
              fontFamily: "serif",
              textTransform: "capitalize",
            }}
          >
            {diceResult.outcome === "CritSuccess"
              ? "Critical Success!"
              : diceResult.outcome === "CritFail"
                ? "Critical Fail!"
                : diceResult.outcome === "Success"
                  ? "Success"
                  : "Fail"}
          </div>
        </div>
      )}

      {/* aria-live region — screen reader announcement (ADR-075) */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        {diceResult && diceRequest ? buildAnnouncement(diceRequest, diceResult) : ""}
      </div>
    </div>
  );
}

export default DiceOverlay;
