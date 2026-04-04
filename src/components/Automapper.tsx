// Automapper — Story 19-8: Room graph renderer for dungeon crawl UI
// This is a minimal type-only stub so tests can import and fail on assertions.
// Dev (Inigo Montoya) implements the real component.

export interface ExitInfo {
  direction: string;
  exit_type: string; // "door" | "corridor" | "stairs" | "chute"
  to_room_id?: string;
}

export interface ExploredRoom {
  id: string;
  name: string;
  room_type: string; // "chamber" | "corridor" | "stairs" | "chute"
  size: string; // "small" | "medium" | "large"
  is_current: boolean;
  exits: ExitInfo[];
}

export interface ThemeConfig {
  colors: {
    accent: string;
    primary: string;
    secondary: string;
    background: string;
  };
}

export interface AutomapperProps {
  rooms: ExploredRoom[];
  currentRoomId: string;
  theme?: ThemeConfig;
}

export function Automapper(_props: AutomapperProps) {
  // NOT IMPLEMENTED — tests should fail on assertions, not imports
  return null;
}
