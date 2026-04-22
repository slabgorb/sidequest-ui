import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDisplayName } from '../hooks/useDisplayName';
import { useEventStream } from '../hooks/useEventStream';
import { PausedBanner } from '../components/PausedBanner';

export function GameScreen({ mode }: { mode: 'solo' | 'multiplayer' }) {
  const { slug = '' } = useParams<{ slug: string }>();
  const { name, setName } = useDisplayName();
  const [paused, setPaused] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string[]>([]);

  const handleMessage = useCallback((m: { type: string; payload?: { waiting_for?: string[] } }) => {
    if (m.type === 'GAME_PAUSED') {
      setPaused(true);
      setWaitingFor(m.payload?.waiting_for ?? []);
    }
    if (m.type === 'GAME_RESUMED') {
      setPaused(false);
      setWaitingFor([]);
    }
  }, []);

  const { events, offline } = useEventStream({
    wsUrl: `ws://${location.host}/ws`,
    slug,
    playerId: name ?? '',
    onMessage: handleMessage,
  });

  const narrations = events.filter((e) => e.kind === 'NARRATION');

  return (
    <div
      data-testid="game-screen"
      data-mode={mode}
      data-slug={slug}
      className="flex flex-col min-h-screen px-6 py-8 max-w-4xl mx-auto w-full"
    >
      {!name ? (
        <NamePrompt slug={slug} mode={mode} setName={setName} />
      ) : (
        <>
          {offline && (
            <div
              data-testid="offline-banner"
              className="mb-4 rounded border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
            >
              Narrator unreachable — showing cached state (read-only)
            </div>
          )}
          <PausedBanner paused={paused} waitingFor={waitingFor} />
          <ol data-testid="narration-log" className="space-y-4 mt-4">
            {narrations.map((e) => (
              <li key={e.seq} className="leading-relaxed text-base">
                {(e.payload as any).text}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function NamePrompt({
  slug,
  mode,
  setName,
}: {
  slug: string;
  mode: 'solo' | 'multiplayer';
  setName: (n: string) => void;
}) {
  const [v, setV] = useState('');
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] gap-8">
      <header className="text-center">
        <div
          aria-hidden="true"
          className="text-muted-foreground/30 text-sm tracking-[0.5em] mb-4"
        >
          ── ◇ ──
        </div>
        <h1 className="text-2xl font-semibold tracking-wide">
          {mode === 'solo' ? 'Solo session' : 'Multiplayer session'}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {slug}
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) setName(v.trim());
        }}
        className="flex flex-col items-center gap-4 w-full max-w-sm"
      >
        <label className="flex flex-col gap-2 w-full text-center">
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Your name
          </span>
          <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            className="w-full rounded border border-border bg-background px-4 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </label>
        <button
          type="submit"
          disabled={!v.trim()}
          className="rounded bg-primary px-6 py-2 text-primary-foreground text-sm tracking-wide uppercase disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </div>
  );
}
