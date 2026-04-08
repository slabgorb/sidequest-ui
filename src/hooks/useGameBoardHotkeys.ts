import { useEffect } from "react";
import { buildHotkeyMap, type WidgetId } from "@/components/GameBoard/widgetRegistry";

const HOTKEY_MAP = buildHotkeyMap();

function isTextInput(el: HTMLElement): boolean {
  const tag = el.tagName?.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const inputType = ((el as HTMLInputElement).type ?? "").toLowerCase();
    return inputType !== "radio" && inputType !== "checkbox";
  }
  return el.getAttribute?.("contenteditable") != null;
}

export function useGameBoardHotkeys(
  toggleWidget: (id: WidgetId) => void,
  availableWidgets: Set<WidgetId>,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTextInput(e.target as HTMLElement)) return;

      const key = e.key.toLowerCase();
      const widgetId = HOTKEY_MAP[key];

      if (widgetId && availableWidgets.has(widgetId)) {
        e.preventDefault();
        toggleWidget(widgetId);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleWidget, availableWidgets]);
}
