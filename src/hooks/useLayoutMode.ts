import { useLocalPrefs } from "./useLocalPrefs";

export type LayoutMode = "scroll" | "focus" | "cards";

interface LayoutPrefs {
  mode: LayoutMode;
}

const DEFAULTS: LayoutPrefs = { mode: "scroll" };
const KEY = "sq-narrative-layout";

export function useLayoutMode() {
  const [prefs, setPref] = useLocalPrefs<LayoutPrefs>(KEY, DEFAULTS);

  return {
    mode: prefs.mode,
    setMode: (mode: LayoutMode) => setPref({ mode }),
  };
}
