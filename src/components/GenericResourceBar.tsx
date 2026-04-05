import { useEffect, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface ResourceThreshold {
  value: number;
  label: string;
  direction: 'low' | 'high';
}

export interface ResourceBarProps {
  name: string;
  value: number;
  max: number;
  genre_slug: string;
  thresholds: ResourceThreshold[];
  onThresholdCrossed?: (info: {
    resource: string;
    threshold: ResourceThreshold;
  }) => void;
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export function GenericResourceBar({
  name,
  value,
  max,
  genre_slug,
  thresholds,
  onThresholdCrossed,
}: ResourceBarProps) {
  const fillPct = max > 0
    ? Math.max(0, Math.min(100, (value / max) * 100))
    : 0;

  // Determine which threshold (if any) is currently crossed
  const crossedThreshold = useMemo(() => {
    for (const t of thresholds) {
      if (t.direction === 'low' && value <= t.value) return t;
      if (t.direction === 'high' && value >= t.value) return t;
    }
    return null;
  }, [thresholds, value]);

  // Fire callback when a threshold is crossed
  useEffect(() => {
    if (crossedThreshold && onThresholdCrossed) {
      onThresholdCrossed({ resource: name, threshold: crossedThreshold });
    }
  }, [crossedThreshold, onThresholdCrossed, name]);

  const barClasses = [
    'relative',
    crossedThreshold ? 'threshold-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-testid="resource-bar"
      data-genre={genre_slug}
      data-threshold-crossed={crossedThreshold?.label ?? undefined}
      className={barClasses}
    >
      {/* Name and value */}
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground">
          {value} / {max}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative w-full h-2 bg-muted rounded-full overflow-visible">
        {/* Fill */}
        <div
          data-testid="resource-bar-fill"
          className="h-full rounded-full transition-all duration-300 bg-primary"
          style={{ width: `${fillPct}%` }}
        />

        {/* Threshold markers */}
        {thresholds.map((t) => {
          const position = max > 0 ? (t.value / max) * 100 : 0;
          return (
            <div
              key={`${t.direction}-${t.value}`}
              data-testid="threshold-marker"
              data-direction={t.direction}
              className="absolute top-0 h-full flex flex-col items-center"
              style={{ left: `${position}%` }}
            >
              <div className="w-0.5 h-full bg-foreground/50" />
              <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Toast notification on threshold crossing */}
      {crossedThreshold && (
        <div
          data-testid="threshold-toast"
          className="mt-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive"
        >
          {name}: {crossedThreshold.label}
        </div>
      )}
    </div>
  );
}
