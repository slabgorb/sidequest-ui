import type { TurnProfile } from "../../types";

const COMPONENT_COLORS: Record<string, string> = {
  game: "#58a",
  combat: "#c64",
  chase: "#6ac",
  trope: "#8a4",
  validation: "#a48",
  watcher: "#848",
};

interface SwimLaneProps {
  component: string;
  turns: TurnProfile[];
}

export function SwimLane({ component, turns }: SwimLaneProps) {
  const color = COMPONENT_COLORS[component] ?? "#666";

  // Find turns where this component fired
  const active = turns.map((t) => ({
    turn: t.turnNumber,
    count: t.spans.filter((s) => s.component === component).length,
  }));

  const maxCount = Math.max(...active.map((a) => a.count), 1);

  return (
    <div className="flex items-center gap-3">
      <div
        className="text-xs w-[80px] text-right truncate"
        style={{ color }}
      >
        {component}
      </div>
      <div className="flex-1 flex items-end gap-[2px] h-[20px]">
        {active.map((a) => (
          <div
            key={a.turn}
            className="flex-1 rounded-t"
            style={{
              height: a.count > 0 ? `${(a.count / maxCount) * 100}%` : 0,
              minHeight: a.count > 0 ? 3 : 0,
              background: color,
              opacity: a.count > 0 ? 0.8 : 0.1,
            }}
            title={`T${a.turn}: ${a.count} events`}
          />
        ))}
      </div>
      <div className="text-xs w-[30px]" style={{ color: "#666" }}>
        {active.reduce((sum, a) => sum + a.count, 0)}
      </div>
    </div>
  );
}
