import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfrontationOverlay } from '../ConfrontationOverlay';
import type {
  ConfrontationData,
  EncounterActor,
  EncounterMetric,
  BeatOption,
  SecondaryStats,
} from '../ConfrontationOverlay';

// ═══════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════

const STANDOFF_ACTORS: EncounterActor[] = [
  { name: 'The Stranger', role: 'duelist', portrait_url: '/portraits/stranger.png' },
  { name: 'Black Bart', role: 'duelist', portrait_url: '/portraits/bart.png' },
];

const STANDOFF_METRIC: EncounterMetric = {
  name: 'tension',
  current: 3,
  starting: 0,
  direction: 'ascending',
  threshold_high: 10,
  threshold_low: null,
};

const STANDOFF_BEATS: BeatOption[] = [
  { id: 'stare_down', label: 'Stare Down', metric_delta: 2, stat_check: 'NERVE', risk: 'Flinch' },
  { id: 'taunt', label: 'Taunt', metric_delta: 1, stat_check: 'PRESENCE' },
  { id: 'draw', label: 'Draw!', metric_delta: 3, stat_check: 'DRAW', resolution: true },
];

const STANDOFF_DATA: ConfrontationData = {
  type: 'standoff',
  label: 'High Noon Standoff',
  category: 'pre_combat',
  actors: STANDOFF_ACTORS,
  metric: STANDOFF_METRIC,
  beats: STANDOFF_BEATS,
  secondary_stats: null,
  genre_slug: 'spaghetti_western',
  mood: 'standoff',
};

const NEGOTIATION_ACTORS: EncounterActor[] = [
  { name: 'Player', role: 'negotiator' },
  { name: 'Crime Lord Vex', role: 'counterpart', portrait_url: '/portraits/vex.png' },
];

const NEGOTIATION_DATA: ConfrontationData = {
  type: 'negotiation',
  label: 'Corporate Negotiation',
  category: 'social',
  actors: NEGOTIATION_ACTORS,
  metric: {
    name: 'leverage',
    current: 5,
    starting: 5,
    direction: 'bidirectional',
    threshold_high: 10,
    threshold_low: 0,
  },
  beats: [
    { id: 'pressure', label: 'Apply Pressure', metric_delta: 2, stat_check: 'Cool' },
    { id: 'concede', label: 'Concede Point', metric_delta: -1, stat_check: 'Net' },
    { id: 'bluff', label: 'Bluff', metric_delta: 3, stat_check: 'Cool', risk: 'Exposed' },
  ],
  secondary_stats: null,
  genre_slug: 'neon_dystopia',
  mood: 'tension',
};

const CHASE_SECONDARY_STATS: SecondaryStats = {
  stats: {
    hp: { current: 18, max: 18 },
    speed: { current: 3, max: 3 },
    armor: { current: 2, max: 2 },
    maneuver: { current: 3, max: 3 },
    fuel: { current: 10, max: 10 },
  },
};

const CHASE_DATA: ConfrontationData = {
  type: 'chase',
  label: 'Wasteland Pursuit',
  category: 'movement',
  actors: [
    { name: 'War Rig', role: 'pursuer' },
    { name: 'Player', role: 'quarry' },
  ],
  metric: {
    name: 'separation',
    current: 5,
    starting: 5,
    direction: 'ascending',
    threshold_high: 10,
    threshold_low: null,
  },
  beats: [
    { id: 'floor_it', label: 'Floor It', metric_delta: 2, stat_check: 'DRAW' },
    { id: 'swerve', label: 'Swerve', metric_delta: 1, stat_check: 'NERVE', risk: 'Spin out' },
  ],
  secondary_stats: CHASE_SECONDARY_STATS,
  genre_slug: 'road_warrior',
  mood: 'tension',
};

const COMBAT_DATA: ConfrontationData = {
  type: 'combat',
  label: 'Ambush!',
  category: 'combat',
  actors: [
    { name: 'Raider', role: 'enemy' },
    { name: 'Player', role: 'combatant' },
  ],
  metric: {
    name: 'round',
    current: 1,
    starting: 1,
    direction: 'ascending',
    threshold_high: null,
    threshold_low: null,
  },
  beats: [
    { id: 'attack', label: 'Attack', metric_delta: 0, stat_check: 'GRIT' },
    { id: 'defend', label: 'Defend', metric_delta: 0, stat_check: 'NERVE' },
  ],
  secondary_stats: null,
  genre_slug: 'spaghetti_western',
  mood: 'combat',
};

// ═══════════════════════════════════════════════════════════
// AC1: ConfrontationOverlay renders for any confrontation type
// ═══════════════════════════════════════════════════════════

