import { useCallback, useMemo } from "react";
import { useLocalPrefs } from "./useLocalPrefs";
import { WIDGET_REGISTRY, type WidgetId } from "@/components/GameBoard/widgetRegistry";

export interface GameBoardLayoutPrefs {
  hiddenWidgets: WidgetId[];
  version: number;
  [key: string]: unknown;
}

const SCHEMA_VERSION = 2;

function defaultPrefs(): GameBoardLayoutPrefs {
  return {
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
    });
  }, [prefs.hiddenWidgets, setPref]);

  const hideWidget = useCallback((id: WidgetId) => {
    const def = WIDGET_REGISTRY[id];
    if (!def.closable) return;
    setPref({
      hiddenWidgets: [...prefs.hiddenWidgets, id],
    });
  }, [prefs.hiddenWidgets, setPref]);

  const toggleWidget = useCallback((id: WidgetId) => {
    if (visibleWidgets.has(id)) {
      hideWidget(id);
    } else {
      showWidget(id);
    }
  }, [visibleWidgets, showWidget, hideWidget]);

  return {
    visibleWidgets,
    showWidget,
    hideWidget,
    toggleWidget,
  };
}
