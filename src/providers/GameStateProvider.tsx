import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface CharacterState {
  name: string;
  hp: number;
  max_hp: number;
  level?: number;
  class?: string;
  statuses: string[];
  inventory: string[];
}

export interface JournalEntry {
  type: 'handout';
  url: string;
  description: string;
  timestamp: number;
  render_id: string;
}

export interface ClientGameState {
  characters: CharacterState[];
  location: string;
  quests: Record<string, string>;
  journal?: JournalEntry[];
}

export interface GameStateContextValue {
  state: ClientGameState;
  setState: (state: ClientGameState) => void;
  localPlayerId: string;
  setLocalPlayerId: (id: string) => void;
}

export const EMPTY_GAME_STATE: ClientGameState = {
  characters: [],
  location: '',
  quests: {},
};

const GameStateContext = createContext<GameStateContextValue>({
  state: EMPTY_GAME_STATE,
  setState: () => {},
  localPlayerId: '',
  setLocalPlayerId: () => {},
});

export interface GameStateProviderProps {
  children: ReactNode;
}

const JOURNAL_STORAGE_KEY = 'sq_journal';
const GAME_STATE_STORAGE_KEY = 'sq_game_state';

function loadJournalFromStorage(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt localStorage
  }
  return [];
}

function saveJournalToStorage(journal: JournalEntry[]): void {
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // ignore quota errors
  }
}

function loadGameStateFromStorage(): ClientGameState | null {
  try {
    const raw = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClientGameState;
      if (parsed && typeof parsed.location === 'string') return parsed;
    }
  } catch {
    // ignore corrupt sessionStorage
  }
  return null;
}

function saveGameStateToStorage(state: ClientGameState): void {
  try {
    sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function GameStateProvider({ children }: GameStateProviderProps) {
  const [state, setStateRaw] = useState<ClientGameState>(() => {
    // Hydrate from sessionStorage first (HMR survival), then fall back to journal
    const saved = loadGameStateFromStorage();
    if (saved) return saved;
    const journal = loadJournalFromStorage();
    return journal.length > 0
      ? { ...EMPTY_GAME_STATE, journal }
      : EMPTY_GAME_STATE;
  });
  const setState = useCallback((s: ClientGameState) => setStateRaw(s), []);
  const [localPlayerId, setLocalPlayerId] = useState('');

  // Persist full game state to sessionStorage for HMR survival
  useEffect(() => {
    saveGameStateToStorage(state);
  }, [state]);

  // Persist journal to localStorage (survives full page reload)
  useEffect(() => {
    if (state.journal && state.journal.length > 0) {
      saveJournalToStorage(state.journal);
    }
  }, [state.journal]);

  return (
    <GameStateContext.Provider value={{ state, setState, localPlayerId, setLocalPlayerId }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameStateContextValue {
  return useContext(GameStateContext);
}
