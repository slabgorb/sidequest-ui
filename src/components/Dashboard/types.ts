import type {
  TropeStatus,
  ValidationAlert,
  GameSnapshot,
} from "@/components/GMMode/types";

// Re-export for convenience
export type { TropeStatus, ValidationAlert, GameSnapshot };

/** Raw server event shape (WatcherEvent struct from Rust) */
export interface RawWatcherEvent {
  timestamp: string;
  component: string;
  event_type: string;
  severity: string;
  fields: Record<string, unknown>;
}

/** Per-span timing record within a turn */
export interface SpanRecord {
  component: string;
  eventType: string;
  startOffsetMs: number;
  durationMs: number | null;
  fields: Record<string, unknown>;
}

/** Rich per-turn profile — the core dashboard abstraction */
export interface TurnProfile {
  turnNumber: number;
  timestamp: string;
  playerInput: string;
  classifiedIntent?: string;
  agentName?: string;
  spans: SpanRecord[];
  totalDurationMs: number;
  agentDurationMs?: number;
  tokenCountIn?: number;
  tokenCountOut?: number;
  extractionTier?: number;
  isDegraded: boolean;
  snapshot: GameSnapshot | null;
  previousSnapshot: GameSnapshot | null;
  alerts: ValidationAlert[];
}

/** Dashboard-level state */
export interface DashboardState {
  connected: boolean;
  turns: TurnProfile[];
  histogram: Record<string, number>;
  tropes: TropeStatus[];
  alerts: ValidationAlert[];
  latestSnapshot: GameSnapshot | null;
  rawEvents: RawWatcherEvent[];
}

export type DashboardTab =
  | "timeline"
  | "subsystems"
  | "state"
  | "persistence"
  | "console";

export type DashboardAction =
  | { type: "EVENT_RECEIVED"; payload: RawWatcherEvent }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "CLEAR_ALERTS" };
