import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { PeerEventStore } from '../peerEventStore';

describe('PeerEventStore', () => {
  it('appends events and returns them in seq order', async () => {
    const s = await PeerEventStore.open('slug-a', 'alice');
    await s.append({ seq: 1, kind: 'NARRATION', payload: { text: 'hi' } });
    await s.append({ seq: 2, kind: 'NARRATION', payload: { text: 'there' } });
    const all = await s.readAll();
    expect(all.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('latestSeq returns 0 for empty store', async () => {
    const s = await PeerEventStore.open('slug-empty', 'alice');
    expect(await s.latestSeq()).toBe(0);
  });

  it('latestSeq returns max seq', async () => {
    const s = await PeerEventStore.open('slug-b', 'alice');
    await s.append({ seq: 1, kind: 'NARRATION', payload: {} });
    await s.append({ seq: 5, kind: 'NARRATION', payload: {} });
    expect(await s.latestSeq()).toBe(5);
  });

  it('scopes by slug+player', async () => {
    const a = await PeerEventStore.open('slug-c', 'alice');
    const b = await PeerEventStore.open('slug-c', 'bob');
    await a.append({ seq: 1, kind: 'NARRATION', payload: { for: 'alice' } });
    const bAll = await b.readAll();
    expect(bAll).toEqual([]);
  });
});
