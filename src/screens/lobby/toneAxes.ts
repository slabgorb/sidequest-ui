/**
 * Narrative-axis → tone-chip translation.
 *
 * `axis_snapshot` is a `{ axis_name: float }` map from `world.yaml` where
 * values run roughly 0.0–1.0 (midpoint 0.5 is "neutral"). The lobby preview
 * renders the most-polarized axes as tone chips so the player can read the
 * world's flavor fingerprint at a glance.
 *
 * Five canonical axes (ADR-052, narrative axis system):
 *   comedy  — how much tonal humor the world permits
 *   gravity — how grim/weighty the tone runs
 *   outlook — how hopeful/bleak the world feels
 *   mythic  — how grounded/legendary the scale is
 *   loyalty — how trustworthy NPC relationships tend to be
 *
 * Axes with values in the neutral band (0.33–0.67) are skipped — only
 * polarized values produce a chip, because a "half gritty, half comic"
 * tag tells the player nothing useful.
 */

export interface ToneChip {
  /** Short label rendered on the chip (e.g., "mythic", "gritty"). */
  label: string;
  /** Unicode glyph prefix for visual distinction. */
  glyph: string;
}

/** Polarized labels per axis: [low, high]. */
const AXIS_LABELS: Record<string, { low: ToneChip; high: ToneChip }> = {
  comedy: {
    low: { label: "serious", glyph: "☍" },
    high: { label: "comedic", glyph: "☺" },
  },
  gravity: {
    low: { label: "light", glyph: "☼" },
    high: { label: "gritty", glyph: "⚖" },
  },
  outlook: {
    low: { label: "bleak", glyph: "☾" },
    high: { label: "hopeful", glyph: "✦" },
  },
  mythic: {
    low: { label: "grounded", glyph: "⌂" },
    high: { label: "mythic", glyph: "✧" },
  },
  loyalty: {
    low: { label: "treacherous", glyph: "⚔" },
    high: { label: "loyal", glyph: "♦" },
  },
};

/** Below this, an axis reads as "low." */
const LOW_THRESHOLD = 0.33;
/** Above this, an axis reads as "high." */
const HIGH_THRESHOLD = 0.67;

/**
 * Produce an ordered list of tone chips from a world's axis snapshot.
 *
 * Results are sorted by distance-from-neutral (most extreme first), so the
 * chip list reads the world's strongest signals to the player without
 * burying them under softer flavors.
 */
export function getToneChips(
  axis_snapshot: Record<string, number>,
): ToneChip[] {
  const chips: Array<{ chip: ToneChip; distance: number }> = [];

  for (const [axis, value] of Object.entries(axis_snapshot)) {
    const labels = AXIS_LABELS[axis];
    if (!labels) continue;

    if (value <= LOW_THRESHOLD) {
      chips.push({ chip: labels.low, distance: 0.5 - value });
    } else if (value >= HIGH_THRESHOLD) {
      chips.push({ chip: labels.high, distance: value - 0.5 });
    }
    // Neutral band (0.33 < v < 0.67) produces no chip by design.
  }

  chips.sort((a, b) => b.distance - a.distance);
  return chips.map((c) => c.chip);
}
