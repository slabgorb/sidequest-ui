import { useEffect, useMemo, useRef, useState } from "react";
import type { RawWatcherEvent, ValidationAlert } from "../../types";
import { EmptyState } from "../../shared/EmptyState";
import { EventRow } from "./EventRow";

interface ConsoleTabProps {
  events: RawWatcherEvent[];
  alerts: ValidationAlert[];
}

export function ConsoleTab({ events, alerts }: ConsoleTabProps) {
  const [componentFilter, setComponentFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [textFilter, setTextFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Extract unique components and severities for filter dropdowns
  const components = useMemo(
    () => [...new Set(events.map((e) => e.component))].sort(),
    [events],
  );
  const severities = useMemo(
    () => [...new Set(events.map((e) => e.severity))].sort(),
    [events],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (componentFilter && e.component !== componentFilter) return false;
      if (severityFilter && e.severity !== severityFilter) return false;
      if (textFilter) {
        const text = textFilter.toLowerCase();
        const fieldStr = JSON.stringify(e.fields).toLowerCase();
        if (
          !e.component.toLowerCase().includes(text) &&
          !e.event_type.toLowerCase().includes(text) &&
          !fieldStr.includes(text)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [events, componentFilter, severityFilter, textFilter]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  if (events.length === 0) {
    return (
      <EmptyState
        message="No events yet"
        detail="Events will appear here as the game generates telemetry."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "#333", background: "#16162a" }}
      >
        <select
          value={componentFilter}
          onChange={(e) => setComponentFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#222", color: "#eee", border: "1px solid #444" }}
        >
          <option value="">All Components</option>
          {components.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#222", color: "#eee", border: "1px solid #444" }}
        >
          <option value="">All Severities</option>
          {severities.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter..."
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded flex-1"
          style={{ background: "#222", color: "#eee", border: "1px solid #444" }}
        />

        <span className="text-xs" style={{ color: "#666" }}>
          {filtered.length}/{events.length}
        </span>

        {alerts.length > 0 && (
          <span className="text-xs" style={{ color: "#e83" }}>
            {alerts.length} alerts
          </span>
        )}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-auto font-mono"
      >
        {filtered.map((event, i) => (
          <EventRow key={i} event={event} />
        ))}
      </div>
    </div>
  );
}
