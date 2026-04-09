/**
 * Wiring test — verifies the GameBoard composable dashboard is fully connected.
 *
 * Per CLAUDE.md: "Every test suite needs a wiring test that verifies the component
 * is wired into the system — imported, called, and reachable from production code paths."
 */
import { describe, it, expect } from "vitest";

describe("GameBoard wiring", () => {
  it("GameBoard is importable from @/components/GameBoard/GameBoard", async () => {
    const mod = await import("@/components/GameBoard/GameBoard");
    expect(typeof mod.GameBoard).toBe("function");
  });

  it("ImageBusProvider is importable from @/providers/ImageBusProvider", async () => {
    const mod = await import("@/providers/ImageBusProvider");
    expect(typeof mod.ImageBusProvider).toBe("function");
    expect(typeof mod.useImageBus).toBe("function");
  });

  it("App.tsx imports GameBoard (not GameLayout)", async () => {
    const appSource = await import("@/App?raw");
    const src = typeof appSource === "string" ? appSource : appSource.default;
    expect(src).toContain("GameBoard");
    expect(src).not.toMatch(/import.*GameLayout.*from/);
  });

  it("App.tsx wraps GameBoard in ImageBusProvider", async () => {
    const appSource = await import("@/App?raw");
    const src = typeof appSource === "string" ? appSource : appSource.default;
    expect(src).toContain("ImageBusProvider");
  });

  it("all widget wrappers are importable", async () => {
    const widgets = [
      "@/components/GameBoard/widgets/NarrativeWidget",
      "@/components/GameBoard/widgets/CharacterWidget",
      "@/components/GameBoard/widgets/MapWidget",
      "@/components/GameBoard/widgets/InventoryWidget",
      "@/components/GameBoard/widgets/JournalWidget",
      "@/components/GameBoard/widgets/KnowledgeWidget",
      "@/components/GameBoard/widgets/ImageGalleryWidget",
      "@/components/GameBoard/widgets/ConfrontationWidget",
      "@/components/GameBoard/widgets/AudioWidget",
    ];
    for (const path of widgets) {
      const mod = await import(path);
      const exportNames = Object.keys(mod);
      expect(exportNames.length).toBeGreaterThan(0);
    }
  });

  it("useGameBoardLayout hook is importable", async () => {
    const mod = await import("@/hooks/useGameBoardLayout");
    expect(typeof mod.useGameBoardLayout).toBe("function");
  });

  it("useGameBoardHotkeys hook is importable", async () => {
    const mod = await import("@/hooks/useGameBoardHotkeys");
    expect(typeof mod.useGameBoardHotkeys).toBe("function");
  });

  it("widgetRegistry exports all required widgets", async () => {
    const mod = await import("@/components/GameBoard/widgetRegistry");
    const requiredIds = [
      "narrative", "character", "inventory", "map",
      "journal", "knowledge", "settings", "gallery",
      "confrontation", "audio",
    ];
    for (const id of requiredIds) {
      expect(mod.WIDGET_REGISTRY[id as keyof typeof mod.WIDGET_REGISTRY]).toBeDefined();
    }
  });

  it("presetLayouts exports all preset names", async () => {
    const mod = await import("@/components/GameBoard/presetLayouts");
    expect(mod.PRESET_LAYOUTS.classic).toBeDefined();
    expect(mod.PRESET_LAYOUTS.tactician).toBeDefined();
    expect(mod.PRESET_LAYOUTS.explorer).toBeDefined();
    expect(mod.PRESET_LAYOUTS.minimalist).toBeDefined();
  });

  it("deleted files do not exist (GameLayout, OverlayManager, SettingsOverlay)", async () => {
    const tryImport = async (path: string) => {
      try {
        await import(path);
        return true;
      } catch {
        return false;
      }
    };
    expect(await tryImport("@/components/GameLayout")).toBe(false);
    expect(await tryImport("@/components/OverlayManager")).toBe(false);
    expect(await tryImport("@/components/SettingsOverlay")).toBe(false);
  });
});
