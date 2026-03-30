import type { TurnProfile } from "../../types";

interface TurnDetailProps {
  turn: TurnProfile;
  onClose: () => void;
}

export function TurnDetail({ turn, onClose }: TurnDetailProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">
          Turn {turn.turnNumber} Detail
        </span>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1"
          style={{
            background: "none",
            border: "1px solid #555",
            color: "#eee",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <DetailRow label="Player Input" value={turn.playerInput || "—"} />
        <DetailRow label="Intent" value={turn.classifiedIntent ?? "—"} />
        <DetailRow label="Agent" value={turn.agentName ?? "—"} />
        <DetailRow
          label="Agent Duration"
          value={turn.agentDurationMs ? `${turn.agentDurationMs}ms` : "—"}
        />
        <DetailRow
          label="Total Duration"
          value={turn.totalDurationMs ? `${turn.totalDurationMs}ms` : "—"}
        />
        <DetailRow
          label="Extraction Tier"
          value={turn.extractionTier ? `Tier ${turn.extractionTier}` : "—"}
          color={
            turn.extractionTier === 1
              ? "#4a9"
              : turn.extractionTier === 2
                ? "#e83"
                : turn.extractionTier === 3
                  ? "#e44"
                  : undefined
          }
        />
        <DetailRow
          label="Tokens In"
          value={turn.tokenCountIn?.toLocaleString() ?? "—"}
        />
        <DetailRow
          label="Tokens Out"
          value={turn.tokenCountOut?.toLocaleString() ?? "—"}
        />
        <DetailRow
          label="Degraded"
          value={turn.isDegraded ? "YES" : "No"}
          color={turn.isDegraded ? "#e44" : "#4a9"}
        />
        <DetailRow
          label="Spans"
          value={`${turn.spans.length} events`}
        />
        <DetailRow
          label="Alerts"
          value={turn.alerts.length > 0 ? `${turn.alerts.length} warnings` : "None"}
          color={turn.alerts.length > 0 ? "#e83" : undefined}
        />
        <DetailRow label="Timestamp" value={turn.timestamp} />
      </div>

      {/* Span breakdown */}
      {turn.spans.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-bold mb-1" style={{ color: "#888" }}>
            Span Breakdown
          </div>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#666" }}>
                <th className="text-left py-1 pr-4">Component</th>
                <th className="text-left py-1 pr-4">Event</th>
                <th className="text-right py-1 pr-4">Offset</th>
                <th className="text-right py-1">Duration</th>
              </tr>
            </thead>
            <tbody>
              {turn.spans.map((span, i) => (
                <tr key={i} style={{ color: "#aaa", borderTop: "1px solid #222" }}>
                  <td className="py-1 pr-4">{span.component}</td>
                  <td className="py-1 pr-4">{span.eventType}</td>
                  <td className="text-right py-1 pr-4">
                    {Math.round(span.startOffsetMs)}ms
                  </td>
                  <td className="text-right py-1">
                    {span.durationMs !== null
                      ? `${Math.round(span.durationMs)}ms`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ color: color ?? "#ddd" }}>{value}</span>
    </div>
  );
}
