import type { TurnProfile } from "../../types";

interface NarrativeLogProps {
  turns: TurnProfile[];
}

export function NarrativeLog({ turns }: NarrativeLogProps) {
  // Extract narrations from span fields
  const entries = turns
    .map((t) => {
      const closeSpan = t.spans.find(
        (s) => s.component === "game" && s.eventType === "agent_span_close",
      );
      const narrationLen = closeSpan?.fields.narration_len as number | undefined;
      return {
        turn: t.turnNumber,
        input: t.playerInput,
        agent: t.agentName ?? "—",
        intent: t.classifiedIntent ?? "—",
        narrationLen: narrationLen ?? 0,
        timestamp: t.timestamp,
        isDegraded: t.isDegraded,
      };
    })
    .filter((e) => e.input || e.narrationLen > 0);

  if (entries.length === 0) {
    return (
      <div className="text-xs" style={{ color: "#888" }}>
        No narrative entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const ts = entry.timestamp.split("T")[1]?.split(".")[0] ?? "";
        return (
          <div
            key={entry.turn}
            className="flex items-start gap-3 py-2 border-b"
            style={{ borderColor: "#222" }}
          >
            <span className="shrink-0" style={{ color: "#555", minWidth: 30 }}>
              T{entry.turn}
            </span>
            <span className="shrink-0" style={{ color: "#555", minWidth: 60 }}>
              {ts}
            </span>
            <span className="shrink-0" style={{ color: "#58a", minWidth: 80 }}>
              {entry.agent}
            </span>
            <span className="shrink-0" style={{ color: "#7ae", minWidth: 80 }}>
              {entry.intent}
            </span>
            <span
              className="flex-1 truncate"
              style={{ color: entry.isDegraded ? "#a44" : "#aaa" }}
            >
              {entry.input || "(no input)"}
            </span>
            <span style={{ color: "#666" }}>{entry.narrationLen} chars</span>
          </div>
        );
      })}
    </div>
  );
}
