import { useState, useMemo } from "react";
import type { SessionStateView, NpcRegistryEntry, PlayerStateView } from "@/types/watcher";
import { THEME } from "../shared/constants";

interface Props {
  debugState: SessionStateView[] | null;
  onRefresh: () => void;
}

export function StateTab({ debugState, onRefresh }: Props) {
  const [filter, setFilter] = useState("");
  const [npcSort, setNpcSort] = useState<{ col: string; asc: boolean }>({ col: "name", asc: true });
  const [expandedNpcs, setExpandedNpcs] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (!debugState || debugState.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: THEME.muted, textAlign: "center", padding: 32 }}>
          No active sessions. Start a game first.
          <br />
          <button onClick={onRefresh} style={btnStyle}>
            ��� Refresh
          </button>
        </div>
      </div>
    );
  }

  // For now, show the first (or only) session. Multi-session support: tabs/dropdown later if needed.
  const session = debugState[0];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: THEME.muted, fontSize: 11 }}>Search:</span>
        <input
          type="text"
          placeholder="Filter NPCs, items..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={inputStyle}
        />
        <button onClick={onRefresh} style={btnStyle} title="Fetch latest state from Rust memory">
          ↻ Refresh
        </button>
        <span style={{ color: THEME.muted, fontSize: 11, marginLeft: "auto" }}>
          {session.genre_slug}/{session.world_slug} · {session.player_count} player(s)
        </span>
      </div>

      {/* Location */}
      <Card title="Location">
        <div style={{ fontSize: 14, color: THEME.accent, marginBottom: 4 }}>
          {session.current_location || "Unknown"}
        </div>
        <div style={{ fontSize: 11, color: THEME.muted }}>
          {session.genre_slug} / {session.world_slug} · Mode: {session.turn_mode}
        </div>
        {session.discovered_regions.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: THEME.muted }}>
            Discovered:{" "}
            {session.discovered_regions.map((r, i) => (
              <span key={i} style={{ color: THEME.teal }}>
                {r}{i < session.discovered_regions.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Players / Characters */}
      {session.players.map((player) => (
        <PlayerCard
          key={player.player_name}
          player={player}
          filter={filter.toLowerCase()}
          expandedItems={expandedItems}
          onToggleItem={(key) => {
            const next = new Set(expandedItems);
            if (next.has(key)) next.delete(key); else next.add(key);
            setExpandedItems(next);
          }}
        />
      ))}

      {/* NPC Registry */}
      <NpcRegistry
        npcs={session.npc_registry}
        filter={filter.toLowerCase()}
        sort={npcSort}
        onSort={(col) => {
          if (npcSort.col === col) setNpcSort({ col, asc: !npcSort.asc });
          else setNpcSort({ col, asc: true });
        }}
        expanded={expandedNpcs}
        onToggleExpand={(name) => {
          const next = new Set(expandedNpcs);
          if (next.has(name)) next.delete(name); else next.add(name);
          setExpandedNpcs(next);
        }}
      />

      {/* Tropes */}
      {session.trope_states.length > 0 && (
        <Card title={`Tropes (${session.trope_states.length})`}>
          {session.trope_states.map((ts) => (
            <div key={ts.trope_definition_id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: THEME.text, width: 180 }}>
                  {ts.trope_definition_id}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: THEME.border,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${ts.progression * 100}%`,
                      height: "100%",
                      background: THEME.teal,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: THEME.muted, width: 80, textAlign: "right" }}>
                  {ts.progression.toFixed(2)} · {ts.status}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Infrastructure */}
      <Card title="Infrastructure">
        <div style={{ fontSize: 11, color: THEME.muted }}>
          Music Director: {session.has_music_director ? "✓" : "✗"} &nbsp;
          Audio Mixer: {session.has_audio_mixer ? "✓" : "✗"} &nbsp;
          Narration History: {session.narration_history_len} entries &nbsp;
          Regions: {session.region_names.length}
        </div>
      </Card>
    </div>
  );
}

// -- Player Card --

function PlayerCard({
  player,
  filter,
  expandedItems,
  onToggleItem,
}: {
  player: PlayerStateView;
  filter: string;
  expandedItems: Set<string>;
  onToggleItem: (key: string) => void;
}) {
  const items = player.inventory.items;
  const filteredItems = filter
    ? items.filter((item) => item.name.toLowerCase().includes(filter))
    : items;

  if (filter && filteredItems.length === 0) return null;

  const hpPct = player.character_max_hp > 0
    ? Math.round((player.character_hp / player.character_max_hp) * 100)
    : 100;
  const hpColor = hpPct > 60 ? THEME.green : hpPct > 30 ? THEME.amber : THEME.red;

  return (
    <Card
      title={`${player.character_name || player.player_name} — ${player.character_class || "?"} (Lv${player.character_level})`}
    >
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 8 }}>
        <div>
          HP:{" "}
          <span style={{ color: hpColor, fontWeight: "bold" }}>
            {player.character_hp}/{player.character_max_hp}
          </span>
        </div>
        <div style={{ flex: 1, maxWidth: 200, height: 6, background: THEME.border, borderRadius: 3 }}>
          <div
            style={{
              width: `${hpPct}%`,
              height: "100%",
              background: hpColor,
              borderRadius: 3,
            }}
          />
        </div>
        <div style={{ color: THEME.muted, fontSize: 11 }}>XP: {player.character_xp}</div>
        {player.inventory.gold > 0 && (
          <div style={{ color: THEME.amber }}>{player.inventory.gold} gold</div>
        )}
      </div>

      {player.display_location && (
        <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 8 }}>
          Location: {player.display_location}
          {player.region_id ? ` (region: ${player.region_id})` : ""}
        </div>
      )}

      {/* Inventory */}
      {filteredItems.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: THEME.purple, marginBottom: 4, fontWeight: "bold" }}>
            INVENTORY ({filteredItems.length} items)
          </div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: THEME.muted }}>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Weight</th>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>State</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const w = item.narrative_weight || 0;
                const stage =
                  w >= 0.7 ? (
                    <span style={{ color: THEME.accent }}>evolved</span>
                  ) : w >= 0.5 ? (
                    <span style={{ color: THEME.green }}>named</span>
                  ) : (
                    <span style={{ color: THEME.muted }}>unnamed</span>
                  );
                const key = `${player.player_name}::${item.name}`;
                const isExpanded = expandedItems.has(key);
                return (
                  <>
                    <tr
                      key={item.id || item.name}
                      style={{ cursor: "pointer" }}
                      onClick={() => onToggleItem(key)}
                    >
                      <td style={tdStyle}>{item.name}</td>
                      <td style={tdStyle}>{w.toFixed(2)}</td>
                      <td style={tdStyle}>{stage}</td>
                      <td style={tdStyle}>{item.state}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.id}-detail`}>
                        <td colSpan={4} style={{ padding: "4px 8px" }}>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              fontSize: 10,
                              color: THEME.muted,
                              margin: 0,
                            }}
                          >
                            {JSON.stringify(item, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Combat */}
      {player.combat_state.in_combat && (
        <div style={{ fontSize: 11, color: THEME.red, fontWeight: "bold" }}>
          IN COMBAT — Round {player.combat_state.round}
        </div>
      )}
    </Card>
  );
}

// -- NPC Registry --

function NpcRegistry({
  npcs,
  filter,
  sort,
  onSort,
  expanded,
  onToggleExpand,
}: {
  npcs: NpcRegistryEntry[];
  filter: string;
  sort: { col: string; asc: boolean };
  onSort: (col: string) => void;
  expanded: Set<string>;
  onToggleExpand: (name: string) => void;
}) {
  const filtered = useMemo(() => {
    let list = npcs;
    if (filter) {
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(filter) ||
          n.role.toLowerCase().includes(filter) ||
          n.location.toLowerCase().includes(filter),
      );
    }
    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sort.col === "location") { va = a.location; vb = b.location; }
      else { va = a.name; vb = b.name; }
      if (typeof va === "number") return sort.asc ? va - (vb as number) : (vb as number) - va;
      return sort.asc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    });
    return list;
  }, [npcs, filter, sort]);

  if (filtered.length === 0) return null;

  const arrow = (col: string) => (sort.col === col ? (sort.asc ? " ▲" : " ▼") : "");

  return (
    <Card title={`NPC Registry (${filtered.length})`}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: THEME.muted }}>
            <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => onSort("name")}>
              Name{arrow("name")}
            </th>
            <th style={thStyle}>Role</th>
            <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => onSort("location")}>
              Location{arrow("location")}
            </th>
            <th style={thStyle}>HP</th>
            <th style={thStyle}>Last Seen</th>
            <th style={thStyle}>Pronouns</th>
            <th style={thStyle}>OCEAN</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((n) => {
            const isExpanded = expanded.has(n.name);
            return (
              <>
                <tr
                  key={n.name}
                  style={{ cursor: "pointer" }}
                  onClick={() => onToggleExpand(n.name)}
                >
                  <td style={tdStyle}>{n.name}</td>
                  <td style={tdStyle}>{n.role}</td>
                  <td style={tdStyle}>{n.location}</td>
                  <td style={tdStyle}>
                    {n.max_hp > 0 ? `${n.hp}/${n.max_hp}` : "—"}
                  </td>
                  <td style={tdStyle}>T{n.last_seen_turn}</td>
                  <td style={tdStyle}>{n.pronouns}</td>
                  <td style={{ ...tdStyle, color: THEME.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.ocean_summary || "—"}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${n.name}-detail`}>
                    <td colSpan={7} style={{ padding: "4px 8px" }}>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          fontSize: 10,
                          color: THEME.muted,
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(n, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// -- Shared UI --

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          color: THEME.accent,
          fontSize: 12,
          fontWeight: "bold",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "4px 8px" };
const tdStyle: React.CSSProperties = { padding: "4px 8px" };

const inputStyle: React.CSSProperties = {
  background: THEME.surface,
  color: THEME.text,
  border: `1px solid ${THEME.border}`,
  padding: "2px 6px",
  fontSize: 11,
  fontFamily: "inherit",
  width: 200,
};

const btnStyle: React.CSSProperties = {
  background: THEME.border,
  color: THEME.text,
  border: "none",
  padding: "4px 10px",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
};
