/**
 * Genre-themed background visible through Dockview panel gutters.
 * Uses existing CSS custom properties from useGenreTheme/useChromeArchetype.
 *
 * Base: radial gradient from --surface to --background (all archetypes).
 * Per-archetype textures layered via [data-archetype] selectors in
 * archetype-chrome.css — no props needed, reads from the CSS cascade.
 */
export function BackgroundCanvas() {
  return (
    <div
      className="background-canvas fixed inset-0 -z-10"
      style={{
        background: `
          radial-gradient(
            ellipse at 50% 50%,
            color-mix(in srgb, var(--surface, hsl(var(--card))) 80%, transparent),
            color-mix(in srgb, var(--surface, hsl(var(--background))) 95%, transparent)
          )
        `,
      }}
      aria-hidden="true"
    />
  );
}
