// DungeonMapRenderer — Story 29-8: Multi-room SVG dungeon map with fog of war and zoom.
// Renders a DungeonLayout as a global SVG grid with room-level visibility and zoom transitions.

import { useMemo, useState } from "react";
import type {
  DungeonLayoutData,
  PlacedRoomData,
  TacticalThemeConfig,
  TacticalEntity,
  TacticalCell,
  FeatureDef,
  FeatureType,
} from "@/types/tactical";

const DEFAULT_CELL_SIZE = 24;

const FEATURE_MARKERS: Record<FeatureType, string> = {
  cover: "\u25A3",
  hazard: "\u26A0",
  difficult_terrain: "\u224B",
  atmosphere: "\u25CC",
  interactable: "\u2699",
  door: "\u25AF",
};

export interface DungeonMapRendererProps {
  layout: DungeonLayoutData;
  currentRoomId: string;
  discoveredRoomIds: readonly string[];
  theme: TacticalThemeConfig;
  onRoomClick?: (roomId: string) => void;
  entities?: readonly TacticalEntity[];
}

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
      return def ? theme.features[def.feature_type] : theme.floor;
    }
  }
}

function cellStroke(
  cell: TacticalCell,
  theme: TacticalThemeConfig
): string | undefined {
  return cell.type === "void" ? undefined : theme.gridLine;
}

function isEntityInRoom(
  entity: TacticalEntity,
  room: PlacedRoomData
): boolean {
  const lx = entity.position.x - room.globalOffsetX;
  const ly = entity.position.y - room.globalOffsetY;
  return lx >= 0 && lx < room.grid.width && ly >= 0 && ly < room.grid.height;
}

// Detect shared-wall boundaries between adjacent rooms.
// When two rooms are horizontally adjacent (room A right edge touches room B left edge),
// skip room B's first column to avoid double-rendering the shared wall.
function computeSharedWallSkips(
  rooms: readonly PlacedRoomData[]
): Map<string, Set<number>> {
  const skipCols = new Map<string, Set<number>>();
  for (const room of rooms) {
    skipCols.set(room.roomId, new Set());
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];

      // Horizontal adjacency: a's right edge == b's left edge
      if (
        a.globalOffsetX + a.grid.width === b.globalOffsetX &&
        rangesOverlap(a.globalOffsetY, a.grid.height, b.globalOffsetY, b.grid.height)
      ) {
        skipCols.get(b.roomId)!.add(0);
      }
      // Reverse: b's right edge == a's left edge
      if (
        b.globalOffsetX + b.grid.width === a.globalOffsetX &&
        rangesOverlap(a.globalOffsetY, a.grid.height, b.globalOffsetY, b.grid.height)
      ) {
        skipCols.get(a.roomId)!.add(0);
      }
    }
  }

  return skipCols;
}

function rangesOverlap(
  aStart: number,
  aLen: number,
  bStart: number,
  bLen: number
): boolean {
  return aStart < bStart + bLen && bStart < aStart + aLen;
}

export function DungeonMapRenderer({
  layout,
  currentRoomId,
  discoveredRoomIds,
  theme,
  onRoomClick,
  entities = [],
}: DungeonMapRendererProps) {
  const [zoomedRoomId, setZoomedRoomId] = useState<string | null>(null);
  const cellSize = DEFAULT_CELL_SIZE;

  const discoveredRooms = layout.rooms.filter((r) =>
    discoveredRoomIds.includes(r.roomId)
  );

  const sharedSkips = useMemo(
    () => computeSharedWallSkips(discoveredRooms),
    [discoveredRooms]
  );

  // ViewBox: overview shows entire dungeon, zoom shows one room
  const overviewVB = `0 0 ${layout.globalWidth * cellSize} ${layout.globalHeight * cellSize}`;
  const zoomedRoom = zoomedRoomId
    ? discoveredRooms.find((r) => r.roomId === zoomedRoomId)
    : null;
  const viewBox = zoomedRoom
    ? `${zoomedRoom.globalOffsetX * cellSize} ${zoomedRoom.globalOffsetY * cellSize} ${zoomedRoom.grid.width * cellSize} ${zoomedRoom.grid.height * cellSize}`
    : overviewVB;

  function handleRoomClick(roomId: string) {
    setZoomedRoomId((prev) => (prev === roomId ? null : roomId));
    onRoomClick?.(roomId);
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      style={{ transition: "all 0.3s ease" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {discoveredRooms.map((room) => {
        const isCurrent = room.roomId === currentRoomId;
        const roomEntities = isCurrent
          ? entities.filter((e) => isEntityInRoom(e, room))
          : [];
        const skipColSet = sharedSkips.get(room.roomId) ?? new Set<number>();

        return (
          <g
            key={room.roomId}
            data-room-id={room.roomId}
            data-current={isCurrent ? "true" : undefined}
            className={isCurrent ? "current-room" : undefined}
            transform={`translate(${room.globalOffsetX * cellSize}, ${room.globalOffsetY * cellSize})`}
            opacity={isCurrent ? undefined : 0.4}
            onClick={() => handleRoomClick(room.roomId)}
          >
            {/* Room cells */}
            {room.grid.cells.map((row, y) =>
              row.map((cell, x) => {
                if (skipColSet.has(x)) return null;

                const globalX = room.globalOffsetX + x;
                const globalY = room.globalOffsetY + y;
                const fill = cellFill(cell, theme, room.grid.legend);
                const stroke = cellStroke(cell, theme);
                const px = x * cellSize;
                const py = y * cellSize;

                if (cell.type === "feature") {
                  const def = cell.glyph
                    ? room.grid.legend[cell.glyph]
                    : undefined;
                  const marker = def
                    ? FEATURE_MARKERS[def.feature_type]
                    : cell.glyph ?? "?";
                  return (
                    <g key={`cell-${x}-${y}`}>
                      <rect
                        data-cell-type="feature"
                        data-x={globalX}
                        data-y={globalY}
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
                    data-x={globalX}
                    data-y={globalY}
                    x={px}
                    y={py}
                    width={cellSize}
                    height={cellSize}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={stroke ? 0.5 : undefined}
                  />
                );
              })
            )}

            {/* Room name label */}
            <text
              x={(room.grid.width * cellSize) / 2}
              y={(room.grid.height * cellSize) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fill="#fff"
              pointerEvents="none"
            >
              {room.roomName}
            </text>

            {/* Entity tokens — only in current room */}
            {roomEntities.map((entity) => {
              const lx = entity.position.x - room.globalOffsetX;
              const ly = entity.position.y - room.globalOffsetY;
              return (
                <circle
                  key={entity.id}
                  data-entity-id={entity.id}
                  cx={lx * cellSize + cellSize / 2}
                  cy={ly * cellSize + cellSize / 2}
                  r={cellSize * 0.35 * entity.size}
                  fill={entity.faction === "player" ? "#4CAF50" : "#F44336"}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
