import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NarrativeView } from '@/screens/NarrativeView';
import { MessageType, type GameMessage } from '@/types/protocol';

// ---------------------------------------------------------------------------
// Helpers
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

function narration(text: string): GameMessage {
  return msg(MessageType.NARRATION, { text });
}

function narrationEnd(): GameMessage {
  return msg(MessageType.NARRATION_END);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TWO_ACTIONS = [
  { character_name: 'Thorn', player_id: 'player-1', action: 'I search the room for traps' },
  { character_name: 'Elara', player_id: 'player-2', action: 'I guard the door' },
];

const THREE_ACTIONS = [
  ...TWO_ACTIONS,
  { character_name: 'Kael', player_id: 'player-3', action: 'I cast detect magic' },
];

// ---------------------------------------------------------------------------
// AC-4: UI displays revealed actions in narration with visual distinction
// ---------------------------------------------------------------------------

describe('ActionReveal — AC-4: renders in narration sequence', () => {
  it('renders ACTION_REVEAL message type', () => {
    render(
      <NarrativeView messages={[actionReveal(TWO_ACTIONS)]} />,
    );
    expect(screen.getByTestId('action-reveal')).toBeInTheDocument();
  });

  it('displays each player action in the reveal', () => {
    render(
      <NarrativeView messages={[actionReveal(TWO_ACTIONS)]} />,
    );
    expect(screen.getByText(/I search the room for traps/)).toBeInTheDocument();
    expect(screen.getByText(/I guard the door/)).toBeInTheDocument();
  });

  it('displays three player actions', () => {
    render(
      <NarrativeView messages={[actionReveal(THREE_ACTIONS)]} />,
    );
    expect(screen.getByText(/I search the room for traps/)).toBeInTheDocument();
    expect(screen.getByText(/I guard the door/)).toBeInTheDocument();
    expect(screen.getByText(/I cast detect magic/)).toBeInTheDocument();
  });

  it('displays character names with their actions', () => {
    render(
      <NarrativeView messages={[actionReveal(TWO_ACTIONS)]} />,
    );
    expect(screen.getByText(/Thorn/)).toBeInTheDocument();
    expect(screen.getByText(/Elara/)).toBeInTheDocument();
  });

  it('renders action reveal with visual distinction from narration', () => {
    render(
      <NarrativeView
        messages={[
          narration('The party enters the dark hallway.'),
          actionReveal(TWO_ACTIONS),
          narration('The trap triggers as Thorn steps forward.'),
        ]}
      />,
    );
    // action-reveal should be a distinct element, not merged into narration text
    const reveal = screen.getByTestId('action-reveal');
    expect(reveal).toBeInTheDocument();
    // Visual distinction: action-reveal has a border or background class
    expect(reveal.className).toMatch(/border|bg-/);
    // Narration text should also be present (not swallowed by reveal)
    expect(screen.getByText(/The party enters the dark hallway/)).toBeInTheDocument();
    expect(screen.getByText(/The trap triggers/)).toBeInTheDocument();
  });

  it('renders action reveal between narration chunks correctly', () => {
    render(
      <NarrativeView
        messages={[
          narration('The turn resolves.'),
          narrationEnd(),
          actionReveal(TWO_ACTIONS),
          narration('The narrator describes the outcome.'),
          narrationEnd(),
        ]}
      />,
    );
    expect(screen.getByTestId('action-reveal')).toBeInTheDocument();
    expect(screen.getByText(/The turn resolves/)).toBeInTheDocument();
    expect(screen.getByText(/The narrator describes/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4 continued: character names displayed, not raw IDs
// ---------------------------------------------------------------------------

describe('ActionReveal — character names not player IDs', () => {
  it('shows character_name, not player_id', () => {
    render(
      <NarrativeView messages={[actionReveal(TWO_ACTIONS)]} />,
    );
    expect(screen.getByText(/Thorn/)).toBeInTheDocument();
    expect(screen.queryByText('player-1')).not.toBeInTheDocument();
  });

  it('shows multi-word character names', () => {
    const actions = [
      { character_name: 'Lyra Dawnforge', player_id: 'p2', action: 'I heal the wounded' },
    ];
    render(
      <NarrativeView messages={[actionReveal(actions)]} />,
    );
    expect(screen.getByText(/Lyra Dawnforge/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Auto-resolved players
// ---------------------------------------------------------------------------

describe('ActionReveal — auto-resolved players', () => {
  it('indicates auto-resolved players in the reveal', () => {
    render(
      <NarrativeView
        messages={[
          actionReveal(
            [{ character_name: 'Thorn', player_id: 'player-1', action: 'I search the room' }],
            5,
            ['Elara'],
          ),
        ]}
      />,
    );
    // Auto-resolved player should be mentioned (e.g., "Elara hesitates")
    expect(screen.getByText(/Elara/)).toBeInTheDocument();
  });

  it('renders reveal with only auto-resolved players (all timed out)', () => {
    render(
      <NarrativeView
        messages={[actionReveal([], 2, ['Thorn', 'Elara'])]}
      />,
    );
    expect(screen.getByTestId('action-reveal')).toBeInTheDocument();
    expect(screen.getByText(/Thorn/)).toBeInTheDocument();
    expect(screen.getByText(/Elara/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Single action (non-multiplayer edge case)
// ---------------------------------------------------------------------------

describe('ActionReveal — single player', () => {
  it('renders a single action reveal', () => {
    const singleAction = [
      { character_name: 'Solo', player_id: 'player-1', action: 'I open the chest' },
    ];
    render(
      <NarrativeView messages={[actionReveal(singleAction)]} />,
    );
    expect(screen.getByText(/I open the chest/)).toBeInTheDocument();
    expect(screen.getByText(/Solo/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ActionReveal — edge cases', () => {
  it('handles empty actions list gracefully', () => {
    render(
      <NarrativeView messages={[actionReveal([])]} />,
    );
    // Empty actions + empty auto_resolved → no action-reveal element rendered
    expect(screen.queryByTestId('action-reveal')).not.toBeInTheDocument();
    // But the view itself should not crash
    const view = document.querySelector("[data-testid='narrative-view']");
    expect(view).toBeInTheDocument();
  });

  it('handles action text with special characters', () => {
    const actions = [
      { character_name: 'Thorn', player_id: 'p1', action: 'I shout "For glory!" & charge' },
    ];
    render(
      <NarrativeView messages={[actionReveal(actions)]} />,
    );
    expect(screen.getByText(/I shout "For glory!" & charge/)).toBeInTheDocument();
  });

  it('flushes pending chunks before rendering action reveal', () => {
    // ACTION_REVEAL between chunks should not merge with chunk text
    render(
      <NarrativeView
        messages={[
          narration('Before the reveal.'),
          actionReveal(TWO_ACTIONS),
          narration('After the reveal.'),
        ]}
      />,
    );
    // The chunk before should be flushed as a separate text segment
    expect(screen.getByText(/Before the reveal/)).toBeInTheDocument();
    expect(screen.getByTestId('action-reveal')).toBeInTheDocument();
    expect(screen.getByText(/After the reveal/)).toBeInTheDocument();
  });

  it('multiple action reveals in sequence render separately', () => {
    render(
      <NarrativeView
        messages={[
          actionReveal(TWO_ACTIONS, 1),
          narration('The narrator describes turn 1.'),
          actionReveal(THREE_ACTIONS, 2),
        ]}
      />,
    );
    const reveals = screen.getAllByTestId('action-reveal');
    expect(reveals).toHaveLength(2);
  });
});
