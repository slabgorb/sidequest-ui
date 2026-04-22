import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStartGame } from '../useStartGame';

describe('useStartGame', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('POSTs to /api/games and returns the mode-prefixed URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        slug: '2026-04-22-moldharrow-keep',
        mode: 'multiplayer',
        genre_slug: 'low_fantasy',
        world_slug: 'moldharrow-keep',
        resumed: false,
      }),
    });
    const { result } = renderHook(() => useStartGame());
    const url = await result.current.start({
      genreSlug: 'low_fantasy',
      worldSlug: 'moldharrow-keep',
      mode: 'multiplayer',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({ method: 'POST' }));
    expect(url).toBe('/play/2026-04-22-moldharrow-keep');
  });

  it('uses /solo/:slug when mode is solo', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        slug: '2026-04-22-moldharrow-keep', mode: 'solo',
        genre_slug: 'low_fantasy', world_slug: 'moldharrow-keep', resumed: false,
      }),
    });
    const { result } = renderHook(() => useStartGame());
    const url = await result.current.start({
      genreSlug: 'low_fantasy', worldSlug: 'moldharrow-keep', mode: 'solo',
    });
    expect(url).toBe('/solo/2026-04-22-moldharrow-keep');
  });
});
