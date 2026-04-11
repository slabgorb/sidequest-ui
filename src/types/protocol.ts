/**
 * Client-side mirror of sidequest/server/protocol.py.
 * Kept minimal — only what the React client needs.
 */

export enum MessageType {
  // CHARACTER_SHEET and INVENTORY removed 2026-04 — per-character sheet
  // and inventory state are now nested inside each PartyMember carried by
  // PARTY_STATUS. See sidequest-protocol `PartyMember.sheet` / `.inventory`.
  PARTY_STATUS = "PARTY_STATUS",
  MAP_UPDATE = "MAP_UPDATE",
  PLAYER_ACTION = "PLAYER_ACTION",
  NARRATION = "NARRATION",
  TURN_STATUS = "TURN_STATUS",
  CHARACTER_CREATION = "CHARACTER_CREATION",
  SESSION_EVENT = "SESSION_EVENT",
  ERROR = "ERROR",
  IMAGE = "IMAGE",
  AUDIO_CUE = "AUDIO_CUE",
  NARRATION_END = "NARRATION_END",
  ACTION_QUEUE = "ACTION_QUEUE",
  CHAPTER_MARKER = "CHAPTER_MARKER",
  THINKING = "THINKING",
  COMBAT_EVENT = "COMBAT_EVENT",
  ACTION_REVEAL = "ACTION_REVEAL",
  SCENARIO_EVENT = "SCENARIO_EVENT",
  ACHIEVEMENT_EARNED = "ACHIEVEMENT_EARNED",
  CONFRONTATION = "CONFRONTATION",
  RENDER_QUEUED = "RENDER_QUEUED",
  JOURNAL_REQUEST = "JOURNAL_REQUEST",
  JOURNAL_RESPONSE = "JOURNAL_RESPONSE",
  ITEM_DEPLETED = "ITEM_DEPLETED",
  RESOURCE_MIN_REACHED = "RESOURCE_MIN_REACHED",
}

/**
 * Loose GameMessage — kept for backward compatibility during migration.
 * Prefer TypedGameMessage from types/payloads.ts for new code.
 */
export interface GameMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  player_id: string;
}

// Re-export typed payloads for convenience
export type {
  TypedGameMessage,
  FootnoteData,
  ActionRevealEntry,
  TurnStatusEntry,
  StateDelta,
  ScenarioEventPayload,
  AchievementEarnedPayload,
} from "./payloads";

/** Per-session narrator verbosity control (story 14-3). */
export type NarratorVerbosity = 'concise' | 'standard' | 'verbose';

/** Per-session narrator vocabulary/complexity control (story 14-4). */
export type NarratorVocabulary = 'accessible' | 'literary' | 'epic';
