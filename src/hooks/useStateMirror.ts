import { useEffect, useRef } from 'react';
import { MessageType, type GameMessage } from '../types/protocol';
import { useGameState, EMPTY_GAME_STATE, type ClientGameState, type CharacterState, type JournalEntry, type KnowledgeEntry, type FactCategory, type FactSource, type Confidence, type ItemDepletion, type ResourceAlert } from '../providers/GameStateProvider';

const VALID_CATEGORIES: string[] = ['Lore', 'Place', 'Person', 'Quest', 'Ability'];
const VALID_SOURCES: string[] = ['Observation', 'Dialogue', 'Discovery', 'Backstory'];
const VALID_CONFIDENCES: string[] = ['Certain', 'Suspected', 'Rumored'];

function validateCategory(raw: string | undefined): FactCategory {
  return (raw && VALID_CATEGORIES.includes(raw) ? raw : 'Lore') as FactCategory;
}

function validateSource(raw: string | undefined): FactSource {
  return (raw && VALID_SOURCES.includes(raw) ? raw : 'Observation') as FactSource;
}

function validateConfidence(raw: string | undefined): Confidence {
  return (raw && VALID_CONFIDENCES.includes(raw) ? raw : 'Suspected') as Confidence;
}

interface FootnoteData {
  marker?: number;
  summary: string;
  category?: string;
  is_new?: boolean;
}

/**
 * Applies state deltas from game messages to the GameState context.
 * Extracts state_delta from NARRATION/TURN_STATUS payloads and
 * initial_state from SESSION_EVENT join messages.
 * Accumulates footnotes into knowledge entries.
 */
