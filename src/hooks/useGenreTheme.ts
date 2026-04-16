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

    // Lie-detector: log every theme_css application so we can verify in
    // the browser console that the expected genre theme actually arrived
    // and was applied (vs. silently falling back to the inherited dark
    // mode defaults). See feedback_no_silent_fallbacks.
    console.debug("[useGenreTheme] theme_css received", {
      bytes: css.length,
      preview: css.slice(0, 80),
    });

    let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_TAG_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;

    // Set data-genre attribute for CSS specificity — :root[data-genre] beats .dark
    const root = document.documentElement;
    root.setAttribute("data-genre", "active");

    // Dynamic Google Font loading from genre CSS.
    // Extract font-family from the :root block or @font-face declarations.
    const fontMatch = css.match(/font-family:\s*'([^']+)'/);
    if (fontMatch) {
      const fontName = fontMatch[1];
      const fontId = fontName.replace(/\s+/g, "+");
      const linkId = "genre-google-font";
      let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.id = linkId;
        linkEl.rel = "stylesheet";
        document.head.appendChild(linkEl);
      }
      linkEl.href = `https://fonts.googleapis.com/css2?family=${fontId}:wght@400;700&display=swap`;
      root.style.setProperty("font-family", `'${fontName}', var(--font-sans)`);
    }

    // Parse --background from genre CSS to determine dark/light mode.
    // We parse the CSS string directly rather than using getComputedStyle
    // because the style tag was just injected and we need the genre value,
    // not any inherited/computed value.
    const bgMatch = css.match(/--background\s*:\s*([^;]+);/);
    const bg = bgMatch?.[1].trim();
    if (bg) {
      const lum = getLuminance(bg);
      const isLight = lum > 0.5;
      console.debug("[useGenreTheme] applied", {
        background: bg,
        luminance: lum.toFixed(3),
        mode: isLight ? "light" : "dark",
      });
      if (isLight) {
        root.classList.remove("dark");
      } else {
        root.classList.add("dark");
      }
    } else {
      console.warn(
        "[useGenreTheme] theme_css applied but --background was empty; " +
          "dark/light mode unchanged. Genre CSS likely missing :root vars.",
      );
    }

    return () => {
      root.removeAttribute("data-genre");
    };
  }, [messages]);
}
