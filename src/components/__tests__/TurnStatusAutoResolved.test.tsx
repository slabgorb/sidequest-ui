/**
 * RED tests for Story 13-4: Timeout fallback — TurnStatusPanel auto-resolved indicators.
 *
 * AC-5: UI renders subtle indicator (icon/badge) on auto-resolved entries.
 *
 * The existing TurnStatusPanel tests (story 13-1) verify that `data-status="auto_resolved"`
 * renders and that `isResolved()` treats auto_resolved correctly. These tests verify the
 * NEW story 13-4 behavior:
 *   - Auto-resolved entries show a distinct "timed out" label/badge
 *   - Local player gets a notification when they are auto-resolved
 *   - onLocalStatusChange fires with 'auto_resolved' value
 */

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TurnStatusPanel } from '../TurnStatusPanel';
import type { TurnStatusEntry } from '../TurnStatusPanel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KAEL_SUBMITTED: TurnStatusEntry = {
  player_id: 'p1',
  character_name: 'Kael',
  status: 'submitted',
};

const ELARA_AUTO_RESOLVED: TurnStatusEntry = {
  player_id: 'p2',
  character_name: 'Elara Dawnforge',
  status: 'auto_resolved',
};

const BRAK_AUTO_RESOLVED: TurnStatusEntry = {
  player_id: 'p3',
  character_name: 'Brak',
  status: 'auto_resolved',
};

// ---------------------------------------------------------------------------
// AC-5: Auto-resolved entries show distinct timeout indicator
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — 13-4: auto-resolved timeout indicator', () => {
  it('auto-resolved entry shows "timed out" label or badge text', () => {
    render(<TurnStatusPanel entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED]} />);

    const entry = screen.getByTestId('turn-entry-p2');
    // Auto-resolved entry should have visible text indicating timeout
    expect(within(entry).getByText(/timed out/i)).toBeInTheDocument();
  });

  it('submitted entry does NOT show timeout indicator', () => {
    render(<TurnStatusPanel entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED]} />);

    const entry = screen.getByTestId('turn-entry-p1');
    // Submitted entry should NOT have timeout text
    expect(within(entry).queryByText(/timed out/i)).not.toBeInTheDocument();
  });

  it('multiple auto-resolved entries each show timeout indicator', () => {
    render(
      <TurnStatusPanel
        entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED, BRAK_AUTO_RESOLVED]}
      />,
    );

    const elara = screen.getByTestId('turn-entry-p2');
    const brak = screen.getByTestId('turn-entry-p3');
    expect(within(elara).getByText(/timed out/i)).toBeInTheDocument();
    expect(within(brak).getByText(/timed out/i)).toBeInTheDocument();
  });

  it('auto-resolved entry has a distinct visual marker (data-timeout attribute)', () => {
    render(<TurnStatusPanel entries={[ELARA_AUTO_RESOLVED]} />);

    const entry = screen.getByTestId('turn-entry-p2');
    const indicator = within(entry).getByTestId('status-indicator');
    // Should have a data-timeout attribute for styling hooks
    expect(indicator).toHaveAttribute('data-timeout', 'true');
  });

  it('submitted entry does not have data-timeout attribute', () => {
    render(<TurnStatusPanel entries={[KAEL_SUBMITTED]} />);

    const entry = screen.getByTestId('turn-entry-p1');
    const indicator = within(entry).getByTestId('status-indicator');
    expect(indicator).not.toHaveAttribute('data-timeout', 'true');
  });
});

// ---------------------------------------------------------------------------
// AC-5: Local player auto-resolved notification
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — 13-4: local player auto-resolved notification', () => {
  it('shows timeout notification when local player is auto-resolved', () => {
    render(
      <TurnStatusPanel
        entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED]}
        localPlayerId="p2"
      />,
    );

    // Local player was auto-resolved — should see a specific notification
    expect(
      screen.getByText(/your action timed out|your turn was auto-resolved/i),
    ).toBeInTheDocument();
  });

  it('does NOT show timeout notification when local player submitted normally', () => {
    render(
      <TurnStatusPanel
        entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED]}
        localPlayerId="p1"
      />,
    );

    // Local player submitted — no timeout notification for them
    expect(
      screen.queryByText(/your action timed out|your turn was auto-resolved/i),
    ).not.toBeInTheDocument();
  });

  it('fires onLocalStatusChange with auto_resolved status', () => {
    const onChange = vi.fn();
    render(
      <TurnStatusPanel
        entries={[ELARA_AUTO_RESOLVED]}
        localPlayerId="p2"
        onLocalStatusChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenCalledWith('auto_resolved');
  });

  it('transitions from pending to auto_resolved fires callback', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TurnStatusPanel
        entries={[{ ...ELARA_AUTO_RESOLVED, status: 'pending' as const }]}
        localPlayerId="p2"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('pending');

    onChange.mockClear();
    rerender(
      <TurnStatusPanel
        entries={[ELARA_AUTO_RESOLVED]}
        localPlayerId="p2"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('auto_resolved');
  });
});

// ---------------------------------------------------------------------------
// Edge cases for auto-resolved behavior
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — 13-4: auto-resolved edge cases', () => {
  it('mixed submitted + auto_resolved still shows resolving message', () => {
    render(
      <TurnStatusPanel
        entries={[KAEL_SUBMITTED, ELARA_AUTO_RESOLVED]}
        localPlayerId="p1"
      />,
    );

    // Both resolved (one submitted, one auto) → resolving state
    expect(screen.getByText(/resolving|processing/i)).toBeInTheDocument();
  });

  it('all auto_resolved shows resolving message', () => {
    render(
      <TurnStatusPanel
        entries={[ELARA_AUTO_RESOLVED, BRAK_AUTO_RESOLVED]}
        localPlayerId="p2"
      />,
    );

    expect(screen.getByText(/resolving|processing/i)).toBeInTheDocument();
  });

  it('auto_resolved entry still shows character name', () => {
    render(<TurnStatusPanel entries={[ELARA_AUTO_RESOLVED]} />);

    const entry = screen.getByTestId('turn-entry-p2');
    expect(within(entry).getByText('Elara Dawnforge')).toBeInTheDocument();
  });
});
