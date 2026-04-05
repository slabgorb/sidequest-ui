import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock useWhisper to avoid @huggingface/transformers dependency in tests
vi.mock("@/hooks/useWhisper", () => ({
  useWhisper: () => ({
    transcribe: vi.fn().mockResolvedValue(""),
    status: "ready" as const,
    loadProgress: 1,
    isWebGPU: false,
  }),
}));

// ---------------------------------------------------------------------------
// The responsive layout component doesn't exist yet — this is RED phase.
// These tests define the expected behavior for the GameLayout component
// that wraps NarrativeView, PartyPanel, InputBar, and AudioStatus in a
// CSS Grid layout with responsive breakpoints.
// ---------------------------------------------------------------------------

// This import will fail until the component is created (RED)
import { GameLayout } from '../GameLayout';
import type { CharacterSummary } from '../PartyPanel';
import type { CharacterSheetData } from '../CharacterSheet';

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
  status_effects: ['poisoned'],
  class: 'Ranger',
  level: 3,
  current_location: 'The Rusty Cantina',
};

const LYRA: CharacterSummary = {
  player_id: 'p2',
  name: 'Lyra Dawnforge',
  character_name: 'Lyra Dawnforge',
  portrait_url: '',
  hp: 8,
  hp_max: 40,
  status_effects: [],
  class: 'Cleric',
  level: 5,
  current_location: 'The Rusty Cantina',
};

const CHARACTERS = [KAEL, LYRA];

const CHARACTER_SHEET: CharacterSheetData = {
  name: 'Kael',
  class: 'Ranger',
  level: 3,
  stats: { strength: 14, dexterity: 18 },
  abilities: ['Tracker'],
  backstory: 'Born in the Ashwood.',
  portrait_url: '/renders/kael.png',
  current_location: 'The Rusty Cantina',
};

const defaultProps = {
  messages: [],
  characters: CHARACTERS,
  onSend: vi.fn(),
  disabled: false,
  characterSheet: CHARACTER_SHEET,
};

// ---------------------------------------------------------------------------
// matchMedia mock helper
// ---------------------------------------------------------------------------

function mockMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });

  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    // Parse max-width and min-width from query
    const maxMatch = query.match(/max-width:\s*(\d+)px/);
    const minMatch = query.match(/min-width:\s*(\d+)px/);

    let matches = false;
    if (maxMatch) {
      matches = width <= parseInt(maxMatch[1]);
    } else if (minMatch) {
      matches = width >= parseInt(minMatch[1]);
    }

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

// ---------------------------------------------------------------------------
// AC-1: Desktop shows full layout (>= 1200px)
// ---------------------------------------------------------------------------

describe('GameLayout — AC-1: Desktop full layout', () => {
  beforeEach(() => {
    mockMatchMedia(1440);
  });

  it('renders the game-layout container with grid display', () => {
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toBeInTheDocument();
  });

  it('renders CharacterPanel sidebar as visible', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('character-panel');
    expect(panel).toBeVisible();
  });

  it('renders party section inside CharacterPanel', () => {
    render(<GameLayout {...defaultProps} />);
    const section = screen.getByTestId('party-section');
    expect(section).toBeVisible();
  });

  it('renders NarrativeView in the layout', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('narrative-view')).toBeInTheDocument();
  });

  it('renders InputBar in the layout', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('input-bar')).toBeInTheDocument();
  });

  it('renders AudioStatus toggle in the layout', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
  });

  it('renders a resize handle on the sidebar', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('sidebar-resize-handle')).toBeInTheDocument();
  });

  it('layout container has correct grid area structure', () => {
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    // Desktop layout should have two-column grid
    expect(layout).toHaveAttribute('data-breakpoint', 'desktop');
  });
});

// ---------------------------------------------------------------------------
// AC-2: Tablet collapses sidebar (768px - 1199px)
// ---------------------------------------------------------------------------

