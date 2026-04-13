/**
 * replayThrowParams — Deterministic wire→scene ThrowParams conversion.
 *
 * Converts wire-format throw params (from DiceResultPayload) into scene-format
 * ThrowParams for Rapier physics replay. The seed drives initial die rotation
 * so all clients start with identical orientation.
 *
 * Determinism contract: same (wireParams, seed) → same output, always.
 */

import type { ThrowParams } from "./DiceScene";
import type { DiceThrowParams } from "@/types/payloads";
import { D20_RADIUS } from "./d20";

/**
 * Deterministic seeded PRNG (mulberry32).
 * Takes a 32-bit seed and returns a function that produces [0, 1) floats.
 * Pure, no external state, identical output across all JS runtimes.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a 32-bit integer seed from a possibly large JS number.
 * Handles seeds up to Number.MAX_SAFE_INTEGER by mixing high and low bits.
 */
function deriveSeed32(seed: number): number {
  // Mix high and low 32-bit halves for large seeds
  const lo = seed & 0xffffffff;
  const hi = (seed / 0x100000000) & 0xffffffff;
  return (lo ^ hi) | 0;
}

/**
 * Convert wire-format DiceThrowParams + seed into scene-format ThrowParams.
 *
 * - velocity → linearVelocity (direct passthrough)
 * - angular → angularVelocity (direct passthrough)
 * - position[2] (normalized 0..1) → position[3] (tray space)
 * - seed → rotation[3] (Euler angles in [-PI, PI])
 */
export function replayThrowParams(
  wire: DiceThrowParams,
  seed: number,
): ThrowParams {
  // Seed-driven PRNG for initial rotation
  const rng = mulberry32(deriveSeed32(seed));

  // Convert normalized 2D position to 3D tray space
  // Reverse of DiceOverlay.handleSceneThrow conversion:
  //   wire.position[0] = scene.position[0] + 0.5
  //   wire.position[1] = (scene.position[2] + 0.8) / 1.6
  const x = wire.position[0] - 0.5;
  const z = wire.position[1] * 1.6 - 0.8;
  const y = D20_RADIUS + 0.5; // above tray floor

  // Seed-driven rotation: three Euler angles in [-PI, PI]
  const rotX = (rng() * 2 - 1) * Math.PI;
  const rotY = (rng() * 2 - 1) * Math.PI;
  const rotZ = (rng() * 2 - 1) * Math.PI;

  return {
    position: [x, y, z],
    linearVelocity: [...wire.velocity],
    angularVelocity: [...wire.angular],
    rotation: [rotX, rotY, rotZ],
  };
}
