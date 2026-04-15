/**
 * ScrapbookGallery — pure presentational component for the diegetic image
 * scrapbook (story 33-17). Takes a list of gallery entries and renders them
 * as a turn-attributed, chapter-grouped travelogue with NPC/world-fact chips,
 * a grid/list view toggle, and a compact 3-col mode at 6+ images.
 *
 * Graceful degradation: scrapbook metadata fields (turn_number, scene_name,
 * narrative_beat, scene_type, npcs, world_facts, chapter) are all optional.
 * When a field is absent the corresponding DOM element is omitted entirely —
 * no placeholders, no "Untitled" fallbacks (see CLAUDE.md "no silent
 * fallbacks"). This lets 33-17 ship before 33-18 enriches the server payload.
 */
import { useState } from "react";
import type { GalleryImage, NpcRole, ScrapbookNpc } from "@/providers/ImageBusProvider";

export type ScrapbookEntry = GalleryImage;

type ViewMode = "grid" | "list";

const COMPACT_THRESHOLD = 6;
const UNSORTED_CHAPTER = "Unsorted";

interface ScrapbookGalleryProps {
  images: readonly ScrapbookEntry[];
}

interface ChapterGroup {
  chapter: string;
  entries: ScrapbookEntry[];
}

function sortEntries(entries: readonly ScrapbookEntry[]): ScrapbookEntry[] {
  return [...entries].sort((a, b) => {
    const ta = a.turn_number ?? Number.POSITIVE_INFINITY;
    const tb = b.turn_number ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.timestamp - b.timestamp;
  });
}

function groupByChapter(sorted: readonly ScrapbookEntry[]): ChapterGroup[] {
  const groups: ChapterGroup[] = [];
  for (const entry of sorted) {
    const chapter = entry.chapter ?? UNSORTED_CHAPTER;
    const last = groups[groups.length - 1];
    if (last && last.chapter === chapter) {
      last.entries.push(entry);
    } else {
      groups.push({ chapter, entries: [entry] });
    }
  }
  return groups;
}

function entryId(entry: ScrapbookEntry): string {
  return entry.render_id ?? `ts${entry.timestamp}`;
}

function titleFor(entry: ScrapbookEntry): string | undefined {
  return entry.scene_name ?? entry.caption;
}

function ScrapbookEmpty() {
  return (
    <div
      data-testid="scrapbook-empty"
      className="flex items-center justify-center h-full p-6 text-sm italic text-muted-foreground/70 text-center"
    >
      No scenes yet — the world will fill these pages.
    </div>
  );
}

