import { useEffect, useRef } from 'react';
import { MessageType, type GameMessage } from '../types/protocol';
import { useGameState, EMPTY_GAME_STATE, type ClientGameState, type CharacterState, type JournalEntry, type KnowledgeEntry, type FactCategory } from '../providers/GameStateProvider';

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
          const validCategories = ['Lore', 'Place', 'Person', 'Quest', 'Ability'];
          const category = (validCategories.includes(fn.category ?? '') ? fn.category : 'Lore') as FactCategory;
          knowledge.push({
            fact_id: factId,
            content: fn.summary,
            category,
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
