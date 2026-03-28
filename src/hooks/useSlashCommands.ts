import { useCallback } from 'react';
import { MessageType, type GameMessage } from '../types/protocol';
import { useGameState } from '../providers/GameStateProvider';

export interface SlashCommandResult {
  handled: boolean;
  messages: GameMessage[];
}

function sysMsg(text: string): GameMessage {
  return {
    type: MessageType.SESSION_EVENT,
    payload: { text },
    player_id: 'system',
  };
}

export function useSlashCommands() {
  const { state } = useGameState();

  const execute = useCallback(
    (input: string): SlashCommandResult => {
      const trimmed = input.trim();
      if (!trimmed.startsWith('/')) {
        return { handled: false, messages: [] };
      }

      const cmd = trimmed.split(/\s+/)[0].toLowerCase();

      switch (cmd) {
        case '/inventory': {
          const char = state.characters[0];
          if (!char || char.inventory.length === 0) {
            return { handled: true, messages: [sysMsg('No items in inventory.')] };
          }
          const lines = char.inventory.map((item) => `• ${item}`).join('\n');
          return { handled: true, messages: [sysMsg(`Inventory:\n${lines}`)] };
        }

        case '/character': {
          const char = state.characters[0];
          if (!char) {
            return { handled: true, messages: [sysMsg('No character data available.')] };
          }
          const header = char.class
            ? `${char.name} — Level ${char.level ?? 1} ${char.class}`
            : char.name;
          const parts = [
            header,
            `HP: ${char.hp} / ${char.max_hp}`,
          ];
          if (char.statuses.length > 0) {
            parts.push(`Statuses: ${char.statuses.join(', ')}`);
          }
          if (char.inventory.length > 0) {
            parts.push(`Inventory (${char.inventory.length}): ${char.inventory.join(', ')}`);
          }
          if (state.location) {
            parts.push(`Location: ${state.location}`);
          }
          return { handled: true, messages: [sysMsg(parts.join('\n'))] };
        }

        case '/quests': {
          const entries = Object.entries(state.quests);
          if (entries.length === 0) {
            return { handled: true, messages: [sysMsg('No active quests.')] };
          }
          const lines = entries.map(([name, status]) => `• ${name} — ${status}`).join('\n');
          return { handled: true, messages: [sysMsg(`Quests:\n${lines}`)] };
        }

        case '/journal': {
          const journal = state.journal ?? [];
          if (journal.length === 0) {
            return { handled: true, messages: [sysMsg('No handouts yet.')] };
          }
          const lines = journal.map(
            (e) => `• ${e.description} (${new Date(e.timestamp).toLocaleDateString()})`,
          ).join('\n');
          return { handled: true, messages: [sysMsg(`Handouts:\n${lines}`)] };
        }

        case '/help': {
          const text = [
            'Available commands:',
            '  /inventory — View your inventory',
            '  /character — View your character sheet',
            '  /quests — View your quest log',
            '  /journal — View your handout journal',
            '  /help — Show this help message',
          ].join('\n');
          return { handled: true, messages: [sysMsg(text)] };
        }

        default:
          return {
            handled: true,
            messages: [sysMsg(`Unknown command: ${cmd}. Type /help for available commands.`)],
          };
      }
    },
    [state],
  );

  return { execute };
}
