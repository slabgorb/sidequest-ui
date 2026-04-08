import { MapOverlay, type MapState } from "@/components/MapOverlay";

interface MapWidgetProps {
  mapData: MapState;
}

export function MapWidget({ mapData }: MapWidgetProps) {
  return <MapOverlay mapData={mapData} />;
}
