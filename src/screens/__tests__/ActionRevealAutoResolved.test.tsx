/**
 * RED tests for Story 13-4: ActionReveal auto-resolved indicators.
 *
 * AC-5: Auto-resolved action cards show a subtle indicator distinguishing
 * timeout fallback from intentional submission.
 *
 * The existing ActionReveal tests (story 13-3) verify that auto_resolved
 * names render with "hesitated" text. These tests verify the NEW 13-4
 * behavior:
 *   - Auto-resolved entries have a distinct data attribute for styling
 *   - Auto-resolved entries show "timed out" label (not just "hesitated")
 *   - Submitted entries are visually distinct from auto-resolved entries
 *   - Notification text describes who was auto-resolved
 */

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NarrativeView } from '@/screens/NarrativeView';
import { MessageType, type GameMessage } from '@/types/protocol';

// ---------------------------------------------------------------------------
// Helpers (matching existing ActionReveal.test.tsx pattern)
// ---------------------------------------------------------------------------

function msg(
  type: MessageType,
  payload: Record<string, unknown> = {},
): GameMessage {
  return { type, payload, player_id: 'server' };
}

function actionReveal(
  actions: Array<{ character_name: string; player_id: string; action: string }>,
  turn_number = 1,
  auto_resolved: string[] = [],
): GameMessage {
  return msg(MessageType.ACTION_REVEAL, { actions, turn_number, auto_resolved });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const THORN_ACTION = {
  character_name: 'Thorn',
  player_id: 'player-1',
  action: 'I search the room for traps',
};

const ELARA_ACTION = {
  character_name: 'Elara',
  player_id: 'player-2',
  action: 'I guard the door',
};

// ---------------------------------------------------------------------------
// AC-5: Auto-resolved actions have distinct visual treatment
// ---------------------------------------------------------------------------

describe('ActionReveal — 13-4: auto-resolved visual indicator', () => {
  it('auto-resolved entry has data-auto-resolved attribute', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION], 1, ['Elara'])]}
      />,
    );

    const reveal = screen.getByTestId('action-reveal');
    // Auto-resolved entries should have a data attribute for CSS targeting
    const autoEntries = reveal.querySelectorAll('[data-auto-resolved="true"]');
    expect(autoEntries.length).toBe(1);
  });

  it('submitted action does NOT have data-auto-resolved attribute', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION, ELARA_ACTION], 1, ['Elara'])]}
      />,
    );

    const reveal = screen.getByTestId('action-reveal');
    // Thorn submitted normally — should not be marked auto-resolved
    const thornText = screen.getByText(/I search the room for traps/);
    const thornEntry = thornText.closest('[data-auto-resolved]');
    if (thornEntry) {
      expect(thornEntry).toHaveAttribute('data-auto-resolved', 'false');
    }
    // Elara was auto-resolved
    const autoEntries = reveal.querySelectorAll('[data-auto-resolved="true"]');
    expect(autoEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('auto-resolved entry shows "timed out" label', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION], 1, ['Elara'])]}
      />,
    );

    // The auto-resolved entry should have explicit "timed out" text
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
  });

  it('auto-resolved entry still shows character name', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION], 1, ['Elara', 'Brak'])]}
      />,
    );

    expect(screen.getByText(/Elara/)).toBeInTheDocument();
    expect(screen.getByText(/Brak/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Mixed reveal — submitted + auto-resolved in same turn
// ---------------------------------------------------------------------------

describe('ActionReveal — 13-4: mixed submitted and auto-resolved', () => {
  it('renders both submitted actions and auto-resolved entries', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION], 1, ['Elara'])]}
      />,
    );

    // Submitted action shows the actual action text
    expect(screen.getByText(/I search the room for traps/)).toBeInTheDocument();
    // Auto-resolved shows character name
    expect(screen.getByText(/Elara/)).toBeInTheDocument();
  });

  it('auto-resolved entries render after submitted actions', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION, ELARA_ACTION], 1, ['Brak'])]}
      />,
    );

    const reveal = screen.getByTestId('action-reveal');
    // Brak (auto-resolved) should appear after the submitted actions
    const allEntries = reveal.querySelectorAll(
      '[data-auto-resolved="true"], [data-auto-resolved="false"]',
    );
    // At minimum, we should have 3 entries (Thorn, Elara submitted + Brak auto)
    expect(allEntries.length).toBeGreaterThanOrEqual(3);

    // Last entry should be the auto-resolved one
    const lastEntry = allEntries[allEntries.length - 1];
    expect(lastEntry).toHaveAttribute('data-auto-resolved', 'true');
  });

  it('notification text lists all auto-resolved player names', () => {
    render(
      <NarrativeView
        messages={[actionReveal([THORN_ACTION], 1, ['Elara', 'Brak'])]}
      />,
    );

    // Both auto-resolved names should be mentioned
    expect(screen.getByText(/Elara/)).toBeInTheDocument();
    expect(screen.getByText(/Brak/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: All players auto-resolved (everyone timed out)
// ---------------------------------------------------------------------------

describe('ActionReveal — 13-4: all players auto-resolved', () => {
  it('renders when all players timed out (no submitted actions)', () => {
    render(
      <NarrativeView
        messages={[actionReveal([], 1, ['Thorn', 'Elara', 'Brak'])]}
      />,
    );

    const reveal = screen.getByTestId('action-reveal');
    expect(reveal).toBeInTheDocument();

    // All entries should be auto-resolved
    const autoEntries = reveal.querySelectorAll('[data-auto-resolved="true"]');
    expect(autoEntries.length).toBe(3);
  });

  it('each auto-resolved player shows timeout indicator', () => {
    render(
      <NarrativeView
        messages={[actionReveal([], 1, ['Thorn', 'Elara'])]}
      />,
    );

    // Each auto-resolved character should have a timeout label
    const timeoutLabels = screen.getAllByText(/timed out/i);
    expect(timeoutLabels.length).toBe(2);
  });
});