describe('AC1: Renders for any confrontation type', () => {
  it('renders standoff confrontation', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByTestId('confrontation-overlay')).toBeInTheDocument();
  });

  it('renders negotiation confrontation', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    expect(screen.getByTestId('confrontation-overlay')).toBeInTheDocument();
  });

  it('renders chase confrontation', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByTestId('confrontation-overlay')).toBeInTheDocument();
  });

  it('renders combat confrontation', () => {
    render(<ConfrontationOverlay data={COMBAT_DATA} />);
    expect(screen.getByTestId('confrontation-overlay')).toBeInTheDocument();
  });

  it('displays the confrontation label', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByText('High Noon Standoff')).toBeInTheDocument();
  });

  it('returns null when data is null', () => {
    const { container } = render(<ConfrontationOverlay data={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// AC2: Metric bar displays with genre-themed colors
// ═══════════════════════════════════════════════════════════

describe('AC2: Metric bar display', () => {
  it('renders the metric bar element', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByTestId('metric-bar')).toBeInTheDocument();
  });

  it('shows metric name', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByText(/tension/i)).toBeInTheDocument();
  });

  it('shows current metric value', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('shows metric progress relative to threshold', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const bar = screen.getByTestId('metric-bar-fill');
    // 3 out of 10 = 30%
    expect(bar).toHaveStyle({ width: '30%' });
  });

  it('renders bidirectional metric for negotiation', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    expect(screen.getByText(/leverage/i)).toBeInTheDocument();
    // Bidirectional: 5 is center of [0, 10]
    expect(screen.getByTestId('metric-bar-fill')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// AC3: Available beats render as action buttons
// ═══════════════════════════════════════════════════════════

describe('AC3: Beat action buttons', () => {
  it('renders all available beats as buttons', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByRole('button', { name: /Stare Down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Taunt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Draw!/i })).toBeInTheDocument();
  });

  it('shows stat check on beat buttons', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    // Each beat button should show which stat it checks
    expect(screen.getByText(/NERVE/)).toBeInTheDocument();
    expect(screen.getByText(/PRESENCE/)).toBeInTheDocument();
    expect(screen.getByText(/DRAW/)).toBeInTheDocument();
  });

  it('marks resolution beats distinctly', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const drawButton = screen.getByRole('button', { name: /Draw!/i });
    // Resolution beats should have a distinct visual treatment
    expect(drawButton).toHaveAttribute('data-resolution', 'true');
  });

  it('exposes risk indicator on risky beat buttons via accessible label', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    // "Stare Down" has risk: "Flinch". The risk text lives on the button's
    // title/aria-label (tooltip surface) so the visible label stays scannable
    // — previously risk text was jammed inline, making 3-field button labels
    // like "Ram Grip [Rig damage on failure...]".
    const stareDown = screen.getByRole('button', { name: /Stare Down.*Flinch/i });
    expect(stareDown).toBeInTheDocument();
    expect(stareDown).toHaveAttribute('title', expect.stringMatching(/Flinch/i));
  });

  it('renders negotiation beats', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    expect(screen.getByRole('button', { name: /Apply Pressure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concede Point/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bluff/i })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// AC4: Actor portraits display
// ═══════════════════════════════════════════════════════════

describe('AC4: Actor portraits', () => {
  it('renders actor names', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getByText('The Stranger')).toBeInTheDocument();
    expect(screen.getByText('Black Bart')).toBeInTheDocument();
  });

  it('renders portrait images when URL provided', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const portraits = screen.getAllByRole('img');
    expect(portraits.length).toBeGreaterThanOrEqual(2);
    expect(portraits[0]).toHaveAttribute('src', '/portraits/stranger.png');
  });

  it('renders placeholder when no portrait URL', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    // Player has no portrait_url — should render a placeholder
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(within(overlay).getByText('Player')).toBeInTheDocument();
  });

  it('shows actor roles', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.getAllByText(/duelist/i).length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// AC5: Secondary stats render when present
// ═══════════════════════════════════════════════════════════

describe('AC5: Secondary stats', () => {
  it('renders secondary stats for chase', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByTestId('secondary-stats')).toBeInTheDocument();
  });

  it('shows rig HP bar', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByText(/18.*\/.*18/)).toBeInTheDocument();
  });

  it('shows fuel gauge', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByText(/fuel/i)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('shows speed and maneuver', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByText(/speed/i)).toBeInTheDocument();
    expect(screen.getByText(/maneuver/i)).toBeInTheDocument();
  });

  it('does not render secondary stats when null', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    expect(screen.queryByTestId('secondary-stats')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// AC6: Standoff gets letterbox framing + extreme close-up
// ═══════════════════════════════════════════════════════════

describe('AC6: Standoff visual treatment', () => {
  it('applies letterbox framing for standoff', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-type', 'standoff');
    expect(overlay).toHaveClass('letterbox');
  });

  it('does not apply letterbox for negotiation', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).not.toHaveClass('letterbox');
  });

  it('renders extreme close-up portrait style for standoff', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const portraits = screen.getAllByTestId('actor-portrait');
    portraits.forEach((portrait) => {
      expect(portrait).toHaveClass('extreme-closeup');
    });
  });

  it('does not apply extreme close-up for other types', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    const portraits = screen.queryAllByTestId('actor-portrait');
    portraits.forEach((portrait) => {
      expect(portrait).not.toHaveClass('extreme-closeup');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// AC7: Chase delegates to chase visualization
// ═══════════════════════════════════════════════════════════

describe('AC7: Chase type rendering', () => {
  it('renders chase-specific layout', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-type', 'chase');
  });

  it('shows separation metric for chase', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    expect(screen.getByText(/separation/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// AC8: Combat keeps current layout
// ═══════════════════════════════════════════════════════════

describe('AC8: Combat type rendering', () => {
  it('renders combat-specific layout', () => {
    render(<ConfrontationOverlay data={COMBAT_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-type', 'combat');
  });
});

// ═══════════════════════════════════════════════════════════
// AC9: Genre theming
// ═══════════════════════════════════════════════════════════

describe('AC9: Genre-themed visual treatment', () => {
  it('applies genre slug as data attribute', () => {
    render(<ConfrontationOverlay data={STANDOFF_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-genre', 'spaghetti_western');
  });

  it('neon_dystopia gets its genre attribute', () => {
    render(<ConfrontationOverlay data={NEGOTIATION_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-genre', 'neon_dystopia');
  });

  it('road_warrior gets its genre attribute', () => {
    render(<ConfrontationOverlay data={CHASE_DATA} />);
    const overlay = screen.getByTestId('confrontation-overlay');
    expect(overlay).toHaveAttribute('data-genre', 'road_warrior');
  });
});
