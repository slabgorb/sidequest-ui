/**
 * DiceSpikePage — Standalone test page for the dice spike.
 *
 * Access via: http://localhost:5173/dice-spike
 * This page loads the DiceOverlay directly for testing.
 * Not wired into the game UI — isolated spike validation.
 */

import { Suspense, lazy } from "react";

const DiceOverlay = lazy(() => import("./DiceOverlay"));

export default function DiceSpikePage() {
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
      <DiceOverlay />
    </Suspense>
  );
}
