import { useState } from "react";
import type { RawWatcherEvent } from "../../types";

const SEVERITY_COLORS: Record<string, string> = {
  info: "#4a9",
  warning: "#e83",
  error: "#e44",
  debug: "#888",
};

interface EventRowProps {
  event: RawWatcherEvent;
}

export function EventRow({ event }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const color = SEVERITY_COLORS[event.severity] ?? "#888";

  const ts = event.timestamp.split("T")[1]?.split(".")[0] ?? event.timestamp;
  const fieldSummary = Object.entries(event.fields)
    .filter(([k]) => k !== "turn_number")
    .slice(0, 4)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");

  return (
    <div
      className="border-b cursor-pointer hover:opacity-100"
      style={{
        borderColor: "#1a1a2e",
        padding: "4px 16px",
        opacity: 0.85,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 text-xs">
        <span style={{ color: "#555", minWidth: 65 }}>{ts}</span>
        <span
          style={{
            color,
            minWidth: 60,
            textTransform: "uppercase",
            fontSize: 10,
          }}
        >
          {event.severity}
        </span>
        <span style={{ color: "#7ae", minWidth: 80 }}>{event.component}</span>
        <span style={{ color: "#aaa", minWidth: 140 }}>{event.event_type}</span>
        <span
          className="truncate flex-1"
          style={{ color: "#777" }}
        >
          {fieldSummary}
        </span>
        {event.fields.turn_number !== undefined && (
          <span style={{ color: "#555" }}>T{String(event.fields.turn_number)}</span>
        )}
      </div>

      {expanded && (
        <pre
          className="mt-2 mb-1 text-xs overflow-auto"
          style={{
            color: "#aaa",
            maxHeight: 200,
            background: "#111",
            padding: 8,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(event.fields, null, 2)}
        </pre>
      )}
    </div>
  );
}
