import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { OverlayManager, type OverlayType } from '../OverlayManager';

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

/** Stateful wrapper that lifts overlay state the same way App.tsx does. */
function StatefulOverlayManager({
  characterData = CHARACTER_DATA,
  inventoryData = INVENTORY_DATA,
  children,
}: {
  characterData?: typeof CHARACTER_DATA | null;
  inventoryData?: typeof INVENTORY_DATA | null;
  children?: React.ReactNode;
}) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
  return (
    <OverlayManager
      characterData={characterData}
      inventoryData={inventoryData}
      mapData={null}
      activeOverlay={activeOverlay}
      onOverlayChange={setActiveOverlay}
    >
      {children ?? <div data-testid="game-content">Game content here</div>}
    </OverlayManager>
  );
}

describe('OverlayManager', () => {
  // --- AC-1: Character sheet opens on 'C' key ---
  describe('AC-1: Character sheet toggle', () => {
    it('opens character sheet when C key is pressed', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });

    it('displays character name in the overlay', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByText('Kael')).toBeInTheDocument();
    });

    it('closes character sheet when C is pressed again (toggle)', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('handles uppercase C key the same as lowercase', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'C' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
    });
  });

  // --- AC-2: Inventory opens on 'I' key ---
  describe('AC-2: Inventory toggle', () => {
    it('opens inventory when I key is pressed', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    });

    it('displays items in the overlay', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByText('Elven Longbow')).toBeInTheDocument();
    });

    it('closes inventory when I is pressed again (toggle)', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });

  // --- AC-3: Only one overlay at a time ---
  describe('AC-3: Single overlay policy', () => {
    it('closes character sheet when inventory is opened', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    });

    it('closes inventory when character sheet is opened', () => {
      render(<StatefulOverlayManager />);
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
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('closes inventory on Escape', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('closes overlay when backdrop is clicked', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();

      const backdrop = screen.getByTestId('overlay-backdrop');
      fireEvent.click(backdrop);
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('does nothing when Escape is pressed with no overlay open', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });

  // --- AC-5: Shortcuts disabled during text input ---
  describe('AC-5: Input focus suppression', () => {
    it('does not open overlay when input element is focused', () => {
      render(
        <StatefulOverlayManager>
          <input data-testid="game-input" />
        </StatefulOverlayManager>,
      );

      const input = screen.getByTestId('game-input');
      input.focus();

      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('does not open overlay when textarea is focused', () => {
      render(
        <StatefulOverlayManager>
          <textarea data-testid="game-textarea" />
        </StatefulOverlayManager>,
      );

      const textarea = screen.getByTestId('game-textarea');
      textarea.focus();

      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('does not open overlay when contenteditable element is focused', () => {
      render(
        <StatefulOverlayManager>
          <div contentEditable data-testid="editable" />
        </StatefulOverlayManager>,
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
      render(<StatefulOverlayManager />);
      expect(screen.getByTestId('game-content')).toBeInTheDocument();
    });

    it('children remain visible when overlay is open', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.getByTestId('game-content')).toBeInTheDocument();
    });

    it('handles null character data gracefully', () => {
      render(<StatefulOverlayManager characterData={null} />);
      fireEvent.keyDown(document, { key: 'c' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
    });

    it('handles null inventory data gracefully', () => {
      render(<StatefulOverlayManager inventoryData={null} />);
      fireEvent.keyDown(document, { key: 'i' });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('ignores modifier key combinations (Ctrl+C, Alt+I)', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'i', altKey: true });
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });

    it('ignores unrelated keys', () => {
      render(<StatefulOverlayManager />);
      fireEvent.keyDown(document, { key: 'a' });
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: ' ' });
      expect(screen.queryByTestId('character-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument();
    });
  });
});
