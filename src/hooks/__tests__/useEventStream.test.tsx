import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { WS } from 'jest-websocket-mock';
import { useEventStream } from '../useEventStream';

describe('useEventStream', () => {
  let server: WS;
  beforeEach(async () => {
    server = new WS('ws://localhost:1234/ws', { jsonProtocol: true });
  });
  afterEach(() => { WS.clean(); });

  it('sends last_seen_seq=0 on first connect', async () => {
    const { result } = renderHook(() =>
      useEventStream({ wsUrl: 'ws://localhost:1234/ws', slug: 'slug-a', playerId: 'alice' }),
    );
    await server.connected;
    const msg = await server.nextMessage as any;
    expect(msg.type).toBe('SESSION_EVENT');
    expect(msg.payload.last_seen_seq).toBe(0);
  });

  it('caches received events and sends latest seq on reconnect', async () => {
    const { result, unmount } = renderHook(() =>
      useEventStream({ wsUrl: 'ws://localhost:1234/ws', slug: 'slug-b', playerId: 'alice' }),
    );
    await server.connected;
    await server.nextMessage;
    act(() => {
      server.send({ type: 'NARRATION', payload: { seq: 1, text: 'beat 1' } });
      server.send({ type: 'NARRATION', payload: { seq: 2, text: 'beat 2' } });
    });
    await waitFor(() => expect(result.current.events.length).toBe(2));
    unmount();
    WS.clean();

    const server2 = new WS('ws://localhost:1234/ws', { jsonProtocol: true });
    renderHook(() =>
      useEventStream({ wsUrl: 'ws://localhost:1234/ws', slug: 'slug-b', playerId: 'alice' }),
    );
    await server2.connected;
    const msg = await server2.nextMessage as any;
    expect(msg.payload.last_seen_seq).toBe(2);
  });
});
