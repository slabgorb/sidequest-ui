import { openDB, type IDBPDatabase } from 'idb';

export type PeerEvent = {
  seq: number;
  kind: string;
  payload: unknown;
};

// Per-slug + per-player IndexedDB event cache.
//
// Each peer maintains a local append-only log of events it has received from
// the narrator-host (see MP-03 plan). On reconnect, the peer sends
// `last_seen_seq` so the server can replay anything missed. When the
// narrator-host is unreachable the peer can still render cached events in
// read-only mode.
//
// Scoped by slug + player_id so multiple players on the same machine (shared
// browser profile) don't bleed state into each other, and so one player's
// filtered projection never leaks into another's cache.
export class PeerEventStore {
  private readonly db: IDBPDatabase;
  private readonly storeName: string;

  private constructor(db: IDBPDatabase, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  static async open(slug: string, playerId: string): Promise<PeerEventStore> {
    const dbName = `sq:${slug}:${playerId}`;
    const storeName = 'events';
    const db = await openDB(dbName, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(storeName)) {
          d.createObjectStore(storeName, { keyPath: 'seq' });
        }
      },
    });
    return new PeerEventStore(db, storeName);
  }

  async append(ev: PeerEvent): Promise<void> {
    await this.db.put(this.storeName, ev);
  }

  async readAll(): Promise<PeerEvent[]> {
    const all = await this.db.getAll(this.storeName);
    return (all as PeerEvent[]).sort((a, b) => a.seq - b.seq);
  }

  async latestSeq(): Promise<number> {
    const all = await this.readAll();
    return all.length === 0 ? 0 : all[all.length - 1].seq;
  }
}
