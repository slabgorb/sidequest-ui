import { COYOTE_STAR_ORRERY } from "./coyoteStarData";
import type { OrreryData } from "./types";

export { OrreryView } from "./OrreryView";
export { COYOTE_STAR_ORRERY };
export type { OrreryBody, OrreryData, OrreryAnomaly, OrreryMoment } from "./types";

/**
 * Registry: world slug → orrery data. Returns null for worlds that don't
 * have an orrery view yet (terrestrial worlds, dungeons, etc.). Add a new
 * world by importing its OrreryData here and registering it under its slug.
 *
 * The MapWidget consults this to decide whether to render the orrery for
 * the current world. When server-side cartography starts shipping
 * navigation_mode + numeric orbital data over the wire, this registry
 * becomes a thin adapter between the wire format and OrreryData; today it
 * holds hand-authored mirrors of cartography.yaml.
 */
const ORRERY_REGISTRY: Record<string, OrreryData> = {
  coyote_star: COYOTE_STAR_ORRERY,
};

export function getOrreryDataForWorld(slug: string | undefined): OrreryData | null {
  if (!slug) return null;
  return ORRERY_REGISTRY[slug] ?? null;
}
