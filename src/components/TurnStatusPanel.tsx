/**
 * TurnStatusPanel — Shows pending/submitted status per player during turn collection.
 *
 * Presentational component: receives turn entries as props, renders status per player.
 * WebSocket integration lives in the parent (provider/hook layer).
 */

import { useEffect, useMemo } from 'react';

export interface TurnStatusEntry {
  player_id: string;
  character_name: string;
  status: 'pending' | 'submitted' | 'auto_resolved';
}

export type GameMode = 'freeplay' | 'structured' | 'cinematic';

export interface TurnStatusPanelProps {
  entries: TurnStatusEntry[];
  localPlayerId?: string;
  gameMode?: GameMode;
  onLocalStatusChange?: (status: TurnStatusEntry['status']) => void;
}

export function TurnStatusPanel({
  entries,
  localPlayerId,
  gameMode,
  onLocalStatusChange,
}: TurnStatusPanelProps) {
  // Deduplicate by player_id — last entry wins
  const deduped = useMemo(() => {
    const map = new Map<string, TurnStatusEntry>();
    for (const entry of entries) {
      map.set(entry.player_id, entry);
    }
    return Array.from(map.values());
  }, [entries]);

  const localEntry = localPlayerId
    ? deduped.find((e) => e.player_id === localPlayerId)
    : undefined;

  const localStatus = localEntry?.status;
  const allSubmitted = deduped.length > 0 && deduped.every((e) => e.status === 'submitted');
  const showWaiting = localStatus === 'submitted' && !allSubmitted;

  // Notify parent of local player status changes
  useEffect(() => {
    if (localStatus && onLocalStatusChange) {
      onLocalStatusChange(localStatus);
    }
  }, [localStatus, onLocalStatusChange]);

  // Mode-aware: hidden in freeplay (after hooks to satisfy Rules of Hooks)
  if (gameMode === 'freeplay') {
    return null;
  }

  return (
    <div data-testid="turn-status-panel">
      {deduped.map((entry) => (
        <div
          key={entry.player_id}
          data-testid={`turn-entry-${entry.player_id}`}
          data-local={localPlayerId ? String(entry.player_id === localPlayerId) : undefined}
        >
          <span>{entry.character_name}</span>
          <span data-testid="status-indicator" data-status={entry.status} />
        </div>
      ))}
      {showWaiting && <div>Waiting for other players...</div>}
      {allSubmitted && <div>Resolving turn...</div>}
    </div>
  );
}
