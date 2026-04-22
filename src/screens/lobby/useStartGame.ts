import { useCallback } from 'react';

export type StartGameInput = {
  genreSlug: string;
  worldSlug: string;
  mode: 'solo' | 'multiplayer';
};

export function useStartGame() {
  const start = useCallback(async (input: StartGameInput): Promise<string> => {
    const resp = await fetch('/api/games', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        genre_slug: input.genreSlug,
        world_slug: input.worldSlug,
        mode: input.mode,
      }),
    });
    if (!resp.ok) throw new Error(`start game failed: ${resp.status}`);
    const body = await resp.json();
    const prefix = body.mode === 'solo' ? '/solo' : '/play';
    return `${prefix}/${body.slug}`;
  }, []);
  return { start };
}
