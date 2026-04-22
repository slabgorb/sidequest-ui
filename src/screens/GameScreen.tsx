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
    <div data-testid="game-screen" data-mode={mode} data-slug={slug}>
      {!name ? (
        <NamePrompt setName={setName} />
      ) : (
        <>
          {offline && (
            <div data-testid="offline-banner">
              Narrator unreachable — showing cached state (read-only)
            </div>
          )}
          <PausedBanner paused={paused} waitingFor={waitingFor} />
          <ol data-testid="narration-log">
            {narrations.map((e) => (
              <li key={e.seq}>{(e.payload as any).text}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function NamePrompt({ setName }: { setName: (n: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) setName(v.trim());
      }}
    >
      <label>
        Your name: <input value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button type="submit">Join</button>
    </form>
  );
}
