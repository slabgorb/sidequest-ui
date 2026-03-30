import { useMemo, useState } from "react";
import type { TurnProfile, TropeStatus } from "../../types";
import { EmptyState } from "../../shared/EmptyState";
import { SwimLane } from "./SwimLane";
import { TropeTrack } from "./TropeTrack";

interface SubsystemsTabProps {
  turns: TurnProfile[];
  histogram: Record<string, number>;
  tropes: TropeStatus[];
}

type SubView = "swimlanes" | "intents" | "extraction";

export function SubsystemsTab({ turns, histogram, tropes }: SubsystemsTabProps) {
  const [view, setView] = useState<SubView>("swimlanes");

  // Collect all unique components across all turns
  const components = useMemo(() => {
    const set = new Set<string>();
    for (const turn of turns) {
      for (const span of turn.spans) {
        set.add(span.component);
      }
    }
    return [...set].sort();
  }, [turns]);

  // Intent history: turn → intent → agent
  const intentHistory = useMemo(
    () =>
      turns
        .filter((t) => t.classifiedIntent)
        .map((t) => ({
          turn: t.turnNumber,
          intent: t.classifiedIntent!,
          agent: t.agentName ?? "—",
          input: t.playerInput,
        })),
    [turns],
  );

  // Extraction tier distribution
  const tierDist = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, unknown: 0 };
    for (const t of turns) {
      if (t.extractionTier === 1) dist[1]++;
      else if (t.extractionTier === 2) dist[2]++;
      else if (t.extractionTier === 3) dist[3]++;
      else dist.unknown++;
    }
    return dist;
  }, [turns]);

  if (turns.length === 0) {
    return (
      <EmptyState
        message="No subsystem data yet"
        detail="Subsystem activity will appear after the first turn."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-view selector */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "#333", background: "#16162a" }}
      >
        {(["swimlanes", "intents", "extraction"] as SubView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="text-xs px-3 py-1 rounded"
            style={{
              background: view === v ? "#333" : "transparent",
              color: view === v ? "#eee" : "#888",
              border: "1px solid #444",
            }}
          >
            {v === "swimlanes"
              ? "Swimlanes"
              : v === "intents"
                ? "Intent History"
                : "Extraction Tiers"}
          </button>
        ))}

        {/* Histogram summary */}
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "#666" }}>
          {Object.entries(histogram)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([comp, count]) => (
              <span key={comp}>
                {comp}: <span style={{ color: "#aaa" }}>{count}</span>
              </span>
            ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {view === "swimlanes" && (
          <div className="space-y-4">
            {components.map((comp) => (
              <SwimLane key={comp} component={comp} turns={turns} />
            ))}
            {tropes.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-bold mb-2" style={{ color: "#888" }}>
                  Trope Progression
                </div>
                {tropes.map((trope) => (
                  <TropeTrack key={trope.name} trope={trope} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === "intents" && (
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#666" }}>
                <th className="text-left py-2 pr-4">Turn</th>
                <th className="text-left py-2 pr-4">Intent</th>
                <th className="text-left py-2 pr-4">Agent</th>
                <th className="text-left py-2">Input</th>
              </tr>
            </thead>
            <tbody>
              {intentHistory.map((row) => (
                <tr
                  key={row.turn}
                  style={{ color: "#aaa", borderTop: "1px solid #222" }}
                >
                  <td className="py-1 pr-4">T{row.turn}</td>
                  <td className="py-1 pr-4" style={{ color: "#7ae" }}>
                    {row.intent}
                  </td>
                  <td className="py-1 pr-4" style={{ color: "#58a" }}>
                    {row.agent}
                  </td>
                  <td className="py-1 truncate max-w-[400px]">{row.input}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "extraction" && (
          <div>
            <div className="text-xs mb-4" style={{ color: "#888" }}>
              JSON Extraction Tier Distribution
            </div>
            <div className="flex items-end gap-4 h-[200px]">
              <TierBar label="Tier 1 (Direct)" count={tierDist[1]} total={turns.length} color="#4a9" />
              <TierBar label="Tier 2 (Fenced)" count={tierDist[2]} total={turns.length} color="#e83" />
              <TierBar label="Tier 3 (Regex)" count={tierDist[3]} total={turns.length} color="#e44" />
              {tierDist.unknown > 0 && (
                <TierBar label="Unknown" count={tierDist.unknown} total={turns.length} color="#666" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TierBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="text-xs" style={{ color: "#aaa" }}>
        {count}
      </div>
      <div
        className="w-full rounded-t"
        style={{
          height: `${Math.max(pct, 2)}%`,
          background: color,
          minHeight: 4,
        }}
      />
      <div className="text-xs text-center" style={{ color: "#888" }}>
        {label}
      </div>
      <div className="text-xs" style={{ color: "#666" }}>
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}
