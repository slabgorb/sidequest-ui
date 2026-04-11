/** Mirrors Rust WatcherEventType (sidequest-server/src/lib.rs). */
export type WatcherEventType =
  | "agent_span_open"
  | "agent_span_close"
  | "validation_warning"
  | "subsystem_exercise_summary"
  | "coverage_gap"
  | "json_extraction_result"
  | "state_transition"
  | "turn_complete"
  | "lore_retrieval"
  | "prompt_assembled"
  | "game_state_snapshot";

/** Mirrors Rust Severity. */
export type Severity = "info" | "warning" | "error";

/** A watcher telemetry event from the Rust API's /ws/watcher stream. */
export interface WatcherEvent {
  timestamp: string;
  component: string;
  event_type: WatcherEventType;
  severity: Severity;
  fields: Record<string, unknown>;
}

/** Span data embedded in TurnComplete events. */
export interface TurnSpan {
  name: string;
  component: string;
  start_ms: number;
  duration_ms: number;
}

/** Fields on a TurnComplete event. */
export interface TurnCompleteFields {
  turn_id?: number;
  turn_number?: number;
  classified_intent?: string;
  agent_name?: string;
  agent_duration_ms?: number;
  total_duration_ms?: number;
  is_degraded?: boolean;
  token_count_in?: number;
  token_count_out?: number;
  extraction_tier?: string;
  player_input?: string;
  patches?: Array<{ patch_type: string; fields_changed?: string[] }>;
  beats_fired?: Array<{ trope: string; threshold?: number }>;
  spans?: TurnSpan[];
  delta_empty?: boolean;
}


// --- Debug state endpoint types (GET /api/debug/state) ---

export interface PlayerStateView {
  player_name: string;
  character_name: string | null;
  character_class: string;
  character_hp: number;
  character_max_hp: number;
  character_level: number;
  character_xp: number;
  region_id: string;
  display_location: string;
  inventory: InventoryView;
}

export interface InventoryView {
  items: ItemView[];
  gold: number;
}

export interface ItemView {
  id: string;
  name: string;
  description: string;
  narrative_weight: number;
  state: string;
  source_turn: number;
  tags: string[];
}

export interface TropeStateView {
  trope_definition_id: string;
  status: string;
  progression: number;
}

export interface NpcRegistryEntry {
  name: string;
  pronouns: string;
  role: string;
  location: string;
  last_seen_turn: number;
  age: string;
  appearance: string;
  ocean_summary?: string;
  ocean?: Record<string, unknown>;
  hp: number;
  max_hp: number;
}

export interface SessionStateView {
  session_key: string;
  genre_slug: string;
  world_slug: string;
  current_location: string;
  discovered_regions: string[];
  narration_history_len: number;
  turn_mode: string;
  npc_registry: NpcRegistryEntry[];
  trope_states: TropeStateView[];
  players: PlayerStateView[];
  player_count: number;
  has_music_director: boolean;
  has_audio_mixer: boolean;
  region_names: [string, string][];
}
