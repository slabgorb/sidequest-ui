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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KAEL: CharacterSummary = {
  player_id: 'p1',
  name: 'Kael',
  portrait_url: '/renders/kael_portrait.png',
  hp: 24,
  hp_max: 30,
  status_effects: ['poisoned'],
  class: 'Ranger',
  level: 3,
};

const LYRA: CharacterSummary = {
  player_id: 'p2',
  name: 'Lyra Dawnforge',
  portrait_url: '',
  hp: 8,
  hp_max: 40,
  status_effects: [],
  class: 'Cleric',
  level: 5,
};

const CHARACTERS = [KAEL, LYRA];

const defaultProps = {
  messages: [],
  characters: CHARACTERS,
  onSend: vi.fn(),
  disabled: false,
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

  it('renders PartyPanel sidebar as visible', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('party-panel');
    expect(panel).toBeVisible();
  });

  it('renders PartyPanel in expanded state (not collapsed)', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('party-panel');
    expect(panel).not.toHaveAttribute('data-collapsed');
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

  it('sidebar has data-layout="full" at desktop width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('party-panel');
    // At desktop, sidebar should be in full layout mode
    expect(panel).not.toHaveAttribute('data-collapsed', 'true');
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

describe('GameLayout — AC-2: Tablet collapsed sidebar', () => {
  beforeEach(() => {
    mockMatchMedia(1024);
  });

  it('renders PartyPanel in collapsed state at tablet width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('party-panel');
    expect(panel).toHaveAttribute('data-collapsed', 'true');
  });

  it('sidebar is still visible (icon strip) at tablet width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.getByTestId('party-panel');
    expect(panel).toBeVisible();
  });

  it('character portraits/initials are visible in collapsed sidebar', () => {
    render(<GameLayout {...defaultProps} />);
    // Portrait image for Kael should still be visible
    const kael = screen.getByAltText('Kael');
    expect(kael).toBeVisible();
  });

  it('character names are hidden in collapsed sidebar', () => {
    render(<GameLayout {...defaultProps} />);
    // Names should be visibility: hidden in collapsed mode
    const nameEl = screen.getByText('Kael');
    expect(nameEl).not.toBeVisible();
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

  it('PartyPanel is not visible at mobile width', () => {
    render(<GameLayout {...defaultProps} />);
    const panel = screen.queryByTestId('party-panel');
    // Panel should either not render or be hidden
    if (panel) {
      expect(panel).not.toBeVisible();
    } else {
      expect(panel).toBeNull();
    }
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
    // Should not have a sidebar column
    expect(layout).toHaveAttribute('data-breakpoint', 'mobile');
  });

  it('InputBar renders below narrative on mobile', () => {
    render(<GameLayout {...defaultProps} />);
    expect(screen.getByTestId('input-bar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Mobile PartyPanel accessible as overlay
// ---------------------------------------------------------------------------

describe('GameLayout — AC-4: Mobile PartyPanel overlay', () => {
  beforeEach(() => {
    mockMatchMedia(375);
  });

  it('pressing P key opens PartyPanel as overlay on mobile', async () => {
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    // Before pressing P, party panel should not be visible
    expect(screen.queryByTestId('party-panel')).not.toBeVisible();

    // Press P to open overlay
    await user.keyboard('p');

    // Party panel should now be visible as overlay
    const panel = screen.getByTestId('party-panel');
    expect(panel).toBeVisible();
  });

  it('mobile overlay renders full-screen', async () => {
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    await user.keyboard('p');

    // Overlay backdrop should be present
    const overlay = screen.getByTestId('party-overlay');
    expect(overlay).toBeInTheDocument();
  });

  it('pressing P again closes the overlay', async () => {
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    await user.keyboard('p');
    expect(screen.getByTestId('party-panel')).toBeVisible();

    await user.keyboard('p');
    expect(screen.queryByTestId('party-panel')).not.toBeVisible();
  });

  it('pressing Escape closes the overlay', async () => {
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    await user.keyboard('p');
    expect(screen.getByTestId('party-panel')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('party-panel')).not.toBeVisible();
  });

  it('overlay shows full party data (not just icons)', async () => {
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    await user.keyboard('p');

    // Full party data should be visible, not collapsed icon strip
    const panel = screen.getByTestId('party-panel');
    expect(panel).not.toHaveAttribute('data-collapsed', 'true');
    expect(within(panel).getByText('Kael')).toBeVisible();
    expect(within(panel).getByText('Lyra Dawnforge')).toBeVisible();
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
// Keyboard shortcut safety — P key in input fields
// ---------------------------------------------------------------------------

describe('GameLayout — keyboard safety', () => {
  it('P key does not toggle overlay when typing in InputBar', async () => {
    mockMatchMedia(375);
    const user = userEvent.setup();
    render(<GameLayout {...defaultProps} />);

    const input = screen.getByTestId('input-bar').querySelector('input')!;
    await user.click(input);
    await user.type(input, 'p');

    // Panel should NOT open when typing in input
    expect(screen.queryByTestId('party-overlay')).not.toBeInTheDocument();
  });
});
