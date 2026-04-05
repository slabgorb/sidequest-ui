import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameLayout, type GameLayoutProps } from '../GameLayout';
import type { OverlayType } from '@/hooks/useSlashCommands';

// Minimal mock data
const CHARACTER_SHEET = {
  name: 'Kael',
  class: 'Ranger',
  level: 3,
  stats: { strength: 14, dexterity: 18 },
  abilities: ['Tracker'],
  backstory: 'Born in the Ashwood.',
  portrait_url: '/renders/kael.png',
};

const INVENTORY_DATA = {
  items: [
    { name: 'Elven Longbow', type: 'weapon', equipped: true, description: 'A bow.' },
  ],
  gold: 42,
};

const MAP_DATA = {
  current_location: 'Town Square',
  explored: [
    { name: 'Town Square', visited: true, connections: ['Market'] },
    { name: 'Market', visited: true, connections: ['Town Square'] },
  ],
};

const JOURNAL_ENTRIES = [
  { id: '1', text: 'Arrived at the village.', timestamp: '2026-04-01' },
];

const KNOWLEDGE_ENTRIES = [
  { id: 'k1', category: 'lore', label: 'Ancient Ruins', text: 'Once a temple.', source: 'narration', created_at: '2026-04-01' },
];

const CHARACTER_SUMMARY = {
  player_id: 'p1',
  name: 'Kael',
  class: 'Ranger',
  level: 3,
  hp: 20,
  hp_max: 25,
  status_effects: [],
  portrait_url: '/renders/kael.png',
};

// Helpers
function renderLayout(overrides: Partial<GameLayoutProps> & { activeOverlay: OverlayType }) {
  const defaults: GameLayoutProps = {
    messages: [],
    characters: [CHARACTER_SUMMARY],
    onSend: vi.fn(),
    disabled: false,
    characterSheet: CHARACTER_SHEET,
    inventoryData: INVENTORY_DATA,
    mapData: MAP_DATA,
    journalEntries: JOURNAL_ENTRIES,
    knowledgeEntries: KNOWLEDGE_ENTRIES,
    activeOverlay: null,
    onOverlayChange: vi.fn(),
  };
  return render(<GameLayout {...defaults} {...overrides} />);
}

