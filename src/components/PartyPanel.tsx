import { useEffect } from "react";

export interface CharacterSummary {
  player_id: string;
  name: string;
  portrait_url?: string;
  hp: number;
  hp_max: number;
  status_effects: string[];
  class: string;
  level: number;
}

interface PartyPanelProps {
  characters: CharacterSummary[];
  collapsed: boolean;
  onToggle: () => void;
  currentPlayerId?: string;
  activePlayerId?: string | null;
}

function getHpLevel(hp: number, hpMax: number): "healthy" | "warning" | "critical" {
  const pct = hpMax > 0 ? (hp / hpMax) * 100 : 0;
  if (pct > 50) return "healthy";
  if (pct > 25) return "warning";
  return "critical";
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function PartyPanel({ characters, collapsed, onToggle, currentPlayerId, activePlayerId }: PartyPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "p") return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      onToggle();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onToggle]);

  return (
    <div
      data-testid="party-panel"
      {...(collapsed ? { "data-collapsed": "true" } : {})}
    >
      <button
        aria-label="Toggle panel"
        onClick={onToggle}
      >
        {collapsed ? "Expand" : "Collapse"}
      </button>

      {characters.map((c) => {
        const hpPct = Math.min(100, c.hp_max > 0 ? (c.hp / c.hp_max) * 100 : 0);
        const isSelf = currentPlayerId !== undefined && c.player_id === currentPlayerId;
        const isActing = activePlayerId !== undefined && activePlayerId !== null && c.player_id === activePlayerId;
        const isWaiting = activePlayerId !== undefined && activePlayerId !== null && c.player_id !== activePlayerId;
        return (
          <div
            key={c.player_id}
            data-testid={`character-card-${c.player_id}`}
            className={[
              "transition-all duration-300",
              isActing ? "ring-2 ring-primary" : "",
              isWaiting ? "opacity-65" : "",
            ].filter(Boolean).join(" ")}
          >
            {c.portrait_url ? (
              <img src={c.portrait_url} alt={c.name} />
            ) : (
              <span>{getInitials(c.name)}</span>
            )}

            <div style={{ visibility: collapsed ? "hidden" : "visible" }}>
              <span>
                {c.name}
                {isSelf && (
                  <span data-testid="you-badge" className="ml-1 text-xs text-muted-foreground/50 font-normal">YOU</span>
                )}
                {isActing && (
                  <span data-testid="acting-badge" className="ml-1 text-xs text-primary font-semibold uppercase tracking-wide">ACTING</span>
                )}
              </span>
              <span>{[c.class, `Lv.${c.level}`].filter(Boolean).join(" ")} — {c.hp}/{c.hp_max}</span>
              <div
                data-testid={`hp-bar-${c.player_id}`}
                data-hp-level={getHpLevel(c.hp, c.hp_max)}
              >
                <div
                  data-testid={`hp-bar-fill-${c.player_id}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>

              {c.status_effects.map((effect) => (
                <span key={effect} data-testid="status-badge">
                  {effect}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
