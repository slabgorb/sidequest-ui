import { useEffect, useRef } from "react";

export type ChromeArchetype = "parchment" | "terminal" | "rugged";

const GENRE_TO_ARCHETYPE: Record<string, ChromeArchetype> = {
  low_fantasy: "parchment",
  victoria: "parchment",
  elemental_harmony: "parchment",
  heavy_metal: "parchment",
  neon_dystopia: "terminal",
  space_opera: "terminal",
  road_warrior: "rugged",
  mutant_wasteland: "rugged",
  spaghetti_western: "rugged",
  pulp_noir: "rugged",
  caverns_and_claudes: "rugged",
};

export function getArchetypeForGenre(genre: string): ChromeArchetype {
  const archetype = GENRE_TO_ARCHETYPE[genre];
  if (!archetype) {
    throw new Error(`Unknown genre slug: "${genre}"`);
  }
  return archetype;
}

export const ARCHETYPE_PROPERTIES: Record<
  ChromeArchetype,
  Record<string, string>
> = {
  parchment: {
    "--font-body": "'EB Garamond', Georgia, serif",
    "--font-ui": "'EB Garamond', Georgia, serif",
    "--border-radius": "2px",
  },
  terminal: {
    "--font-body": "'Share Tech Mono', 'Courier New', monospace",
    "--font-ui": "'Orbitron', monospace",
    "--border-radius": "0px",
  },
  rugged: {
    "--font-body": "'Source Sans 3', 'Helvetica Neue', sans-serif",
    "--font-ui": "'Oswald', Impact, sans-serif",
    "--border-radius": "4px",
  },
};

export function useChromeArchetype(genreSlug: string | null): ChromeArchetype | null {
  const prevKeysRef = useRef<string[]>([]);
  const archetype = genreSlug ? getArchetypeForGenre(genreSlug) : null;

  useEffect(() => {
    if (!archetype) return;

    const root = document.documentElement;
    const style = root.style;

    // Clean up previous archetype CSS properties
    for (const key of prevKeysRef.current) {
      style.removeProperty(key);
    }

    // Set data-archetype attribute for CSS selector targeting
    root.setAttribute("data-archetype", archetype);

    // Inject archetype structural CSS properties
    const props = ARCHETYPE_PROPERTIES[archetype];
    const newKeys: string[] = [];
    for (const [key, value] of Object.entries(props)) {
      style.setProperty(key, value);
      newKeys.push(key);
    }

    prevKeysRef.current = newKeys;
  }, [archetype]);

  return archetype;
}