function NpcChip({
  entryId: id,
  npc,
}: {
  entryId: string;
  npc: ScrapbookNpc;
}) {
  const roleClass: Record<NpcRole, string> = {
    hostile: "bg-red-950/40 text-red-200 border-red-800/60",
    friendly: "bg-emerald-950/40 text-emerald-200 border-emerald-800/60",
    neutral: "bg-muted/40 text-muted-foreground border-muted/60",
  };
  return (
    <span
      data-testid={`scrapbook-npc-chip-${id}-${npc.name}`}
      data-npc-role={npc.role}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${roleClass[npc.role]}`}
    >
      <span
        aria-hidden="true"
        className="w-1 h-1 rounded-full bg-current opacity-70"
      />
      {npc.name}
    </span>
  );
}

function FactChip({
  entryId: id,
  index,
  text,
}: {
  entryId: string;
  index: number;
  text: string;
}) {
  return (
    <span
      data-testid={`scrapbook-fact-chip-${id}-${index}`}
      className="inline-block px-1.5 py-0.5 rounded bg-muted/30 text-[9px] text-muted-foreground border border-muted/40"
    >
      {text}
    </span>
  );
}

function SceneTypeBadge({
  entryId: id,
  sceneType,
}: {
  entryId: string;
  sceneType: string;
}) {
  return (
    <span
      data-testid={`scrapbook-scene-type-${id}`}
      data-scene-type={sceneType}
      className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] uppercase tracking-wide text-white/90"
    >
      {sceneType}
    </span>
  );
}

function TurnBadge({
  entryId: id,
  turnNumber,
  compact,
}: {
  entryId: string;
  turnNumber: number;
  compact: boolean;
}) {
  return (
    <span
      data-testid={`scrapbook-turn-badge-${id}`}
      className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-semibold text-white"
    >
      {compact ? `T${turnNumber}` : `Turn ${turnNumber}`}
    </span>
  );
}

function ScrapbookCard({
  entry,
  compact,
}: {
  entry: ScrapbookEntry;
  compact: boolean;
}) {
  const id = entryId(entry);
  const title = titleFor(entry);
  const caption = entry.narrative_beat;
  const showCaption = !compact && typeof caption === "string";

  return (
    <article
      data-testid={`scrapbook-entry-${id}`}
      className="flex flex-col gap-1 bg-surface/40 rounded overflow-hidden border border-border/40"
    >
      <div className="relative aspect-[4/3] bg-muted/30">
        <img
          src={entry.url}
          alt={entry.alt ?? title ?? "Scrapbook scene"}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {typeof entry.turn_number === "number" && (
          <TurnBadge
            entryId={id}
            turnNumber={entry.turn_number}
            compact={compact}
          />
        )}
        {typeof entry.scene_type === "string" && (
          <SceneTypeBadge entryId={id} sceneType={entry.scene_type} />
        )}
      </div>
      <div
        data-testid={`scrapbook-legend-${id}`}
        className="flex flex-col gap-1 px-2 py-1"
      >
        {typeof title === "string" && (
          <div
            data-testid={`scrapbook-title-${id}`}
            className="font-semibold text-[10px] tracking-wide"
          >
            {title}
          </div>
        )}
        {showCaption && (
          <div
            data-testid={`scrapbook-caption-${id}`}
            className="text-[9px] text-muted-foreground italic line-clamp-2"
          >
            {caption}
          </div>
        )}
        {!compact && entry.world_facts && entry.world_facts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.world_facts.map((fact, factIndex) => (
              <FactChip
                key={`fact-${id}-${fact}`}
                entryId={id}
                index={factIndex}
                text={fact}
              />
            ))}
          </div>
        )}
        {!compact && entry.npcs && entry.npcs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.npcs.map((npc) => (
              <NpcChip key={`npc-${npc.name}`} entryId={id} npc={npc} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ScrapbookGallery({ images }: ScrapbookGalleryProps) {
  const [view, setView] = useState<ViewMode>("grid");

  if (images.length === 0) {
    return <ScrapbookEmpty />;
  }

  const compact = images.length >= COMPACT_THRESHOLD;
  const sorted = sortEntries(images);
  const groups = groupByChapter(sorted);

  return (
    <div
      data-testid="scrapbook-root"
      data-view={view}
      data-compact={compact ? "true" : "false"}
      className="flex flex-col h-full"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div
          data-testid="scrapbook-scene-count"
          className="text-xs text-muted-foreground"
        >
          {images.length} scenes
        </div>
        <div className="flex gap-1" role="group" aria-label="View mode">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`px-2 py-0.5 text-[10px] rounded border ${
              view === "grid"
                ? "bg-primary/30 border-primary/60"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`px-2 py-0.5 text-[10px] rounded border ${
              view === "list"
                ? "bg-primary/30 border-primary/60"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            List
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => {
          // Disambiguate chapters that repeat non-contiguously in the sorted
          // order (same chapter split by another chapter between entries) by
          // composing the key from chapter name + first entry's stable id.
          const firstEntry = group.entries[0];
          const groupTag =
            firstEntry.render_id ?? `ts-${firstEntry.timestamp}`;
          return (
          <section
            key={`chapter-${group.chapter}-${groupTag}`}
            className="mb-3"
          >
            <div
              data-testid={`scrapbook-chapter-divider-${groupTag}`}
              className="text-[10px] uppercase tracking-widest text-muted-foreground/80 border-b border-border/30 pb-1 mb-2"
            >
              {group.chapter}
            </div>
            <div
              className={
                view === "list"
                  ? "flex flex-col gap-2"
                  : compact
                    ? "grid grid-cols-3 gap-2"
                    : "grid grid-cols-2 gap-2"
              }
            >
              {group.entries.map((entry) => (
                <ScrapbookCard
                  key={entry.render_id ?? `entry-ts-${entry.timestamp}`}
                  entry={entry}
                  compact={compact}
                />
              ))}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}
