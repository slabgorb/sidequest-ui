import { useEffect } from "react";

export interface CharacterSummary {
  player_id: string;
  name: string;
  character_name: string;
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

function displayName(c: CharacterSummary): string {
  return c.character_name || c.name;
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
      className={[
        "fixed right-0 top-0 h-full z-40 bg-card border-l border-border",
        "flex flex-col gap-1 p-2 transition-all duration-300 ease-in-out",
        collapsed ? "w-14" : "w-64",
      ].join(" ")}
      {...(collapsed ? { "data-collapsed": "true" } : {})}
    >
      <button
        aria-label="Toggle panel"
        onClick={onToggle}
        className="self-start p-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? ">" : "<"}
      </button>

      {characters.map((c) => {
        const hpPct = Math.min(100, c.hp_max > 0 ? (c.hp / c.hp_max) * 100 : 0);
        const hpLevel = getHpLevel(c.hp, c.hp_max);
        const isSelf = currentPlayerId !== undefined && c.player_id === currentPlayerId;
        const isActing = activePlayerId !== undefined && activePlayerId !== null && c.player_id === activePlayerId;
        const isWaiting = activePlayerId !== undefined && activePlayerId !== null && c.player_id !== activePlayerId;
        return (
          <div
            key={c.player_id}
            data-testid={`character-card-${c.player_id}`}
            className={[
              "flex items-center gap-2 p-2 rounded-md bg-card border border-border/50",
              "transition-all duration-300",
              isActing ? "ring-2 ring-primary" : "",
              isWaiting ? "opacity-65" : "",
            ].filter(Boolean).join(" ")}
          >
            {/* Portrait */}
            {c.portrait_url ? (
              <img
                src={c.portrait_url}
                alt={displayName(c)}
                className="w-10 h-10 rounded-full object-cover border-2 border-border flex-shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground flex-shrink-0 border-2 border-border">
                {getInitials(displayName(c))}
              </span>
            )}

            {/* Details — hidden when collapsed */}
            <div
              className={[
                "flex-1 min-w-0 overflow-hidden transition-opacity duration-200",
                collapsed ? "opacity-0 w-0" : "opacity-100",
              ].join(" ")}
              style={{ visibility: collapsed ? "hidden" : "visible" }}
            >
              <span className="block text-sm font-semibold text-foreground truncate">
                {displayName(c)}
                {isSelf && (
                  <span data-testid="you-badge" className="ml-1 text-xs text-muted-foreground/50 font-normal">YOU</span>
                )}
                {isActing && (
                  <span data-testid="acting-badge" className="ml-1 text-xs text-primary font-semibold uppercase tracking-wide">ACTING</span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">{[c.class, `Lv.${c.level}`].filter(Boolean).join(" ")} — {c.hp}/{c.hp_max}</span>

              {/* HP bar */}
              <div
                data-testid={`hp-bar-${c.player_id}`}
                data-hp-level={hpLevel}
                className="mt-1 h-1.5 w-full rounded-full bg-border/30 overflow-hidden"
              >
                <div
                  data-testid={`hp-bar-fill-${c.player_id}`}
                  className={[
                    "h-full rounded-full transition-all duration-500 ease-out",
                    hpLevel === "healthy" ? "bg-green-500" : "",
                    hpLevel === "warning" ? "bg-amber-500" : "",
                    hpLevel === "critical" ? "bg-red-500 animate-pulse" : "",
                  ].filter(Boolean).join(" ")}
                  style={{ width: `${hpPct}%` }}
                />
              </div>

              {/* Status effects */}
              {c.status_effects.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.status_effects.map((effect) => (
                    <span
                      key={effect}
                      data-testid="status-badge"
                      className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-accent/20 text-accent-foreground"
                    >
                      {effect}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
