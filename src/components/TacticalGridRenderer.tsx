// TacticalGridRenderer — Story 29-4: Single-room SVG tactical grid renderer
// Renders a parsed TacticalGrid as interactive SVG with genre-themed palette.

import type {
  TacticalGridData,
  TacticalThemeConfig,
  TacticalCell,
  TacticalEntity,
  FeatureDef,
  FeatureType,
  GridPos,
} from "@/types/tactical";

export interface TacticalGridRendererProps {
  grid: TacticalGridData;
  cellSize?: number;
  theme: TacticalThemeConfig;
  entities?: TacticalEntity[];
  onCellClick?: (pos: GridPos) => void;
  onCellHover?: (pos: GridPos | null) => void;
}

/** Faction → fill color mapping (AC-3/AC-6). */
const FACTION_COLORS: Record<TacticalEntity["faction"], string> = {
  player: "#2563EB",
  hostile: "#DC2626",
  neutral: "#6B7280",
  ally: "#16A34A",
};

/** Capitalize first letter for display. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DEFAULT_CELL_SIZE = 24;

// Feature type marker glyphs — visual shorthand for each feature category.
const FEATURE_MARKERS: Record<FeatureType, string> = {
  cover: "▣",
  hazard: "⚠",
  difficult_terrain: "≋",
  atmosphere: "◌",
  interactable: "⚙",
  door: "▯",
};

function cellFill(
  cell: TacticalCell,
  theme: TacticalThemeConfig,
  legend: Record<string, FeatureDef>
): string {
  switch (cell.type) {
    case "floor":
      return theme.floor;
    case "wall":
      return theme.wall;
    case "void":
      return "none";
    case "door_closed":
    case "door_open":
      return theme.door;
    case "water":
      return theme.water;
    case "difficult_terrain":
      return theme.difficultTerrain;
    case "feature": {
      const def = cell.glyph ? legend[cell.glyph] : undefined;
      if (def) {
        return theme.features[def.feature_type];
      }
      return theme.floor;
    }
  }
}

function cellStroke(cell: TacticalCell, theme: TacticalThemeConfig): string | undefined {
  if (cell.type === "void") return undefined;
  return theme.gridLine;
}

export function TacticalGridRenderer({
  grid,
  cellSize = DEFAULT_CELL_SIZE,
  theme,
  entities = [],
  onCellClick,
  onCellHover,
}: TacticalGridRendererProps) {
  const totalWidth = grid.width * cellSize;
  const totalHeight = grid.height * cellSize;

  function handleClick(x: number, y: number) {
    onCellClick?.({ x, y });
  }

  function handleMouseEnter(x: number, y: number) {
    onCellHover?.({ x, y });
  }

  function handleMouseLeave() {
    onCellHover?.(null);
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <symbol id="sym-floor">
          <rect width={cellSize} height={cellSize} />
        </symbol>
        <symbol id="sym-wall">
          <rect width={cellSize} height={cellSize} />
        </symbol>
        <symbol id="sym-water">
          <rect width={cellSize} height={cellSize} />
        </symbol>
        <symbol id="sym-door">
          <rect width={cellSize} height={cellSize} />
        </symbol>
        <symbol id="sym-difficult-terrain">
          <rect width={cellSize} height={cellSize} />
        </symbol>
      </defs>

      <g className="grid-layer">
        {grid.cells.map((row, y) =>
          row.map((cell, x) => {
            const fill = cellFill(cell, theme, grid.legend);
            const stroke = cellStroke(cell, theme);
            const px = x * cellSize;
            const py = y * cellSize;

            if (cell.type === "feature") {
              const def = cell.glyph ? grid.legend[cell.glyph] : undefined;
              const marker = def
                ? FEATURE_MARKERS[def.feature_type]
                : cell.glyph ?? "?";
              return (
                <g
                  key={`cell-${x}-${y}`}
                  onClick={() => handleClick(x, y)}
                  onMouseEnter={() => handleMouseEnter(x, y)}
                  onMouseLeave={handleMouseLeave}
                >
                  <rect
                    data-cell-type="feature"
                    data-x={x}
                    data-y={y}
                    x={px}
                    y={py}
                    width={cellSize}
                    height={cellSize}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.5}
                  />
                  {def && <title>{def.label}</title>}
                  <text
                    x={px + cellSize / 2}
                    y={py + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={cellSize * 0.5}
                    fill="#fff"
                    pointerEvents="none"
                  >
                    {marker}
                  </text>
                </g>
              );
            }

            return (
              <rect
                key={`cell-${x}-${y}`}
                data-cell-type={cell.type}
                data-x={x}
                data-y={y}
                x={px}
                y={py}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke={stroke}
                strokeWidth={stroke ? 0.5 : undefined}
                onClick={() => handleClick(x, y)}
                onMouseEnter={() => handleMouseEnter(x, y)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })
        )}
      </g>

      <g className="token-layer">
        {entities.map((entity) => {
          const r = (entity.size * cellSize) / 2;
          const cx = entity.position.x * cellSize + r;
          const cy = entity.position.y * cellSize + r;
          const fill = FACTION_COLORS[entity.faction];
          const initial = entity.name.charAt(0).toUpperCase();

          return (
            <g
              key={entity.id}
              data-entity-id={entity.id}
              transform={`translate(${entity.position.x * cellSize}, ${entity.position.y * cellSize})`}
            >
              <title>{`${entity.name} (${capitalize(entity.faction)})`}</title>
              <circle
                cx={r}
                cy={r}
                r={r}
                fill={fill}
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={r}
                y={r}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cellSize * 0.5}
                fill="#fff"
                pointerEvents="none"
              >
                {initial}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
