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
}

export interface GameMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  player_id: string;
}

/** Per-session narrator verbosity control (story 14-3). */
export type NarratorVerbosity = 'concise' | 'standard' | 'verbose';
