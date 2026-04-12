/**
 * Genre-themed background visible through Dockview panel gutters.
 * Uses existing CSS custom properties from useGenreTheme/useChromeArchetype.
 *
 * Base gradient defined in archetype-chrome.css as .background-canvas default.
 * Per-archetype textures override via [data-archetype] selectors — no props
 * needed, reads from the CSS cascade. Inline styles are NOT used because they
 * have higher specificity than stylesheet rules and would block CSS overrides.
 */
export function BackgroundCanvas() {
  return (
    <div
      className="background-canvas fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
