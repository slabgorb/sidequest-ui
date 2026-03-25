import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CharacterSheet, type CharacterSheetData } from './CharacterSheet';
import { InventoryPanel, type InventoryData } from './InventoryPanel';
import { MapOverlay, type MapState } from './MapOverlay';
import { JournalView, type JournalEntry } from './JournalView';

type OverlayType = 'character' | 'inventory' | 'map' | 'journal' | null;

export interface OverlayManagerProps {
  characterData: CharacterSheetData | null;
  inventoryData: InventoryData | null;
  mapData: MapState | null;
  journalEntries?: JournalEntry[];
  children: ReactNode;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.getAttribute('contenteditable') != null) return true;
  return false;
}

export function OverlayManager({ characterData, inventoryData, mapData, journalEntries, children }: OverlayManagerProps) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTextInput(document.activeElement)) return;

      const key = e.key.toLowerCase();

      if (key === 'escape') {
        setActiveOverlay(null);
        return;
      }

      const toggle = (overlay: OverlayType) =>
        setActiveOverlay((prev) => (prev === overlay ? null : overlay));

      if (key === 'c' && characterData) {
        toggle('character');
        return;
      }

      if (key === 'i' && inventoryData) {
        toggle('inventory');
        return;
      }

      if (key === 'm' && mapData) {
        toggle('map');
        return;
      }

      if (key === 'j' && journalEntries && journalEntries.length > 0) {
        toggle('journal');
      }
    },
    [characterData, inventoryData, mapData, journalEntries],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const closeOverlay = useCallback(() => setActiveOverlay(null), []);

  return (
    <>
      {children}
      {activeOverlay && (
        <div
          data-testid="overlay-backdrop"
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
          onClick={closeOverlay}
        >
          <div
            className="bg-background border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {activeOverlay === 'character' && characterData && (
              <CharacterSheet data={characterData} />
            )}
            {activeOverlay === 'inventory' && inventoryData && (
              <InventoryPanel data={inventoryData} />
            )}
            {activeOverlay === 'map' && mapData && (
              <MapOverlay mapData={mapData} onClose={closeOverlay} />
            )}
            {activeOverlay === 'journal' && journalEntries && (
              <JournalView entries={journalEntries} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
