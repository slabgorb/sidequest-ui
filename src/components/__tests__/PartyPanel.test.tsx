import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PartyPanel } from '../PartyPanel';
import type { CharacterSummary } from '../PartyPanel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KAEL: CharacterSummary = {
  player_id: 'p1',
  name: 'Kael',
  character_name: 'Kael',
  portrait_url: '/renders/kael_portrait.png',
  hp: 24,
  hp_max: 30,
  status_effects: ['poisoned', 'inspired'],
  class: 'Ranger',
  level: 3,
  current_location: 'The Rusty Cantina',
};

const LYRA: CharacterSummary = {
  player_id: 'p2',
  name: 'Lyra Dawnforge',
  character_name: 'Lyra Dawnforge',
  portrait_url: '/renders/lyra_portrait.png',
  hp: 8,
  hp_max: 40,
  status_effects: [],
  class: 'Cleric',
  level: 5,
  current_location: 'The Rusty Cantina',
};

const THANE: CharacterSummary = {
  player_id: 'p3',
  name: 'Thane',
  character_name: 'Thane',
  portrait_url: '',
  hp: 15,
  hp_max: 28,
  status_effects: ['stunned'],
  class: 'Fighter',
  level: 4,
  current_location: 'Scrapyard Gate',
};

const THREE_CHARACTERS = [KAEL, LYRA, THANE];

// ---------------------------------------------------------------------------
// AC-1: Character cards render from PARTY_STATUS
// ---------------------------------------------------------------------------

