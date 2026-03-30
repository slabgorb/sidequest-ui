import type { GameSnapshot } from "../../types";
import { useTurnDiff } from "../../hooks/useTurnDiff";

interface DiffViewerProps {
  before: GameSnapshot | null;
  after: GameSnapshot | null;
  turnNumber: number;
}

const DIFF_COLORS = {
  added: "#4a9",
  removed: "#e44",
  changed: "#e83",
};

export function DiffViewer({ before, after, turnNumber }: DiffViewerProps) {
  const diff = useTurnDiff(before, after);

  if (!before) {
    return (
      <div className="text-xs" style={{ color: "#888" }}>
        No previous snapshot — this is the first turn with state data.
      </div>
    );
  }

  if (diff.length === 0) {
    return (
      <div className="text-xs" style={{ color: "#888" }}>
        No state changes on turn {turnNumber}.
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="mb-3" style={{ color: "#888" }}>
        {diff.length} changes on turn {turnNumber}
      </div>
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#666" }}>
            <th className="text-left py-1 pr-4">Type</th>
            <th className="text-left py-1 pr-4">Path</th>
            <th className="text-left py-1 pr-4">Before</th>
            <th className="text-left py-1">After</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((entry, i) => (
            <tr
              key={i}
              style={{
                color: DIFF_COLORS[entry.type],
                borderTop: "1px solid #222",
              }}
            >
              <td className="py-1 pr-4 uppercase text-[10px]">{entry.type}</td>
              <td className="py-1 pr-4" style={{ color: "#7ae" }}>
                {entry.path}
              </td>
              <td
                className="py-1 pr-4 max-w-[300px] truncate"
                style={{ color: entry.type === "removed" ? "#e44" : "#888" }}
              >
                {entry.before !== undefined ? formatValue(entry.before) : "—"}
              </td>
              <td
                className="py-1 max-w-[300px] truncate"
                style={{ color: entry.type === "added" ? "#4a9" : "#ddd" }}
              >
                {entry.after !== undefined ? formatValue(entry.after) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return `"${v}"`;
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