export function useStateMirror(messages: GameMessage[]): void {
  const { setState, setLocalPlayerId } = useGameState();
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length === 0) return;

    // Replay all messages to compute current state (idempotent)
    let current: ClientGameState = { ...EMPTY_GAME_STATE, characters: [], quests: {}, knowledge: [] };
    const journal: JournalEntry[] = [];
    const knowledge: KnowledgeEntry[] = [];
    const seenRenderIds = new Set<string>();
    const seenFactIds = new Set<string>();
    const depletions: ItemDepletion[] = [];
    const resourceAlerts: ResourceAlert[] = [];
    let myPlayerId = '';
    let turnCounter = 0;

    for (const msg of messages) {
      // Detect handout IMAGE messages
      if (msg.type === MessageType.IMAGE && msg.payload.handout === true) {
        const renderId = msg.payload.render_id as string;
        if (renderId && !seenRenderIds.has(renderId)) {
          seenRenderIds.add(renderId);
          journal.push({
            type: 'handout',
            url: msg.payload.url as string,
            description: msg.payload.description as string,
            timestamp: Date.now(),
            render_id: renderId,
          });
        }
        continue;
      }

      if (msg.type === MessageType.SESSION_EVENT) {
        // Capture local player_id from the connected event
        const event = msg.payload.event as string | undefined;
        if ((event === 'connected' || event === 'ready') && msg.player_id) {
          myPlayerId = msg.player_id;
        }
        const initialState = msg.payload.initial_state as ClientGameState | undefined;
        if (initialState) {
          current = {
            characters: (initialState.characters ?? []).map(normalizeCharacter),
            location: initialState.location ?? '',
            quests: { ...initialState.quests },
            knowledge: [],
          };
        }
        continue;
      }

      // Track turns for knowledge entry timestamps
      if (msg.type === MessageType.PLAYER_ACTION) {
        turnCounter++;
        continue;
      }

      // JOURNAL_RESPONSE: server returns accumulated journal/knowledge entries
      if (msg.type === MessageType.JOURNAL_RESPONSE) {
        const entries = msg.payload.entries as Array<{
          fact_id: string;
          content: string;
          category: string;
          source: string;
          confidence: string;
          learned_turn: number;
        }> | undefined;
        if (entries) {
          for (const entry of entries) {
            if (seenFactIds.has(entry.fact_id)) continue;
            seenFactIds.add(entry.fact_id);
            knowledge.push({
              fact_id: entry.fact_id,
              content: entry.content,
              category: validateCategory(entry.category),
              source: validateSource(entry.source),
              confidence: validateConfidence(entry.confidence),
              is_new: false,
              learned_turn: entry.learned_turn,
            });
          }
        }
        continue;
      }

      // ITEM_DEPLETED: a consumable item was fully exhausted
      if (msg.type === MessageType.ITEM_DEPLETED) {
        const itemName = msg.payload.item_name as string;
        const remainingBefore = msg.payload.remaining_before as number;
        if (itemName) {
          depletions.push({ item_name: itemName, remaining_before: remainingBefore ?? 0 });
        }
        continue;
      }

      // RESOURCE_MIN_REACHED: a resource decayed to its minimum
      if (msg.type === MessageType.RESOURCE_MIN_REACHED) {
        const resourceName = msg.payload.resource_name as string;
        const minValue = msg.payload.min_value as number;
        if (resourceName) {
          resourceAlerts.push({ resource_name: resourceName, min_value: minValue ?? 0 });
        }
        continue;
      }

      if (msg.type !== MessageType.NARRATION && msg.type !== MessageType.TURN_STATUS) {
        continue;
      }

      // Accumulate footnotes into knowledge entries from NARRATION messages
      if (msg.type === MessageType.NARRATION) {
        const footnotes = (msg.payload.footnotes as FootnoteData[] | undefined) ?? [];
        for (const fn of footnotes) {
          if (!fn.summary) continue;
          const factId = `${turnCounter}-${fn.marker ?? knowledge.length}`;
          if (seenFactIds.has(factId)) continue;
          seenFactIds.add(factId);
          knowledge.push({
            fact_id: factId,
            content: fn.summary,
            category: validateCategory(fn.category),
            source: 'Observation' as FactSource,
            confidence: 'Suspected' as Confidence,
            is_new: fn.is_new ?? true,
            learned_turn: turnCounter,
          });
        }
      }

      // In multiplayer, only apply state_delta from our own narrations
      // (other players' character state comes via PARTY_STATUS, not state_delta)
      if (myPlayerId && msg.player_id && msg.player_id !== myPlayerId) {
        continue;
      }

      const delta = msg.payload.state_delta as Record<string, unknown> | undefined;
      if (!delta || Object.keys(delta).length === 0) continue;

      current = applyDelta(current, delta);
    }

    // Store local player ID in context for other hooks
    if (myPlayerId) {
      setLocalPlayerId(myPlayerId);
    }

    // Merge journal entries (preserve existing from localStorage, add new)
    if (journal.length > 0) {
      const existingJournal = current.journal ?? [];
      const existingIds = new Set(existingJournal.map(e => e.render_id));
      const newEntries = journal.filter(e => !existingIds.has(e.render_id));
      current = { ...current, journal: [...existingJournal, ...newEntries] };
    }

    // Merge accumulated knowledge
    if (knowledge.length > 0) {
      current = { ...current, knowledge };
    }

    // Merge accumulated depletions and resource alerts
    if (depletions.length > 0) {
      current = { ...current, depletions };
    }
    if (resourceAlerts.length > 0) {
      current = { ...current, resourceAlerts };
    }

    if (messages.length !== prevLengthRef.current) {
      prevLengthRef.current = messages.length;
      setState(current);
    }
  }, [messages, setState]);
}

function normalizeCharacter(c: CharacterState): CharacterState {
  return {
    name: c.name,
    hp: c.hp,
    max_hp: c.max_hp,
    level: c.level,
    class: c.class,
    statuses: [...(c.statuses ?? [])],
    inventory: [...(c.inventory ?? [])],
  };
}

function applyDelta(state: ClientGameState, delta: Record<string, unknown>): ClientGameState {
  const next = { ...state };

  if ('location' in delta && typeof delta.location === 'string') {
    next.location = delta.location;
  }

  if ('quests' in delta && delta.quests && typeof delta.quests === 'object') {
    next.quests = { ...next.quests, ...(delta.quests as Record<string, string>) };
  }

  if ('characters' in delta && Array.isArray(delta.characters)) {
    const charMap = new Map(next.characters.map(c => [c.name, c]));
    for (const cd of delta.characters as CharacterState[]) {
      charMap.set(cd.name, normalizeCharacter(cd));
    }
    next.characters = Array.from(charMap.values());
  }

  return next;
}
