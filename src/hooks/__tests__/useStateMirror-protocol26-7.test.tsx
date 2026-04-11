/**
 * Story 26-7: useStateMirror handling of missing protocol message types.
 *
 * Tests that JOURNAL_RESPONSE, ITEM_DEPLETED, and RESOURCE_MIN_REACHED
 * are processed by useStateMirror and surface in ClientGameState.
 *
 * JOURNAL_REQUEST is client→server only (sent, not received), so it doesn't
 * need a useStateMirror handler — but we test the send path separately.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  GameStateProvider,
  useGameState,
} from '../../providers/GameStateProvider';
import { useStateMirror } from '../../hooks/useStateMirror';
import { MessageType, type GameMessage } from '../../types/protocol';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <GameStateProvider>{children}</GameStateProvider>;
}

// ---------------------------------------------------------------------------
// AC-2: useStateMirror handles JOURNAL_RESPONSE
// ---------------------------------------------------------------------------

describe('useStateMirror — JOURNAL_RESPONSE handling', () => {
  it('populates knowledge entries from JOURNAL_RESPONSE', () => {
    const journalResponse: GameMessage = {
      type: MessageType.JOURNAL_RESPONSE,
      payload: {
        entries: [
          {
            fact_id: 'f-1',
            content: 'The Dark Tower stands at the center of the wasteland.',
            category: 'Lore',
            source: 'Discovery',
            confidence: 'Certain',
            learned_turn: 3,
          },
          {
            fact_id: 'f-2',
            content: 'Rusty is a mechanic in Geartown.',
            category: 'Person',
            source: 'Dialogue',
            confidence: 'Suspected',
            learned_turn: 5,
          },
        ],
      },
      player_id: 'server',
    };

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror([journalResponse]);
        return state;
      },
      { wrapper },
    );

    // After processing JOURNAL_RESPONSE, knowledge should contain the entries
    expect(result.current.state.knowledge.length).toBeGreaterThanOrEqual(2);
    const loreEntry = result.current.state.knowledge.find(
      (k) => k.fact_id === 'f-1',
    );
    expect(loreEntry).toBeDefined();
    expect(loreEntry!.content).toBe(
      'The Dark Tower stands at the center of the wasteland.',
    );
    expect(loreEntry!.category).toBe('Lore');
  });

  it('handles empty JOURNAL_RESPONSE gracefully', () => {
    const emptyResponse: GameMessage = {
      type: MessageType.JOURNAL_RESPONSE,
      payload: { entries: [] },
      player_id: 'server',
    };

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror([emptyResponse]);
        return state;
      },
      { wrapper },
    );

    // Should not crash, knowledge should remain empty or unchanged
    expect(result.current.state.knowledge).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-3: ITEM_DEPLETED surfaces in game state
// ---------------------------------------------------------------------------

describe('useStateMirror — ITEM_DEPLETED handling', () => {
  it('records item depletion in game state', () => {
    const itemDepleted: GameMessage = {
      type: MessageType.ITEM_DEPLETED,
      payload: {
        item_name: 'Torch',
        remaining_before: 1,
      },
      player_id: 'server',
    };

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror([itemDepleted]);
        return state;
      },
      { wrapper },
    );

    // After ITEM_DEPLETED, the depletion event should be tracked
    // Implementation may use notifications, alerts, or a depletions array
    const depletions = result.current.state.depletions ?? [];
    expect(depletions.length).toBe(1);
    expect(depletions[0].item_name).toBe('Torch');
    expect(depletions[0].remaining_before).toBe(1);
  });

  it('accumulates multiple depletions', () => {
    const depletion1: GameMessage = {
      type: MessageType.ITEM_DEPLETED,
      payload: { item_name: 'Torch', remaining_before: 1 },
      player_id: 'server',
    };
    const depletion2: GameMessage = {
      type: MessageType.ITEM_DEPLETED,
      payload: { item_name: 'Healing Potion', remaining_before: 1 },
      player_id: 'server',
    };

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror([depletion1, depletion2]);
        return state;
      },
      { wrapper },
    );

    const depletions = result.current.state.depletions ?? [];
    expect(depletions.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-3: RESOURCE_MIN_REACHED surfaces in game state
// ---------------------------------------------------------------------------

describe('useStateMirror — RESOURCE_MIN_REACHED handling', () => {
  it('records resource minimum alert in game state', () => {
    const resourceMin: GameMessage = {
      type: MessageType.RESOURCE_MIN_REACHED,
      payload: {
        resource_name: 'Lantern Oil',
        min_value: 0.0,
      },
      player_id: 'server',
    };

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror([resourceMin]);
        return state;
      },
      { wrapper },
    );

    // After RESOURCE_MIN_REACHED, the alert should be tracked
    const resourceAlerts = result.current.state.resourceAlerts ?? [];
    expect(resourceAlerts.length).toBe(1);
    expect(resourceAlerts[0].resource_name).toBe('Lantern Oil');
    expect(resourceAlerts[0].min_value).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: JOURNAL_REQUEST can be constructed and sent
// ---------------------------------------------------------------------------

describe('JOURNAL_REQUEST construction', () => {
  it('builds a valid JOURNAL_REQUEST message', () => {
    const request: GameMessage = {
      type: MessageType.JOURNAL_REQUEST,
      payload: {
        category: 'Lore',
        sort_by: 'time',
      },
      player_id: 'p1',
    };

    expect(request.type).toBe('JOURNAL_REQUEST');
    expect(request.payload.sort_by).toBe('time');
    expect(request.payload.category).toBe('Lore');
  });

  it('builds a JOURNAL_REQUEST without category filter', () => {
    const request: GameMessage = {
      type: MessageType.JOURNAL_REQUEST,
      payload: {
        sort_by: 'category',
      },
      player_id: 'p1',
    };

    expect(request.type).toBe('JOURNAL_REQUEST');
    expect(request.payload.category).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Wiring test: messages are NOT silently dropped
// ---------------------------------------------------------------------------

describe('Protocol wiring — no silent drops', () => {
  it('ITEM_DEPLETED is not ignored by useStateMirror', () => {
    // This test catches Pattern 5 (LLM Compensation) — if useStateMirror
    // skips this message type, the player never sees item depletion.
    const messages: GameMessage[] = [
      {
        type: MessageType.ITEM_DEPLETED,
        payload: { item_name: 'Torch', remaining_before: 1 },
        player_id: 'server',
      },
    ];

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror(messages);
        return state;
      },
      { wrapper },
    );

    // State should differ from EMPTY after processing ITEM_DEPLETED
    const hasDepletions = (result.current.state.depletions ?? []).length > 0;
    expect(hasDepletions).toBe(true);
  });

  it('RESOURCE_MIN_REACHED is not ignored by useStateMirror', () => {
    const messages: GameMessage[] = [
      {
        type: MessageType.RESOURCE_MIN_REACHED,
        payload: { resource_name: 'Lantern Oil', min_value: 0 },
        player_id: 'server',
      },
    ];

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror(messages);
        return state;
      },
      { wrapper },
    );

    const hasAlerts = (result.current.state.resourceAlerts ?? []).length > 0;
    expect(hasAlerts).toBe(true);
  });

  it('JOURNAL_RESPONSE is not ignored by useStateMirror', () => {
    const messages: GameMessage[] = [
      {
        type: MessageType.JOURNAL_RESPONSE,
        payload: {
          entries: [
            {
              fact_id: 'f-1',
              content: 'Test fact',
              category: 'Lore',
              source: 'Discovery',
              confidence: 'Certain',
              learned_turn: 1,
            },
          ],
        },
        player_id: 'server',
      },
    ];

    const { result } = renderHook(
      () => {
        const state = useGameState();
        useStateMirror(messages);
        return state;
      },
      { wrapper },
    );

    // Knowledge should be populated from JOURNAL_RESPONSE
    expect(result.current.state.knowledge.length).toBeGreaterThan(0);
  });
});
