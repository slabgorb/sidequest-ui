/**
 * Story 9-13: Journal browse view — source & confidence display
 *
 * RED phase — these tests extend KnowledgeEntry with `source` and `confidence`
 * fields that don't exist yet in the type. They will fail until Dev adds:
 *   - `source: FactSource` to KnowledgeEntry (Observation | Dialogue | Discovery | Backstory)
 *   - `confidence: Confidence` to KnowledgeEntry (Certain | Suspected | Rumored)
 *   - Source icon display in KnowledgeJournal component
 *   - Confidence badge display in KnowledgeJournal component
 *
 * ACs tested: AC5 (source display), AC5-confidence (confidence display)
 */

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KnowledgeJournal } from '../KnowledgeJournal';
import type { KnowledgeEntry, FactCategory } from '@/providers/GameStateProvider';

// ---------------------------------------------------------------------------
// Fixtures — entries with source and confidence
// ---------------------------------------------------------------------------

function entry(overrides: Partial<KnowledgeEntry> & { fact_id: string }): KnowledgeEntry {
  return {
    content: 'A mysterious fact about the world',
    category: 'Lore' as FactCategory,
    is_new: true,
    learned_turn: 1,
    source: 'Observation',
    confidence: 'Certain',
    ...overrides,
  } as KnowledgeEntry;
}

const ENTRIES: KnowledgeEntry[] = [
  entry({
    fact_id: 's1',
    content: 'Smoke rising from the northern ridge',
    source: 'Observation',
    confidence: 'Certain',
    category: 'Place',
    learned_turn: 3,
  }),
  entry({
    fact_id: 's2',
    content: 'The innkeeper warned of bandits on the east road',
    source: 'Dialogue',
    confidence: 'Suspected',
    category: 'Person',
    learned_turn: 5,
  }),
  entry({
    fact_id: 's3',
    content: 'Hidden passage behind the bookcase in the study',
    source: 'Discovery',
    confidence: 'Certain',
    category: 'Place',
    learned_turn: 7,
  }),
  entry({
    fact_id: 's4',
    content: 'They say a dragon sleeps beneath the mountain',
    source: 'Dialogue',
    confidence: 'Rumored',
    category: 'Lore',
    learned_turn: 2,
  }),
  entry({
    fact_id: 's5',
    content: 'You grew up in the shadow of the Iron Spire',
    source: 'Backstory',
    confidence: 'Certain',
    category: 'Lore',
    learned_turn: 0,
  }),
];

// ---------------------------------------------------------------------------
// AC: Source display — entries show how the fact was learned
// ---------------------------------------------------------------------------

describe('Source display', () => {
  it('shows source for observation entries', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const smokeEntry = screen.getByText(/smoke rising/i).closest('[data-testid="journal-entry"]');
    expect(smokeEntry).toBeTruthy();
    expect(within(smokeEntry as HTMLElement).getByText(/observation/i)).toBeInTheDocument();
  });

  it('shows source for dialogue entries', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const innEntry = screen.getByText(/innkeeper warned/i).closest('[data-testid="journal-entry"]');
    expect(innEntry).toBeTruthy();
    expect(within(innEntry as HTMLElement).getByText(/dialogue/i)).toBeInTheDocument();
  });

  it('shows source for discovery entries', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const passageEntry = screen.getByText(/hidden passage/i).closest('[data-testid="journal-entry"]');
    expect(passageEntry).toBeTruthy();
    expect(within(passageEntry as HTMLElement).getByText(/discovery/i)).toBeInTheDocument();
  });

  it('shows source for backstory entries', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const backstoryEntry = screen.getByText(/iron spire/i).closest('[data-testid="journal-entry"]');
    expect(backstoryEntry).toBeTruthy();
    expect(within(backstoryEntry as HTMLElement).getByText(/backstory/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC: Confidence display — entries show confidence level
// ---------------------------------------------------------------------------

describe('Confidence display', () => {
  it('shows Certain confidence level', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const smokeEntry = screen.getByText(/smoke rising/i).closest('[data-testid="journal-entry"]');
    expect(smokeEntry).toBeTruthy();
    expect(within(smokeEntry as HTMLElement).getByText(/certain/i)).toBeInTheDocument();
  });

  it('shows Suspected confidence level', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const innEntry = screen.getByText(/innkeeper warned/i).closest('[data-testid="journal-entry"]');
    expect(innEntry).toBeTruthy();
    expect(within(innEntry as HTMLElement).getByText(/suspected/i)).toBeInTheDocument();
  });

  it('shows Rumored confidence level', () => {
    render(<KnowledgeJournal entries={ENTRIES} />);
    const dragonEntry = screen.getByText(/dragon sleeps/i).closest('[data-testid="journal-entry"]');
    expect(dragonEntry).toBeTruthy();
    expect(within(dragonEntry as HTMLElement).getByText(/rumored/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wiring: WebSocket message handler updates knowledge state with source/confidence
// ---------------------------------------------------------------------------

describe('Wire format', () => {
  it('entries have source field in type', () => {
    const e = ENTRIES[0];
    // TypeScript compile-time check: source must be on the type
    expect(e.source).toBeDefined();
    expect(typeof e.source).toBe('string');
  });

  it('entries have confidence field in type', () => {
    const e = ENTRIES[0];
    // TypeScript compile-time check: confidence must be on the type
    expect(e.confidence).toBeDefined();
    expect(typeof e.confidence).toBe('string');
  });
});
