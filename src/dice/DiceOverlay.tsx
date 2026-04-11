/**
 * DiceOverlay — Lazy-loadable entry point for the 3D dice system.
 *
 * Renders a full-screen fixed overlay with a Three.js Canvas.
 * State (throw params, result) lives here so HTML overlays can
 * sit outside the Canvas (R3F doesn't allow HTML inside <Canvas>).
 *
 * Spike version: always-on for testing. Production version will be
 * controlled by DiceRequest messages from the server.
 */

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { DiceScene, type ThrowParams } from "./DiceScene";

export default function DiceOverlay() {
  const [throwParams, setThrowParams] = useState<ThrowParams | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [rollKey, setRollKey] = useState(0);

  const handleThrow = useCallback((params: ThrowParams) => {
    setResult(null);
    setThrowParams(params);
    setRollKey((k) => k + 1);
  }, []);

  const handleSettle = useCallback((value: number) => {
    setResult(value);
  }, []);

  const handleReset = useCallback(() => {
    setThrowParams(null);
    setResult(null);
  }, []);

  const isCrit = result === 20;
  const isFumble = result === 1;
  const resultColor = isCrit ? "#22c55e" : isFumble ? "#ef4444" : "#e8e0d0";
  const resultLabel =
    result === null
      ? ""
      : isCrit
      ? "Natural 20!"
      : isFumble
      ? "Natural 1!"
      : `${result}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        pointerEvents: "auto",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#8a7a6a",
          fontSize: 14,
          fontFamily: "serif",
          letterSpacing: 1,
          pointerEvents: "none",
        }}
      >
        Grab the die and flick to throw
      </div>
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
          onThrow={handleThrow}
          onSettle={handleSettle}
        />
      </Canvas>
      {result !== null && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            aria-live="polite"
            style={{
              fontSize: isCrit || isFumble ? 48 : 36,
              fontWeight: 700,
              color: resultColor,
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              fontFamily: "serif",
            }}
          >
            {resultLabel}
          </div>
          <button
            onClick={handleReset}
            style={{
              padding: "6px 16px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 6,
              color: "#e8e0d0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Roll again
          </button>
        </div>
      )}
    </div>
  );
}
