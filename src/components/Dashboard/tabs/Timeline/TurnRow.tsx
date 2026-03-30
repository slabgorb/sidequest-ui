import type { TurnProfile, SpanRecord } from "../../types";

const SPAN_COLORS: Record<string, string> = {
  intent_router: "#4a9",
  agent: "#58a",
  json_extractor: "#a84",
  state: "#484",
  trope: "#8a4",
  game: "#58a",
  combat: "#c64",
  chase: "#6ac",
  validation: "#a48",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  agent_span_open: "#58a",
  agent_span_close: "#58a",
  state_transition: "#484",
  validation_warning: "#a48",
  subsystem_exercise_summary: "#848",
  coverage_gap: "#a44",
  json_extraction_result: "#a84",
};

function spanColor(span: SpanRecord, isDegraded: boolean): string {
  if (isDegraded) return "#a44";
  return (
    SPAN_COLORS[span.component] ??
    EVENT_TYPE_COLORS[span.eventType] ??
    "#666"
  );
}

// Estimate span width as a fraction of turn duration
function spanWidthFraction(span: SpanRecord, totalDuration: number): number {
  if (span.durationMs !== null && span.durationMs > 0) {
    return span.durationMs / totalDuration;
  }
  // For events without explicit duration, give a minimum visible width
  return Math.max(0.02, 50 / totalDuration);
}

interface TurnRowProps {
  turn: TurnProfile;
  y: number;
  rowHeight: number;
  labelWidth: number;
  maxDuration: number;
  isSelected: boolean;
  onClick: () => void;
}

export function TurnRow({
  turn,
  y,
  rowHeight,
  labelWidth,
  maxDuration,
  isSelected,
  onClick,
}: TurnRowProps) {
  const chartWidth = 100; // percentage
  const barAreaStart = labelWidth;
  const barAreaWidth = chartWidth - (labelWidth / 10); // approximate

  // Build sequential spans: lay them out left-to-right
  // Use startOffsetMs for positioning when available
  const sortedSpans = [...turn.spans].sort(
    (a, b) => a.startOffsetMs - b.startOffsetMs,
  );

  // If we have agentDurationMs, create a synthetic agent span
  const effectiveDuration = turn.totalDurationMs || turn.agentDurationMs || maxDuration;
  const scale = effectiveDuration > 0 ? 1 / effectiveDuration : 1 / maxDuration;

  // Tier indicator
  const tierColor =
    turn.extractionTier === 1
      ? "#4a9"
      : turn.extractionTier === 2
        ? "#e83"
        : turn.extractionTier === 3
          ? "#e44"
          : "#666";

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      opacity={isSelected ? 1 : 0.85}
    >
      {/* Selection highlight */}
      {isSelected && (
        <rect
          x="0"
          y={y - 2}
          width="100%"
          height={rowHeight + 4}
          fill="#58a"
          opacity={0.1}
          rx={2}
        />
      )}

      {/* Turn label */}
      <text
        x={8}
        y={y + rowHeight / 2 + 4}
        fill={turn.isDegraded ? "#a44" : "#888"}
        fontSize={11}
        fontFamily="monospace"
      >
        T{turn.turnNumber}
      </text>

      {/* Extraction tier dot */}
      <circle
        cx={50}
        cy={y + rowHeight / 2}
        r={3}
        fill={tierColor}
      >
        <title>
          {turn.extractionTier
            ? `Tier ${turn.extractionTier}`
            : "No extraction data"}
        </title>
      </circle>

      {/* Span bars */}
      {sortedSpans.map((span, i) => {
        const xFrac = span.startOffsetMs * scale;
        const wFrac = spanWidthFraction(span, effectiveDuration);
        const color = spanColor(span, turn.isDegraded);

        // Convert fractions to SVG coordinates
        // barAreaStart is in px, we need to work in a mixed coordinate system
        // Use percentage-based positioning via transform
        const xPercent = (xFrac * barAreaWidth);
        const wPercent = Math.max(wFrac * barAreaWidth, 0.5);

        return (
          <g key={i}>
            <rect
              x={`${barAreaStart + xPercent}%`}
              y={y + 4}
              width={`${wPercent}%`}
              height={rowHeight - 8}
              fill={color}
              rx={2}
              opacity={0.9}
            >
              <title>
                {`${span.component} (${span.eventType})\n` +
                  `Offset: ${Math.round(span.startOffsetMs)}ms\n` +
                  `Duration: ${span.durationMs !== null ? `${Math.round(span.durationMs)}ms` : "—"}\n` +
                  Object.entries(span.fields)
                    .filter(([k]) => k !== "turn_number")
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                    .join("\n")}
              </title>
            </rect>

            {/* Token count label on agent spans */}
            {span.component === "game" &&
              span.eventType === "agent_span_close" &&
              turn.tokenCountIn !== undefined && (
                <text
                  x={`${barAreaStart + xPercent + wPercent / 2}%`}
                  y={y + rowHeight / 2 + 3}
                  fill="#fff"
                  fontSize={9}
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity={0.7}
                  style={{ pointerEvents: "none" }}
                >
                  {turn.tokenCountIn}→{turn.tokenCountOut}
                </text>
              )}
          </g>
        );
      })}

      {/* Duration label at end */}
      <text
        x="98%"
        y={y + rowHeight / 2 + 4}
        fill="#666"
        fontSize={10}
        fontFamily="monospace"
        textAnchor="end"
      >
        {effectiveDuration > 0 ? `${Math.round(effectiveDuration)}ms` : "—"}
      </text>
    </g>
  );
}
