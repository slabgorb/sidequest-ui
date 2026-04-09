import { MapOverlay, type MapState } from "@/components/MapOverlay";

interface MapWidgetProps {
  mapData: MapState | null;
}

export function MapWidget({ mapData }: MapWidgetProps) {
  if (!mapData) {
    return (
      <div
        data-testid="map-panel-empty"
        className="p-4 text-sm text-muted-foreground/60 italic"
      >
        No map data yet. The world map will populate as you explore.
      </div>
    );
  }
  return <MapOverlay mapData={mapData} />;
}
