import { useState } from "react";
import type { WatcherEvent } from "@/types/watcher";
import { THEME } from "../shared/constants";

interface Props {
  promptEvents: WatcherEvent[];
}

interface PromptFields {
  turn_number?: number;
  agent?: string;
  total_tokens?: number;
  zones?: Record<string, { token_count: number; content?: string }>;
  full_prompt?: string;
}

export function PromptTab({ promptEvents }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const selected = selectedIdx !== null ? promptEvents[selectedIdx] : null;
  const fields = selected ? (selected.fields as unknown as PromptFields) : null;

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
          {promptEvents.map((ev, i) => {
            const f = ev.fields as unknown as PromptFields;
            return (
              <option key={i} value={i}>
                T{f.turn_number || "?"} · {f.agent || "?"} · {f.total_tokens || 0} tokens
              </option>
            );
          })}
        </select>
      </div>

      {fields?.zones && (
        <Card title="Zone Breakdown">
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: THEME.muted }}>
                <th style={thStyle}>Zone</th>
                <th style={thStyle}>Tokens</th>
                <th style={thStyle}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fields.zones)
                .sort(([, a], [, b]) => b.token_count - a.token_count)
                .map(([zone, data]) => (
                  <tr key={zone}>
                    <td style={tdStyle}>{zone}</td>
                    <td style={tdStyle}>{data.token_count}</td>
                    <td style={tdStyle}>
                      {fields.total_tokens
                        ? `${Math.round((data.token_count / fields.total_tokens) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 11, color: THEME.muted }}>
            Total: {fields.total_tokens || 0} tokens · Agent: {fields.agent || "?"}
          </div>
        </Card>
      )}

      {fields?.full_prompt && (
        <Card title="Full Prompt">
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: THEME.text,
              fontSize: 12,
              maxHeight: "calc(100vh - 300px)",
              overflowY: "auto",
              margin: 0,
            }}
          >
            {fields.full_prompt}
          </pre>
        </Card>
      )}

      {!fields?.zones && !fields?.full_prompt && selected && (
        <Card title="Raw Fields">
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 11,
              color: THEME.muted,
              margin: 0,
            }}
          >
            {JSON.stringify(selected.fields, null, 2)}
          </pre>
        </Card>
      )}

      {!selected && promptEvents.length === 0 && (
        <div style={{ color: THEME.muted, textAlign: "center", padding: 32 }}>
          Waiting for prompt_assembled events...
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

const thStyle: React.CSSProperties = { textAlign: "left", padding: "4px 8px" };
const tdStyle: React.CSSProperties = { padding: "4px 8px" };
