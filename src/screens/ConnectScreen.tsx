import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine } from "@/audio/AudioEngine";
import type { GenresResponse, GenreMeta, WorldMeta } from "@/types/genres";
import { OptionList, type OptionItem } from "./lobby/OptionList";
import { WorldPreview } from "./lobby/WorldPreview";

export interface ConnectScreenProps {
  onConnect: (playerName: string, genre: string, world: string) => void;
  /**
   * Full genres response from `/api/genres`. Keyed by genre slug, each
   * value carries the pack's display name, description, and full world
   * metadata for the picker preview panel. Empty object = loading or
   * failed fetch.
   */
  genres: GenresResponse;
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ playerName, genre, world }),
    );
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

/** Build a pretty label from a slug, replacing underscores with spaces. */
function prettify(slug: string): string {
  return slug.replace(/_/g, " ");
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
  const [genreSlug, setGenreSlug] = useState<string | null>(
    saved.genre ?? null,
  );
  const [worldSlug, setWorldSlug] = useState<string | null>(
    saved.world ?? null,
  );

  // Sorted list of genre slugs for stable rendering.
  const genreItems: OptionItem[] = useMemo(
    () =>
      Object.entries(genres)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([slug, meta]) => ({
          slug,
          label: meta.name || prettify(slug),
        })),
    [genres],
  );

  const currentPack: GenreMeta | null =
    genreSlug && genres[genreSlug] ? genres[genreSlug] : null;

  // World list derived from the selected genre.
  const worldItems: OptionItem[] = useMemo(() => {
    if (!currentPack) return [];
    return currentPack.worlds.map((w) => ({
      slug: w.slug,
      label: w.name || prettify(w.slug),
    }));
  }, [currentPack]);

  const currentWorld: WorldMeta | null = useMemo(() => {
    if (!currentPack || !worldSlug) return null;
    return currentPack.worlds.find((w) => w.slug === worldSlug) ?? null;
  }, [currentPack, worldSlug]);

  // When the genre changes, pick a sensible default world:
  //   1. Respect the saved world if it's valid in this genre (initial mount only).
  //   2. Otherwise, if there's exactly one world, auto-select it.
  //   3. Otherwise, clear the selection — the player must pick.
  useEffect(() => {
    if (!currentPack) {
      setWorldSlug(null);
      return;
    }
    const available = currentPack.worlds.map((w) => w.slug);

    if (
      isInitialMount.current &&
      saved.world &&
      available.includes(saved.world)
    ) {
      setWorldSlug(saved.world);
    } else if (available.length === 1) {
      setWorldSlug(available[0]);
    } else if (worldSlug && !available.includes(worldSlug)) {
      setWorldSlug(null);
    }
    isInitialMount.current = false;
    // We intentionally don't depend on `worldSlug` here — re-running this
    // effect on every world change would fight the user's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPack, saved.world]);

  const canSubmit =
    playerName.trim() !== "" && genreSlug !== null && worldSlug !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !genreSlug || !worldSlug) return;

    // Unlock AudioContext on this user gesture — browsers require a
    // click/tap before audio can play.
    try {
      await AudioEngine.getInstance().ensureResumed();
    } catch {
      // Audio unlock is best-effort; never block game entry.
    }

    saveState(playerName, genreSlug, worldSlug);
    onConnect(playerName, genreSlug, worldSlug);
  };

  const showGenreError = genreError || Object.keys(genres).length === 0;

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-12">
      {/* Opening ornament */}
      <span
        aria-hidden="true"
        className="text-muted-foreground/30 text-sm tracking-[0.5em] mb-10"
      >
        ── ◇ ──
      </span>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-8 w-full max-w-4xl"
      >
        {/* Name prompt */}
        <div className="text-center w-full max-w-sm">
          <label
            htmlFor="player-name"
            className="block text-base italic text-muted-foreground/60 mb-3"
          >
            What name shall be yours?
          </label>
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
          />
        </div>

        {/* Genre + World + Preview — two-column on md+, single-column below. */}
        {showGenreError ? (
          <div className="text-center w-full max-w-sm">
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
        ) : (
          <div className="flex flex-col md:flex-row gap-8 w-full">
            {/* Left column — genre + world radio lists */}
            <div className="flex flex-col gap-6 md:w-64 shrink-0">
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-2">
                  Genre
                </h2>
                <OptionList
                  ariaLabel="Genre"
                  items={genreItems}
                  selected={genreSlug}
                  onSelect={setGenreSlug}
                  disabled={isConnecting}
                />
              </section>

              {currentPack && worldItems.length > 0 && (
                <section>
                  <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-2">
                    World
                  </h2>
                  <OptionList
                    ariaLabel="World"
                    items={worldItems}
                    selected={worldSlug}
                    onSelect={setWorldSlug}
                    disabled={isConnecting}
                  />
                </section>
              )}
            </div>

            {/* Right column — world preview */}
            <WorldPreview pack={currentPack} world={currentWorld} />
          </div>
        )}

        {/* Error */}
        {error && (
          <p role="alert" className="text-sm italic text-destructive/70">
            {error}
          </p>
        )}

        {/* Connecting state */}
        {isConnecting && (
          <p
            role="status"
            className="text-sm italic text-muted-foreground/50 animate-pulse"
          >
            The pages are turning…
          </p>
        )}

        {/* Closing ornament + submit */}
        <div className="flex flex-col items-center gap-4 mt-4">
          <span
            aria-hidden="true"
            className="text-muted-foreground/30 text-sm tracking-[0.5em]"
          >
            ── ◇ ──
          </span>
          <button
            type="submit"
            disabled={!canSubmit || isConnecting}
            title={
              !canSubmit
                ? "Enter your name and choose a genre and world"
                : undefined
            }
            className="text-base italic text-foreground/70 hover:text-foreground
                       disabled:text-muted-foreground/30 disabled:cursor-default
                       transition-all bg-transparent border border-muted-foreground/30
                       hover:border-muted-foreground/50 hover:bg-muted/20
                       focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:outline-none
                       rounded px-8 py-2.5 cursor-pointer tracking-wide"
          >
            Begin
          </button>
        </div>
      </form>
    </div>
  );
}
