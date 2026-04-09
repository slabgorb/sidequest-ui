import { useCallback, useMemo } from "react";
import type { Layout, Layouts } from "react-grid-layout";
import { useLocalPrefs } from "./useLocalPrefs";
import { PRESET_LAYOUTS, type PresetName } from "@/components/GameBoard/presetLayouts";
import { WIDGET_REGISTRY, type WidgetId } from "@/components/GameBoard/widgetRegistry";

export interface GameBoardLayoutPrefs {
  activePreset: PresetName | "custom";
  layouts: Layouts;
  hiddenWidgets: WidgetId[];
  version: number;
}

const SCHEMA_VERSION = 1;

function defaultPrefs(): GameBoardLayoutPrefs {
  return {
    activePreset: "classic",
    layouts: structuredClone(PRESET_LAYOUTS.classic),
    hiddenWidgets: [],
    version: SCHEMA_VERSION,
  };
}

export function useGameBoardLayout(genre?: string, world?: string) {
  const key = `sq-gameboard:${genre ?? "default"}:${world ?? "default"}`;
  const [prefs, setPref] = useLocalPrefs<GameBoardLayoutPrefs>(key, defaultPrefs());

  const visibleWidgets = useMemo(() => {
    const allIds = Object.keys(WIDGET_REGISTRY) as WidgetId[];
    return new Set(allIds.filter(id => !prefs.hiddenWidgets.includes(id)));
  }, [prefs.hiddenWidgets]);

  const showWidget = useCallback((id: WidgetId) => {
    setPref({
      hiddenWidgets: prefs.hiddenWidgets.filter(w => w !== id),
      activePreset: "custom",
    });
  }, [prefs.hiddenWidgets, setPref]);

  const hideWidget = useCallback((id: WidgetId) => {
    const def = WIDGET_REGISTRY[id];
    if (!def.closable) return;
    setPref({
      hiddenWidgets: [...prefs.hiddenWidgets, id],
      activePreset: "custom",
    });
  }, [prefs.hiddenWidgets, setPref]);

  const toggleWidget = useCallback((id: WidgetId) => {
    if (visibleWidgets.has(id)) {
      hideWidget(id);
    } else {
      showWidget(id);
    }
  }, [visibleWidgets, showWidget, hideWidget]);

  const setPreset = useCallback((preset: PresetName) => {
    const layouts = structuredClone(PRESET_LAYOUTS[preset]);
    const lgIds = new Set((layouts.lg as Layout[]).map(item => item.i));
    const allIds = Object.keys(WIDGET_REGISTRY) as WidgetId[];
    const hiddenWidgets = allIds.filter(id => !lgIds.has(id));
    setPref({ activePreset: preset, layouts, hiddenWidgets });
  }, [setPref]);

  const onLayoutChange = useCallback((_current: Layout[], allLayouts: Layouts) => {
    setPref({ layouts: allLayouts, activePreset: "custom" });
  }, [setPref]);

  /** Get visible layout items — filters out hidden widgets.
   *  Widgets that are visible but have no layout entry (e.g., data-gated widgets
   *  that appeared after preset was chosen) get a fallback position appended
   *  below existing content to avoid pile-ups at (0,0).
   */
  const visibleLayouts = useMemo((): Layouts => {
    const result: Layouts = {};
    for (const [bp, items] of Object.entries(prefs.layouts)) {
      const filtered = (items as Layout[]).filter(item => visibleWidgets.has(item.i as WidgetId));
      const existingIds = new Set(filtered.map(item => item.i));

      // Find the bottom edge of existing items to stack new ones below
      let maxY = 0;
      for (const item of filtered) {
        maxY = Math.max(maxY, item.y + item.h);
      }

      // Add fallback positions for visible widgets missing from this breakpoint
      for (const id of visibleWidgets) {
        if (!existingIds.has(id)) {
          filtered.push({ i: id, x: 0, y: maxY, w: 4, h: 3, minW: 2, minH: 2 });
          maxY += 3;
        }
      }

      result[bp] = filtered;
    }
    return result;
  }, [prefs.layouts, visibleWidgets]);

  return {
    prefs,
    visibleWidgets,
    visibleLayouts,
    showWidget,
    hideWidget,
    toggleWidget,
    setPreset,
    onLayoutChange,
  };
}
