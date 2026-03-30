import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TurnStatusPanel } from '../TurnStatusPanel';
import type { TurnStatusEntry } from '../TurnStatusPanel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KAEL_PENDING: TurnStatusEntry = {
  player_id: 'p1',
  character_name: 'Kael',
  status: 'pending',
};

const LYRA_SUBMITTED: TurnStatusEntry = {
  player_id: 'p2',
  character_name: 'Lyra Dawnforge',
  status: 'submitted',
};

const THANE_PENDING: TurnStatusEntry = {
  player_id: 'p3',
  character_name: 'Thane',
  status: 'pending',
};

const THANE_AUTO: TurnStatusEntry = {
  player_id: 'p3',
  character_name: 'Thane',
  status: 'auto_resolved',
};

const ALL_PENDING = [KAEL_PENDING, { ...LYRA_SUBMITTED, status: 'pending' as const }, THANE_PENDING];
const MIXED = [KAEL_PENDING, LYRA_SUBMITTED, THANE_PENDING];
const ALL_SUBMITTED: TurnStatusEntry[] = [
  { ...KAEL_PENDING, status: 'submitted' },
  LYRA_SUBMITTED,
  { ...THANE_PENDING, status: 'submitted' },
];

// ---------------------------------------------------------------------------
// AC-1: Panel renders — shows all party members with status
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-1: panel renders with party members', () => {
  it('renders a status entry for each player in the turn', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} />);
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText('Lyra Dawnforge')).toBeInTheDocument();
    expect(screen.getByText('Thane')).toBeInTheDocument();
  });

  it('has a root element with data-testid="turn-status-panel"', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
  });

  it('renders individual entries with data-testid="turn-entry-{player_id}"', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} />);
    expect(screen.getByTestId('turn-entry-p1')).toBeInTheDocument();
    expect(screen.getByTestId('turn-entry-p2')).toBeInTheDocument();
    expect(screen.getByTestId('turn-entry-p3')).toBeInTheDocument();
  });

  it('renders empty state gracefully when entries is empty', () => {
    render(<TurnStatusPanel entries={[]} />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
    expect(screen.queryByTestId(/^turn-entry-/)).not.toBeInTheDocument();
  });

  it('renders single-player entry', () => {
    render(<TurnStatusPanel entries={[KAEL_PENDING]} />);
    expect(screen.getByTestId('turn-entry-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('turn-entry-p2')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Real-time updates — status changes reflected in UI
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-2: real-time status updates', () => {
  it('shows "pending" indicator for players who have not submitted', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} />);
    const entry = screen.getByTestId('turn-entry-p1');
    expect(within(entry).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'pending',
    );
  });

  it('shows "submitted" indicator for players who have submitted', () => {
    render(<TurnStatusPanel entries={[LYRA_SUBMITTED]} />);
    const entry = screen.getByTestId('turn-entry-p2');
    expect(within(entry).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'submitted',
    );
  });

  it('shows "auto_resolved" indicator for auto-resolved players', () => {
    render(<TurnStatusPanel entries={[THANE_AUTO]} />);
    const entry = screen.getByTestId('turn-entry-p3');
    expect(within(entry).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'auto_resolved',
    );
  });

  it('displays mixed statuses correctly across players', () => {
    render(<TurnStatusPanel entries={MIXED} />);

    const kael = screen.getByTestId('turn-entry-p1');
    expect(within(kael).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'pending',
    );

    const lyra = screen.getByTestId('turn-entry-p2');
    expect(within(lyra).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'submitted',
    );

    const thane = screen.getByTestId('turn-entry-p3');
    expect(within(thane).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'pending',
    );
  });

  it('updates when entries prop changes (re-render)', () => {
    const { rerender } = render(<TurnStatusPanel entries={ALL_PENDING} />);

    // Initially all pending
    const kaelBefore = screen.getByTestId('turn-entry-p1');
    expect(within(kaelBefore).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'pending',
    );

    // Kael submits
    const updated = [
      { ...KAEL_PENDING, status: 'submitted' as const },
      { ...LYRA_SUBMITTED, status: 'pending' as const },
      THANE_PENDING,
    ];
    rerender(<TurnStatusPanel entries={updated} />);

    const kaelAfter = screen.getByTestId('turn-entry-p1');
    expect(within(kaelAfter).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'submitted',
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3: Input locks after submit — disable with waiting message
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-3: input locks after submit', () => {
  it('shows waiting message when local player has submitted', () => {
    render(
      <TurnStatusPanel
        entries={MIXED}
        localPlayerId="p2"
      />,
    );
    expect(screen.getByText(/waiting for other players/i)).toBeInTheDocument();
  });

  it('does not show waiting message when local player is still pending', () => {
    render(
      <TurnStatusPanel
        entries={MIXED}
        localPlayerId="p1"
      />,
    );
    expect(screen.queryByText(/waiting for other players/i)).not.toBeInTheDocument();
  });

  it('reports submitted state via onLocalStatusChange callback', () => {
    const onChange = vi.fn();
    render(
      <TurnStatusPanel
        entries={[{ ...KAEL_PENDING, status: 'submitted' }]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('submitted');
  });

  it('reports pending state via onLocalStatusChange callback', () => {
    const onChange = vi.fn();
    render(
      <TurnStatusPanel
        entries={[KAEL_PENDING]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('pending');
  });

  it('visually distinguishes local player entry', () => {
    render(
      <TurnStatusPanel
        entries={MIXED}
        localPlayerId="p1"
      />,
    );
    const entry = screen.getByTestId('turn-entry-p1');
    expect(entry).toHaveAttribute('data-local', 'true');
  });

  it('marks non-local entries as data-local=false', () => {
    render(
      <TurnStatusPanel
        entries={MIXED}
        localPlayerId="p1"
      />,
    );
    const entry = screen.getByTestId('turn-entry-p2');
    expect(entry).toHaveAttribute('data-local', 'false');
  });
});

// ---------------------------------------------------------------------------
// AC-4: Input unlocks after narration — re-enables for next turn
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-4: input unlocks after narration', () => {
  it('does not show waiting message when all statuses reset to pending (new turn)', () => {
    // After narration, server sends a fresh TURN_STATUS with all pending
    render(
      <TurnStatusPanel
        entries={ALL_PENDING}
        localPlayerId="p1"
      />,
    );
    expect(screen.queryByText(/waiting for other players/i)).not.toBeInTheDocument();
  });

  it('transitions from submitted to pending on rerender (turn cycle)', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TurnStatusPanel
        entries={[{ ...KAEL_PENDING, status: 'submitted' }]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('submitted');

    onChange.mockClear();
    rerender(
      <TurnStatusPanel
        entries={[KAEL_PENDING]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith('pending');
  });

  it('clears waiting message when local player returns to pending', () => {
    const { rerender } = render(
      <TurnStatusPanel
        entries={[LYRA_SUBMITTED, KAEL_PENDING]}
        localPlayerId="p2"
      />,
    );
    expect(screen.getByText(/waiting for other players/i)).toBeInTheDocument();

    rerender(
      <TurnStatusPanel
        entries={[
          { ...LYRA_SUBMITTED, status: 'pending' },
          KAEL_PENDING,
        ]}
        localPlayerId="p2"
      />,
    );
    expect(screen.queryByText(/waiting for other players/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Mode-aware — hidden in FreePlay, visible in Structured/Cinematic
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-5: mode-aware visibility', () => {
  it('renders panel in "structured" mode', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} gameMode="structured" />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
  });

  it('renders panel in "cinematic" mode', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} gameMode="cinematic" />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
  });

  it('does not render panel in "freeplay" mode', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} gameMode="freeplay" />);
    expect(screen.queryByTestId('turn-status-panel')).not.toBeInTheDocument();
  });

  it('renders panel when gameMode is undefined (defaults to visible)', () => {
    render(<TurnStatusPanel entries={ALL_PENDING} />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
  });

  it('hides panel when mode transitions from structured to freeplay', () => {
    const { rerender } = render(
      <TurnStatusPanel entries={ALL_PENDING} gameMode="structured" />,
    );
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();

    rerender(<TurnStatusPanel entries={ALL_PENDING} gameMode="freeplay" />);
    expect(screen.queryByTestId('turn-status-panel')).not.toBeInTheDocument();
  });

  it('shows panel when mode transitions from freeplay to cinematic', () => {
    const { rerender } = render(
      <TurnStatusPanel entries={ALL_PENDING} gameMode="freeplay" />,
    );
    expect(screen.queryByTestId('turn-status-panel')).not.toBeInTheDocument();

    rerender(<TurnStatusPanel entries={ALL_PENDING} gameMode="cinematic" />);
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Names shown — displays character names, not player IDs
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — AC-6: character names displayed', () => {
  it('displays character_name, not player_id', () => {
    render(<TurnStatusPanel entries={[KAEL_PENDING]} />);
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.queryByText('p1')).not.toBeInTheDocument();
  });

  it('displays full multi-word character names', () => {
    render(<TurnStatusPanel entries={[LYRA_SUBMITTED]} />);
    expect(screen.getByText('Lyra Dawnforge')).toBeInTheDocument();
    expect(screen.queryByText('p2')).not.toBeInTheDocument();
  });

  it('character name appears inside the entry element', () => {
    render(<TurnStatusPanel entries={[KAEL_PENDING]} />);
    const entry = screen.getByTestId('turn-entry-p1');
    expect(within(entry).getByText('Kael')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('TurnStatusPanel — edge cases', () => {
  it('handles duplicate player_ids gracefully (last wins)', () => {
    const dupes: TurnStatusEntry[] = [
      { player_id: 'p1', character_name: 'Kael', status: 'pending' },
      { player_id: 'p1', character_name: 'Kael', status: 'submitted' },
    ];
    render(<TurnStatusPanel entries={dupes} />);
    // Should deduplicate — only one entry for p1
    const entries = screen.getAllByTestId(/^turn-entry-p1$/);
    expect(entries).toHaveLength(1);
    // Second entry's status (submitted) wins over first (pending)
    expect(within(entries[0]).getByTestId('status-indicator')).toHaveAttribute(
      'data-status',
      'submitted',
    );
  });

  it('preserves entry order from entries array', () => {
    render(<TurnStatusPanel entries={MIXED} />);
    const entries = screen.getAllByTestId(/^turn-entry-/);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveAttribute('data-testid', 'turn-entry-p1');
    expect(entries[1]).toHaveAttribute('data-testid', 'turn-entry-p2');
    expect(entries[2]).toHaveAttribute('data-testid', 'turn-entry-p3');
  });

  it('does not crash when localPlayerId is not in entries', () => {
    render(
      <TurnStatusPanel
        entries={MIXED}
        localPlayerId="p99"
      />,
    );
    expect(screen.getByTestId('turn-status-panel')).toBeInTheDocument();
    expect(screen.queryByText(/waiting for other players/i)).not.toBeInTheDocument();
  });

  it('shows all submitted summary when every player has submitted', () => {
    render(
      <TurnStatusPanel
        entries={ALL_SUBMITTED}
        localPlayerId="p1"
      />,
    );
    // When all have submitted, should indicate turn is resolving
    expect(screen.getByText(/resolving|processing/i)).toBeInTheDocument();
  });

  it('treats auto_resolved as resolved for allSubmitted detection', () => {
    const mixedResolved: TurnStatusEntry[] = [
      { player_id: 'p1', character_name: 'Kael', status: 'submitted' },
      { player_id: 'p2', character_name: 'Lyra Dawnforge', status: 'auto_resolved' },
    ];
    render(
      <TurnStatusPanel
        entries={mixedResolved}
        localPlayerId="p1"
      />,
    );
    // Both resolved (submitted + auto_resolved) → resolving message, not waiting
    expect(screen.getByText(/resolving|processing/i)).toBeInTheDocument();
    expect(screen.queryByText(/waiting for other players/i)).not.toBeInTheDocument();
  });

  it('does not fire onLocalStatusChange on same-status rerender', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TurnStatusPanel
        entries={[KAEL_PENDING]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pending');

    onChange.mockClear();
    // Rerender with same status — callback should NOT fire again
    rerender(
      <TurnStatusPanel
        entries={[{ ...KAEL_PENDING }]}
        localPlayerId="p1"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not fire onLocalStatusChange in freeplay mode', () => {
    const onChange = vi.fn();
    render(
      <TurnStatusPanel
        entries={[{ ...KAEL_PENDING, status: 'submitted' }]}
        localPlayerId="p1"
        gameMode="freeplay"
        onLocalStatusChange={onChange}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
