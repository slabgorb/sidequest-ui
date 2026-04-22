import { useEffect, useRef, useState } from 'react';
import { PeerEventStore, type PeerEvent } from '../lib/peerEventStore';

type Args = { wsUrl: string; slug: string; playerId: string; onMessage?: (m: any) => void };

export function useEventStream({ wsUrl, slug, playerId, onMessage }: Args) {
  const [events, setEvents] = useState<PeerEvent[]>([]);
  const [offline, setOffline] = useState(false);
  const storeRef = useRef<PeerEventStore | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!slug || !playerId) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    (async () => {
      const store = await PeerEventStore.open(slug, playerId);
      if (cancelled) return;
      storeRef.current = store;
      const cached = await store.readAll();
      setEvents(cached);
      const lastSeen = await store.latestSeq();

      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setOffline(false);
        ws!.send(JSON.stringify({
          type: 'SESSION_EVENT',
          player_id: playerId,
          payload: { event: 'connect', game_slug: slug, last_seen_seq: lastSeen },
        }));
      };
      ws.onerror = () => { setOffline(true); };
      ws.onclose = () => { setOffline(true); };
      ws.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        onMessageRef.current?.(m);
        if (m.payload && typeof m.payload.seq === 'number') {
          const peerEv: PeerEvent = { seq: m.payload.seq, kind: m.type, payload: m.payload };
          await store.append(peerEv);
          setEvents((cur) => [...cur, peerEv]);
        }
      };
    })();

    return () => { cancelled = true; ws?.close(); };
  }, [wsUrl, slug, playerId]);

  return { events, offline };
}
