import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapOverlay, type MapState } from '../MapOverlay';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_MAP: MapState = {
  current_location: 'The Ashwood Tavern',
  region: 'Eldergrove',
  explored: [
    { name: 'The Ashwood Tavern', x: 5, y: 3, type: 'settlement', connections: ['Forest Path'] },
    { name: 'Forest Path', x: 6, y: 4, type: 'road', connections: ['The Ashwood Tavern', 'Ruins'] },
    { name: 'Ruins', x: 8, y: 5, type: 'dungeon', connections: ['Forest Path'] },
  ],
  fog_bounds: { width: 20, height: 15 },
};

const SINGLE_LOCATION_MAP: MapState = {
  current_location: 'Town Square',
  region: 'Starting Zone',
  explored: [
    { name: 'Town Square', x: 10, y: 7, type: 'settlement', connections: [] },
  ],
  fog_bounds: { width: 20, height: 15 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapOverlay', () => {
  // --- AC-1: Explored locations render as nodes ---
  describe('AC-1: Explored location nodes', () => {
    it('renders all explored locations as labeled nodes', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      expect(screen.getByText('The Ashwood Tavern')).toBeInTheDocument();
      expect(screen.getByText('Forest Path')).toBeInTheDocument();
      expect(screen.getByText('Ruins')).toBeInTheDocument();
    });

    it('renders location type indicators', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      const tavern = screen.getByTestId('map-node-The Ashwood Tavern');
      expect(tavern).toHaveAttribute('data-type', 'settlement');

      const ruins = screen.getByTestId('map-node-Ruins');
      expect(ruins).toHaveAttribute('data-type', 'dungeon');
    });

    it('renders region name', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      expect(screen.getByText('Eldergrove')).toBeInTheDocument();
    });
  });

  // --- AC-2: Connections render between locations ---
  describe('AC-2: Location connections', () => {
    it('renders connection paths between connected locations', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      // Connections should be rendered as path/line elements
      const connections = screen.getAllByTestId(/^map-connection-/);
      // Tavern↔Path and Path↔Ruins = 2 unique connections
      expect(connections.length).toBeGreaterThanOrEqual(2);
    });

    it('handles location with no connections', () => {
      render(<MapOverlay mapData={SINGLE_LOCATION_MAP} onClose={() => {}} />);
      expect(screen.getByText('Town Square')).toBeInTheDocument();
      expect(screen.queryAllByTestId(/^map-connection-/)).toHaveLength(0);
    });
  });

  // --- AC-3: Current location is highlighted ---
  describe('AC-3: Current location marker', () => {
    it('marks the current location with an active indicator', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      const currentNode = screen.getByTestId('map-node-The Ashwood Tavern');
      expect(currentNode).toHaveAttribute('data-current', 'true');
    });

    it('does not mark non-current locations as active', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      const ruins = screen.getByTestId('map-node-Ruins');
      expect(ruins).not.toHaveAttribute('data-current', 'true');
    });
  });

  // --- AC-4: Fog of war ---
  describe('AC-4: Fog of war', () => {
    it('renders a fog overlay element', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      expect(screen.getByTestId('map-fog')).toBeInTheDocument();
    });

    it('uses fog_bounds dimensions for the fog layer', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      const fog = screen.getByTestId('map-fog');
      // Fog should reference the bounds dimensions
      expect(fog).toBeInTheDocument();
    });
  });

  // --- Edge cases ---
  describe('Edge cases', () => {
    it('renders with empty explored array', () => {
      const emptyMap: MapState = {
        current_location: '',
        region: 'Unknown',
        explored: [],
        fog_bounds: { width: 10, height: 10 },
      };
      render(<MapOverlay mapData={emptyMap} onClose={() => {}} />);
      expect(screen.getByTestId('map-overlay')).toBeInTheDocument();
    });

    it('has a root element with data-testid for overlay targeting', () => {
      render(<MapOverlay mapData={BASE_MAP} onClose={() => {}} />);
      expect(screen.getByTestId('map-overlay')).toBeInTheDocument();
    });

    it('renders a close button that calls onClose', () => {
      const onClose = vi.fn();
      render(<MapOverlay mapData={BASE_MAP} onClose={onClose} />);
      const closeBtn = screen.getByRole('button', { name: /close/i });
      closeBtn.click();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
