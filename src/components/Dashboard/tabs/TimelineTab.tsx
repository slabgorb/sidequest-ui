import { useMemo } from "react";
import type { WatcherEvent, TurnCompleteFields, TurnSpan } from "@/types/watcher";
import { FlameChart } from "../charts/FlameChart";
import { THEME } from "../shared/constants";

interface Props {
  turns: WatcherEvent[];
  selectedTurn: number | null;
  onSelectTurn: (index: number) => void;
}

export function TimelineTab({ turns, selectedTurn, onSelectTurn }: Props) {
  const selected = selectedTurn !== null ? turns[selectedTurn] : null;
  const fields = selected ? (selected.fields as TurnCompleteFields) : null;

  const spans: TurnSpan[] = useMemo(() => {
    if (!fields) return [];
    if (fields.spans && fields.spans.length > 0) return fields.spans;
    // Fallback: single agent_llm span
    const dur = fields.total_duration_ms || fields.agent_duration_ms || 1;
    return [
      {
        name: "agent_llm",
        component: fields.agent_name || "narrator",
        start_ms: 0,
        duration_ms: dur,
      },
    ];
  }, [fields]);

  const totalMs = fields
    ? fields.total_duration_ms || fields.agent_duration_ms || 1
    : 0;

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, height: "100%" }}>
      {/* Turn list sidebar */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <Card title="Turns">
          <div style={{ maxHeight: "calc(100vh - 170px)", overflowY: "auto" }}>
            {turns.length === 0 ? (
              <div style={{ color: THEME.muted, fontSize: 12, padding: 8 }}>
                Waiting for first turn...
              </div>
            ) : (
              [...turns].reverse().map((t, ri) => {
                const i = turns.length - 1 - ri;
                const f = t.fields as TurnCompleteFields;
                const dur = ((f.agent_duration_ms || 0) / 1000).toFixed(1);
                const agent = f.agent_name || "?";
                const isSelected = selectedTurn === i;
                return (
                  <div
                    key={i}
                    onClick={() => onSelectTurn(i)}
                    style={{
                      padding: "6px 10px",
                      cursor: "pointer",
                      borderLeft: `3px solid ${isSelected ? THEME.accent : "transparent"}`,
                      background: isSelected ? "rgba(0,212,255,0.08)" : undefined,
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      #{f.turn_id || i + 1} {agent} {dur}s
                    </span>
                    {f.is_degraded && (
                      <span style={badgeStyle(THEME.red)}>DEGRADED</span>
                    )}
                    {!f.is_degraded && f.classified_intent === "Combat" && (
                      <span style={badgeStyle(THEME.amber)}>COMBAT</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Flame chart + metadata */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card
          title={
            fields
              ? `Turn ${fields.turn_id || "?"} · ${fields.classified_intent || "?"} → ${fields.agent_name || "?"} · ${(totalMs / 1000).toFixed(1)}s`
              : "Select a turn"
          }
        >
          <FlameChart spans={spans} totalMs={totalMs} />
        </Card>

        {fields && (
          <Card title="Turn Details">
            <div style={{ color: THEME.muted, fontSize: 12, lineHeight: 1.8 }}>
              <div>
                <b>Input:</b> {fields.player_input || "—"}
              </div>
              <div>
                <b>Intent:</b> {fields.classified_intent || "?"} →{" "}
                <b>Agent:</b> {fields.agent_name || "?"}
              </div>
              <div>
                <b>Tokens:</b> {fields.token_count_in || 0} in /{" "}
                {fields.token_count_out || 0} out &nbsp; <b>Tier:</b>{" "}
                {fields.extraction_tier || "?"} &nbsp; <b>Degraded:</b>{" "}
                {fields.is_degraded ? (
                  <span style={{ color: THEME.red }}>YES</span>
                ) : (
                  "no"
                )}
              </div>
              <div>
                <b>Patches:</b>{" "}
                {(fields.patches || [])
                  .map(
                    (p) =>
                      `${p.patch_type}(${(p.fields_changed || []).join(",")})`,
                  )
                  .join(", ") || "none"}
              </div>
              <div>
                <b>Beats:</b>{" "}
                {(fields.beats_fired || [])
                  .map(
                    (b) =>
                      `${b.trope}@${(b.threshold || 0).toFixed(1)}`,
                  )
                  .join(", ") || "none"}
              </div>
              <div>
                <b>Delta empty:</b> {String(fields.delta_empty ?? "—")}
              </div>
            </div>
          </Card>
        )}
      </div>
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

function badgeStyle(bg: string): React.CSSProperties {
  return {
    fontSize: 9,
    padding: "1px 5px",
    borderRadius: 8,
    background: bg,
    color: "white",
  };
}
