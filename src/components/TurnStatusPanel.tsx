/**
 * TurnStatusPanel — Shows pending/submitted status per player during turn collection.
 *
 * Presentational component: receives turn entries as props, renders status per player.
 * WebSocket integration lives in the parent (provider/hook layer).
 *
 * Story 13-13: Enhanced with sealed-letter visual metaphor for multiplayer prominence.
 * Per-player sealed/unsealed indicators, "all letters sealed" transition state,
 * hidden in single-player, data attributes for CSS styling.
 */

import { useEffect, useMemo, useRef } from 'react';

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

function isResolved(status: TurnStatusEntry['status']): boolean {
  return status === 'submitted' || status === 'auto_resolved';
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
  const allResolved = deduped.length > 0 && deduped.every((e) => isResolved(e.status));
  const showWaiting = localStatus !== undefined && isResolved(localStatus) && !allResolved;
  const isStructured = gameMode === 'structured';
  const sealedCount = deduped.filter((e) => isResolved(e.status)).length;

  // Track previous status to deduplicate callback fires
  const prevStatusRef = useRef<TurnStatusEntry['status'] | undefined>(undefined);

  // Notify parent of local player status changes — gated by mode and deduped by ref
  useEffect(() => {
    if (gameMode === 'freeplay') return;
    if (localStatus && localStatus !== prevStatusRef.current && onLocalStatusChange) {
      onLocalStatusChange(localStatus);
    }
    prevStatusRef.current = localStatus;
  }, [localStatus, onLocalStatusChange, gameMode]);

  // Mode-aware: hidden in freeplay (after hooks to satisfy Rules of Hooks)
  if (gameMode === 'freeplay') {
    return null;
  }

  // Hidden in single-player during active game modes — panel only shows for multiplayer (2+ players)
  if (gameMode && deduped.length < 2) {
    return null;
  }

  return (
    <div
      data-testid="turn-status-panel"
      data-sealed-round={isStructured ? 'true' : undefined}
      data-all-in={isStructured && allResolved ? 'true' : undefined}
      role={isStructured ? 'status' : undefined}
    >
      {deduped.map((entry) => {
        const sealed = isResolved(entry.status);
        return (
          <div
            key={entry.player_id}
            data-testid={`turn-entry-${entry.player_id}`}
            data-local={localPlayerId ? String(entry.player_id === localPlayerId) : undefined}
          >
            <span>{entry.character_name}</span>
            <span
              data-testid="status-indicator"
              data-status={entry.status}
              data-letter={isStructured ? (sealed ? 'sealed' : 'unsealed') : undefined}
              data-timeout={entry.status === 'auto_resolved' ? 'true' : undefined}
            />
            {isStructured ? (
              <span>{sealed ? 'Sealed' : 'Composing'}</span>
            ) : (
              entry.status === 'auto_resolved' && (
                <span className="text-amber-500 text-xs ml-1">timed out</span>
              )
            )}
          </div>
        );
      })}
      {isStructured && (
        <div>{sealedCount} / {deduped.length}</div>
      )}
      {isStructured && allResolved && (
        <div>All letters sealed</div>
      )}
      {!isStructured && showWaiting && <div>Waiting for other players...</div>}
      {!isStructured && allResolved && <div>Resolving turn...</div>}
    </div>
  );
}
