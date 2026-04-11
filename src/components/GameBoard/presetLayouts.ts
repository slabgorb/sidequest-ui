import type { Layout, Layouts } from "react-grid-layout";

export type PresetName = "classic" | "tactician" | "explorer" | "minimalist";

/**
 * Each preset defines layouts for 3 breakpoints:
 *   lg: 12 columns (desktop >=1200px)
 *   md: 8 columns  (tablet 768-1199px)
 *   sm: 6 columns  (small tablet, before mobile takeover)
 *
 * Widget `i` values match WidgetId from widgetRegistry.
 * Only widgets present in the layout are visible; others are hidden.
 */

const CLASSIC_LG: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 8, h: 8, minW: 3, minH: 3 },
  { i: "character", x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 3 },
  { i: "gallery",   x: 8, y: 6, w: 4, h: 4, minW: 2, minH: 2 },
];

const CLASSIC_MD: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 5, h: 8, minW: 3, minH: 3 },
  { i: "character", x: 5, y: 0, w: 3, h: 6, minW: 3, minH: 3 },
  { i: "gallery",   x: 5, y: 6, w: 3, h: 4, minW: 2, minH: 2 },
];

const CLASSIC_SM: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 6, h: 6, minW: 3, minH: 3 },
  { i: "character", x: 0, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "gallery",   x: 0, y: 10, w: 6, h: 3, minW: 2, minH: 2 },
];

const TACTICIAN_LG: Layout[] = [
  { i: "narrative",  x: 0, y: 0, w: 5, h: 6, minW: 3, minH: 3 },
  { i: "map",        x: 5, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { i: "character",  x: 9, y: 0, w: 3, h: 5, minW: 3, minH: 3 },
  { i: "gallery",    x: 0, y: 6, w: 4, h: 4, minW: 2, minH: 2 },
  { i: "inventory",  x: 9, y: 5, w: 3, h: 3, minW: 2, minH: 2 },
];

const TACTICIAN_MD: Layout[] = [
  { i: "narrative",  x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 3 },
  { i: "map",        x: 4, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { i: "character",  x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "gallery",    x: 4, y: 5, w: 4, h: 3, minW: 2, minH: 2 },
];

const TACTICIAN_SM: Layout[] = [
  { i: "narrative",  x: 0, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
  { i: "map",        x: 0, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "character",  x: 0, y: 9, w: 6, h: 4, minW: 3, minH: 3 },
];

const EXPLORER_LG: Layout[] = [
  { i: "map",        x: 0, y: 0, w: 6, h: 6, minW: 3, minH: 3 },
  { i: "narrative",  x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "gallery",    x: 6, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
  { i: "knowledge",  x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 3 },
];

const EXPLORER_MD: Layout[] = [
  { i: "map",        x: 0, y: 0, w: 5, h: 5, minW: 3, minH: 3 },
  { i: "narrative",  x: 5, y: 0, w: 3, h: 5, minW: 3, minH: 3 },
  { i: "gallery",    x: 0, y: 5, w: 4, h: 3, minW: 2, minH: 2 },
  { i: "knowledge",  x: 4, y: 5, w: 4, h: 3, minW: 3, minH: 3 },
];

const EXPLORER_SM: Layout[] = [
  { i: "map",        x: 0, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
  { i: "narrative",  x: 0, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "gallery",    x: 0, y: 9, w: 6, h: 3, minW: 2, minH: 2 },
];

const MINIMALIST_LG: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 12, h: 10, minW: 3, minH: 3 },
];

const MINIMALIST_MD: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 8, h: 10, minW: 3, minH: 3 },
];

const MINIMALIST_SM: Layout[] = [
  { i: "narrative", x: 0, y: 0, w: 6, h: 10, minW: 3, minH: 3 },
];

export const PRESET_LAYOUTS: Record<PresetName, Layouts> = {
  classic:    { lg: CLASSIC_LG,    md: CLASSIC_MD,    sm: CLASSIC_SM },
  tactician:  { lg: TACTICIAN_LG,  md: TACTICIAN_MD,  sm: TACTICIAN_SM },
  explorer:   { lg: EXPLORER_LG,   md: EXPLORER_MD,   sm: EXPLORER_SM },
  minimalist: { lg: MINIMALIST_LG, md: MINIMALIST_MD, sm: MINIMALIST_SM },
};

export const PRESET_LABELS: Record<PresetName, string> = {
  classic: "Classic",
  tactician: "Tactician",
  explorer: "Explorer",
  minimalist: "Minimalist",
};

/** Widgets visible in each preset (derived from layout items) */
export function visibleWidgetsForPreset(preset: PresetName): Set<string> {
  const lg = PRESET_LAYOUTS[preset].lg as Layout[];
  return new Set(lg.map(item => item.i));
}