describe('GameLayout — AC-2: Tablet sidebar', () => {
  beforeEach(() => {
    mockMatchMedia(1024);
  });

  it('renders CharacterPanel sidebar at tablet width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('character-panel');
    expect(panel).toBeVisible();
  });

  it('party section is visible in sidebar at tablet width', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('party-section')).toBeVisible();
  });

  it('layout container indicates tablet breakpoint', () => {
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'tablet');
  });

  it('NarrativeView expands to fill remaining space', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('narrative-view')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Mobile hides sidebar (< 768px)
// ---------------------------------------------------------------------------

describe('GameLayout — AC-3: Mobile hides sidebar', () => {
  beforeEach(() => {
    mockMatchMedia(375);
  });

  it('CharacterPanel is not visible at mobile width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.queryByTestId('character-panel');
    expect(panel).toBeNull();
  });

  it('NarrativeView is full-width at mobile', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('narrative-view')).toBeInTheDocument();
  });

  it('layout container indicates mobile breakpoint', () => {
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'mobile');
  });

  it('layout uses single-column grid on mobile', () => {
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'mobile');
  });

  it('InputBar renders below narrative on mobile', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('input-bar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Party info integrated into sidebar (no separate overlay)
// ---------------------------------------------------------------------------

describe('GameLayout — AC-4: Party integrated into sidebar', () => {
  beforeEach(() => {
    mockMatchMedia(1440);
  });

  it('party members are rendered inside CharacterPanel', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('character-panel');
    expect(within(panel).getByTestId('party-section')).toBeInTheDocument();
  });

  it('each party member has a card in the sidebar', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('party-member-p1')).toBeInTheDocument();
    expect(screen.getByTestId('party-member-p2')).toBeInTheDocument();
  });

  it('no separate PartyPanel overlay exists', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.queryByTestId('party-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('party-overlay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: InputBar is touch-friendly on mobile
// ---------------------------------------------------------------------------

describe('GameLayout — AC-5: Touch-friendly InputBar on mobile', () => {
  beforeEach(() => {
    mockMatchMedia(375);
  });

  it('InputBar has mobile-friendly class at mobile breakpoint', () => {
    render(<GameLayout {...defaultProps} />);
    const inputBar = screen.getByTestId('input-bar');
    // Input should have minimum touch target height (44px per iOS guidelines)
    // This is verified through a data attribute or class
    const input = inputBar.querySelector('input');
    expect(input).toHaveAttribute('data-mobile', 'true');
  });

  it('aside toggle is a button (not keyboard shortcut) on mobile', () => {
    render(<GameLayout {...defaultProps} />);
    // On mobile, aside toggle should be a visible button
    const asideButton = screen.getByRole('button', { name: /aside/i });
    expect(asideButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Edge cases and breakpoint boundaries
// ---------------------------------------------------------------------------

describe('GameLayout — breakpoint boundaries', () => {
  it('1200px is desktop (boundary)', () => {
    mockMatchMedia(1200);
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'desktop');
  });

  it('1199px is tablet (boundary)', () => {
    mockMatchMedia(1199);
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'tablet');
  });

  it('768px is tablet (boundary)', () => {
    mockMatchMedia(768);
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'tablet');
  });

  it('767px is mobile (boundary)', () => {
    mockMatchMedia(767);
    render(<GameLayout {...defaultProps} />);
    const layout = screen.getByTestId('game-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'mobile');
  });
});

// ---------------------------------------------------------------------------
// AudioStatus adapts to narrow widths
// ---------------------------------------------------------------------------

describe('GameLayout — AudioStatus adapts', () => {
  it('AudioStatus toggle renders at all breakpoints', () => {
    for (const width of [1440, 1024, 375]) {
      mockMatchMedia(width);
      const { unmount } = render(<GameLayout {...defaultProps} />);
      expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut safety — P key no longer toggles party
// ---------------------------------------------------------------------------

describe('GameLayout — keyboard safety', () => {
  it('P key does not trigger any overlay', async () => {
    mockMatchMedia(1440);
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    await user.keyboard('p');

    // No party overlay should appear -- party is inline in sidebar
    expect(screen.queryByTestId('party-overlay')).not.toBeInTheDocument();
  });
});
