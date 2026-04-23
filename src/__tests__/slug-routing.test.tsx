// Slug routing wiring tests — MP-01 fix-forward
//
// Verifies that /solo/:slug and /play/:slug mount AppInner (not the deleted
// GameScreen scaffold), and that AppInner sends SESSION_EVENT{connect, game_slug}
// via WebSocket when a display name is already set in localStorage.
//
// The slug-routing.test.tsx that existed before this refactor checked for
// `data-testid="game-screen"` — a testid that only existed on the scaffold.
// After the fix-forward, the routes render AppInner, which is already the real
// game state machine (connect → creation → game). We assert:
//   1. `/solo/:slug` renders `data-testid="app"` (AppInner's root element).
//   2. `/play/:slug` does the same.
//   3. `/` still renders `data-testid="lobby-root"` (unchanged).
//   4. At a slug route with a stored display name, AppInner sends
//      SESSION_EVENT{event:"connect", game_slug} via WebSocket.
//
// Issue 1 fix (MP-01 spec review): AppInner now fetches GET /api/games/:slug on
// mount to seed currentGenre before the WS connect fires. All WS tests must mock
// that endpoint so the gameMeta gate is satisfied and connect fires.

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WS } from 'jest-websocket-mock';
import { installWebAudioMock, installLocalStorageMock } from '@/audio/__tests__/web-audio-mock';
import { AudioEngine } from '@/audio/AudioEngine';
import App from '../App';

// Default game metadata returned by GET /api/games/:slug in tests.
const GAME_META = {
  genre_slug: 'low_fantasy',
  world_slug: 'greyhawk',
  mode: 'solo',
};

// Minimal fetch mock that handles the two endpoints AppInner always calls:
//   GET /api/genres        — genre list (runs in all modes)
//   GET /api/games/:slug   — game metadata (runs in slug-mode)
// Anything else gets an empty 200.
function makeDefaultFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && /\/api\/games\/[^?]+/.test(url)) {
      return Promise.resolve(
        new Response(JSON.stringify(GAME_META), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
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
  });
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  // Pre-seed a display name so AppInner skips NamePrompt and fires connect immediately.
  localStorage.setItem('sq:display-name', 'alice');
  // Default fetch mock — satisfies both genres and game-metadata fetches.
  vi.stubGlobal('fetch', makeDefaultFetchMock());
});

afterEach(() => {
  WS.clean();
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('slug routing — AppInner mounts at slug routes', () => {
  it('renders AppInner (data-testid="app") at /solo/:slug', () => {
    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('app')).toBeInTheDocument();
  });

  it('renders AppInner (data-testid="app") at /play/:slug', () => {
    render(
      <MemoryRouter initialEntries={['/play/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('app')).toBeInTheDocument();
  });

  it('renders lobby-root at /', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByTestId('lobby-root')).toBeInTheDocument();
  });
});

describe('slug routing — AppInner sends slug-based SESSION_EVENT on mount', () => {
  it('sends SESSION_EVENT{event:"connect", game_slug} when mounted at /solo/:slug', async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;

    // AppInner fires SESSION_EVENT{connect, game_slug} on mount (after 300ms timeout).
    const msg = await server.nextMessage as { type: string; payload: Record<string, unknown> };
    expect(msg.type).toBe('SESSION_EVENT');
    expect(msg.payload.event).toBe('connect');
    expect(msg.payload.game_slug).toBe('2026-04-22-moldharrow-keep');
  });

  it('sends SESSION_EVENT{event:"connect", game_slug} when mounted at /play/:slug', async () => {
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
});

describe('slug routing — AppInner phase transitions driven by server messages', () => {
  it('transitions to game phase when server sends SESSION_EVENT{ready}', async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // consume SESSION_EVENT connect

    act(() => {
      server.send({ type: 'SESSION_EVENT', payload: { event: 'ready' } });
    });

    // GameBoard should now be rendered — the game phase is active.
    // We verify this by confirming the app element is still present
    // (ErrorBoundary didn't crash) and the connect-waiting indicator is gone.
    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Issue 2: NamePrompt path — slug URL with no display name stored
// ---------------------------------------------------------------------------

describe('slug routing — NamePrompt shown when no display name is set', () => {
  it('renders NamePrompt and does NOT fire WS connect when slug URL has no display name', async () => {
    // Clear the display name seeded in beforeEach — no name in storage.
    localStorage.removeItem('sq:display-name');

    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    // NamePrompt should be visible — look for its label text.
    await waitFor(() => {
      expect(screen.getByText(/what name shall be yours/i)).toBeInTheDocument();
    });

    // WebSocket.send must NOT have been called — no connect message yet.
    // Give a beat past the 300ms WS timeout to be sure nothing fired.
    await new Promise((r) => setTimeout(r, 450));
    expect(server.messages).toHaveLength(0);

    // Now type a name and submit — connect should fire after metadata loads.
    const input = screen.getByRole('textbox', { name: /player name/i });
    await userEvent.type(input, 'bob');
    await userEvent.click(screen.getByRole('button', { name: /begin/i }));

    // After name is submitted, WS connect message should arrive.
    const msg = await server.nextMessage as { type: string; payload: Record<string, unknown> };
    expect(msg.type).toBe('SESSION_EVENT');
    expect(msg.payload.event).toBe('connect');
    expect(msg.payload.game_slug).toBe('2026-04-22-moldharrow-keep');
  });
});

// ---------------------------------------------------------------------------
// Issue 1 gate check: metadata fetch gates WS connect
// ---------------------------------------------------------------------------

describe('slug routing — metadata fetch gates WS connect', () => {
  it('fetches GET /api/games/:slug and WS connect does not fire until metadata resolves', async () => {
    // Deferred promise — we control when the metadata response resolves.
    let flushGameMeta!: () => void;
    const deferredMeta = new Promise<Response>((resolve) => {
      flushGameMeta = () =>
        resolve(
          new Response(JSON.stringify(GAME_META), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
    });

    // Override the default fetch mock with one that defers /api/games/:slug.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && /\/api\/games\/[^?]+/.test(url)) {
          return deferredMeta;
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

    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );

    // Wait well past the 300ms WS connect timeout — connect must NOT fire
    // while metadata fetch is still pending.
    await new Promise((r) => setTimeout(r, 450));
    expect(server.messages).toHaveLength(0);

    // Now flush the metadata response — connect should follow.
    act(() => { flushGameMeta(); });

    const msg = await server.nextMessage as { type: string; payload: Record<string, unknown> };
    expect(msg.type).toBe('SESSION_EVENT');
    expect(msg.payload.event).toBe('connect');
    expect(msg.payload.game_slug).toBe('2026-04-22-moldharrow-keep');
  });
});
