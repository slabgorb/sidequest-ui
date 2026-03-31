import { useCallback } from 'react';
import type { GameMessage } from '../types/protocol';

export type OverlayType = 'character' | 'inventory' | 'map' | 'journal' | 'knowledge' | 'settings' | null;

export interface SlashCommandResult {
  handled: boolean;
  messages: GameMessage[];
  overlay?: OverlayType;
}

export function useSlashCommands() {
  const execute = useCallback((input: string): SlashCommandResult => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { handled: false, messages: [] };
    }

    const cmd = trimmed.split(/\s+/)[0].toLowerCase();

    // Overlay triggers — open the panel locally, no server round-trip.
    // These use canonical data from dedicated WebSocket messages (INVENTORY,
    // CHARACTER_SHEET, MAP_UPDATE), not the degraded state mirror.
    switch (cmd) {
      case '/inventory':
        return { handled: true, messages: [], overlay: 'inventory' };
      case '/character':
        return { handled: true, messages: [], overlay: 'character' };
      case '/map':
        return { handled: true, messages: [], overlay: 'map' };
      case '/journal':
        return { handled: true, messages: [], overlay: 'journal' };
      case '/knowledge':
        return { handled: true, messages: [], overlay: 'knowledge' };
      case '/settings':
        return { handled: true, messages: [], overlay: 'settings' };
      default:
        // Passthrough — let the backend handle it. Backend has /status, /save,
        // /help, /quests, /gm, /tone, and returns the response as NARRATION.
        return { handled: false, messages: [] };
    }
  }, []);

  return { execute };
}
