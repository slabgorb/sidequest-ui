import { useEffect, useRef } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";

const STYLE_TAG_ID = "genre-theme-css";

/**
 * Parse a CSS color (hex or rgb()) and return its relative luminance (0–1).
 * Returns 0 (dark) if the color can't be parsed.
 */
function getLuminance(color: string): number {
  let r = 0, g = 0, b = 0;
  const hex = color.replace(/\s/g, "");
  if (hex.startsWith("#")) {
    const h = hex.slice(1);
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length >= 6) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
  } else {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    }
  }
  // sRGB relative luminance per WCAG 2.0
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Listens for SESSION_EVENT "theme_css" messages and injects the genre's
 * CSS into a <style> tag in <head>.
 */
export function useGenreTheme(messages: GameMessage[]): void {
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    const themeMessages = messages.filter(
      (m) => m.type === MessageType.SESSION_EVENT && m.payload.event === "theme_css",
    );

    const last = themeMessages[themeMessages.length - 1];
    if (!last) return;

    const css = last.payload.css as string | undefined;
    if (!css) return;

    // Skip if we already injected this exact CSS
    if (appliedRef.current === css) return;
    appliedRef.current = css;

    let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_TAG_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;

    // Bridge genre CSS variables to Tailwind design tokens.
    // Genre CSS sets --text, --background, --surface, --accent, --primary, --secondary
    // Tailwind reads --foreground, --background, --card, --accent, etc.
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const bridge: Record<string, string> = {
      "--foreground": computed.getPropertyValue("--text").trim(),
      "--card-foreground": computed.getPropertyValue("--text").trim(),
      "--popover-foreground": computed.getPropertyValue("--text").trim(),
      "--background": computed.getPropertyValue("--background").trim(),
      "--card": computed.getPropertyValue("--surface").trim(),
      "--popover": computed.getPropertyValue("--surface").trim(),
      "--muted-foreground": computed.getPropertyValue("--text").trim(),
    };
    for (const [twVar, genreVal] of Object.entries(bridge)) {
      if (genreVal) {
        root.style.setProperty(twVar, genreVal);
      }
    }

    // Check background luminance to decide dark/light mode.
    // Only remove "dark" class if the genre background is actually light.
    const bg = computed.getPropertyValue("--background").trim();
    if (bg) {
      const isLight = getLuminance(bg) > 0.5;
      if (isLight) {
        root.classList.remove("dark");
      } else {
        root.classList.add("dark");
      }
    }
  }, [messages]);
}
