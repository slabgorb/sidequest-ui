import { useState, useEffect, useCallback } from 'react';

export interface JournalEntry {
  type: 'handout';
  url: string;
  description: string;
  timestamp: number;
  render_id: string;
}

interface JournalViewProps {
  entries: JournalEntry[];
}

export function JournalView({ entries }: JournalViewProps) {
  const [lightboxEntry, setLightboxEntry] = useState<JournalEntry | null>(null);

  const closeLightbox = useCallback(() => setLightboxEntry(null), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeLightbox]);

  if (entries.length === 0) {
    return <div data-testid="journal-empty">No handouts yet.</div>;
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div data-testid="journal-view">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {sorted.map((entry) => (
          <div key={entry.render_id} onClick={() => setLightboxEntry(entry)} style={{ cursor: 'pointer' }}>
            <img
              src={entry.url}
              alt={entry.description}
              style={{ width: '100%', objectFit: 'cover', borderRadius: '4px' }}
            />
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{entry.description}</p>
          </div>
        ))}
      </div>

      {lightboxEntry && (
        <div data-testid="journal-lightbox" style={{
          position: 'fixed', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div
            data-testid="lightbox-backdrop"
            onClick={closeLightbox}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={lightboxEntry.url}
              alt={lightboxEntry.description}
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
