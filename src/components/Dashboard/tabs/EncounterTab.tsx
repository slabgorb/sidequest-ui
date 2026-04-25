import { useEffect, useState } from "react";
import type { EncounterEvent } from "@/types/payloads";
import { THEME } from "../shared/constants";

// ---------------------------------------------------------------------------
// Pure row renderers — one per ENCOUNTER_* event kind
// ---------------------------------------------------------------------------

function startedRow(payload: Record<string, unknown>) {
  const playerThresh = (payload.player_metric_threshold as number) ?? "?";
  const oppThresh = (payload.opponent_metric_threshold as number) ?? "?";
  return (
    <span>
      Encounter started — Player metric: 0 / {playerThresh},
      {" "}Opponent metric: 0 / {oppThresh}
    </span>
  );
}

function beatRow(payload: Record<string, unknown>) {
  return (
    <span>
      <strong>{payload.actor as string}</strong>
      {" (side="}{payload.actor_side as string}{") "}
      played <em>{payload.beat_id as string}</em>
      {" "}({payload.beat_kind as string}, tier {payload.outcome_tier as string});
      {" "}deltas own={payload.own_delta as number} opp={payload.opponent_delta as number}
    </span>
  );
}

function advanceRow(payload: Record<string, unknown>) {
  const delta = payload.delta as number;
  return (
    <span>
      {payload.side as string} dial advanced {delta > 0 ? "+" : ""}
      {delta} ({payload.before as number} → {payload.after as number})
    </span>
  );
}

function tagRow(payload: Record<string, unknown>) {
  return (
    <span>
      tag <em>"{payload.tag_text as string}"</em> on {(payload.target as string) || "(scene)"}
      {" "}— leverage {payload.leverage as number}, {(payload.fleeting as boolean) ? "fleeting" : "persistent"}
    </span>
  );
}

function statusRow(payload: Record<string, unknown>) {
  return (
    <span>
      {payload.actor as string} took status <em>{payload.text as string}</em>
      {" "}({payload.severity as string})
    </span>
  );
}

function yieldRow(payload: Record<string, unknown>) {
  const op = payload.op as string;
  if (op === "yield_resolved") {
    return (
      <span>
        Yield resolved — {payload.yielded_actors as string} (edge refreshed:
        {" "}{payload.edge_refreshed as number})
      </span>
    );
  }
  return <span>Yield received from {payload.actor_name as string}</span>;
}

function resolvedRow(payload: Record<string, unknown>) {
  return (
    <strong>
      RESOLVED — outcome: {payload.outcome as string}; final player_metric=
      {payload.final_player_metric as number}, opponent_metric=
      {payload.final_opponent_metric as number}
    </strong>
  );
}

function skippedRow(payload: Record<string, unknown>) {
  return (
    <span>
      Beat skipped — {payload.actor as string} ({payload.actor_side as string}) /
      {" "}{payload.beat_id as string} — reason: {payload.reason as string}
    </span>
  );
}

function renderEventRow(ev: EncounterEvent): React.ReactNode {
  switch (ev.kind) {
    case "ENCOUNTER_STARTED":
      return startedRow(ev.payload);
    case "ENCOUNTER_BEAT_APPLIED":
      return beatRow(ev.payload);
    case "ENCOUNTER_METRIC_ADVANCE":
      return advanceRow(ev.payload);
    case "ENCOUNTER_TAG_CREATED":
      return tagRow(ev.payload);
    case "ENCOUNTER_STATUS_ADDED":
      return statusRow(ev.payload);
    case "ENCOUNTER_YIELD":
      return yieldRow(ev.payload);
    case "ENCOUNTER_BEAT_SKIPPED":
      return skippedRow(ev.payload);
    case "ENCOUNTER_RESOLVED":
      return resolvedRow(ev.payload);
    case "ENCOUNTER_RESOLUTION_SIGNAL":
      return null; // internal — no visible row
    default: {
      // Exhaustiveness guard: surface unknown kinds rather than silently swallowing them.
      const unknown = (ev as { kind: string }).kind;
      return <span style={{ color: THEME.amber }}>(unknown event kind: {unknown})</span>;
    }
  }
}

// ---------------------------------------------------------------------------
// EncounterTimeline — pure renderer (used by tests and by EncounterTab)
// ---------------------------------------------------------------------------

interface TimelineProps {
  events: EncounterEvent[];
}

export function EncounterTimeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div style={{ color: THEME.muted, textAlign: "center", padding: 32 }}>
        No encounter events recorded for this session.
      </div>
    );
  }

  return (
    <ol
      className="encounter-timeline"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        fontFamily: "inherit",
        fontSize: 12,
      }}
    >
      {events.map((ev) => {
        const rowContent = renderEventRow(ev);
        if (rowContent === null) return null;
        const isResolved = ev.kind === "ENCOUNTER_RESOLVED";
        return (
          <li
            key={ev.seq}
            style={{
              display: "flex",
              gap: 12,
              padding: "4px 0",
              borderBottom: `1px solid ${THEME.border}`,
              color: isResolved ? THEME.accent : THEME.text,
            }}
          >
            <span
              style={{
                color: THEME.muted,
                minWidth: 32,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              #{ev.seq}
            </span>
            <span
              style={{
                color: THEME.purple,
                minWidth: 220,
                flexShrink: 0,
                fontSize: 11,
              }}
            >
              {ev.kind}
            </span>
            <span style={{ flex: 1 }}>{rowContent}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// EncounterTab — live wrapper that fetches from REST + renders EncounterTimeline
// ---------------------------------------------------------------------------

interface TabProps {
  slug: string | null;
}

export function EncounterTab({ slug }: TabProps) {
  const [events, setEvents] = useState<EncounterEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch(`/api/sessions/${slug}/encounter_events`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (!cancelled) {
          if (!Array.isArray(data)) {
            throw new Error(`Expected array, got ${typeof data}`);
          }
          setEvents(data as EncounterEvent[]);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <div style={{ color: THEME.muted, textAlign: "center", padding: 32 }}>
        No active session.
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: THEME.red, padding: 16 }}>
        Error loading encounter events: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
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
        Encounter Timeline — {events.length} event{events.length !== 1 ? "s" : ""}
      </div>
      <EncounterTimeline events={events} />
    </div>
  );
}
