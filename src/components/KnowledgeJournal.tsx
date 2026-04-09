import { useState, useMemo } from 'react';
import type { KnowledgeEntry, FactCategory } from '@/providers/GameStateProvider';

const CATEGORIES: FactCategory[] = ['Lore', 'Place', 'Person', 'Quest', 'Ability'];

type SortMode = 'chronological' | 'categorical';

interface KnowledgeJournalProps {
  entries: KnowledgeEntry[];
  onRequestJournal?: (category?: string) => void;
  /** Character backstory — absorbed from the old standalone Lore panel.
   *  Renders as a static section above the discovered-facts list. */
  backstory?: string;
}

export function KnowledgeJournal({ entries, onRequestJournal, backstory }: KnowledgeJournalProps) {
  const [activeCategory, setActiveCategory] = useState<FactCategory | 'All'>('All');
  const [sortMode, setSortMode] = useState<SortMode>('chronological');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = entries.filter((e) => e.category === cat).length;
    }
    return counts;
  }, [entries]);

  const hasBackstory = backstory && backstory.trim().length > 0;

  const backstorySection = hasBackstory ? (
    <section data-testid="knowledge-backstory" className="mb-5 pb-4 border-b border-border/30">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]/70 mb-2">
        Backstory
      </h3>
      <p className="text-sm font-[var(--font-narrative)] leading-relaxed whitespace-pre-wrap text-foreground/80">
        {backstory}
      </p>
    </section>
  ) : null;

  if (entries.length === 0) {
    return (
      <div data-testid="knowledge-journal" className="p-6">
        {backstorySection}
        <p className="text-muted-foreground/60 italic">
          {hasBackstory
            ? "Your journal is empty beyond your own history. Explore the world to fill its pages."
            : "Your journal is empty. Explore the world to fill its pages."}
        </p>
      </div>
    );
  }

  const filtered =
    activeCategory === 'All'
      ? entries
      : entries.filter((e) => e.category === activeCategory);

  const sorted = [...filtered];
  if (sortMode === 'chronological') {
    sorted.sort((a, b) => b.learned_turn - a.learned_turn);
  } else {
    sorted.sort((a, b) => {
      const catCmp = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
      if (catCmp !== 0) return catCmp;
      return b.learned_turn - a.learned_turn;
    });
  }

  return (
    <div data-testid="knowledge-journal" className="p-4">
      {backstorySection}
      <div role="tablist" className="flex gap-1 mb-3 flex-wrap">
        <button
          role="tab"
          aria-selected={activeCategory === 'All'}
          onClick={() => setActiveCategory('All')}
          className={`text-xs px-2 py-1 rounded ${activeCategory === 'All' ? 'bg-primary/20 text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-2 py-1 rounded ${activeCategory === cat ? 'bg-primary/20 text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
          >
            {cat} {categoryCounts[cat] > 0 && <span className="opacity-50">{categoryCounts[cat]}</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-3">
        <button
          data-testid="sort-toggle"
          onClick={() =>
            setSortMode((m) => (m === 'chronological' ? 'categorical' : 'chronological'))
          }
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
        >
          {sortMode === 'chronological' ? 'Sort by Category' : 'Sort by Time'}
        </button>
        {onRequestJournal && (
          <button
            data-testid="refresh-journal"
            onClick={() => onRequestJournal(activeCategory === 'All' ? undefined : activeCategory)}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
          >
            Refresh from server
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((entry) => (
          <div key={entry.fact_id} data-testid="journal-entry" className="text-sm border-l-2 border-border/30 pl-3 py-1">
            <p className="text-foreground/80">{entry.content}</p>
            <div className="flex gap-2 text-xs text-muted-foreground/50 mt-0.5">
              <span>{entry.category}</span>
              <span>Turn {entry.learned_turn}</span>
              {entry.source && <span>{entry.source}</span>}
              {entry.confidence && <span>{entry.confidence}</span>}
              {entry.is_new && <span className="text-accent-foreground/40 italic">new</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
