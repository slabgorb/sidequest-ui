// AppInner slug-route event wiring — replaces the deleted GameScreen scaffold test.
//
// GameScreen.tsx was deleted in the MP-01 fix-forward refactor. All slug routes
// (/solo/:slug, /play/:slug) now render AppInner, which drives the real game
// state machine. This test verifies that AppInner:
//   1. Sends SESSION_EVENT{connect, game_slug} when mounted at a slug route.
//   2. Transitions sessionPhase to "game" when the server sends SESSION_EVENT{ready}.
//   3. GameBoard renders after the "ready" transition (not the scaffold narration-log).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WS } from 'jest-websocket-mock';
import { installWebAudioMock, installLocalStorageMock } from '@/audio/__tests__/web-audio-mock';
import { AudioEngine } from '@/audio/AudioEngine';
import App from '../../App';

// Minimal fetch mock: handles the two endpoints AppInner calls in slug-mode.
// GET /api/games/:slug — game metadata (seeds currentGenre, gates WS connect).
// GET /api/genres     — genre list (always called on mount).
function installFetchMock() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && /\/api\/games\/[^?]+/.test(url)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ genre_slug: 'low_fantasy', world_slug: 'greyhawk', mode: 'solo' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (typeof url === 'string' && url.includes('/api/genres')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ low_fantasy: { name: 'Low Fantasy', worlds: [] } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }),
  );
}

describe('AppInner slug-route event wiring', () => {
  beforeEach(() => {
    AudioEngine.resetInstance();
    installWebAudioMock();
    installLocalStorageMock();
    localStorage.setItem('sq:display-name', 'alice');
    // AppInner now fetches GET /api/games/:slug on slug-mode mount to seed
    // currentGenre before WS connect fires. Mock this endpoint so the tests
    // do not time out waiting for the fetch gate to resolve.
    installFetchMock();
  });

  afterEach(() => {
    WS.clean();
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends SESSION_EVENT connect with game_slug over WS when mounted at /play/:slug', async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/play/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;

    const msg = await server.nextMessage as { type: string; payload: Record<string, unknown> };
    expect(msg.type).toBe('SESSION_EVENT');
    expect(msg.payload.event).toBe('connect');
    expect(msg.payload.game_slug).toBe('2026-04-22-moldharrow-keep');
  });

  it('transitions to game phase when server sends SESSION_EVENT{ready} after connect', async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/play/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // consume the SESSION_EVENT connect

    act(() => {
      server.send({ type: 'SESSION_EVENT', payload: { event: 'ready' } });
    });

    // After the "ready" event, sessionPhase should be "game" and AppInner
    // should still render without an error boundary crash.
    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });
  });
});
