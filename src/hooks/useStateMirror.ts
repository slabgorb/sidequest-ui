import { useEffect, useRef } from 'react';
import { MessageType, type GameMessage } from '../types/protocol';
import { useGameState, EMPTY_GAME_STATE, type ClientGameState, type CharacterState, type JournalEntry } from '../providers/GameStateProvider';

/**
 * Applies state deltas from game messages to the GameState context.
 * Extracts state_delta from NARRATION/TURN_STATUS payloads and
 * initial_state from SESSION_EVENT join messages.
 */
export function useStateMirror(messages: GameMessage[]): void {
  const { setState } = useGameState();
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length === 0) return;

    // Replay all messages to compute current state (idempotent)
    let current: ClientGameState = { ...EMPTY_GAME_STATE, characters: [], quests: {} };
    const journal: JournalEntry[] = [];
    const seenRenderIds = new Set<string>();

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
        const initialState = msg.payload.initial_state as ClientGameState | undefined;
        if (initialState) {
          current = {
            characters: (initialState.characters ?? []).map(normalizeCharacter),
            location: initialState.location ?? '',
            quests: { ...initialState.quests },
          };
        }
        continue;
      }

      if (msg.type !== MessageType.NARRATION && msg.type !== MessageType.TURN_STATUS) {
        continue;
      }

      const delta = msg.payload.state_delta as Record<string, unknown> | undefined;
      if (!delta || Object.keys(delta).length === 0) continue;

      current = applyDelta(current, delta);
    }

    // Merge journal entries (preserve existing from localStorage, add new)
    if (journal.length > 0) {
      const existingJournal = current.journal ?? [];
      const existingIds = new Set(existingJournal.map(e => e.render_id));
      const newEntries = journal.filter(e => !existingIds.has(e.render_id));
      current = { ...current, journal: [...existingJournal, ...newEntries] };
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
