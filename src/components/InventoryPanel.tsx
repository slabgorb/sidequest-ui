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

interface StackedItem {
  item: InventoryItem;
  count: number;
}

export function InventoryPanel({ data }: InventoryPanelProps) {
  // Stack identical items by normalized name, then group by type
  const stacked = new Map<string, StackedItem>();
  for (const item of data.items) {
    const key = item.name.trim();
    const existing = stacked.get(key);
    if (existing) {
      existing.count += item.quantity ?? 1;
    } else {
      stacked.set(key, { item, count: item.quantity ?? 1 });
    }
  }

  // Group stacked items by type
  const grouped = new Map<string, StackedItem[]>();
  for (const entry of stacked.values()) {
    const list = grouped.get(entry.item.type) ?? [];
    list.push(entry);
    grouped.set(entry.item.type, list);
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
            {items.map(({ item, count }) => (
              <li
                key={`${item.type}-${item.name.trim()}`}
                data-testid={`item-${item.name}`}
                data-equipped={item.equipped != null ? String(item.equipped) : undefined}
                className="p-2 rounded bg-[var(--surface)]"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {item.name}
                    {count > 1 && (
                      <span className="text-muted-foreground ml-1 font-normal">x{count}</span>
                    )}
                  </span>
                  {item.equipped === true && (
                    <span className="text-xs text-muted-foreground">Equipped</span>
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
