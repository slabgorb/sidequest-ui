/**
 * Genre-themed background visible through grid gutters.
 * Uses existing CSS custom properties from useGenreTheme/useChromeArchetype.
 */
export function BackgroundCanvas() {
  return (
    <div
      className="fixed inset-0 -z-10"
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
