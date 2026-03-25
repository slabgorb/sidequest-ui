import { useEffect, useRef } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";

const STYLE_TAG_ID = "genre-theme-css";

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
      "--card": computed.getPropertyValue("--surface").trim(),
      "--popover": computed.getPropertyValue("--surface").trim(),
      "--muted-foreground": computed.getPropertyValue("--text").trim(),
    };
    for (const [twVar, genreVal] of Object.entries(bridge)) {
      if (genreVal) {
        root.style.setProperty(twVar, genreVal);
      }
    }

    // If genre sets a light background, remove dark class so Tailwind
    // dark: variants don't fight the genre theme
    const bg = computed.getPropertyValue("--background").trim();
    if (bg) {
      root.classList.remove("dark");
    }
  }, [messages]);
}
