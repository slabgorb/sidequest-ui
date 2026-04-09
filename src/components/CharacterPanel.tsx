import { useRef } from "react";
import type { CharacterSheetData } from "./CharacterSheet";
import { GenericResourceBar, type ResourceThreshold } from "./GenericResourceBar";
import { useLocalPrefs } from "@/hooks/useLocalPrefs";
import type { CharacterSummary } from "./PartyPanel";
import { KnowledgeJournal } from "./KnowledgeJournal";
import type { KnowledgeEntry } from "@/providers/GameStateProvider";

type TabId = "stats" | "abilities" | "status" | "journal";

export interface ResourcePool {
  value: number;
  max: number;
  thresholds: ResourceThreshold[];
}

interface CharacterPanelPrefs {
  activeTab: TabId;
}

const DEFAULTS: CharacterPanelPrefs = {
  activeTab: "stats",
};

export interface CharacterPanelProps {
  character: CharacterSheetData;
  resources?: Record<string, ResourcePool> | null;
  genreSlug?: string;
  onResourceThresholdCrossed?: (info: {
    resource: string;
    threshold: ResourceThreshold;
  }) => void;
  knowledgeEntries?: KnowledgeEntry[];
  onRequestJournal?: (category?: string) => void;
  characters?: CharacterSummary[];
  currentPlayerId?: string;
  activePlayerId?: string | null;
}

function toDisplayName(id: string): string {
  return id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CharacterPanel({
  character,
  resources,
  genreSlug,
  knowledgeEntries,
  onRequestJournal,
  onResourceThresholdCrossed,
  characters = [],
  currentPlayerId,
  activePlayerId,
}: CharacterPanelProps) {
  const [prefs, setPref] = useLocalPrefs<CharacterPanelPrefs>(
    "sq-character-panel",
    DEFAULTS,
  );

  const hasResources = resources != null && Object.keys(resources).length > 0;

  // Backstory removed: lives in the top-level Lore panel now. Character
  // tab is the mechanical sheet (stats / abilities / status), not lore.
  const tabs: { id: TabId; label: string }[] = [
    { id: "stats", label: "Stats" },
    { id: "abilities", label: "Abilities" },
    ...(hasResources ? [{ id: "status" as TabId, label: "Status" }] : []),
    ...(knowledgeEntries && knowledgeEntries.length > 0 ? [{ id: "journal" as TabId, label: "Journal" }] : []),
  ];

  // Inventory has its own top-level panel — drop the redundant subtab.
  // If a previous session persisted activeTab="inventory" (now removed),
  // fall back to "stats" instead of leaving the panel blank.
  const activeTab: TabId = (tabs.some((t) => t.id === prefs.activeTab) ? prefs.activeTab : "stats");

  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      data-testid="character-panel"
      ref={panelRef}
      className="character-panel flex flex-col bg-card/50 h-full overflow-y-auto"
    >
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
          {/* Per-character location removed: it was set once at chargen and
              never updated as the player moved, leading to a stale "mouth"
              display while the top header correctly showed "ANTECHAMBER".
              Party shares location — the top-level location header is the
              single source of truth. */}
        </div>
      </div>

      {/* Tabs + content */}
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
        {activeTab === "status" && hasResources && (
          <StatusContent
            resources={resources!}
            genreSlug={genreSlug ?? ""}
            onThresholdCrossed={onResourceThresholdCrossed}
          />
        )}
        {activeTab === "journal" && knowledgeEntries && (
          <KnowledgeJournal entries={knowledgeEntries} onRequestJournal={onRequestJournal} />
        )}
      </div>

      {/* Party members section */}
      {characters.length > 0 && (
        <div data-testid="party-section" className="border-t border-border/30 p-2 flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Party</h3>
          {characters.map((c) => {
            const hpPct = Math.min(100, c.hp_max > 0 ? (c.hp / c.hp_max) * 100 : 0);
            const hpLevel = getHpLevel(c.hp, c.hp_max);
            const isSelf = currentPlayerId !== undefined && c.player_id === currentPlayerId;
            const isActing = activePlayerId !== undefined && activePlayerId !== null && c.player_id === activePlayerId;
            const isWaiting = activePlayerId !== undefined && activePlayerId !== null && c.player_id !== activePlayerId;
            return (
              <div
                key={c.player_id}
                data-testid={`party-member-${c.player_id}`}
                className={[
                  "flex items-center gap-2 p-2 rounded-md bg-card border border-border/50",
                  "transition-all duration-300",
                  isActing ? "ring-2 ring-primary" : "",
                  isWaiting ? "opacity-65" : "",
                ].filter(Boolean).join(" ")}
              >
                {c.portrait_url ? (
                  <img
                    src={c.portrait_url}
                    alt={c.character_name || c.name}
                    className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground flex-shrink-0 border border-border">
                    {(c.character_name || c.name).split(/\s+/).map((w) => w[0]).join("").toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-foreground truncate">
                    {c.character_name || c.name}
                    {isSelf && <span className="ml-1 text-[10px] text-muted-foreground/50 font-normal">YOU</span>}
                    {isActing && <span className="ml-1 text-[10px] text-primary font-semibold uppercase">ACTING</span>}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{c.class} Lv.{c.level} — {c.hp}/{c.hp_max}</span>
                  <div className="mt-0.5 h-1 w-full rounded-full bg-border/30 overflow-hidden">
                    <div
                      className={[
                        "h-full rounded-full transition-all duration-500 ease-out",
                        hpLevel === "healthy" ? "bg-green-500" : "",
                        hpLevel === "warning" ? "bg-amber-500" : "",
                        hpLevel === "critical" ? "bg-red-500 animate-pulse" : "",
                      ].filter(Boolean).join(" ")}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  {c.status_effects.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {c.status_effects.map((effect) => (
                        <span key={effect} className="inline-block px-1 py-0.5 text-[9px] rounded bg-accent/20 text-accent-foreground">
                          {effect}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function getHpLevel(hp: number, hpMax: number): "healthy" | "warning" | "critical" {
  const pct = hpMax > 0 ? (hp / hpMax) * 100 : 0;
  if (pct > 50) return "healthy";
  if (pct > 25) return "warning";
  return "critical";
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
  const real = abilities.filter((a) => !a.includes("auto-filled"));
  if (real.length === 0) {
    return <p className="text-sm text-muted-foreground/60">No abilities.</p>;
  }
  return (
    <ul className="list-disc list-inside text-sm space-y-1">
      {real.map((ability) => (
        <li key={ability}>{ability}</li>
      ))}
    </ul>
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
