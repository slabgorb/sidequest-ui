import { useState, useMemo } from 'react';

export type FactCategory = 'Lore' | 'Place' | 'Person' | 'Quest' | 'Ability';
export type FactSource = 'Observation' | 'Dialogue' | 'Discovery';
export type Confidence = 'Certain' | 'Suspected' | 'Rumored';

export interface KnowledgeEntry {
  fact_id: string;
  content: string;
  category: FactCategory;
  source: FactSource;
  confidence: Confidence;
  learned_turn: number;
}

const CATEGORIES: FactCategory[] = ['Lore', 'Place', 'Person', 'Quest', 'Ability'];

const SOURCE_ICONS: Record<FactSource, { testId: string; label: string }> = {
  Observation: { testId: 'source-observation', label: '👁' },
  Dialogue: { testId: 'source-dialogue', label: '💬' },
  Discovery: { testId: 'source-discovery', label: '⭐' },
};

type SortMode = 'chronological' | 'categorical';

interface KnowledgeJournalProps {
  entries: KnowledgeEntry[];
}

export function KnowledgeJournal({ entries }: KnowledgeJournalProps) {
  const [activeCategory, setActiveCategory] = useState<FactCategory | 'All'>('All');
  const [sortMode, setSortMode] = useState<SortMode>('chronological');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = entries.filter((e) => e.category === cat).length;
    }
    return counts;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div data-testid="knowledge-journal">
        <p>Your journal is empty. Explore the world to fill its pages.</p>
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
    <div data-testid="knowledge-journal">
      <div role="tablist">
        <button
          role="tab"
          aria-selected={activeCategory === 'All'}
          onClick={() => setActiveCategory('All')}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat} {categoryCounts[cat]}
          </button>
        ))}
      </div>

      <button
        data-testid="sort-toggle"
        onClick={() =>
          setSortMode((m) => (m === 'chronological' ? 'categorical' : 'chronological'))
        }
      >
        {sortMode === 'chronological' ? 'Sort by Category' : 'Sort by Time'}
      </button>

      {sorted.map((entry) => (
        <div key={entry.fact_id} data-testid="journal-entry">
          <span data-testid={SOURCE_ICONS[entry.source].testId}>
            {SOURCE_ICONS[entry.source].label}
          </span>
          <p>{entry.content}</p>
          <span>{entry.confidence}</span>
          <span>Turn {entry.learned_turn}</span>
        </div>
      ))}
    </div>
  );
}
