/**
 * Map a journey-history entry's `mode` field to a glyph + accessible label.
 *
 * Lives in its own file (rather than co-located with `JourneyHistory.tsx`)
 * so the React Fast Refresh boundary stays component-only — the
 * `react-refresh/only-export-components` lint rule rejects mixing helper
 * exports with component exports.
 *
 * Old entries (pre 2026-04-24) lack the `mode` field — those render as a
 * hollow diamond labeled "unknown mode" rather than defaulting to solo,
 * because silently displaying a solo icon for what might be an MP save
 * would recreate the very misclick risk this fix addresses.
 */
export function modeBadge(mode: "solo" | "multiplayer" | undefined): {
  glyph: string;
  label: string;
} {
  if (mode === "solo") return { glyph: "◈", label: "solo session" };
  if (mode === "multiplayer")
    return { glyph: "⚑", label: "multiplayer session" };
  return { glyph: "◇", label: "unknown mode (legacy entry)" };
}
