/**
 * Client-side mirror of sidequest/server/protocol.py.
 * Kept minimal — only what the React client needs.
 */

export enum MessageType {
  PARTY_STATUS = "PARTY_STATUS",
  MAP_UPDATE = "MAP_UPDATE",
  CHARACTER_SHEET = "CHARACTER_SHEET",
  INVENTORY = "INVENTORY",
  PLAYER_ACTION = "PLAYER_ACTION",
  NARRATION = "NARRATION",
  TURN_STATUS = "TURN_STATUS",
  CHARACTER_CREATION = "CHARACTER_CREATION",
  SESSION_EVENT = "SESSION_EVENT",
  ERROR = "ERROR",
  VOICE_SIGNAL = "VOICE_SIGNAL",
  IMAGE = "IMAGE",
  AUDIO_CUE = "AUDIO_CUE",
  VOICE_TEXT = "VOICE_TEXT",
  NARRATION_CHUNK = "NARRATION_CHUNK",
  NARRATION_END = "NARRATION_END",
  ACTION_QUEUE = "ACTION_QUEUE",
  CHAPTER_MARKER = "CHAPTER_MARKER",
  THINKING = "THINKING",
  COMBAT_EVENT = "COMBAT_EVENT",
  ACTION_REVEAL = "ACTION_REVEAL",
  TTS_START = "TTS_START",
  TTS_CHUNK = "TTS_CHUNK",
  TTS_END = "TTS_END",
  SCENARIO_EVENT = "SCENARIO_EVENT",
  ACHIEVEMENT_EARNED = "ACHIEVEMENT_EARNED",
  CONFRONTATION = "CONFRONTATION",
  RENDER_QUEUED = "RENDER_QUEUED",
}

export interface GameMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  player_id: string;
}

/** TTS stream start — announces how many audio segments to expect. */
export interface TtsStartPayload {
  total_segments: number;
}

/** TTS audio chunk — base64-encoded audio for one narration segment. */
export interface TtsChunkPayload {
  audio_base64: string;
  segment_index: number;
  is_last_chunk: boolean;
  speaker: string;
  format: string;
}

/** Scenario system event (Epic 7). */
export interface ScenarioEventPayload {
  event_type: string;
  description: string;
  details?: Record<string, unknown>;
}

/** Achievement earned — trope transition triggered an achievement (story 15-13). */
export interface AchievementEarnedPayload {
  achievement_id: string;
  name: string;
  description: string;
  trope_id: string;
  trigger: string;
  emoji?: string;
}

/** Per-session narrator verbosity control (story 14-3). */
export type NarratorVerbosity = 'concise' | 'standard' | 'verbose';

/** Per-session narrator vocabulary/complexity control (story 14-4). */
export type NarratorVocabulary = 'accessible' | 'literary' | 'epic';
