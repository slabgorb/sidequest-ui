import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface CharacterState {
  name: string;
  hp: number;
  max_hp: number;
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
}

export const EMPTY_GAME_STATE: ClientGameState = {
  characters: [],
  location: '',
  quests: {},
};

const GameStateContext = createContext<GameStateContextValue>({
  state: EMPTY_GAME_STATE,
  setState: () => {},
});

export interface GameStateProviderProps {
  children: ReactNode;
}

const JOURNAL_STORAGE_KEY = 'sq_journal';

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

export function GameStateProvider({ children }: GameStateProviderProps) {
  const [state, setStateRaw] = useState<ClientGameState>(() => {
    const journal = loadJournalFromStorage();
    return journal.length > 0
      ? { ...EMPTY_GAME_STATE, journal }
      : EMPTY_GAME_STATE;
  });
  const setState = useCallback((s: ClientGameState) => setStateRaw(s), []);

  // Persist journal to localStorage whenever it changes
  useEffect(() => {
    if (state.journal && state.journal.length > 0) {
      saveJournalToStorage(state.journal);
    }
  }, [state.journal]);

  return (
    <GameStateContext.Provider value={{ state, setState }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameStateContextValue {
  return useContext(GameStateContext);
}
