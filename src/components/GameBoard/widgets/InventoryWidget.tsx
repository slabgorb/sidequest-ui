import { InventoryPanel, type InventoryData } from "@/components/InventoryPanel";

interface InventoryWidgetProps {
  data: InventoryData;
}

export function InventoryWidget({ data }: InventoryWidgetProps) {
  return <InventoryPanel data={data} />;
}
