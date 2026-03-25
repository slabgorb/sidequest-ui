import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OverlayManager } from '../OverlayManager';
import { MessageType, type GameMessage } from '@/types/protocol';

// Mock data that would come from WebSocket messages
const CHARACTER_DATA = {
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
    { name: 'Healing Potion', type: 'consumable', quantity: 3, description: 'Heals.' },
  ],
  gold: 42,
};

function renderWithOverlay(
  characterData: typeof CHARACTER_DATA | null = CHARACTER_DATA,
  inventoryData: typeof INVENTORY_DATA | null = INVENTORY_DATA,
) {
  return render(
    <OverlayManager characterData={characterData} inventoryData={inventoryData}>
      <div data-testid="game-content">Game content here</div>
    </OverlayManager>,
  );
}

describe('OverlayManager', () => {
  // --- AC-1: Character sheet opens on 'C' key ---
  describe('AC-1: Character sheet toggle', () => {
    it('opens character sheet when C key is pressed', async () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });

    it('displays character name in the overlay', async () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByText('Kael')).toBeInTheDocument();
    });

    it('closes character sheet when C is pressed again (toggle)', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('handles uppercase C key the same as lowercase', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'C' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });
  });

  // --- AC-2: Inventory opens on 'I' key ---
  describe('AC-2: Inventory toggle', () => {
    it('opens inventory when I key is pressed', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    });

    it('displays items in the overlay', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByText('Elven Longbow')).toBeInTheDocument();
    });

    it('closes inventory when I is pressed again (toggle)', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });

  // --- AC-3: Only one overlay at a time ---
  describe('AC-3: Single overlay policy', () => {
    it('closes character sheet when inventory is opened', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    });

    it('closes inventory when character sheet is opened', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });
  });

  // --- AC-4: Escape and backdrop close overlays ---
  describe('AC-4: Escape and backdrop dismiss', () => {
    it('closes character sheet on Escape', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('closes inventory on Escape', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('closes overlay when backdrop is clicked', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      const backdrop = screen.getByTestId('overlay-backdrop');
      fireEvent.click(backdrop);
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('does nothing when Escape is pressed with no overlay open', () => {
      renderWithOverlay();
      // Should not throw or cause errors
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });

  // --- AC-5: Shortcuts disabled during text input ---
  describe('AC-5: Input focus suppression', () => {
    it('does not open overlay when input element is focused', () => {
      render(
        <OverlayManager characterData={CHARACTER_DATA} inventoryData={INVENTORY_DATA}>
          <input data-testid="game-input" />
        </OverlayManager>,
      );

      const input = screen.getByTestId('game-input');
      input.focus();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('does not open overlay when textarea is focused', () => {
      render(
        <OverlayManager characterData={CHARACTER_DATA} inventoryData={INVENTORY_DATA}>
          <textarea data-testid="game-textarea" />
        </OverlayManager>,
      );

      const textarea = screen.getByTestId('game-textarea');
      textarea.focus();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('does not open overlay when contenteditable element is focused', () => {
      render(
        <OverlayManager characterData={CHARACTER_DATA} inventoryData={INVENTORY_DATA}>
          <div contentEditable data-testid="editable" />
        </OverlayManager>,
      );

      const editable = screen.getByTestId('editable');
      editable.focus();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });
  });

  // --- Edge cases ---
  describe('Edge cases', () => {
    it('renders children even when no overlay is active', () => {
      renderWithOverlay();
      expect(screen.getByTestId('game-content')).toBeInTheDocument();
    });

    it('children remain visible when overlay is open', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('game-content')).toBeInTheDocument();
    });

    it('handles null character data gracefully', () => {
      renderWithOverlay(null, INVENTORY_DATA);
      fireEvent.keyDown(document, { key: 'c' });
      // Should not crash; overlay should either not open or show empty state
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('handles null inventory data gracefully', () => {
      renderWithOverlay(CHARACTER_DATA, null);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('ignores modifier key combinations (Ctrl+C, Alt+I)', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i', altKey: true });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('ignores unrelated keys', () => {
      renderWithOverlay();
      fireEvent.keyDown(document, { key: 'a' });
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: ' ' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });
});
