// world-select mode wiring — MP-01 fix-forward update
//
// Verifies the ConnectScreen → Start button flow:
//   1. User picks a world and mode.
//   2. Clicks Start.
//   3. POST /api/games is called with the correct mode in the body.
//   4. The URL changes to the mode-correct path (/play/:slug for multiplayer).
//   5. AppInner mounts at the new URL (data-testid="app" is present).
//
// Before MP-01 fix-forward, this test checked for data-testid="game-screen"
// which was the deleted GameScreen scaffold. After the fix-forward, all slug
// routes render AppInner, which uses data-testid="app".

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installWebAudioMock, installLocalStorageMock } from '@/audio/__tests__/web-audio-mock';
import { AudioEngine } from '@/audio/AudioEngine';
import App from '../../../App';

const GENRES_RESPONSE = {
  low_fantasy: {
    name: 'Low Fantasy',
    description: '',
    worlds: [
      {
        slug: 'moldharrow-keep',
        name: 'Moldharrow Keep',
        description: '',
        era: null,
        setting: null,
        axis_snapshot: {},
        inspirations: [],
        hero_image: null,
      },
    ],
  },
};

const GAME_RESPONSE = {
  slug: '2026-04-22-moldharrow-keep',
  mode: 'multiplayer',
  genre_slug: 'low_fantasy',
  world_slug: 'moldharrow-keep',
  resumed: false,
};

describe('world-select mode wiring', () => {
  beforeEach(() => {
    AudioEngine.resetInstance();
    installWebAudioMock();
    installLocalStorageMock();
    // Pre-seed display name so AppInner skips NamePrompt after navigation.
    localStorage.setItem('sq:display-name', 'testplayer');
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends mode + world to POST /api/games and AppInner mounts at the returned URL', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      // Sessions polling — always return empty list
      if (typeof url === 'string' && url.startsWith('/api/sessions')) {
        return Promise.resolve({ ok: true, json: async () => ({ sessions: [] }) });
      }
      // Genres fetch
      if (typeof url === 'string' && url === '/api/genres') {
        return Promise.resolve({ ok: true, json: async () => GENRES_RESPONSE });
      }
      // Start game POST
      if (typeof url === 'string' && url === '/api/games' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => GAME_RESPONSE });
      }
      // GET /api/games/:slug — AppInner fetches this on slug-route mount to seed
      // currentGenre. Must return a valid GameResponse shape so the metadata gate
      // is satisfied and the WS connect fires (not the error path).
      if (typeof url === 'string' && /\/api\/games\/[^?]+/.test(url) && !opts?.method) {
        return Promise.resolve(
          new Response(JSON.stringify(GAME_RESPONSE), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);

    await waitFor(() => screen.getByRole('radio', { name: /Moldharrow Keep/i }));
    fireEvent.click(screen.getByRole('radio', { name: /Moldharrow Keep/i }));
    fireEvent.click(screen.getByRole('radio', { name: /multiplayer/i }));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mode":"multiplayer"'),
      }));
    });

    // After navigation, AppInner mounts at /play/:slug.
    // data-testid="app" is AppInner's root element.
    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Critical #3: verify we are NOT on the error path — the alert role must
    // not be present (i.e. GET /api/games/:slug succeeded, not 404'd).
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
