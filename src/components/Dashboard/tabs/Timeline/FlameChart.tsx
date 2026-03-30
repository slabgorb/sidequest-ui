import type { TurnProfile } from "../../types";
import { TurnRow } from "./TurnRow";

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 80;
const PADDING = 8;

interface FlameChartProps {
  turns: TurnProfile[];
  selectedTurn: number | null;
  onSelectTurn: (turnNumber: number | null) => void;
}

export function FlameChart({ turns, selectedTurn, onSelectTurn }: FlameChartProps) {
  // Find the max duration across all turns for consistent scaling
  const maxDuration = Math.max(
    ...turns.map((t) => t.totalDurationMs || t.agentDurationMs || 1000),
    1000,
  );

  const totalHeight = turns.length * (ROW_HEIGHT + PADDING) + PADDING;

  return (
    <div>
      {/* Time axis header */}
      <div className="flex items-center mb-2" style={{ paddingLeft: LABEL_WIDTH }}>
        <div className="flex-1 flex justify-between text-xs" style={{ color: "#666" }}>
          <span>0ms</span>
          <span>{Math.round(maxDuration / 4)}ms</span>
          <span>{Math.round(maxDuration / 2)}ms</span>
          <span>{Math.round((maxDuration * 3) / 4)}ms</span>
          <span>{Math.round(maxDuration)}ms</span>
        </div>
      </div>

      {/* Chart body */}
      <svg
        width="100%"
        height={totalHeight}
        style={{ display: "block" }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={`${LABEL_WIDTH + frac * (100 - (LABEL_WIDTH / 10))}%`}
            y1="0"
            x2={`${LABEL_WIDTH + frac * (100 - (LABEL_WIDTH / 10))}%`}
            y2={totalHeight}
            stroke="#222"
            strokeDasharray="4 4"
          />
        ))}

        {turns.map((turn, i) => {
          const y = i * (ROW_HEIGHT + PADDING) + PADDING;
          return (
            <TurnRow
              key={turn.turnNumber}
              turn={turn}
              y={y}
              rowHeight={ROW_HEIGHT}
              labelWidth={LABEL_WIDTH}
              maxDuration={maxDuration}
              isSelected={selectedTurn === turn.turnNumber}
              onClick={() =>
                onSelectTurn(
                  selectedTurn === turn.turnNumber ? null : turn.turnNumber,
                )
              }
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "#888" }}>
        <LegendItem color="#4a9" label="Intent" />
        <LegendItem color="#58a" label="Agent" />
        <LegendItem color="#a84" label="Extraction" />
        <LegendItem color="#484" label="Patch" />
        <LegendItem color="#848" label="Delta" />
        <LegendItem color="#a44" label="Degraded" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-3 h-2 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
