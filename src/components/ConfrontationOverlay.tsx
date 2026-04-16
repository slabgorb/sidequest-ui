import type { DiceRequestPayload, DiceResultPayload, DiceThrowParams } from "@/types/payloads";
import { InlineDiceTray } from "@/dice/InlineDiceTray";

// ═══════════════════════════════════════════════════════════
// Types — exported for tests and consumers
// ═══════════════════════════════════════════════════════════

export interface EncounterActor {
  name: string;
  role: string;
  portrait_url?: string;
}

export interface EncounterMetric {
  name: string;
  current: number;
  starting: number;
  direction: 'ascending' | 'bidirectional';
  threshold_high: number | null;
  threshold_low: number | null;
}

export interface BeatOption {
  id: string;
  label: string;
  metric_delta: number;
  stat_check: string;
  risk?: string;
  resolution?: boolean;
}

export interface StatValue {
  current: number;
  max: number;
}

export interface SecondaryStats {
  stats: Record<string, StatValue>;
  damage_tier?: string;
}

export interface ConfrontationData {
  type: string;
  label: string;
  category: string;
  actors: EncounterActor[];
  metric: EncounterMetric;
  beats: BeatOption[];
  secondary_stats: SecondaryStats | null;
  genre_slug: string;
  mood: string;
  /**
   * Server-side clear signal: when `false`, the confrontation has ended and
   * the overlay should unmount. Absent or `true` means active. Handled at
   * dispatch in App.tsx (search: `payload.active !== false`).
   */
  active?: boolean;
}

interface ConfrontationOverlayProps {
  data: ConfrontationData | null;
  onBeatSelect?: (beatId: string) => void;
  /** When true, renders inline (no fixed positioning) for use inside a widget. */
  inline?: boolean;
  /** Dice state — rendered inline below beats when active. */
  diceRequest?: DiceRequestPayload | null;
  diceResult?: DiceResultPayload | null;
  playerId?: string;
  onDiceThrow?: (params: DiceThrowParams, face: number[]) => void;
}

// ═══════════════════════════════════════════════════════════
// Metric bar
// ═══════════════════════════════════════════════════════════

function MetricBar({ metric }: { metric: EncounterMetric }) {
  let fillPct: number;
  if (metric.direction === 'bidirectional') {
    const range = (metric.threshold_high ?? 10) - (metric.threshold_low ?? 0);
    fillPct = range > 0
      ? ((metric.current - (metric.threshold_low ?? 0)) / range) * 100
      : 50;
  } else {
    const max = metric.threshold_high ?? 10;
    fillPct = max > 0 ? (metric.current / max) * 100 : 0;
  }
  fillPct = Math.max(0, Math.min(100, fillPct));

  return (
    <div data-testid="metric-bar" className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold capitalize">{metric.name}</span>
        <span className="text-muted-foreground">{metric.current}</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          data-testid="metric-bar-fill"
          className="h-full rounded-full transition-all duration-300 bg-primary"
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Actor portraits
// ═══════════════════════════════════════════════════════════

function ActorPortrait({
  actor,
  isStandoff,
}: {
  actor: EncounterActor;
  isStandoff: boolean;
}) {
  const portraitClasses = [
    'flex flex-col items-center gap-1',
    isStandoff ? 'extreme-closeup' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div data-testid="actor-portrait" className={portraitClasses}>
      {actor.portrait_url ? (
        <img
          src={actor.portrait_url}
          alt={actor.name}
          className="w-16 h-16 rounded-full object-cover border-2 border-border"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border-2 border-border">
          {actor.name.charAt(0)}
        </div>
      )}
      <span className="text-xs font-semibold">{actor.name}</span>
      <span className="text-[10px] text-muted-foreground capitalize">
        {actor.role}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Beat action buttons
// ═══════════════════════════════════════════════════════════

function BeatActions({ beats, onBeatSelect }: { beats: BeatOption[]; onBeatSelect?: (beatId: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {beats.map((beat) => {
        // Match the narration renderer's "Ram (Grip)" format rather than
        // concatenating label + stat_check in the a11y text stream.
        // Risk text was previously inlined into the label (three fields crammed
        // into one button); move it to a native tooltip so the button stays
        // scannable and the consequence is still surfaced on hover/long-press.
        const tooltip = beat.risk
          ? `${beat.label} (${beat.stat_check}) — ${beat.risk}`
          : `${beat.label} (${beat.stat_check})`;
        return (
          <button
            key={beat.id}
            type="button"
            title={tooltip}
            aria-label={tooltip}
            data-resolution={beat.resolution ? 'true' : undefined}
            onClick={() => onBeatSelect?.(beat.id)}
            className={[
              'px-3 py-1.5 rounded text-xs border transition-colors',
              beat.resolution
                ? 'border-destructive text-destructive hover:bg-destructive/10 font-bold'
                : 'border-border hover:bg-muted',
            ].join(' ')}
          >
            <span>{beat.label}</span>
            {' '}
            <span className="text-muted-foreground text-[10px]">
              ({beat.stat_check})
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Secondary stats panel (chase rig stats)
// ═══════════════════════════════════════════════════════════

function SecondaryStatsPanel({ stats }: { stats: SecondaryStats }) {
  const entries = Object.entries(stats.stats ?? {});
  if (entries.length === 0) return null;
  return (
    <div data-testid="secondary-stats" className="mt-3 p-2 bg-muted/50 rounded text-xs space-y-1">
      {stats.damage_tier && (
        <div className="text-center font-semibold text-muted-foreground/70 mb-1">{stats.damage_tier}</div>
      )}
      {entries.map(([name, val]) => (
        <div key={name} className="flex justify-between">
          <span className="capitalize">{name.replace(/_/g, " ")}</span>
          <span>{val.current} / {val.max}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════

export function ConfrontationOverlay({ data, onBeatSelect, inline, diceRequest, diceResult, playerId, onDiceThrow }: ConfrontationOverlayProps) {
  if (!data) return null;

  const isStandoff = data.type === 'standoff';

  const overlayClasses = [
    inline
      ? 'bg-card p-4'
      : 'fixed inset-x-0 bottom-0 z-30 bg-card border-t border-border shadow-lg p-4',
    isStandoff ? 'letterbox' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-testid="confrontation-overlay"
      data-type={data.type}
      data-genre={data.genre_slug}
      className={overlayClasses}
    >
      <h3 className="text-sm font-bold mb-2">{data.label}</h3>

      {/* Actor portraits */}
      <div className="flex justify-around mb-3">
        {data.actors.map((actor) => (
          <ActorPortrait
            key={actor.name}
            actor={actor}
            isStandoff={isStandoff}
          />
        ))}
      </div>

      {/* Metric bar */}
      <MetricBar metric={data.metric} />

      {/* Beat action buttons */}
      <BeatActions beats={data.beats} onBeatSelect={onBeatSelect} />

      {/* Inline dice tray — rolls right here when a beat is selected */}
      {onDiceThrow && playerId && (
        <InlineDiceTray
          diceRequest={diceRequest ?? null}
          diceResult={diceResult ?? null}
          playerId={playerId}
          onThrow={onDiceThrow}
          genreSlug={data.genre_slug}
        />
      )}

      {/* Secondary stats (chase rigs, etc.) */}
      {data.secondary_stats && (
        <SecondaryStatsPanel stats={data.secondary_stats} />
      )}
    </div>
  );
}
