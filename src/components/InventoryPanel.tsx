export interface InventoryItem {
  name: string;
  type: string;
  equipped?: boolean;
  quantity?: number;
  description: string;
}

export interface InventoryData {
  items: InventoryItem[];
  gold: number;
}

export interface InventoryPanelProps {
  data: InventoryData;
}

export function InventoryPanel({ data }: InventoryPanelProps) {
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of data.items) {
    const list = grouped.get(item.type) ?? [];
    list.push(item);
    grouped.set(item.type, list);
  }

  return (
    <div data-testid="inventory-panel" className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[var(--primary)]">Inventory</h2>
        <span className="text-sm font-mono">{data.gold} gold</span>
      </div>

      {Array.from(grouped.entries()).map(([type, items]) => (
        <div key={type}>
          <h3 className="text-sm font-semibold capitalize mb-1">{type}</h3>
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li
                key={`${item.type}-${item.name}-${idx}`}
                data-testid={`item-${item.name}`}
                data-equipped={item.equipped != null ? String(item.equipped) : undefined}
                className="p-2 rounded bg-[var(--surface)]"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{item.name}</span>
                  {item.equipped != null && (
                    <span className="text-xs text-[var(--accent)]">
                      {item.equipped ? 'Equipped' : 'Unequipped'}
                    </span>
                  )}
                  {item.quantity != null && (
                    <span className="text-xs font-mono">x{item.quantity}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
