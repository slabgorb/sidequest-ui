export interface TurnEventItem {
  subsystem: string;
  detail: string;
  severity?: string;
}

export interface TurnEvent {
  turn: number;
  events: TurnEventItem[];
}

export interface TropeStatus {
  name: string;
  progress: number;
  beats_fired: string[];
}

export interface ValidationAlert {
  severity: string;
  check: string;
  message: string;
  turn: number;
}

export interface GameSnapshot {
  characters?: unknown[];
  location?: string;
  combat?: unknown;
  quest_log?: unknown[];
  [key: string]: unknown;
}

export interface WatcherState {
  connected: boolean;
  turns: TurnEvent[];
  histogram: Record<string, number>;
  tropes: TropeStatus[];
  alerts: ValidationAlert[];
  latestSnapshot: GameSnapshot | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WatcherAction =
  | { type: "EVENT_RECEIVED"; payload: WatcherEvent | Record<string, any> }
  | { type: "DISCONNECTED" }
  | { type: "CONNECTED" }
  | { type: "CLEAR_ALERTS" };

export interface WatcherTurnRecord {
  type: "turn_record";
  turn: number;
  events: TurnEventItem[];
  validations?: ValidationAlert[];
  tropes?: TropeStatus[];
}

export interface WatcherSnapshot {
  type: "snapshot";
  data: GameSnapshot;
}

export type WatcherEvent = WatcherTurnRecord | WatcherSnapshot;
