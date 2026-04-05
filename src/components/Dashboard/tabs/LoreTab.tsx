import { useState, useMemo } from "react";
import type { WatcherEvent } from "@/types/watcher";
import { THEME } from "../shared/constants";

interface Props {
  loreEvents: WatcherEvent[];
}

interface LoreFields {
  turn_number?: number;
  budget?: number;
  tokens_used?: number;
  total_fragments?: number;
  selected_count?: number;
  fragments?: Array<{
    category?: string;
    content?: string;
    relevance?: number;
    tokens?: number;
    selected?: boolean;
  }>;
}

export function LoreTab({ loreEvents }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");

  const selected = selectedIdx !== null ? loreEvents[selectedIdx] : null;
  const fields = selected ? (selected.fields as unknown as LoreFields) : null;

  const filteredFragments = useMemo(() => {
    if (!fields?.fragments) return [];
    const q = filterText.toLowerCase();
    if (!q) return fields.fragments;
    return fields.fragments.filter(
      (f) =>
        (f.content || "").toLowerCase().includes(q) ||
        (f.category || "").toLowerCase().includes(q),
    );
  }, [fields, filterText]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: THEME.muted, fontSize: 11 }}>Turn:</span>
        <select
          value={selectedIdx ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedIdx(v === "" ? null : Number(v));
          }}
          style={selectStyle}
        >
          <option value="">Select a turn</option>
          {loreEvents.map((ev, i) => {
            const f = ev.fields as unknown as LoreFields;
            return (
              <option key={i} value={i}>
                T{f.turn_number || i + 1} · {f.selected_count || 0}/{f.total_fragments || 0} frags ·{" "}
                {f.tokens_used || 0}/{f.budget || 0} tok
              </option>
            );
          })}
        </select>
        <span style={{ color: THEME.muted, fontSize: 11, marginLeft: 8 }}>Filter:</span>
        <input
          type="text"
          placeholder="Search fragments..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={inputStyle}
        />
      </div>

      {fields && (
        <Card title="Budget">
          <div style={{ fontSize: 12 }}>
            <span style={{ color: THEME.accent }}>
              {fields.tokens_used || 0}
            </span>
            <span style={{ color: THEME.muted }}> / {fields.budget || 0} tokens used</span>
            <span style={{ color: THEME.muted, marginLeft: 16 }}>
              {fields.selected_count || 0} / {fields.total_fragments || 0} fragments selected
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              height: 8,
              background: THEME.border,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${fields.budget ? Math.min(((fields.tokens_used || 0) / fields.budget) * 100, 100) : 0}%`,
                height: "100%",
                background:
                  (fields.tokens_used || 0) > (fields.budget || 1) * 0.9
                    ? THEME.amber
                    : THEME.teal,
                borderRadius: 4,
              }}
            />
          </div>
        </Card>
      )}

      {filteredFragments.length > 0 && (
        <Card title={`Fragments (${filteredFragments.length})`}>
          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
            {filteredFragments.map((frag, i) => (
              <div
                key={i}
                style={{
                  padding: "4px 8px",
                  marginBottom: 2,
                  borderLeft: `3px solid ${frag.selected ? THEME.teal : THEME.border}`,
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                  <span style={{ color: THEME.purple }}>{frag.category || "?"}</span>
                  {frag.relevance !== undefined && (
                    <span style={{ color: THEME.muted }}>
                      relevance: {frag.relevance.toFixed(2)}
                    </span>
                  )}
                  {frag.tokens !== undefined && (
                    <span style={{ color: THEME.muted }}>{frag.tokens} tok</span>
                  )}
                  {frag.selected && (
                    <span style={{ color: THEME.green }}>✓ selected</span>
                  )}
                </div>
                <div style={{ color: THEME.text, whiteSpace: "pre-wrap" }}>
                  {frag.content || ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!selected && loreEvents.length === 0 && (
        <div style={{ color: THEME.muted, textAlign: "center", padding: 32 }}>
          Waiting for lore_retrieval events...
        </div>
      )}
    </div>
  );
}

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

const selectStyle: React.CSSProperties = {
  background: THEME.surface,
  color: THEME.text,
  border: `1px solid ${THEME.border}`,
  padding: "2px 6px",
  fontSize: 11,
  fontFamily: "inherit",
};

const inputStyle: React.CSSProperties = {
  background: THEME.surface,
  color: THEME.text,
  border: `1px solid ${THEME.border}`,
  padding: "2px 6px",
  fontSize: 11,
  fontFamily: "inherit",
  width: 200,
};
