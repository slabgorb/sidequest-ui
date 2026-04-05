import type { CharacterSheetData } from "./CharacterSheet";
import type { InventoryData } from "./InventoryPanel";
import { GenericResourceBar, type ResourceThreshold } from "./GenericResourceBar";
import { useLocalPrefs } from "@/hooks/useLocalPrefs";

type TabId = "stats" | "abilities" | "backstory" | "inventory" | "status";

export interface ResourcePool {
  value: number;
  max: number;
  thresholds: ResourceThreshold[];
}

interface CharacterPanelPrefs {
  activeTab: TabId;
  collapsed: boolean;
}

const DEFAULTS: CharacterPanelPrefs = {
  activeTab: "stats",
  collapsed: false,
};

export interface CharacterPanelProps {
  character: CharacterSheetData;
  inventory?: InventoryData | null;
  resources?: Record<string, ResourcePool> | null;
  genreSlug?: string;
  onResourceThresholdCrossed?: (info: {
    resource: string;
    threshold: ResourceThreshold;
  }) => void;
}

function toDisplayName(id: string): string {
  return id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CharacterPanel({
  character,
  inventory,
  resources,
  genreSlug,
  onResourceThresholdCrossed,
}: CharacterPanelProps) {
  const [prefs, setPref] = useLocalPrefs<CharacterPanelPrefs>(
    "sq-character-panel",
    DEFAULTS,
  );

  const activeTab = prefs.activeTab;
  const collapsed = prefs.collapsed;

  const hasResources = resources != null && Object.keys(resources).length > 0;

  const tabs: { id: TabId; label: string }[] = [
    { id: "stats", label: "Stats" },
    { id: "abilities", label: "Abilities" },
    { id: "backstory", label: "Backstory" },
    ...(inventory ? [{ id: "inventory" as TabId, label: "Inventory" }] : []),
    ...(hasResources ? [{ id: "status" as TabId, label: "Status" }] : []),
  ];

  return (
    <div data-testid="character-panel" className="flex flex-col border-r border-border/50 bg-card/50 w-72 shrink-0">
      {/* Header: portrait + name */}
      <div className="flex items-start gap-3 p-4">
        {character.portrait_url && (
          <img
            src={character.portrait_url}
            alt={character.name}
            className="w-16 h-16 rounded object-cover shrink-0"
          />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[var(--primary)] truncate">{character.name}</h2>
          <p className="text-xs text-muted-foreground">
            Level {character.level} {toDisplayName(character.class)}
          </p>
          {character.current_location && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
              {character.current_location}
            </p>
          )}
        </div>
        <button
          data-testid="panel-collapse-toggle"
          onClick={() => setPref({ collapsed: !collapsed })}
          className="ml-auto text-muted-foreground hover:text-foreground text-sm shrink-0"
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Tabs + content — hidden when collapsed */}
      {!collapsed && (
        <>
          <div role="tablist" className="flex border-b border-border/30 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setPref({ activeTab: tab.id })}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="flex-1 overflow-auto p-4">
            {activeTab === "stats" && <StatsContent stats={character.stats} />}
            {activeTab === "abilities" && <AbilitiesContent abilities={character.abilities} />}
            {activeTab === "backstory" && <BackstoryContent backstory={character.backstory} />}
            {activeTab === "inventory" && inventory && <InventoryContent inventory={inventory} />}
            {activeTab === "status" && hasResources && (
              <StatusContent
                resources={resources!}
                genreSlug={genreSlug ?? ""}
                onThresholdCrossed={onResourceThresholdCrossed}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatsContent({ stats }: { stats: Record<string, number> }) {
  const entries = Object.entries(stats);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground/60">No stats available.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {entries.map(([stat, value]) => (
        <div key={stat} className="flex justify-between px-2 py-1 rounded bg-[var(--surface)]">
          <span className="text-[var(--primary)] text-sm">{toDisplayName(stat)}</span>
          <span className="font-mono text-sm">{value}</span>
        </div>
      ))}
    </div>
  );
}

function AbilitiesContent({ abilities }: { abilities: string[] }) {
  if (abilities.length === 0) {
    return <p className="text-sm text-muted-foreground/60">No abilities.</p>;
  }
  return (
    <ul className="list-disc list-inside text-sm space-y-1">
      {abilities.map((ability) => (
        <li key={ability}>{ability}</li>
      ))}
    </ul>
  );
}

function BackstoryContent({ backstory }: { backstory: string }) {
  return <p className="text-sm font-[var(--font-narrative)]">{backstory}</p>;
}

function InventoryContent({ inventory }: { inventory: InventoryData }) {
  return (
    <div className="space-y-2">
      {inventory.items.map((item) => (
        <div key={item.name} className="text-sm">
          <span className="font-medium">{item.name}</span>
          {"quantity" in item && item.quantity && (
            <span className="text-muted-foreground ml-1">×{item.quantity}</span>
          )}
        </div>
      ))}
      {inventory.gold != null && (
        <div className="text-sm text-amber-500/80 mt-2">Gold: {inventory.gold}</div>
      )}
    </div>
  );
}

function StatusContent({
  resources,
  genreSlug,
  onThresholdCrossed,
}: {
  resources: Record<string, ResourcePool>;
  genreSlug: string;
  onThresholdCrossed?: (info: {
    resource: string;
    threshold: ResourceThreshold;
  }) => void;
}) {
  const entries = Object.entries(resources);
  return (
    <div className="space-y-3">
      {entries.map(([name, pool]) => (
        <GenericResourceBar
          key={name}
          name={name}
          value={pool.value}
          max={pool.max}
          genre_slug={genreSlug}
          thresholds={pool.thresholds}
          onThresholdCrossed={onThresholdCrossed}
        />
      ))}
    </div>
  );
}
