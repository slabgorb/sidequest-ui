import React, { useMemo } from "react";
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
              renderTurnList(turns, selectedTurn, onSelectTurn)
            )}
          </div>
        </Card>
      </div>

      {/* Flame chart + metadata */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card
          title={
            fields
              ? `Turn ${fields.turn_id ?? "?"} → ${fields.agent_name ?? "?"} · ${(totalMs / 1000).toFixed(1)}s`
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

// ─────────────────────────────────────────────────────────────────────────────
// Session-divider rendering — playtest 2026-04-11 fix for "Turn # collides
// across sessions in OTEL dashboard".
//
// Background: turn_id resets per session (it's the in-session turn counter).
// When a player plays two sessions in the same world (or two sessions in
// different worlds, or two different players), the dashboard timeline used to
// show two `#1 narrator` rows mingled together with no way to tell them apart.
//
// Fix: detect session boundaries between consecutive turns and render a
// horizontal divider with the session identifier. A boundary is any of:
//   - (player_id, genre, world) tuple changes between consecutive turns
//   - turn_id RESETS BACKWARDS (e.g. #5 → #1) within the same tuple, which
//     can happen if the player completes a session and starts a new
//     character in the same world (server clears npc_registry per the
//     companion fix in sidequest-api PR #408)
//
// The (player_id, genre, world) tuple comes from the new TurnComplete fields
// added in sidequest-api PR #409. Older events from a stale server may not
// carry those fields — in that case the dividers degrade gracefully (only
// turn_id reset triggers a boundary, which still catches the most common
// "started a new session" case).
// ─────────────────────────────────────────────────────────────────────────────

interface SessionTuple {
  player_id?: string;
  genre?: string;
  world?: string;
}

function sameSession(a: SessionTuple, b: SessionTuple): boolean {
  return (
    a.player_id === b.player_id && a.genre === b.genre && a.world === b.world
  );
}

function isSessionBoundary(
  prev: TurnCompleteFields | null,
  curr: TurnCompleteFields,
): boolean {
  if (!prev) return false;
  if (!sameSession(prev, curr)) return true;
  // turn_id reset within the same (player_id, genre, world) tuple — almost
  // certainly a fresh character or fresh session in the same world.
  const prevId = prev.turn_id ?? 0;
  const currId = curr.turn_id ?? 0;
  if (currId > 0 && prevId > 0 && currId < prevId) return true;
  return false;
}

function sessionLabel(f: TurnCompleteFields, startTime?: string): string {
  const parts: string[] = [];
  if (f.player_id) parts.push(f.player_id);
  if (f.genre) parts.push(f.genre);
  if (f.world) parts.push(f.world);
  const base = parts.length > 0 ? parts.join(" · ") : "session";
  if (startTime) {
    // Render as HH:MM in the user's local time. Bare server timestamp would
    // be ISO with timezone, just clip the time portion as a quick hint.
    const t = new Date(startTime);
    if (!isNaN(t.getTime())) {
      const hh = t.getHours().toString().padStart(2, "0");
      const mm = t.getMinutes().toString().padStart(2, "0");
      return `${base} · ${hh}:${mm}`;
    }
  }
  return base;
}

function SessionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px 4px",
        color: THEME.accent,
        fontSize: 10,
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      <div style={{ flex: 1, height: 1, background: THEME.accent, opacity: 0.4 }} />
      <span>── {label} ──</span>
      <div style={{ flex: 1, height: 1, background: THEME.accent, opacity: 0.4 }} />
    </div>
  );
}

function renderTurnList(
  turns: WatcherEvent[],
  selectedTurn: number | null,
  onSelectTurn: (index: number) => void,
): React.ReactNode {
  // Walk turns in CHRONOLOGICAL order to compute session boundaries, then
  // emit them in REVERSE order (newest at top) to match the existing layout.
  // We label each turn with whether it starts a new session (boundary === true)
  // and what the session header looks like.
  type Item = {
    index: number;
    fields: TurnCompleteFields;
    isBoundary: boolean;
    sessionHeader: string | null;
  };
  const items: Item[] = [];
  let prev: TurnCompleteFields | null = null;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    const f = t.fields as TurnCompleteFields;
    const boundary = isSessionBoundary(prev, f);
    items.push({
      index: i,
      fields: f,
      isBoundary: boundary || prev === null,
      sessionHeader:
        boundary || prev === null ? sessionLabel(f, t.timestamp) : null,
    });
    prev = f;
  }

  return [...items].reverse().map((item) => {
    const { index: i, fields: f, isBoundary, sessionHeader } = item;
    const dur = ((f.agent_duration_ms || 0) / 1000).toFixed(1);
    const agent = f.agent_name || "?";
    const isSelected = selectedTurn === i;
    return (
      <React.Fragment key={`turn-${i}`}>
        <div
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
            #{f.turn_id ?? i + 1} {agent} {dur}s
          </span>
          {f.is_degraded && <span style={badgeStyle(THEME.red)}>DEGRADED</span>}
        </div>
        {/* Divider goes ABOVE the boundary turn in chronological order, which
            in the rendered (reversed) order means BELOW the row in the DOM.
            That puts the divider visually between this row and the older row
            below it, matching how the user reads the list top-down. */}
        {isBoundary && sessionHeader && (
          <SessionDivider label={sessionHeader} />
        )}
      </React.Fragment>
    );
  });
}
