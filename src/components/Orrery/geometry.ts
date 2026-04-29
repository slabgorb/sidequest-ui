// Pure geometry — AU↔px scaling, Kepler position from true anomaly,
// Lagrange-point position from a parent body, moon position from a parent.
//
// Conventions
// -----------
// Coordinates are SVG (origin top-left, y-down). The star sits at HUB_PX.
// Math uses standard CCW-positive angles; we negate the y component when
// emitting screen-space so a body at math-angle θ appears at screen-angle
// −θ (i.e. up = −y).
//
// All angles in DEGREES at the public boundary; converted to radians inside.

import type { OrreryBody } from "./types";

/** Center of the orrery in viewBox coordinates. */
export const HUB_PX = { x: 600, y: 600 } as const;

/**
 * Heliocentric AU → pixels. Logarithmically compressed so the inner system
 * is readable AND the outer system fits inside the 1200×1200 viewBox.
 *
 * Anchored: 1.0 AU → 240 px, 15.0 AU → 720 px. Matches the visual scale of
 * the design exemplar to within a few px across the system.
 */
export function auToPx(au: number): number {
  if (au <= 0) return 0;
  const ln15 = Math.log(15);
  return 240 + (Math.log(au) / ln15) * 480;
}

/**
 * Moon orbit semi-major axis (km → px). Compresses the per-system moon
 * brackets independently of the heliocentric scale; chosen to give Red
 * Prospect's 6-moon system room without bleeding into adjacent planets'
 * rings.
 */
export function moonKmToPx(km: number, kind: "planet" | "gas_giant"): number {
  // Both anchors picked from the design: tethys at ~580_000 km drawn at r≈22 px;
  // the_horn at ~4_050_000 km drawn at r≈140 px (mean, eccentric). Linear in km
  // works fine here — moon orbits don't span enough decades to need log scaling.
  const scale = kind === "gas_giant" ? 35e-6 : 38e-6;
  return km * scale;
}

/**
 * Kepler position of a moon relative to its parent body, computed from the
 * moon's eccentric orbit (a, e, ν, ω). Returns offset in pixels (y-down).
 * `omega_deg` defaults to 0 — moons in our data don't carry per-moon
 * argument-of-periapsis, but the wide spectrum of true-anomaly choices
 * already breaks visual symmetry.
 */
export function moonKeplerOffset(
  a_km: number,
  e: number,
  kind: "planet" | "gas_giant",
  nu_deg: number,
  omega_deg = 0,
): { x: number; y: number; r: number } {
  const a_px = moonKmToPx(a_km, kind);
  const omega = omega_deg * DEG;
  const nu = nu_deg * DEG;
  const r = (a_px * (1 - e * e)) / (1 + e * Math.cos(nu));
  const angle = omega + nu;
  return { x: r * Math.cos(angle), y: -r * Math.sin(angle), r };
}

const DEG = Math.PI / 180;

/** Convert math-angle (CCW from +x, +y up) to SVG screen angle (CW from +x, +y down). */
export function mathToScreenDeg(deg: number): number {
  return -deg;
}

/**
 * Kepler position relative to the star (focus). Returns SVG coords (y-down).
 *
 * @param a_px      semi-major axis in pixels
 * @param e         eccentricity (0–1)
 * @param omega_deg argument of periapsis (math-angle of perihelion direction)
 * @param nu_deg    true anomaly (math-angle from perihelion)
 */
export function keplerPosition(
  a_px: number,
  e: number,
  omega_deg: number,
  nu_deg: number,
): { x: number; y: number } {
  const omega = omega_deg * DEG;
  const nu = nu_deg * DEG;
  const r = (a_px * (1 - e * e)) / (1 + e * Math.cos(nu));
  const angle = omega + nu;
  return {
    x: HUB_PX.x + r * Math.cos(angle),
    y: HUB_PX.y - r * Math.sin(angle),
  };
}

/**
 * Center of the SVG ellipse representing this orbit, in pre-rotation
 * pixel coordinates. The ellipse is then rotated by mathToScreenDeg(ω)
 * around the hub so the perihelion ends up at math-angle ω.
 *
 * Convention: in the un-rotated frame the focus (hub) sits at the +c side
 * of the ellipse and perihelion at +a (the right vertex). To put the focus
 * at the hub in pre-rotation pixel coords, the geometric center sits at
 * `hub - (c, 0)` = `(hub.x − a*e, hub.y)`.
 *
 * Verification: with cx = hub.x − a*e:
 *   focus      = center + (c, 0) = (hub.x, hub.y)        ✓
 *   perihelion = center + (a, 0) = (hub.x + a(1−e), hub.y)
 *     distance from focus = a(1−e)                       ✓
 *   apoapsis   = center − (a, 0) = (hub.x − a(1+e), hub.y)
 *     distance from focus = a(1+e)                       ✓
 *
 * After rotating the ellipse by mathToScreenDeg(ω) (= −ω in SVG-CW),
 * perihelion lands at math-angle ω from the hub, which matches the
 * Kepler position emitted by `keplerPosition` at ν = 0.
 */
export function ellipseCenter(
  a_px: number,
  e: number,
): { cx: number; cy: number } {
  return { cx: HUB_PX.x - a_px * e, cy: HUB_PX.y };
}

export function ellipseSemiMinor(a_px: number, e: number): number {
  return a_px * Math.sqrt(1 - e * e);
}

/**
 * Lagrange position relative to a SECONDARY body's heliocentric orbit.
 * L4 = secondary's true anomaly + 60°
 * L5 = secondary's true anomaly − 60°
 * L3 = secondary's true anomaly + 180°
 * L1/L2 are intentionally not handled here — they share the secondary's
 * angular position and differ only in radius (small offset toward/away
 * from the primary). For the static orrery they coincide visually.
 */
export function lagrangeAngleDeg(
  secondaryNuDeg: number,
  point: "L1" | "L2" | "L3" | "L4" | "L5",
): number {
  switch (point) {
    case "L4":
      return secondaryNuDeg + 60;
    case "L5":
      return secondaryNuDeg - 60;
    case "L3":
      return secondaryNuDeg + 180;
    case "L1":
    case "L2":
      return secondaryNuDeg;
  }
}

/** Heliocentric pixel position of a body, given the world's bodies list and a moment. */
export function bodyHelioPosition(
  body: OrreryBody,
  bodies: OrreryBody[],
  trueAnomalyByBody: Record<string, number>,
): { x: number; y: number } | null {
  if (body.kind === "lagrange") {
    if (!body.lagrange_pair || !body.lagrange_point) return null;
    const secondaryId = body.lagrange_pair[1];
    const secondary = bodies.find((b) => b.id === secondaryId);
    if (!secondary || secondary.semi_major_axis_au === undefined) return null;
    const secondaryNu = trueAnomalyByBody[secondary.id] ?? 0;
    const lagrangeNu = lagrangeAngleDeg(secondaryNu, body.lagrange_point);
    const a_px = auToPx(secondary.semi_major_axis_au);
    return keplerPosition(
      a_px,
      secondary.eccentricity ?? 0,
      secondary.perihelion_deg ?? 0,
      lagrangeNu,
    );
  }
  if (body.semi_major_axis_au === undefined) return null;
  const nu = trueAnomalyByBody[body.id] ?? 0;
  return keplerPosition(
    auToPx(body.semi_major_axis_au),
    body.eccentricity ?? 0,
    body.perihelion_deg ?? 0,
    nu,
  );
}

