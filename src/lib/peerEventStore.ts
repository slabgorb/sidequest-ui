import { openDB, type IDBPDatabase } from 'idb';

export type PeerEvent = {
  seq: number;
  kind: string;
  payload: unknown;
};

export class PeerEventStore {
  private constructor(private db: IDBPDatabase, private storeName: string) {}

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
