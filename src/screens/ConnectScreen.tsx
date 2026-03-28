import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/audio/AudioEngine";

export interface ConnectScreenProps {
  onConnect: (playerName: string, genre: string, world: string) => void;
  genres: string[];
  isConnecting?: boolean;
  error?: string | null;
  genreError?: boolean;
  onRetryGenres?: () => void;
}

const STORAGE_KEY = "sidequest-connect";

interface SavedConnectState {
  playerName?: string;
  genre?: string;
  world?: string;
}

function loadSavedState(): SavedConnectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedConnectState;
  } catch {
    return {};
  }
}

function saveState(playerName: string, genre: string, world: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerName, genre, world }));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

export function ConnectScreen({
  onConnect,
  genres,
  isConnecting = false,
  error,
  genreError = false,
  onRetryGenres,
}: ConnectScreenProps) {
  const [saved] = useState(loadSavedState);
  const isInitialMount = useRef(true);
  const [playerName, setPlayerName] = useState(saved.playerName ?? "");
  const [genre, setGenre] = useState(saved.genre ?? "");
  const [world, setWorld] = useState(saved.world ?? "");
  const [worlds, setWorlds] = useState<string[]>([]);
  const [loadingWorlds, setLoadingWorlds] = useState(false);

  const fetchWorlds = useCallback(async (genreName: string, preferredWorld?: string) => {
    if (!genreName) {
      setWorlds([]);
      setWorld("");
      return;
    }
    setLoadingWorlds(true);
    try {
      const res = await fetch("/api/genres");
      const data = await res.json();
      const genreData = data[genreName];
      const worldList: string[] = genreData?.worlds ?? [];
      setWorlds(worldList);
      if (preferredWorld && worldList.includes(preferredWorld)) {
        setWorld(preferredWorld);
      } else if (worldList.length === 1) {
        setWorld(worldList[0]);
      } else {
        setWorld("");
      }
    } catch {
      setWorlds([]);
      setWorld("");
    } finally {
      setLoadingWorlds(false);
    }
  }, []);

  useEffect(() => {
    const preferred = isInitialMount.current ? saved.world : undefined;
    isInitialMount.current = false;
    fetchWorlds(genre, preferred);
  }, [genre, fetchWorlds, saved.world]);

  const canSubmit = playerName.trim() !== "" && genre !== "" && world !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Unlock AudioContext on this user gesture — browsers require a
    // click/tap before audio can play.
    try {
      await AudioEngine.getInstance().ensureResumed();
    } catch {
      // Audio unlock is best-effort; never block game entry.
    }

    saveState(playerName, genre, world);
    onConnect(playerName, genre, world);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      {/* Opening ornament */}
      <span className="text-muted-foreground/30 text-sm tracking-[0.5em] mb-12">
        ── ◇ ──
      </span>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Name prompt */}
        <div className="text-center w-full">
          <p className="text-base italic text-muted-foreground/60 mb-3">
            What name shall be yours?
          </p>
          <input
            id="player-name"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-transparent border-0 border-b border-muted-foreground/20
                       text-center text-lg text-foreground/90
                       focus:outline-none focus:border-muted-foreground/50
                       placeholder:text-muted-foreground/20"
            placeholder="…"
            disabled={isConnecting}
            aria-label="Player name"
          />
        </div>

        {/* Genre + World prompts */}
        <div className="text-center w-full">
          <p className="text-base italic text-muted-foreground/60 mb-3">
            In which world do you seek passage?
          </p>
          <div className="relative w-full mb-4">
          <select
            id="genre-select"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full bg-transparent border-0 border-b border-muted-foreground/20
                       text-center text-base text-foreground/90 appearance-none
                       focus:outline-none focus:border-muted-foreground/50
                       hover:border-muted-foreground/40
                       cursor-pointer pr-6"
            disabled={isConnecting}
            aria-label="Genre"
          >
            <option value="">…</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
            ))}
          </select>
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none text-xs">▾</span>
          </div>

          {genre && !loadingWorlds && worlds.length > 0 && (
            <div className="relative w-full">
            <select
              id="world-select"
              value={world}
              onChange={(e) => setWorld(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-muted-foreground/20
                         text-center text-base text-foreground/90 appearance-none
                         focus:outline-none focus:border-muted-foreground/50
                         hover:border-muted-foreground/40
                         cursor-pointer pr-6"
              disabled={isConnecting}
              aria-label="World"
            >
              {worlds.length > 1 && <option value="">…</option>}
              {worlds.map((w) => (
                <option key={w} value={w}>{w.replace(/_/g, " ")}</option>
              ))}
            </select>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none text-xs">▾</span>
            </div>
          )}

          {genre && loadingWorlds && (
            <p className="text-sm italic text-muted-foreground/40 animate-pulse">
              Discovering worlds…
            </p>
          )}

          {genreError && (
            <div className="text-center mt-2">
              <p className="text-sm italic text-destructive/70 mb-2">
                Could not load worlds. Is the server running?
              </p>
              {onRetryGenres && (
                <button
                  type="button"
                  onClick={onRetryGenres}
                  className="text-sm italic text-foreground/60 hover:text-foreground
                             transition-colors bg-transparent border-0 cursor-pointer underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p role="alert" className="text-sm italic text-destructive/70">
            {error}
          </p>
        )}

        {/* Connecting state */}
        {isConnecting && (
          <p role="status" className="text-sm italic text-muted-foreground/50 animate-pulse">
            The pages are turning…
          </p>
        )}

        {/* Closing ornament + submit */}
        <div className="flex flex-col items-center gap-4 mt-4">
          <span className="text-muted-foreground/30 text-sm tracking-[0.5em]">
            ── ◇ ──
          </span>
          <button
            type="submit"
            disabled={!canSubmit || isConnecting}
            className="text-base italic text-foreground/70 hover:text-foreground
                       disabled:text-muted-foreground/30 disabled:cursor-default
                       transition-all bg-transparent border border-muted-foreground/20
                       hover:border-muted-foreground/50 rounded px-8 py-2 cursor-pointer"
          >
            Begin
          </button>
        </div>
      </form>
    </div>
  );
}
