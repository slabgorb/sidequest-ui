import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { KnowledgeEntry } from "@/providers/GameStateProvider";

export interface LoreWidgetProps {
  character: CharacterSheetData | null;
  knowledgeEntries: KnowledgeEntry[];
}

/**
 * Lore panel — reference content the player can read between turns.
 *
 * Holds the things that aren't mechanical character state: backstory,
 * accumulated world facts, NPC dossiers, faction notes. Lives as a peer
 * of Character / Inventory / Map rather than buried inside the Character
 * tab. The Character tab focuses on mechanical sheet (stats, abilities).
 */
export function LoreWidget({ character, knowledgeEntries }: LoreWidgetProps) {
  const hasBackstory = character?.backstory && character.backstory.trim().length > 0;
  const hasKnowledge = knowledgeEntries && knowledgeEntries.length > 0;

  if (!hasBackstory && !hasKnowledge) {
    return (
      <div data-testid="lore-panel" className="p-4 text-sm text-muted-foreground/60 italic">
        No lore yet. As you play, your backstory and the world facts you discover will collect here.
      </div>
    );
  }

  return (
    <div data-testid="lore-panel" className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      {hasBackstory && (
        <section data-testid="lore-backstory">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]/70 mb-2">
            Backstory
          </h3>
          <p className="text-sm font-[var(--font-narrative)] leading-relaxed whitespace-pre-wrap">
            {character!.backstory}
          </p>
        </section>
      )}

      {hasKnowledge && (
        <section data-testid="lore-knowledge">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]/70 mb-2">
            Discovered Facts
          </h3>
          <ul className="space-y-1.5">
            {knowledgeEntries.map((entry) => (
              <li
                key={entry.fact_id}
                className="text-sm text-muted-foreground leading-snug flex gap-2"
              >
                <span className="text-muted-foreground/40 shrink-0 text-xs uppercase tracking-wider self-center">
                  {entry.category}
                </span>
                <span>{entry.content}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
