import { useEffect, useRef, useState } from "react";
import type { TurnProfile } from "../../types";
import { EmptyState } from "../../shared/EmptyState";
import { FlameChart } from "./FlameChart";
import { TurnDetail } from "./TurnDetail";

interface TimelineTabProps {
  turns: TurnProfile[];
}

export function TimelineTab({ turns }: TimelineTabProps) {
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (scrollRef.current && selectedTurn === null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length, selectedTurn]);

  if (turns.length === 0) {
    return (
      <EmptyState
        message="Waiting for first turn..."
        detail="Play a turn in the game tab to see timing data here."
      />
    );
  }

  const selected = selectedTurn !== null
    ? turns.find((t) => t.turnNumber === selectedTurn) ?? null
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Flame chart area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4">
        <FlameChart
          turns={turns}
          selectedTurn={selectedTurn}
          onSelectTurn={setSelectedTurn}
        />
      </div>

      {/* Detail panel for selected turn */}
      {selected && (
        <div
          className="border-t p-4 max-h-[250px] overflow-auto"
          style={{ borderColor: "#333", background: "#16162a" }}
        >
          <TurnDetail
            turn={selected}
            onClose={() => setSelectedTurn(null)}
          />
        </div>
      )}
    </div>
  );
}
