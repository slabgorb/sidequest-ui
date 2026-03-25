export interface CombatEnemy {
  name: string;
  hp: number;
  max_hp: number;
  ac?: number;
}

export interface CombatState {
  in_combat: boolean;
  enemies: CombatEnemy[];
  turn_order: string[];
  current_turn: string;
}

interface CombatOverlayProps {
  combat: CombatState;
}

export function CombatOverlay({ combat }: CombatOverlayProps) {
  if (!combat.in_combat) return null;

  return (
    <div data-testid="combat-overlay" className="fixed top-4 right-4 z-30 w-64 bg-card border border-border rounded-lg shadow-lg p-3">
      <h3 className="text-sm font-bold mb-2 text-destructive">Combat</h3>

      {/* Turn order */}
      {combat.turn_order.length > 0 && (
        <div className="mb-2 text-xs text-muted-foreground">
          <span className="font-semibold">Turn:</span>{" "}
          {combat.turn_order.map((name) => (
            <span
              key={name}
              className={name === combat.current_turn ? "font-bold text-foreground" : ""}
            >
              {name}
              {name !== combat.turn_order[combat.turn_order.length - 1] ? " → " : ""}
            </span>
          ))}
        </div>
      )}

      {/* Enemy list with HP bars */}
      <ul className="space-y-1.5">
        {combat.enemies.map((enemy) => {
          const hpPct = enemy.max_hp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.max_hp) * 100)) : 0;
          const isBloodied = hpPct <= 50 && hpPct > 0;
          const isDefeated = enemy.hp <= 0;
          return (
            <li key={enemy.name} className={`text-xs ${isDefeated ? "opacity-40" : ""}`}>
              <div className="flex justify-between mb-0.5">
                <span className={isBloodied ? "text-destructive" : ""}>
                  {enemy.name}
                  {isBloodied && !isDefeated ? " (bloodied)" : ""}
                  {isDefeated ? " (defeated)" : ""}
                </span>
                <span className="text-muted-foreground">
                  {enemy.hp}/{enemy.max_hp}
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${hpPct}%`,
                    backgroundColor: hpPct > 50 ? "var(--primary)" : hpPct > 25 ? "orange" : "var(--destructive)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