describe('PartyPanel — AC-1: character cards render', () => {
  it('renders a CharacterCard for each character in the party', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText('Lyra Dawnforge')).toBeInTheDocument();
    expect(screen.getByText('Thane')).toBeInTheDocument();
  });

  it('renders character name and class/level', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText(/Ranger/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('renders HP values for each character', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    // Should display current/max HP somewhere
    expect(screen.getByText(/24/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('renders portrait image with correct src', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    const img = screen.getByRole('img', { name: /Kael/i });
    expect(img).toHaveAttribute('src', '/renders/kael_portrait.png');
  });

  it('renders an empty state when characters array is empty', () => {
    render(
      <PartyPanel characters={[]} collapsed={false} onToggle={vi.fn()} />,
    );
    // Panel should exist but have no character cards
    expect(screen.getByTestId('party-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('character-card')).not.toBeInTheDocument();
  });

  it('has a root element with data-testid for layout targeting', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByTestId('party-panel')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: HP bar color-coded by health percentage
// ---------------------------------------------------------------------------

describe('PartyPanel — AC-2: HP bar color coding', () => {
  it('applies green/healthy styling when HP > 50%', () => {
    const healthy = { ...KAEL, hp: 24, hp_max: 30 }; // 80%
    render(
      <PartyPanel characters={[healthy]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'healthy');
  });

  it('applies yellow/warning styling when HP > 25% and <= 50%', () => {
    const warning = { ...KAEL, hp: 12, hp_max: 40 }; // 30%
    render(
      <PartyPanel characters={[warning]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'warning');
  });

  it('applies red/critical styling when HP <= 25%', () => {
    const critical = { ...KAEL, hp: 5, hp_max: 40 }; // 12.5%
    render(
      <PartyPanel characters={[critical]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'critical');
  });

  it('treats exactly 50% as warning, not healthy', () => {
    const edge = { ...KAEL, hp: 20, hp_max: 40 }; // exactly 50%
    render(
      <PartyPanel characters={[edge]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'warning');
  });

  it('treats exactly 25% as critical, not warning', () => {
    const edge = { ...KAEL, hp: 10, hp_max: 40 }; // exactly 25%
    render(
      <PartyPanel characters={[edge]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'critical');
  });

  it('handles 0 HP without crashing', () => {
    const dead = { ...KAEL, hp: 0, hp_max: 30 };
    render(
      <PartyPanel characters={[dead]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'critical');
  });

  it('sets HP bar width proportional to current HP', () => {
    const half = { ...KAEL, hp: 15, hp_max: 30 }; // 50%
    render(
      <PartyPanel characters={[half]} collapsed={false} onToggle={vi.fn()} />,
    );
    const fill = screen.getByTestId('hp-bar-fill-p1');
    expect(fill).toHaveStyle({ width: '50%' });
  });
});

// ---------------------------------------------------------------------------
// AC-3: Panel collapses to icon strip
// ---------------------------------------------------------------------------

describe('PartyPanel — AC-3: collapse/expand', () => {
  it('renders expanded by default when collapsed=false', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    const panel = screen.getByTestId('party-panel');
    expect(panel).not.toHaveAttribute('data-collapsed', 'true');
    // Character names should be visible in expanded mode
    expect(screen.getByText('Kael')).toBeVisible();
  });

  it('renders collapsed when collapsed=true', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={true} onToggle={vi.fn()} />,
    );
    const panel = screen.getByTestId('party-panel');
    expect(panel).toHaveAttribute('data-collapsed', 'true');
  });

  it('hides character names and HP details when collapsed', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={true} onToggle={vi.fn()} />,
    );
    // Names should not be visible in collapsed mode
    expect(screen.queryByText('Kael')).not.toBeVisible();
  });

  it('still shows portrait thumbnails when collapsed', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={true} onToggle={vi.fn()} />,
    );
    // Portrait images remain visible for the icon strip
    expect(screen.getByRole('img', { name: /Kael/i })).toBeVisible();
  });

  it('calls onToggle when toggle button is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={onToggle} />,
    );
    const toggleBtn = screen.getByRole('button', { name: /toggle.*panel|collapse|expand/i });
    await user.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('has a toggle button', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /toggle.*panel|collapse|expand/i }),
    ).toBeInTheDocument();
  });

  it('toggles panel on P keypress', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={onToggle} />,
    );
    await user.keyboard('p');
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('does not toggle on P when an input is focused', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <input data-testid="text-input" />
        <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={onToggle} />
      </div>,
    );
    const input = screen.getByTestId('text-input');
    await user.click(input);
    await user.keyboard('p');
    expect(onToggle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Portrait fallback for missing images
// ---------------------------------------------------------------------------

describe('PartyPanel — AC-4: portrait fallback', () => {
  it('shows initials when portrait_url is empty', () => {
    const noPortrait = { ...KAEL, portrait_url: '' };
    render(
      <PartyPanel characters={[noPortrait]} collapsed={false} onToggle={vi.fn()} />,
    );
    // Should not render an img element
    const card = screen.getByTestId('character-card-p1');
    expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    // Should show initials — 'K' for Kael
    expect(within(card).getByText('K')).toBeInTheDocument();
  });

  it('shows initials when portrait_url is undefined', () => {
    const noPortrait = { ...KAEL, portrait_url: undefined } as unknown as CharacterSummary;
    render(
      <PartyPanel characters={[noPortrait]} collapsed={false} onToggle={vi.fn()} />,
    );
    const card = screen.getByTestId('character-card-p1');
    expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    expect(within(card).getByText('K')).toBeInTheDocument();
  });

  it('shows two-initial fallback for multi-word names', () => {
    const noPortrait = { ...LYRA, portrait_url: '' };
    render(
      <PartyPanel characters={[noPortrait]} collapsed={false} onToggle={vi.fn()} />,
    );
    const card = screen.getByTestId('character-card-p2');
    // 'Lyra Dawnforge' → 'LD'
    expect(within(card).getByText('LD')).toBeInTheDocument();
  });

  it('shows portrait image when portrait_url is present', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    const card = screen.getByTestId('character-card-p1');
    expect(within(card).getByRole('img')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Status effect badges
// ---------------------------------------------------------------------------

describe('PartyPanel — AC-5: status effect badges', () => {
  it('renders a badge for each status effect', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('poisoned')).toBeInTheDocument();
    expect(screen.getByText('inspired')).toBeInTheDocument();
  });

  it('renders no badges when status_effects is empty', () => {
    render(
      <PartyPanel characters={[LYRA]} collapsed={false} onToggle={vi.fn()} />,
    );
    const card = screen.getByTestId('character-card-p2');
    expect(within(card).queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('renders single status effect badge', () => {
    render(
      <PartyPanel characters={[THANE]} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('stunned')).toBeInTheDocument();
  });

  it('status badges have data-testid for styling hooks', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    const badges = screen.getAllByTestId('status-badge');
    expect(badges).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('PartyPanel — edge cases', () => {
  it('renders multiple character cards in order', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    const cards = screen.getAllByTestId(/^character-card-/);
    expect(cards).toHaveLength(3);
  });

  it('each character card has a unique testid based on player_id', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByTestId('character-card-p1')).toBeInTheDocument();
    expect(screen.getByTestId('character-card-p2')).toBeInTheDocument();
    expect(screen.getByTestId('character-card-p3')).toBeInTheDocument();
  });

  it('handles full HP (100%)', () => {
    const full = { ...KAEL, hp: 30, hp_max: 30 };
    render(
      <PartyPanel characters={[full]} collapsed={false} onToggle={vi.fn()} />,
    );
    const bar = screen.getByTestId('hp-bar-p1');
    expect(bar).toHaveAttribute('data-hp-level', 'healthy');
    const fill = screen.getByTestId('hp-bar-fill-p1');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('clamps HP bar width to 100% even if hp > hp_max', () => {
    const overhealed = { ...KAEL, hp: 35, hp_max: 30 };
    render(
      <PartyPanel characters={[overhealed]} collapsed={false} onToggle={vi.fn()} />,
    );
    const fill = screen.getByTestId('hp-bar-fill-p1');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('panel is accessible — toggle button is keyboard-reachable', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    const toggle = screen.getByRole('button', { name: /toggle.*panel|collapse|expand/i });
    expect(toggle).not.toHaveAttribute('tabindex', '-1');
  });
});

// ---------------------------------------------------------------------------
// Story 14-2: Player location on character sheet
// ---------------------------------------------------------------------------

describe('PartyPanel — Story 14-2: player location display', () => {
  it('renders current_location under each character name', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={false} onToggle={vi.fn()} />,
    );
    const card = screen.getByTestId('character-card-p1');
    expect(within(card).getByText('The Rusty Cantina')).toBeInTheDocument();
  });

  it('renders location for every party member', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    // Kael and Lyra are at The Rusty Cantina
    const kaelCard = screen.getByTestId('character-card-p1');
    expect(within(kaelCard).getByText('The Rusty Cantina')).toBeInTheDocument();
    const lyraCard = screen.getByTestId('character-card-p2');
    expect(within(lyraCard).getByText('The Rusty Cantina')).toBeInTheDocument();
    // Thane is at Scrapyard Gate
    const thaneCard = screen.getByTestId('character-card-p3');
    expect(within(thaneCard).getByText('Scrapyard Gate')).toBeInTheDocument();
  });

  it('hides location text when panel is collapsed', () => {
    render(
      <PartyPanel characters={[KAEL]} collapsed={true} onToggle={vi.fn()} />,
    );
    expect(screen.queryByText('The Rusty Cantina')).not.toBeVisible();
  });
});

describe('PartyPanel — Story 14-2: multi-location visual grouping', () => {
  it('applies location-group styling when party is split across locations', () => {
    // When party members are in different locations, each card should have a
    // data-location attribute so CSS can style location groups distinctly.
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    const kaelCard = screen.getByTestId('character-card-p1');
    const thaneCard = screen.getByTestId('character-card-p3');
    // Cards should carry data-location for CSS grouping
    expect(kaelCard).toHaveAttribute('data-location', 'The Rusty Cantina');
    expect(thaneCard).toHaveAttribute('data-location', 'Scrapyard Gate');
  });

  it('marks cards as split-party when members are in different locations', () => {
    // When party is split, the panel should signal it visually.
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    const panel = screen.getByTestId('party-panel');
    expect(panel).toHaveAttribute('data-split-party', 'true');
  });

  it('does NOT mark split-party when all members are co-located', () => {
    const colocated = [KAEL, LYRA]; // Both at "The Rusty Cantina"
    render(
      <PartyPanel characters={colocated} collapsed={false} onToggle={vi.fn()} />,
    );
    const panel = screen.getByTestId('party-panel');
    expect(panel).not.toHaveAttribute('data-split-party', 'true');
  });

  it('renders a location badge with distinct styling per location', () => {
    render(
      <PartyPanel characters={THREE_CHARACTERS} collapsed={false} onToggle={vi.fn()} />,
    );
    // Location badges should have data-testid for styling hooks
    const locationBadges = screen.getAllByTestId('location-badge');
    expect(locationBadges.length).toBeGreaterThanOrEqual(3); // One per character
  });
});
