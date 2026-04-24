import { useCallback } from 'react';

export type StartGameInput = {
  genreSlug: string;
  worldSlug: string;
  mode: 'solo' | 'multiplayer';
};

export type StartGameResult = {
  /** Pre-built navigation target (e.g. "/solo/2026-04-24-flickering_reach"). */
  url: string;
  /** Server-assigned game slug — needed by callers that record history. */
  slug: string;
  /** Game mode echoed back from the server. */
  mode: 'solo' | 'multiplayer';
};

export function useStartGame() {
  const start = useCallback(async (input: StartGameInput): Promise<StartGameResult> => {
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
    const mode: 'solo' | 'multiplayer' = body.mode === 'multiplayer' ? 'multiplayer' : 'solo';
    const prefix = mode === 'solo' ? '/solo' : '/play';
    return { url: `${prefix}/${body.slug}`, slug: body.slug, mode };
  }, []);
  return { start };
}
