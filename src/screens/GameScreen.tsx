import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDisplayName } from '../hooks/useDisplayName';
import { PausedBanner } from '../components/PausedBanner';

export function GameScreen({ mode }: { mode: 'solo' | 'multiplayer' }) {
  const { slug = '' } = useParams<{ slug: string }>();
  const { name, setName } = useDisplayName();
  const [paused, setPaused] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string[]>([]);

  useEffect(() => {
    if (!name || !slug) return;
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: 'SESSION_EVENT',
          player_id: name,
          payload: { event: 'connect', game_slug: slug },
        }),
      );
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data as string) as { type: string; payload: { waiting_for: string[] } };
      if (m.type === 'GAME_PAUSED') {
        setPaused(true);
        setWaitingFor(m.payload.waiting_for);
      }
      if (m.type === 'GAME_RESUMED') {
        setPaused(false);
        setWaitingFor([]);
      }
    };
    return () => ws.close();
  }, [name, slug]);

  return (
    <div data-testid="game-screen" data-mode={mode} data-slug={slug}>
      {!name ? (
        <NamePrompt setName={setName} />
      ) : (
        <>
          <PausedBanner paused={paused} waitingFor={waitingFor} />
          {/* rest of game UI */}
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