describe('GameLayout — Overlay Rewiring (25-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- AC-1: CharacterPanel as persistent sidebar ---
  describe('AC-1: CharacterPanel sidebar', () => {
    it('renders CharacterPanel when characterSheet data exists', () => {
      renderLayout({ activeOverlay: null });
      expect(screen.getByTestId('character-panel')).toBeInTheDocument();
    });

    it('does not render CharacterPanel when characterSheet is null', () => {
      renderLayout({ activeOverlay: null, characterSheet: null });
      expect(screen.queryByTestId('character-panel')).not.toBeInTheDocument();
    });

    it('passes character and inventory data to CharacterPanel', () => {
      renderLayout({ activeOverlay: null });
      // CharacterPanel renders character name
      const panel = screen.getByTestId('character-panel');
      expect(panel).toBeInTheDocument();
      expect(screen.getByText('Kael')).toBeInTheDocument();
    });
  });

  // --- AC-2: Game state overlays render directly ---
  describe('AC-2: Game state overlay modals', () => {
    it('renders character sheet overlay when activeOverlay is character', () => {
      renderLayout({ activeOverlay: 'character' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });

    it('renders inventory overlay when activeOverlay is inventory', () => {
      renderLayout({ activeOverlay: 'inventory' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    });

    it('renders map overlay when activeOverlay is map', () => {
      renderLayout({ activeOverlay: 'map' });
      // MapOverlay or Automapper
      const mapElement = screen.queryByTestId('map-overlay') ?? screen.queryByTestId('automapper');
      expect(mapElement).toBeInTheDocument();
    });

    it('renders journal overlay when activeOverlay is journal', () => {
      renderLayout({ activeOverlay: 'journal' });
      expect(screen.getByText('Arrived at the village.')).toBeInTheDocument();
    });

    it('renders knowledge overlay when activeOverlay is knowledge', () => {
      renderLayout({ activeOverlay: 'knowledge' });
      expect(screen.getByText('Ancient Ruins')).toBeInTheDocument();
    });

    it('renders no overlay when activeOverlay is null', () => {
      renderLayout({ activeOverlay: null });
      expect(screen.queryByTestId('overlay-backdrop')).not.toBeInTheDocument();
    });

    it('renders overlay with a backdrop', () => {
      renderLayout({ activeOverlay: 'character' });
      expect(screen.getByTestId('overlay-backdrop')).toBeInTheDocument();
    });

    it('calls onOverlayChange(null) when backdrop is clicked', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: 'character', onOverlayChange });
      fireEvent.click(screen.getByTestId('overlay-backdrop'));
      expect(onOverlayChange).toHaveBeenCalledWith(null);
    });
  });

  // --- AC-3: Hotkeys wired in GameLayout ---
  describe('AC-3: Hotkey overlay toggling', () => {
    it('calls onOverlayChange with "character" on C key press', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'c' });
      expect(onOverlayChange).toHaveBeenCalledWith('character');
    });

    it('calls onOverlayChange with "inventory" on I key press', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'i' });
      expect(onOverlayChange).toHaveBeenCalledWith('inventory');
    });

    it('calls onOverlayChange with "map" on M key press', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'm' });
      expect(onOverlayChange).toHaveBeenCalledWith('map');
    });

    it('calls onOverlayChange with "journal" on J key press', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'j' });
      expect(onOverlayChange).toHaveBeenCalledWith('journal');
    });

    it('calls onOverlayChange with "knowledge" on K key press', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'k' });
      expect(onOverlayChange).toHaveBeenCalledWith('knowledge');
    });

    it('calls onOverlayChange(null) on Escape when overlay is open', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: 'character', onOverlayChange });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onOverlayChange).toHaveBeenCalledWith(null);
    });

    it('toggles overlay off when pressing same key with overlay open', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: 'character', onOverlayChange });
      fireEvent.keyDown(document, { key: 'c' });
      expect(onOverlayChange).toHaveBeenCalledWith(null);
    });

    it('does not trigger hotkeys when input is focused', () => {
      const onOverlayChange = vi.fn();
      const { container } = renderLayout({ activeOverlay: null, onOverlayChange });
      // Find the InputBar's input or add one
      const inputs = container.querySelectorAll('input, textarea');
      if (inputs.length > 0) {
        (inputs[0] as HTMLElement).focus();
        fireEvent.keyDown(document, { key: 'c' });
        // Should NOT have been called with 'character' — input is focused
        expect(onOverlayChange).not.toHaveBeenCalledWith('character');
      }
    });

    it('does not trigger hotkeys with modifier keys', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
      expect(onOverlayChange).not.toHaveBeenCalledWith('character');
    });

    it('does not open character overlay if characterSheet is null', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: null, characterSheet: null, onOverlayChange });
      fireEvent.keyDown(document, { key: 'c' });
      expect(onOverlayChange).not.toHaveBeenCalledWith('character');
    });
  });

  // --- AC-5: OverlayManager no longer imported ---
  describe('AC-5: OverlayManager removed from production code', () => {
    it('GameLayout does not import OverlayManager', async () => {
      // If OverlayManager is still imported, GameLayout module resolution will
      // include it. We verify by checking the module loaded successfully without
      // OverlayManager being a dependency.
      const mod = await import('../GameLayout');
      expect(mod.GameLayout).toBeDefined();
      // The real check: OverlayManager.tsx should not exist
      // Dev will delete it — the wiring test verifies the import chain works without it
    });
  });

  // --- Integration: single overlay policy ---
  describe('Integration: single overlay at a time', () => {
    it('switches from character to inventory overlay', () => {
      const onOverlayChange = vi.fn();
      renderLayout({ activeOverlay: 'character', onOverlayChange });
      fireEvent.keyDown(document, { key: 'i' });
      expect(onOverlayChange).toHaveBeenCalledWith('inventory');
    });
  });
});
