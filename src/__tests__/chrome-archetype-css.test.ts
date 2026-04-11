import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Load the archetype CSS file as a string for content verification.
// jsdom doesn't process external CSS, so we verify selectors and rules
// by parsing the raw CSS text.
// ---------------------------------------------------------------------------

const CSS_PATH = resolve(__dirname, "../styles/archetype-chrome.css");

function loadArchetypeCSS(): string {
  return readFileSync(CSS_PATH, "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: Three CSS archetype rulesets targeting [data-archetype="X"]
// ---------------------------------------------------------------------------

describe("archetype CSS selectors", () => {
  it("contains [data-archetype=\"parchment\"] selector", () => {
    const css = loadArchetypeCSS();
    expect(css).toContain('[data-archetype="parchment"]');
  });

  it("contains [data-archetype=\"terminal\"] selector", () => {
    const css = loadArchetypeCSS();
    expect(css).toContain('[data-archetype="terminal"]');
  });

  it("contains [data-archetype=\"rugged\"] selector", () => {
    const css = loadArchetypeCSS();
    expect(css).toContain('[data-archetype="rugged"]');
  });
});

// ---------------------------------------------------------------------------
// AC2: Texture overlays via ::before pseudo-elements
// ---------------------------------------------------------------------------

describe("archetype texture overlays", () => {
  it("parchment has a radial-gradient vignette overlay", () => {
    const css = loadArchetypeCSS();
    // Parchment uses radial-gradient for aged paper effect
    const parchmentSection = extractArchetypeSection(css, "parchment");
    expect(parchmentSection).toContain("radial-gradient");
    expect(parchmentSection).toMatch(/::before|::after/);
  });

  it("terminal has CRT scanline overlay", () => {
    const css = loadArchetypeCSS();
    const terminalSection = extractArchetypeSection(css, "terminal");
    // CRT scanlines use repeating-linear-gradient
    expect(terminalSection).toContain("repeating-linear-gradient");
    expect(terminalSection).toMatch(/::before|::after/);
  });

  it("rugged has dusty vignette overlay", () => {
    const css = loadArchetypeCSS();
    const ruggedSection = extractArchetypeSection(css, "rugged");
    expect(ruggedSection).toContain("radial-gradient");
    expect(ruggedSection).toMatch(/::before|::after/);
  });
});

// ---------------------------------------------------------------------------
// AC3-5: Archetype-specific structural rules
// ---------------------------------------------------------------------------

describe("parchment archetype rules", () => {
  it("sets soft borders (1px)", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "parchment");
    expect(section).toMatch(/border.*1px/);
  });

  it("uses linear-gradient for panel/header backgrounds", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "parchment");
    expect(section).toContain("linear-gradient");
  });
});

describe("terminal archetype rules", () => {
  it("defines glow CSS custom properties", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "terminal");
    expect(section).toContain("--glow-primary");
    expect(section).toContain("--glow-accent");
  });

  it("uses text-shadow for neon glow effects", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "terminal");
    expect(section).toContain("text-shadow");
  });
});

describe("rugged archetype rules", () => {
  it("sets heavy borders (2px)", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "rugged");
    expect(section).toMatch(/border.*2px/);
  });

  it("uses text-transform uppercase for headers", () => {
    const css = loadArchetypeCSS();
    const section = extractArchetypeSection(css, "rugged");
    expect(section).toContain("text-transform");
    expect(section).toContain("uppercase");
  });
});

// ---------------------------------------------------------------------------
// AC6: CSS lives in a dedicated file (not inline)
// ---------------------------------------------------------------------------

describe("archetype CSS file structure", () => {
  it("file exists at src/styles/archetype-chrome.css", () => {
    // This will throw if the file doesn't exist (loadArchetypeCSS reads it)
    const css = loadArchetypeCSS();
    expect(css.length).toBeGreaterThan(0);
  });

  it("contains all three archetype blocks in a single file", () => {
    const css = loadArchetypeCSS();
    const archetypes = ["parchment", "terminal", "rugged"];
    for (const arch of archetypes) {
      expect(css).toContain(`[data-archetype="${arch}"]`);
    }
  });

  it("does not contain color property definitions (colors come from genre theme)", () => {
    const css = loadArchetypeCSS();
    // Archetype CSS should only set structural properties, not override genre colors.
    // It should reference color vars (var(--primary)), not set them (--primary: #xxx).
    // Exception: archetype-specific extra vars like --glow-primary are OK.
    const lines = css.split("\n");
    const colorOverrides = lines.filter(
      (line) =>
        /^\s*--(?:primary|secondary|accent|background|surface|text|border)\s*:/.test(line),
    );
    expect(colorOverrides).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC7: Wiring — CSS is imported by the app
// ---------------------------------------------------------------------------

describe("archetype CSS wiring", () => {
  it("is imported in main.tsx or index.css", () => {
    // Check that the archetype CSS file is imported somewhere in the app entry
    const mainPath = resolve(__dirname, "../main.tsx");
    const indexCssPath = resolve(__dirname, "../index.css");

    const mainContent = readFileSync(mainPath, "utf-8");
    const indexCssContent = readFileSync(indexCssPath, "utf-8");

    const isImported =
      mainContent.includes("archetype-chrome") ||
      indexCssContent.includes("archetype-chrome");

    expect(isImported).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper: Extract the CSS section for a specific archetype
// ---------------------------------------------------------------------------

/**
 * Extracts all CSS rules that target a specific archetype.
 * Looks for [data-archetype="X"] and grabs everything until the next
 * archetype selector or end of file.
 */
function extractArchetypeSection(css: string, archetype: string): string {
  const selector = `[data-archetype="${archetype}"]`;
  const startIndex = css.indexOf(selector);
  if (startIndex === -1) return "";

  // Find the next archetype selector or end of file
  const archetypes = ["parchment", "terminal", "rugged"];
  const otherArchetypes = archetypes.filter((a) => a !== archetype);

  let endIndex = css.length;
  for (const other of otherArchetypes) {
    const otherSelector = `[data-archetype="${other}"]`;
    const otherIndex = css.indexOf(otherSelector, startIndex + selector.length);
    if (otherIndex !== -1 && otherIndex < endIndex) {
      endIndex = otherIndex;
    }
  }

  return css.slice(startIndex, endIndex);
}
