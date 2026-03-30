import React, { useState } from "react";
import type { WatcherState, TurnEvent, TropeStatus, ValidationAlert } from "./types";

interface GMModeProps {
  state: WatcherState;
  onClose: () => void;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        onClick={() => setOpen((prev) => !prev)}
        style={{ cursor: "pointer", fontWeight: "bold", padding: "4px 0" }}
      >
        {open ? "▼" : "▶"} {title}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

function EventStream({ turns }: { turns: TurnEvent[] }) {
  return (
    <CollapsibleSection title="Event Stream">
      {turns.length === 0 ? (
        <div>No events yet</div>
      ) : (
        turns.map((turn) => (
          <div key={turn.turn} style={{ marginBottom: 4 }}>
            <div style={{ fontWeight: "bold" }}>Turn {turn.turn}</div>
            {turn.events.map((event, i) => (
              <div
                key={i}
                style={{
                  color:
                    event.severity === "warning"
                      ? "orange"
                      : event.severity === "error"
                        ? "red"
                        : "green",
                  paddingLeft: 12,
                }}
              >
                {event.subsystem}: {event.detail}
              </div>
            ))}
          </div>
        ))
      )}
    </CollapsibleSection>
  );
}

function SubsystemBars({ histogram }: { histogram: Record<string, number> }) {
  const entries = Object.entries(histogram).sort(([, a], [, b]) => b - a);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <CollapsibleSection title="Subsystem Activity">
      {entries.length === 0 ? (
        <div>No activity</div>
      ) : (
        entries.map(([name, count]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 120 }}>{name}</span>
            <div
              style={{
                width: `${(count / max) * 100}%`,
                minWidth: 2,
                height: 12,
                background: count === 0 ? "#666" : "#4a9",
              }}
            />
            <span>{count}</span>
          </div>
        ))
      )}
    </CollapsibleSection>
  );
}

function TropeTimeline({ tropes }: { tropes: TropeStatus[] }) {
  return (
    <CollapsibleSection title="Trope Timeline">
      {tropes.length === 0 ? (
        <div>No active tropes</div>
      ) : (
        tropes.map((trope) => (
          <div key={trope.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 120 }}>{trope.name}</span>
            <div style={{ flex: 1, height: 12, background: "#333", position: "relative" }}>
              <div
                style={{
                  width: `${trope.progress * 100}%`,
                  height: "100%",
                  background: trope.progress > 0.7 ? "#e83" : "#48a",
                }}
              />
            </div>
            <span>{trope.progress.toFixed(2)}</span>
            {trope.beats_fired.length > 0 && <span>◆</span>}
          </div>
        ))
      )}
    </CollapsibleSection>
  );
}

function StateInspector({ snapshot }: { snapshot: WatcherState["latestSnapshot"] }) {
  return (
    <CollapsibleSection title="Game State Inspector">
      {snapshot === null ? (
        <div>No snapshot available</div>
      ) : (
        <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
    </CollapsibleSection>
  );
}

function AlertList({ alerts }: { alerts: ValidationAlert[] }) {
  return (
    <CollapsibleSection title="Validation Alerts">
      {alerts.length === 0 ? (
        <div>No alerts</div>
      ) : (
        alerts.map((alert, i) => (
          <div
            key={i}
            style={{
              color: alert.severity === "error" ? "red" : "orange",
              paddingLeft: 8,
            }}
          >
            ⚠ {alert.check}: {alert.message} — Turn {alert.turn}
          </div>
        ))
      )}
    </CollapsibleSection>
  );
}

export default function GMMode({ state, onClose }: GMModeProps) {
  return (
    <div
      className="w-[400px] shrink-0 h-full overflow-auto border-l border-border/30"
      style={{
        background: "#1a1a2e",
        color: "#eee",
        padding: 12,
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: "bold", fontSize: 14 }}>GM Mode</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: state.connected ? "#4a9" : "#e55" }}>
            {state.connected ? "Connected" : "Disconnected"}
          </span>
          <button
            onClick={() => window.open("/gm", "_blank")}
            aria-label="Open Dashboard"
            style={{
              background: "none",
              border: "1px solid #555",
              color: "#eee",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: 10,
            }}
          >
            Dashboard
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "1px solid #555",
              color: "#eee",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {state.turns.length === 0 && Object.keys(state.histogram).length === 0 && state.latestSnapshot === null ? (
        <div
          data-testid="gm-empty-state"
          style={{ color: "#888", textAlign: "center", padding: "24px 0", lineHeight: 1.6 }}
        >
          Waiting for first turn...
          <br />
          <span style={{ fontSize: 11 }}>
            Events, subsystem activity, and game state will appear here after the first player action.
          </span>
        </div>
      ) : (
        <>
          <EventStream turns={state.turns} />
          <SubsystemBars histogram={state.histogram} />
          <TropeTimeline tropes={state.tropes} />
          <StateInspector snapshot={state.latestSnapshot} />
          <AlertList alerts={state.alerts} />
        </>
      )}
    </div>
  );
}
