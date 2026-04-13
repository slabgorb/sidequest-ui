/**
 * Typed payload interfaces for each GameMessage type.
 *
 * These replace the loose `Record<string, unknown>` payload with
 * discriminated union members, eliminating manual `as` casts across
 * App.tsx, narrativeSegments.ts, useStateMirror.ts, useAudioCue.ts,
 * useGenreTheme.ts, and ImageBusProvider.tsx.
 *
 * Mirrors sidequest-protocol (Rust) payload structs.
 */

import { MessageType } from "./protocol";

// ---------------------------------------------------------------------------
// Shared sub-types (re-exported from here as canonical location)
// ---------------------------------------------------------------------------

export interface FootnoteData {
  marker?: number;
  fact_id?: string;
  summary: string;
  category?: string;
  is_new?: boolean;
}

export interface ActionRevealEntry {
  character_name: string;
  player_id: string;
  action: string;
}

export interface TurnStatusEntry {
  player_id: string;
  character_name: string;
  status: "pending" | "submitted" | "auto_resolved";
}

export interface StateDelta {
  location?: string;
  quests?: Record<string, string>;
  characters?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface PartyMemberPayload {
  player_id: string;
  name: string;
  character_name?: string;
  current_hp: number;
  max_hp: number;
  statuses?: string[];
  class: string;
  level: number;
  portrait_url?: string;
  current_location?: string;
  sheet?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
}

export interface ResourcePoolPayload {
  name: string;
  label?: string;
  current: number;
  min: number;
  max: number;
  voluntary: boolean;
}

export interface RolledStat {
  name: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Per-message-type payload interfaces
// ---------------------------------------------------------------------------

/** Spinner indicator — no fields, presence is the signal. */
export type ThinkingPayload = Record<string, never>;

export interface NarrationPayload {
  text: string;
  state_delta?: StateDelta;
  footnotes?: FootnoteData[];
}

export interface NarrationEndPayload {
  state_delta?: StateDelta;
}

export interface SessionEventPayload {
  event: string;
  player_name?: string;
  text?: string;
  genre?: string;
  world?: string;
  has_character?: boolean;
  initial_state?: Record<string, unknown>;
  narrator_verbosity?: string;
  narrator_vocabulary?: string;
  image_cooldown_seconds?: number;
  css?: string;
}

export interface CharacterCreationPayload {
  phase: string;
  scene_index?: number;
  total_scenes?: number;
  prompt?: string;
  summary?: string;
  message?: string;
  choices?: string[];
  allows_freeform?: boolean;
  input_type?: string;
  loading_text?: string;
  character_preview?: Record<string, unknown>;
  rolled_stats?: RolledStat[];
  choice?: string;
  character?: Record<string, unknown>;
}

export interface TurnStatusPayload {
  player_name?: string;
  status?: string;
  player_id?: string;
  state_delta?: StateDelta;
  entries?: Array<{
    player_id: string;
    character_name?: string;
    player_name?: string;
    status: string;
  }>;
}

export interface PartyStatusPayload {
  members: PartyMemberPayload[];
  resources?: Record<string, ResourcePoolPayload>;
}

export interface PlayerActionPayload {
  action: string;
  aside?: boolean;
}

export interface MapUpdatePayload {
  current_location: string;
  region?: string;
  explored?: string[];
  fog_bounds?: Record<string, unknown>;
  cartography?: Record<string, unknown>;
}

export interface ConfrontationPayload {
  active: boolean;
  encounter_type?: string;
  title?: string;
  actors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ErrorPayload {
  message: string;
  reconnect_required?: boolean;
}

export interface ImagePayload {
  url: string;
  alt?: string;
  description?: string;
  caption?: string;
  render_id?: string;
  tier?: string;
  width?: number;
  height?: number;
  handout?: boolean;
}

export interface AudioCuePayload {
  mood?: string;
  music_track?: string;
  sfx_triggers?: string[];
  action?: string;
  music_volume?: number;
  sfx_volume?: number;
  crossfade_ms?: number;
}

export interface RenderQueuedPayload {
  render_id: string;
}

export interface ChapterMarkerPayload {
  location: string;
}

export interface ActionRevealPayload {
  turn_number: number;
  actions: ActionRevealEntry[];
  auto_resolved?: string[];
}

export interface ItemDepletedPayload {
  item_name: string;
  remaining_before: number;
}

export interface ResourceMinReachedPayload {
  resource_name: string;
  min_value: number;
}

export interface JournalRequestPayload {
  filter?: string;
}

export interface JournalResponsePayload {
  entries: Array<{
    fact_id: string;
    content: string;
    category: string;
    source: string;
    confidence: string;
    learned_turn: number;
  }>;
}

export interface ScenarioEventPayload {
  event_type: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface AchievementEarnedPayload {
  achievement_id: string;
  name: string;
  description: string;
  trope_id: string;
  trigger: string;
  emoji?: string;
}

// ---------------------------------------------------------------------------
// Dice types (story 34-2, mirroring sidequest-protocol wire types)
// ---------------------------------------------------------------------------

/** One group of dice in a pool — e.g., `{ sides: 20, count: 1 }` for a d20. */
export interface DieSpec {
  /** Die face count (4, 6, 8, 10, 12, 20, 100). 0 = Unknown. */
  sides: number;
  /** How many dice of this type to throw (1-255). */
  count: number;
}

/** Throw gesture parameters — controls animation, NOT outcome (ADR-074). */
export interface DiceThrowParams {
  /** Initial linear velocity `[x, y, z]`. */
  velocity: [number, number, number];
  /** Initial angular velocity `[x, y, z]`. */
  angular: [number, number, number];
  /** Release point, normalized `[x, y]` in `[0.0, 1.0]`. */
  position: [number, number];
}

/** Outcome classification — feeds narrator tone. */
export type RollOutcome = "CritSuccess" | "Success" | "Fail" | "CritFail";

/** Per-group face values paired with the originating DieSpec. */
export interface DieGroupResult {
  spec: DieSpec;
  faces: number[];
}

/** Server -> all clients: request a dice roll during the reveal phase. */
export interface DiceRequestPayload {
  request_id: string;
  rolling_player_id: string;
  character_name: string;
  dice: DieSpec[];
  modifier: number;
  stat: string;
  difficulty: number;
  context: string;
}

/** Client -> server: player submits throw gesture. */
export interface DiceThrowPayload {
  request_id: string;
  throw_params: DiceThrowParams;
}

/** Server -> all clients: resolved dice roll outcome. */
export interface DiceResultPayload {
  request_id: string;
  rolling_player_id: string;
  character_name: string;
  rolls: DieGroupResult[];
  modifier: number;
  total: number;
  difficulty: number;
  outcome: RollOutcome;
  seed: number;
  throw_params: DiceThrowParams;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

interface BaseMessage {
  player_id: string;
}

export interface ThinkingMessage extends BaseMessage {
  type: typeof MessageType.THINKING;
  payload: ThinkingPayload;
}

export interface NarrationMessage extends BaseMessage {
  type: typeof MessageType.NARRATION;
  payload: NarrationPayload;
}

export interface NarrationEndMessage extends BaseMessage {
  type: typeof MessageType.NARRATION_END;
  payload: NarrationEndPayload;
}

export interface SessionEventMessage extends BaseMessage {
  type: typeof MessageType.SESSION_EVENT;
  payload: SessionEventPayload;
}

export interface CharacterCreationMessage extends BaseMessage {
  type: typeof MessageType.CHARACTER_CREATION;
  payload: CharacterCreationPayload;
}

export interface TurnStatusMessage extends BaseMessage {
  type: typeof MessageType.TURN_STATUS;
  payload: TurnStatusPayload;
}

export interface PartyStatusMessage extends BaseMessage {
  type: typeof MessageType.PARTY_STATUS;
  payload: PartyStatusPayload;
}

export interface PlayerActionMessage extends BaseMessage {
  type: typeof MessageType.PLAYER_ACTION;
  payload: PlayerActionPayload;
}

export interface MapUpdateMessage extends BaseMessage {
  type: typeof MessageType.MAP_UPDATE;
  payload: MapUpdatePayload;
}

export interface ConfrontationMessage extends BaseMessage {
  type: typeof MessageType.CONFRONTATION;
  payload: ConfrontationPayload;
}

export interface ErrorMessage extends BaseMessage {
  type: typeof MessageType.ERROR;
  payload: ErrorPayload;
}

export interface ImageMessage extends BaseMessage {
  type: typeof MessageType.IMAGE;
  payload: ImagePayload;
}

export interface AudioCueMessage extends BaseMessage {
  type: typeof MessageType.AUDIO_CUE;
  payload: AudioCuePayload;
}

export interface RenderQueuedMessage extends BaseMessage {
  type: typeof MessageType.RENDER_QUEUED;
  payload: RenderQueuedPayload;
}

export interface ChapterMarkerMessage extends BaseMessage {
  type: typeof MessageType.CHAPTER_MARKER;
  payload: ChapterMarkerPayload;
}

export interface ActionRevealMessage extends BaseMessage {
  type: typeof MessageType.ACTION_REVEAL;
  payload: ActionRevealPayload;
}

export interface ItemDepletedMessage extends BaseMessage {
  type: typeof MessageType.ITEM_DEPLETED;
  payload: ItemDepletedPayload;
}

export interface ResourceMinReachedMessage extends BaseMessage {
  type: typeof MessageType.RESOURCE_MIN_REACHED;
  payload: ResourceMinReachedPayload;
}

export interface JournalResponseMessage extends BaseMessage {
  type: typeof MessageType.JOURNAL_RESPONSE;
  payload: JournalResponsePayload;
}

export interface DiceRequestMessage extends BaseMessage {
  type: typeof MessageType.DICE_REQUEST;
  payload: DiceRequestPayload;
}

export interface DiceThrowMessage extends BaseMessage {
  type: typeof MessageType.DICE_THROW;
  payload: DiceThrowPayload;
}

export interface DiceResultMessage extends BaseMessage {
  type: typeof MessageType.DICE_RESULT;
  payload: DiceResultPayload;
}

export type TypedGameMessage =
  | ThinkingMessage
  | NarrationMessage
  | NarrationEndMessage
  | SessionEventMessage
  | CharacterCreationMessage
  | TurnStatusMessage
  | PartyStatusMessage
  | PlayerActionMessage
  | MapUpdateMessage
  | ConfrontationMessage
  | ErrorMessage
  | ImageMessage
  | AudioCueMessage
  | RenderQueuedMessage
  | ChapterMarkerMessage
  | ActionRevealMessage
  | ItemDepletedMessage
  | ResourceMinReachedMessage
  | JournalResponseMessage
  | DiceRequestMessage
  | DiceThrowMessage
  | DiceResultMessage;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isNarration(msg: TypedGameMessage): msg is NarrationMessage {
  return msg.type === MessageType.NARRATION;
}

export function isNarrationEnd(msg: TypedGameMessage): msg is NarrationEndMessage {
  return msg.type === MessageType.NARRATION_END;
}

export function isSessionEvent(msg: TypedGameMessage): msg is SessionEventMessage {
  return msg.type === MessageType.SESSION_EVENT;
}

export function isCharacterCreation(msg: TypedGameMessage): msg is CharacterCreationMessage {
  return msg.type === MessageType.CHARACTER_CREATION;
}

export function isTurnStatus(msg: TypedGameMessage): msg is TurnStatusMessage {
  return msg.type === MessageType.TURN_STATUS;
}

export function isPartyStatus(msg: TypedGameMessage): msg is PartyStatusMessage {
  return msg.type === MessageType.PARTY_STATUS;
}

export function isPlayerAction(msg: TypedGameMessage): msg is PlayerActionMessage {
  return msg.type === MessageType.PLAYER_ACTION;
}

export function isMapUpdate(msg: TypedGameMessage): msg is MapUpdateMessage {
  return msg.type === MessageType.MAP_UPDATE;
}

export function isConfrontation(msg: TypedGameMessage): msg is ConfrontationMessage {
  return msg.type === MessageType.CONFRONTATION;
}

export function isError(msg: TypedGameMessage): msg is ErrorMessage {
  return msg.type === MessageType.ERROR;
}

export function isImage(msg: TypedGameMessage): msg is ImageMessage {
  return msg.type === MessageType.IMAGE;
}

export function isAudioCue(msg: TypedGameMessage): msg is AudioCueMessage {
  return msg.type === MessageType.AUDIO_CUE;
}

export function isChapterMarker(msg: TypedGameMessage): msg is ChapterMarkerMessage {
  return msg.type === MessageType.CHAPTER_MARKER;
}

export function isActionReveal(msg: TypedGameMessage): msg is ActionRevealMessage {
  return msg.type === MessageType.ACTION_REVEAL;
}

export function isItemDepleted(msg: TypedGameMessage): msg is ItemDepletedMessage {
  return msg.type === MessageType.ITEM_DEPLETED;
}

export function isResourceMinReached(msg: TypedGameMessage): msg is ResourceMinReachedMessage {
  return msg.type === MessageType.RESOURCE_MIN_REACHED;
}

export function isJournalResponse(msg: TypedGameMessage): msg is JournalResponseMessage {
  return msg.type === MessageType.JOURNAL_RESPONSE;
}

export function isDiceRequest(msg: TypedGameMessage): msg is DiceRequestMessage {
  return msg.type === MessageType.DICE_REQUEST;
}

export function isDiceThrow(msg: TypedGameMessage): msg is DiceThrowMessage {
  return msg.type === MessageType.DICE_THROW;
}

export function isDiceResult(msg: TypedGameMessage): msg is DiceResultMessage {
  return msg.type === MessageType.DICE_RESULT;
}

// ---------------------------------------------------------------------------
// Validation helpers (moved from useStateMirror)
// ---------------------------------------------------------------------------

export type FactCategory = "Lore" | "Place" | "Person" | "Quest" | "Ability" | "Event";
export type FactSource = "narrator" | "game_event" | "player";
export type Confidence = "certain" | "inferred" | "rumor";

const VALID_CATEGORIES: FactCategory[] = ["Lore", "Place", "Person", "Quest", "Ability", "Event"];
const VALID_SOURCES: FactSource[] = ["narrator", "game_event", "player"];
const VALID_CONFIDENCES: Confidence[] = ["certain", "inferred", "rumor"];

export function validateCategory(raw: string | undefined): FactCategory {
  if (raw && VALID_CATEGORIES.includes(raw as FactCategory)) return raw as FactCategory;
  if (raw) console.warn(`Unknown FactCategory: "${raw}", falling back to "Lore"`);
  return "Lore";
}

export function validateSource(raw: string | undefined): FactSource {
  if (raw && VALID_SOURCES.includes(raw as FactSource)) return raw as FactSource;
  if (raw) console.warn(`Unknown FactSource: "${raw}", falling back to "narrator"`);
  return "narrator";
}

export function validateConfidence(raw: string | undefined): Confidence {
  if (raw && VALID_CONFIDENCES.includes(raw as Confidence)) return raw as Confidence;
  if (raw) console.warn(`Unknown Confidence: "${raw}", falling back to "certain"`);
  return "certain";
}
