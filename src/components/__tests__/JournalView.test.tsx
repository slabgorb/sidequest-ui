import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JournalView, type JournalEntry } from '../JournalView';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRIES: JournalEntry[] = [
  {
    type: 'handout',
    url: '/renders/letter.png',
    description: 'A weathered letter found in the captain\'s quarters',
    timestamp: 1000,
    render_id: 'id1',
  },
  {
    type: 'handout',
    url: '/renders/map.png',
    description: 'An ancient map of the ruins',
    timestamp: 2000,
    render_id: 'id2',
  },
  {
    type: 'handout',
    url: '/renders/portrait.png',
    description: 'Portrait of the missing noble',
    timestamp: 3000,
    render_id: 'id3',
  },
];

// ---------------------------------------------------------------------------
// AC-3: JournalView renders handout gallery
// ---------------------------------------------------------------------------

describe('AC-3: JournalView renders handout gallery', () => {
  it('renders thumbnail images for each journal entry', () => {
    render(<JournalView entries={ENTRIES} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
  });

  it('displays description for each handout', () => {
    render(<JournalView entries={ENTRIES} />);

    expect(screen.getByText(/weathered letter/i)).toBeInTheDocument();
    expect(screen.getByText(/ancient map/i)).toBeInTheDocument();
    expect(screen.getByText(/missing noble/i)).toBeInTheDocument();
  });

  it('shows most recent entries first (sorted by timestamp desc)', () => {
    render(<JournalView entries={ENTRIES} />);

    const images = screen.getAllByRole('img');
    // Most recent (timestamp=3000) should be first
    expect(images[0]).toHaveAttribute('alt', 'Portrait of the missing noble');
  });

  it('shows empty state when no entries', () => {
    render(<JournalView entries={[]} />);

    expect(screen.getByText(/no handouts yet/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Lightbox opens on thumbnail click
// ---------------------------------------------------------------------------

describe('AC-4: Lightbox opens on thumbnail click', () => {
  it('opens lightbox overlay when thumbnail is clicked', () => {
    render(<JournalView entries={ENTRIES} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    expect(screen.getByTestId('journal-lightbox')).toBeInTheDocument();
  });

  it('lightbox shows full-size image', () => {
    render(<JournalView entries={ENTRIES} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const lightbox = screen.getByTestId('journal-lightbox');
    const fullImg = lightbox.querySelector('img');
    expect(fullImg).toBeTruthy();
    expect(fullImg!.src).toContain('/renders/portrait.png');
  });

  it('lightbox closes on backdrop click', () => {
    render(<JournalView entries={ENTRIES} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);
    expect(screen.getByTestId('journal-lightbox')).toBeInTheDocument();

    const backdrop = screen.getByTestId('lightbox-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('journal-lightbox')).not.toBeInTheDocument();
  });

  it('lightbox closes on Escape key', () => {
    render(<JournalView entries={ENTRIES} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);
    expect(screen.getByTestId('journal-lightbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('journal-lightbox')).not.toBeInTheDocument();
  });
});
