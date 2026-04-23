import { useCallback, useEffect, useRef } from 'react';
import { PeerEventStore, type PeerEvent } from '@/lib/peerEventStore';

// Thin wrapper around PeerEventStore for AppInner. The store is keyed by
// (slug, playerId), so we re-open it when either changes. `getLatestSeq` is a
// ref-backed getter the caller invokes at the moment it needs the current
// high-water mark — typically when assembling the SESSION_EVENT connect
// payload. `appendEvent` persists inbound events and bumps the in-memory
// high-water mark monotonically.
//
// Kept intentionally narrower than useEventStream (removed in MP-03
// reconciliation): this hook does NOT own the WebSocket. The battle-tested
// useGameSocket remains the single WS owner; this hook layers the durable
// event cache on top.
//
// IDB is authoritative for durability; we also mirror the high-water mark
// into localStorage so `getLatestSeq()` returns the correct value
// synchronously at mount time — before the async IDB open resolves. Without
// the mirror, a cold-start with a non-empty cache would send
// `last_seen_seq: 0` and trigger a full server replay (correct but wasteful;
// dedupe masks the user-visible duplication).

const hintKey = (slug: string, playerId: string) =>
  `sq:${slug}:${playerId}:lastSeq`;

function readHint(slug: string | undefined, playerId: string | null): number {
  if (!slug || !playerId) return 0;
  try {
    const raw = localStorage.getItem(hintKey(slug, playerId));
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeHint(slug: string, playerId: string, seq: number): void {
  try {
    localStorage.setItem(hintKey(slug, playerId), String(seq));
  } catch {
    // quota or disabled — non-critical; IDB is still authoritative.
  }
}

export function usePeerEventCache(slug: string | undefined, playerId: string | null) {
  const storeRef = useRef<PeerEventStore | null>(null);
  const latestSeqRef = useRef<number>(readHint(slug, playerId));
  const slugRef = useRef<string | undefined>(slug);
  const playerIdRef = useRef<string | null>(playerId);

  useEffect(() => {
    slugRef.current = slug;
    playerIdRef.current = playerId;
    if (!slug || !playerId) {
      storeRef.current = null;
      latestSeqRef.current = 0;
      return;
    }
    // Re-read the hint in case slug/playerId changed since mount. Only bump
    // forward — never let a stale hint overwrite a higher in-memory mark.
    const hint = readHint(slug, playerId);
    if (hint > latestSeqRef.current) {
      latestSeqRef.current = hint;
    }
    let cancelled = false;
    (async () => {
      try {
        const store = await PeerEventStore.open(slug, playerId);
        if (cancelled) return;
        storeRef.current = store;
        const seq = await store.latestSeq();
        if (cancelled) return;
        // IDB is authoritative — reconcile the hint up-or-down to match.
        if (seq !== latestSeqRef.current) {
          latestSeqRef.current = seq;
          writeHint(slug, playerId, seq);
        }
      } catch {
        // IDB unavailable — operate without a cache (last_seen_seq falls
        // back to the hint, which defaults to 0; server replays everything).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, playerId]);

  const getLatestSeq = useCallback(() => latestSeqRef.current, []);

  const appendEvent = useCallback(async (ev: PeerEvent) => {
    const store = storeRef.current;
    if (!store) return;
    await store.append(ev);
    if (ev.seq > latestSeqRef.current) {
      latestSeqRef.current = ev.seq;
      const curSlug = slugRef.current;
      const curPlayer = playerIdRef.current;
      if (curSlug && curPlayer) {
        writeHint(curSlug, curPlayer, ev.seq);
      }
    }
  }, []);

  return { getLatestSeq, appendEvent };
}
