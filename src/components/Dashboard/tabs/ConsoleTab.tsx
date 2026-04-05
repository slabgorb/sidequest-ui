import { useState, useRef, useEffect, useMemo } from "react";
import type { WatcherEvent } from "@/types/watcher";
import { THEME, COMP_COLORS, safeStr } from "../shared/constants";

interface Props {
  allEvents: WatcherEvent[];
}

export function ConsoleTab({ allEvents }: Props) {
  const [compFilter, setCompFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Extract unique components and event types for filter dropdowns
  const components = useMemo(
    () => [...new Set(allEvents.map((e) => e.component))].sort(),
    [allEvents],
  );
  const eventTypes = useMemo(
    () => [...new Set(allEvents.map((e) => safeStr(e.event_type)))].sort(),
    [allEvents],
  );

  const filtered = useMemo(() => {
    let events = allEvents;
    if (compFilter) events = events.filter((e) => e.component === compFilter);
    if (typeFilter) events = events.filter((e) => safeStr(e.event_type) === typeFilter);
    return events;
  }, [allEvents, compFilter, typeFilter]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: THEME.muted, fontSize: 11 }}>Filter:</span>
        <select
          value={compFilter}
          onChange={(e) => setCompFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">All components</option>
          {components.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">All types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label style={{ color: THEME.muted, fontSize: 11 }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />{" "}
          Auto-scroll
        </label>
        <span style={{ color: THEME.muted, fontSize: 11, marginLeft: "auto" }}>
          {filtered.length} events
        </span>
      </div>
      <div
        ref={logRef}
        style={{
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 6,
          padding: 4,
          maxHeight: "calc(100vh - 150px)",
          overflowY: "auto",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ color: THEME.muted, padding: 16, textAlign: "center" }}>
            Waiting for events...
          </div>
        ) : (
          filtered.map((ev, i) => (
            <EventRow key={i} event={ev} />
          ))
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: WatcherEvent }) {
  const compColor = COMP_COLORS[event.component] || THEME.purple;
  const sevBorder =
    event.severity === "error"
      ? THEME.red
      : event.severity === "warning"
        ? THEME.amber
        : THEME.border;

  // Compact fields display — key=value pairs, skip large objects
  const fieldPairs = Object.entries(event.fields)
    .filter(([, v]) => typeof v !== "object" || v === null)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");

  return (
    <div
      style={{
        padding: "3px 8px",
        fontSize: 11,
        borderLeft: `3px solid ${sevBorder}`,
        marginBottom: 1,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: compColor }}>{event.component}</span>{" "}
      <span style={{ color: THEME.teal }}>{safeStr(event.event_type)}</span>{" "}
      <span style={{ color: THEME.muted }}>{fieldPairs}</span>
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
