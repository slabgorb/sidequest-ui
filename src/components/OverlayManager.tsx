import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { CharacterSheet, type CharacterSheetData } from './CharacterSheet';
import { InventoryPanel, type InventoryData } from './InventoryPanel';
import { MapOverlay, type MapState } from './MapOverlay';
import { Automapper, type ExploredRoom, type ExitInfo } from './Automapper';
import { JournalView, type JournalEntry } from './JournalView';
import { KnowledgeJournal } from './KnowledgeJournal';
import type { KnowledgeEntry } from '@/providers/GameStateProvider';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';

export type OverlayType = 'character' | 'inventory' | 'map' | 'journal' | 'knowledge' | 'settings' | null;

interface OverlayManagerProps {
  characterData: CharacterSheetData | null;
  inventoryData: InventoryData | null;
  mapData: MapState | null;
  journalEntries?: JournalEntry[];
  knowledgeEntries?: KnowledgeEntry[];
  settingsProps?: SettingsPanelProps;
  activeOverlay: OverlayType;
  onOverlayChange: (overlay: OverlayType) => void;
  children: ReactNode;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    return type !== 'radio' && type !== 'checkbox';
  }
  if (el.getAttribute('contenteditable') != null) return true;
  return false;
}

/** Bridge MapState → Automapper props when room graph data is present */
function useAutomapperData(mapData: MapState | null) {
  return useMemo(() => {
    if (!mapData) return null;
    // Room graph mode: at least one explored location has room_exits
    const hasRoomGraph = mapData.explored.some(
      (loc: Record<string, unknown>) => Array.isArray((loc as Record<string, unknown>).room_exits) && ((loc as Record<string, unknown>).room_exits as unknown[]).length > 0
    );
    if (!hasRoomGraph) return null;

    const rooms: ExploredRoom[] = mapData.explored.map((loc: Record<string, unknown>) => {
      const roomExits = ((loc as Record<string, unknown>).room_exits ?? []) as Array<{ target: string; exit_type: string }>;
      const exits: ExitInfo[] = roomExits.map((re) => ({
        direction: re.exit_type.includes("chute") ? "down" : "east", // direction from exit_type as fallback
        exit_type: re.exit_type.replace("_down", "").replace("_up", ""),
        to_room_id: re.target || undefined,
      }));
      return {
        id: (loc as Record<string, unknown>).name as string,
        name: (loc as Record<string, unknown>).name as string,
        room_type: ((loc as Record<string, unknown>).room_type as string) || "chamber",
        size: "medium",
        is_current: (loc as Record<string, unknown>).name === mapData.current_location,
        exits,
      };
    });

    return { rooms, currentRoomId: mapData.current_location };
  }, [mapData]);
}

export function OverlayManager({ characterData, inventoryData, mapData, journalEntries, knowledgeEntries, settingsProps, activeOverlay, onOverlayChange, children }: OverlayManagerProps) {
  const automapperData = useAutomapperData(mapData);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTextInput(document.activeElement)) return;

      const key = e.key.toLowerCase();

      if (key === 'escape') {
        onOverlayChange(null);
        return;
      }

      const toggle = (overlay: OverlayType) =>
        onOverlayChange(activeOverlay === overlay ? null : overlay);

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
        return;
      }

      if (key === 'k' && knowledgeEntries && knowledgeEntries.length > 0) {
        toggle('knowledge');
      }
    },
    [characterData, inventoryData, mapData, journalEntries, knowledgeEntries, activeOverlay, onOverlayChange],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const closeOverlay = useCallback(() => onOverlayChange(null), [onOverlayChange]);

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
              automapperData
                ? <Automapper rooms={automapperData.rooms} currentRoomId={automapperData.currentRoomId} />
                : <MapOverlay mapData={mapData} onClose={closeOverlay} />
            )}
            {activeOverlay === 'journal' && journalEntries && (
              <JournalView entries={journalEntries} />
            )}
            {activeOverlay === 'knowledge' && knowledgeEntries && (
              <KnowledgeJournal entries={knowledgeEntries} />
            )}
            {activeOverlay === 'settings' && settingsProps && (
              <SettingsPanel {...settingsProps} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
