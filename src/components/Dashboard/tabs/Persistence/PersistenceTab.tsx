import { useMemo, useState } from "react";
import type { GameSnapshot, TurnProfile } from "../../types";
import { EmptyState } from "../../shared/EmptyState";
import { NarrativeLog } from "./NarrativeLog";

interface PersistenceTabProps {
  snapshot: GameSnapshot | null;
  turns: TurnProfile[];
}

type PersistenceView = "overview" | "narrative" | "quests" | "npcs" | "inventory";

export function PersistenceTab({ snapshot, turns }: PersistenceTabProps) {
  const [view, setView] = useState<PersistenceView>("overview");

  // Extract data from snapshot
  const metadata = useMemo(() => {
    if (!snapshot) return null;
    return {
      genre: snapshot.genre_slug ?? snapshot.genre ?? "—",
      world: snapshot.world_slug ?? snapshot.world ?? "—",
      location: snapshot.location ?? "—",
      timeOfDay: snapshot.time_of_day ?? "—",
      turnCount: snapshot.turn_count ?? turns.length,
      lastSaved: snapshot.last_saved_at ?? "—",
    };
  }, [snapshot, turns.length]);

  const characters = useMemo(
    () => (snapshot?.characters as unknown[] | undefined) ?? [],
    [snapshot],
  );

  const questLog = useMemo(
    () =>
      snapshot?.quest_log
        ? Object.entries(snapshot.quest_log as Record<string, string>)
        : [],
    [snapshot],
  );

  const npcRegistry = useMemo(
    () => (snapshot?.npc_registry as unknown[] | undefined) ?? [],
    [snapshot],
  );

  if (!snapshot) {
    return (
      <EmptyState
        message="No save data available"
        detail="Persistence data will appear after a game_state_snapshot is received."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* View selector */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "#333", background: "#16162a" }}
      >
        {(["overview", "narrative", "quests", "npcs", "inventory"] as PersistenceView[]).map(
          (v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-xs px-3 py-1 rounded capitalize"
              style={{
                background: view === v ? "#333" : "transparent",
                color: view === v ? "#eee" : "#888",
                border: "1px solid #444",
              }}
            >
              {v}
            </button>
          ),
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 text-xs">
        {view === "overview" && metadata && (
          <div className="space-y-4">
            <Section title="Session">
              <KV label="Genre" value={String(metadata.genre)} />
              <KV label="World" value={String(metadata.world)} />
              <KV label="Location" value={String(metadata.location)} />
              <KV label="Time of Day" value={String(metadata.timeOfDay)} />
              <KV label="Turn Count" value={String(metadata.turnCount)} />
              <KV label="Last Saved" value={String(metadata.lastSaved)} />
            </Section>

            <Section title={`Characters (${characters.length})`}>
              {characters.length === 0 ? (
                <div style={{ color: "#888" }}>No characters</div>
              ) : (
                characters.map((c, i) => {
                  const char = c as Record<string, unknown>;
                  return (
                    <div key={i} className="mb-2 p-2 rounded" style={{ background: "#222" }}>
                      <div style={{ color: "#7ae" }}>
                        {String(char.name ?? `Character ${i + 1}`)}
                      </div>
                      <div style={{ color: "#888" }}>
                        {char.class ? `${char.class} ` : ""}
                        {char.level ? `Lv${char.level} ` : ""}
                        {char.hp !== undefined ? `HP: ${char.hp}/${char.max_hp ?? "?"}` : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </Section>
          </div>
        )}

        {view === "narrative" && <NarrativeLog turns={turns} />}

        {view === "quests" && (
          <Section title={`Quest Log (${questLog.length})`}>
            {questLog.length === 0 ? (
              <div style={{ color: "#888" }}>No active quests</div>
            ) : (
              questLog.map(([name, status]) => (
                <div key={name} className="flex justify-between py-1 border-b" style={{ borderColor: "#222" }}>
                  <span style={{ color: "#7ae" }}>{name}</span>
                  <span style={{ color: "#aaa" }}>{status}</span>
                </div>
              ))
            )}
          </Section>
        )}

        {view === "npcs" && (
          <Section title={`NPC Registry (${npcRegistry.length})`}>
            {npcRegistry.length === 0 ? (
              <div style={{ color: "#888" }}>No registered NPCs</div>
            ) : (
              npcRegistry.map((npc, i) => {
                const n = npc as Record<string, unknown>;
                return (
                  <div key={i} className="mb-2 p-2 rounded" style={{ background: "#222" }}>
                    <div style={{ color: "#7ae" }}>{String(n.name ?? `NPC ${i + 1}`)}</div>
                    {n.role && <div style={{ color: "#888" }}>Role: {String(n.role)}</div>}
                    {n.attitude && <div style={{ color: "#888" }}>Attitude: {String(n.attitude)}</div>}
                    {n.last_seen_turn && (
                      <div style={{ color: "#666" }}>Last seen: Turn {String(n.last_seen_turn)}</div>
                    )}
                  </div>
                );
              })
            )}
          </Section>
        )}

        {view === "inventory" && (
          <Section title="Inventory">
            {(() => {
              const items = characters.flatMap((c) => {
                const char = c as Record<string, unknown>;
                const inv = (char.inventory as unknown[] | undefined) ?? [];
                return inv.map((item) => ({
                  owner: String(char.name ?? "?"),
                  ...(item as Record<string, unknown>),
                }));
              });
              if (items.length === 0) {
                return <div style={{ color: "#888" }}>No items</div>;
              }
              return items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-1 border-b" style={{ borderColor: "#222" }}>
                  <span style={{ color: "#7ae" }}>{String(item.name ?? "Unknown")}</span>
                  <span style={{ color: "#888" }}>{String(item.type ?? "")}</span>
                  <span style={{ color: "#666" }}>({item.owner})</span>
                  {item.equipped && <span style={{ color: "#4a9" }}>equipped</span>}
                </div>
              ));
            })()}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold mb-2" style={{ color: "#888" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ color: "#ddd" }}>{value}</span>
    </div>
  );
}
