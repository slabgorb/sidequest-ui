export interface ExploredLocation {
  name: string;
  x: number;
  y: number;
  type: string;
  connections: string[];
}

export interface MapState {
  current_location: string;
  region: string;
  explored: ExploredLocation[];
  fog_bounds: { width: number; height: number };
}

export interface MapOverlayProps {
  mapData: MapState;
  onClose: () => void;
}

export function MapOverlay({ mapData, onClose }: MapOverlayProps) {
  const explored = mapData.explored ?? [];
  const fogBounds = mapData.fog_bounds ?? { width: 10, height: 10 };
  const connections = getUniqueConnections(explored);

  return (
    <div data-testid="map-overlay" className="p-6 space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[var(--primary)]">{mapData.region}</h2>
        <button onClick={onClose} aria-label="Close" className="text-sm px-2 py-1 rounded">
          Close
        </button>
      </div>

      <svg
        viewBox={`0 0 ${fogBounds.width} ${fogBounds.height}`}
        className="w-full h-64 bg-[var(--surface)] rounded"
      >
        <rect
          data-testid="map-fog"
          x="0"
          y="0"
          width={fogBounds.width}
          height={fogBounds.height}
          fill="rgba(0,0,0,0.6)"
        />

        {connections.map(([from, to]) => {
          const a = explored.find((l) => l.name === from);
          const b = explored.find((l) => l.name === to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              data-testid={`map-connection-${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--accent, #888)"
              strokeWidth="0.15"
            />
          );
        })}

        {explored.map((loc) => (
          <g
            key={loc.name}
            data-testid={`map-node-${loc.name}`}
            data-type={loc.type}
            data-current={loc.name === mapData.current_location ? 'true' : undefined}
          >
            <circle
              cx={loc.x}
              cy={loc.y}
              r={loc.name === mapData.current_location ? 0.6 : 0.4}
              fill={loc.name === mapData.current_location ? 'var(--accent, gold)' : 'var(--primary, #ccc)'}
            />
            <text
              x={loc.x}
              y={loc.y + 1.2}
              textAnchor="middle"
              fontSize="0.7"
              fill="var(--primary, white)"
            >
              {loc.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getUniqueConnections(explored: ExploredLocation[]): [string, string][] {
  const seen = new Set<string>();
  const result: [string, string][] = [];

  for (const loc of explored) {
    for (const conn of loc.connections) {
      const key = [loc.name, conn].sort().join('↔');
      if (!seen.has(key)) {
        seen.add(key);
        result.push([loc.name, conn]);
      }
    }
  }

  return result;
}
