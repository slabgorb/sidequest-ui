import { describe, it, expect, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { WS } from 'jest-websocket-mock';
import { PeerEventStore } from '../../lib/peerEventStore';
import { useEventStream } from '../useEventStream';

describe('useEventStream offline mode', () => {
  afterEach(() => { WS.clean(); });

  it('exposes cached events and offline=true when WS fails', async () => {
    const s = await PeerEventStore.open('slug-offline', 'alice');
    await s.append({ seq: 1, kind: 'NARRATION', payload: { text: 'old beat' } });

    const server = new WS('ws://localhost:65535/does-not-exist', { jsonProtocol: true });

    const { result } = renderHook(() =>
      useEventStream({
        wsUrl: 'ws://localhost:65535/does-not-exist',
        slug: 'slug-offline',
        playerId: 'alice',
      }),
    );

    // Cached events should appear before connection settles
    await waitFor(() => expect(result.current.events.length).toBe(1));

    // Trigger the server-side error so onerror/onclose fires on the client
    await server.connected;
    server.error();

    await waitFor(() => expect(result.current.offline).toBe(true), { timeout: 2000 });
  });
});
