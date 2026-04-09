export type WidgetId =
  | "narrative"
  | "character"
  | "inventory"
  | "lore"
  | "map"
  | "journal"
  | "knowledge"
  | "settings"
  | "gallery"
  | "confrontation"
  | "audio";

export interface WidgetDef {
  id: WidgetId;
  label: string;
  hotkey?: string;
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  closable: boolean;
  /** Widget auto-appears/disappears based on data availability */
  dataGated: boolean;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDef> = {
  narrative: {
    id: "narrative",
    label: "Narrative",
    minW: 3,
    minH: 3,
    defaultW: 8,
    defaultH: 8,
    closable: false,
    dataGated: false,
  },
  character: {
    id: "character",
    label: "Character",
    hotkey: "c",
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 6,
    closable: true,
    dataGated: true,
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    hotkey: "i",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 4,
    closable: true,
    dataGated: true,
  },
  lore: {
    id: "lore",
    label: "Lore",
    hotkey: "l",
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 5,
    closable: true,
    dataGated: false,
  },
  map: {
    id: "map",
    label: "Map",
    hotkey: "m",
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 5,
    closable: true,
    dataGated: true,
  },
  journal: {
    id: "journal",
    label: "Handouts",
    hotkey: "j",
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 4,
    closable: true,
    dataGated: true,
  },
  knowledge: {
    id: "knowledge",
    label: "Knowledge",
    hotkey: "k",
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    closable: true,
    dataGated: true,
  },
  settings: {
    id: "settings",
    label: "Settings",
    hotkey: "s",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 3,
    closable: true,
    dataGated: false,
  },
  gallery: {
    id: "gallery",
    label: "Gallery",
    hotkey: "g",
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 4,
    closable: true,
    dataGated: false,
  },
  confrontation: {
    id: "confrontation",
    label: "Confrontation",
    minW: 4,
    minH: 2,
    defaultW: 6,
    defaultH: 3,
    closable: false,
    dataGated: true,
  },
  audio: {
    id: "audio",
    label: "Audio",
    minW: 2,
    minH: 1,
    defaultW: 2,
    defaultH: 1,
    closable: true,
    dataGated: false,
  },
};

/** Build a hotkey → WidgetId lookup from the registry */
export function buildHotkeyMap(): Record<string, WidgetId> {
  const map: Record<string, WidgetId> = {};
  for (const def of Object.values(WIDGET_REGISTRY)) {
    if (def.hotkey) {
      map[def.hotkey] = def.id;
    }
  }
  return map;
}
