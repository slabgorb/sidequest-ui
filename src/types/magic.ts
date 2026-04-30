// TypeScript mirrors of sidequest.magic.models. Hand-maintained; keep
// in sync with the pydantic models. Generation tooling deferred.

export type WorldKnowledgePrimary =
  | "denied"
  | "classified"
  | "esoteric"
  | "mythic_lapsed"
  | "folkloric"
  | "acknowledged";

export interface WorldKnowledge {
  primary: WorldKnowledgePrimary;
  local_register: WorldKnowledgePrimary | null;
}

export type LedgerScope =
  | "character"
  | "world"
  | "item"
  | "faction"
  | "location"
  | "bond_pair";

export type LedgerDirection = "up" | "down" | "bidirectional";

export interface LedgerBarSpec {
  id: string;
  scope: LedgerScope;
  direction: LedgerDirection;
  range: [number, number];
  threshold_high?: number | null;
  threshold_higher?: number | null;
  threshold_low?: number | null;
  threshold_lower?: number | null;
  consequence_on_high_cross?: string | null;
  consequence_on_low_cross?: string | null;
  decay_per_session: number;
  starts_at_chargen: number;
}

export interface LedgerBar {
  spec: LedgerBarSpec;
  value: number;
}

export interface BarKey {
  scope: LedgerScope;
  owner_id: string;
  bar_id: string;
}

export type FlagSeverity = "yellow" | "red" | "deep_red";

export interface Flag {
  severity: FlagSeverity;
  reason: string;
  detail: string;
}

export interface WorldMagicConfig {
  world_slug: string;
  genre_slug: string;
  allowed_sources: string[];
  active_plugins: string[];
  intensity: number;
  world_knowledge: WorldKnowledge;
  visibility: Record<string, string>;
  hard_limits: Array<{ id: string; description: string; references_plugin?: string | null }>;
  cost_types: string[];
  ledger_bars: LedgerBarSpec[];
  can_build_caster: boolean;
  can_build_item_user: boolean;
  narrator_register: string;
}

export interface WorkingRecord {
  plugin: string;
  mechanism: string;
  actor: string;
  costs: Record<string, number>;
  domain: string;
  narrator_basis: string;
  flavor?: string | null;
  consent_state?: string | null;
  item_id?: string | null;
  alignment_with_item_nature?: number | null;
}

export interface MagicState {
  config: WorldMagicConfig;
  // Server serializes ledger as Record<string, LedgerBar> with key = "scope|owner|bar".
  ledger: Record<string, LedgerBar>;
  working_log: WorkingRecord[];
}

export function barKeyToString(k: BarKey): string {
  return `${k.scope}|${k.owner_id}|${k.bar_id}`;
}

export function getCharacterBars(
  magic: MagicState,
  characterId: string,
): LedgerBar[] {
  const prefix = `character|${characterId}|`;
  return Object.entries(magic.ledger)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v);
}

export function getWorldBars(magic: MagicState): LedgerBar[] {
  return Object.entries(magic.ledger)
    .filter(([k]) => k.startsWith("world|"))
    .map(([, v]) => v);
}
