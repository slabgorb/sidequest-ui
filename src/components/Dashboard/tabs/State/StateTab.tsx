import { useState } from "react";
import type { TurnProfile } from "../../types";
import { EmptyState } from "../../shared/EmptyState";
import { SnapshotTree } from "./SnapshotTree";
import { DiffViewer } from "./DiffViewer";

interface StateTabProps {
  turns: TurnProfile[];
}

type StateView = "tree" | "diff";

export function StateTab({ turns }: StateTabProps) {
  const [view, setView] = useState<StateView>("tree");
  const [selectedTurnIdx, setSelectedTurnIdx] = useState<number>(-1);
  const [searchText, setSearchText] = useState("");

  // Find turns with snapshots
  const turnsWithSnapshots = turns.filter((t) => t.snapshot !== null);

  if (turnsWithSnapshots.length === 0) {
    return (
      <EmptyState
        message="No state snapshots available"
        detail="State snapshots will appear after the server sends game_state_snapshot events."
      />
    );
  }

  // Default to latest turn
  const effectiveIdx =
    selectedTurnIdx >= 0 && selectedTurnIdx < turnsWithSnapshots.length
      ? selectedTurnIdx
      : turnsWithSnapshots.length - 1;
  const selectedTurn = turnsWithSnapshots[effectiveIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "#333", background: "#16162a" }}
      >
        <button
          onClick={() => setView("tree")}
          className="text-xs px-3 py-1 rounded"
          style={{
            background: view === "tree" ? "#333" : "transparent",
            color: view === "tree" ? "#eee" : "#888",
            border: "1px solid #444",
          }}
        >
          Tree View
        </button>
        <button
          onClick={() => setView("diff")}
          className="text-xs px-3 py-1 rounded"
          style={{
            background: view === "diff" ? "#333" : "transparent",
            color: view === "diff" ? "#eee" : "#888",
            border: "1px solid #444",
          }}
        >
          Diff View
        </button>

        <select
          value={effectiveIdx}
          onChange={(e) => setSelectedTurnIdx(parseInt(e.target.value, 10))}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#222", color: "#eee", border: "1px solid #444" }}
        >
          {turnsWithSnapshots.map((t, i) => (
            <option key={t.turnNumber} value={i}>
              Turn {t.turnNumber}
              {t.classifiedIntent ? ` (${t.classifiedIntent})` : ""}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search state..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="text-xs px-2 py-1 rounded flex-1 max-w-[300px]"
          style={{ background: "#222", color: "#eee", border: "1px solid #444" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {view === "tree" && selectedTurn.snapshot && (
          <SnapshotTree
            data={selectedTurn.snapshot}
            searchText={searchText}
          />
        )}
        {view === "diff" && (
          <DiffViewer
            before={selectedTurn.previousSnapshot}
            after={selectedTurn.snapshot}
            turnNumber={selectedTurn.turnNumber}
          />
        )}
      </div>
    </div>
  );
}
