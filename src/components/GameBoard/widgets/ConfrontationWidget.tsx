import { ConfrontationOverlay, type ConfrontationData } from "@/components/ConfrontationOverlay";

interface ConfrontationWidgetProps {
  data: ConfrontationData;
  onBeatSelect?: (beatId: string) => void;
}

export function ConfrontationWidget({ data, onBeatSelect }: ConfrontationWidgetProps) {
  return <ConfrontationOverlay data={data} onBeatSelect={onBeatSelect} inline />;
}
