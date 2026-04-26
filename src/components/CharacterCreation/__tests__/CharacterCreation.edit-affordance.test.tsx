import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterCreation } from "../CharacterCreation";

/**
 * Playtest 2026-04-26 sq-playtest-pingpong section
 * `[UX] Edit affordances on the chargen sheet are too pale to discover`.
 *
 * The original "Edit" link was a bare text-only `<button>` rendered in
 * `text-muted-foreground` — too pale to read against a dark background, no
 * visual icon, no per-row hover state. ux-observer flagged it as a
 * discoverability hit (low priority, but real for first-timers and touch
 * users).
 *
 * Fix: add a `lucide-react` `Pencil` icon next to the "Edit" label, plus a
 * row-level hover state that brightens the entire row's background and the
 * Edit button's border. Accessibility-preserving: the icon is `aria-hidden`
 * and the button still carries `aria-label="Edit <Field>"`.
 *
 * These tests pin the visual upgrade so a future refactor cannot quietly
 * regress it back to the bare-text pale link.
 */
describe("CharacterCreation confirmation preview — edit affordance discoverability", () => {
  const renderConfirmation = () =>
    render(
      <CharacterCreation
        scene={{
          phase: "confirmation",
          scene_index: 3,
          total_scenes: 4,
          input_type: "confirm",
          message: "Confirm your character?",
          character_preview: {
            Name: "Rux",
            Race: "Beastkin",
            Class: "Delver",
          },
        }}
        loading={false}
        onRespond={() => {}}
      />,
    );

  it("renders a pencil icon inside each Edit button", () => {
    renderConfirmation();
    // One pencil per row; testid mirrors the row testid pattern.
    expect(screen.getByTestId("review-edit-icon-Name")).toBeInTheDocument();
    expect(screen.getByTestId("review-edit-icon-Race")).toBeInTheDocument();
    expect(screen.getByTestId("review-edit-icon-Class")).toBeInTheDocument();
  });

  it("preserves the accessible name on each Edit button", () => {
    renderConfirmation();
    // `getByRole("button", { name })` does the accessibility-tree lookup;
    // this would fail if the icon swallowed the accessible name (e.g. by
    // not being aria-hidden) or if the visible "Edit" text were dropped.
    expect(
      screen.getByRole("button", { name: "Edit Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Race" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Class" }),
    ).toBeInTheDocument();
  });

  it("keeps the visible 'Edit' text alongside the icon (not icon-only)", () => {
    renderConfirmation();
    // Belt-and-suspenders: the button text content should still contain
    // "Edit" — the icon is reinforcement, not replacement. Helps Sebastien
    // (mechanics-first) scan the column quickly without parsing icons.
    const button = screen.getByTestId("review-edit-Name");
    expect(button.textContent).toMatch(/Edit/);
  });

  it("marks the icon aria-hidden so the button's accessible name is unambiguous", () => {
    renderConfirmation();
    const icon = screen.getByTestId("review-edit-icon-Name");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies a row-level hover state class so the affordance brightens on row hover", () => {
    renderConfirmation();
    // Tailwind class assertion — JSDOM doesn't simulate :hover paint, so
    // we verify the structural class that drives the effect. The
    // `group/edit-row` named-group plus `hover:bg-muted/30` on the row
    // wrapper, and `group-hover/edit-row:*` on the button, are what give
    // first-timers a "this is interactive" cue without requiring a click.
    const row = screen.getByTestId("review-section-Name");
    expect(row.className).toMatch(/group\/edit-row/);
    expect(row.className).toMatch(/hover:bg-muted/);
    const button = screen.getByTestId("review-edit-Name");
    expect(button.className).toMatch(/group-hover\/edit-row:/);
  });
});

/**
 * Wiring test (CLAUDE.md "Every Test Suite Needs a Wiring Test"):
 * the upgraded affordance is meaningless if `CharacterCreation` isn't
 * actually mounted by the production session router. We verify the
 * component-level upgrade is reachable from `App.tsx`'s real render path
 * by inspecting the production source for both the import and the JSX
 * mount inside the `creation` phase branch.
 *
 * This is deliberately a static-source check rather than a full App
 * mount: the App-mount path requires a WebSocket harness, slug routing
 * setup, and identity confirmation — all of which already have dedicated
 * wiring tests (`mp-03-event-sync-wiring`, `slug-routing`, etc.). What
 * this test catches is a future PR that deletes the `<CharacterCreation>`
 * mount or renames the component without updating App.tsx, leaving the
 * upgraded affordance present in the file but unreachable in production.
 */
describe("CharacterCreation edit affordance — wiring", () => {
  it("is mounted by App.tsx during the chargen session phase", () => {
    // process.cwd() in vitest is the package root (sidequest-ui).
    const appSource = readFileSync(resolve("src/App.tsx"), "utf8");
    // Production import wiring.
    expect(appSource).toMatch(
      /from\s+["']@\/components\/CharacterCreation\/CharacterCreation["']/,
    );
    // Production JSX wiring inside the creation phase branch.
    expect(appSource).toMatch(/sessionPhase\s*===\s*["']creation["']/);
    expect(appSource).toMatch(/<CharacterCreation\b/);
  });
});
