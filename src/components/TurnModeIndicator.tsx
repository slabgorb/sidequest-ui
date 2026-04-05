import { useEffect, useRef, useState } from 'react';
import type { GameMode } from './TurnStatusPanel';

const MODE_CONFIG: Record<GameMode, { label: string; color: string; tooltip: string }> = {
  freeplay: {
    label: 'Free Play',
    color: 'green',
    tooltip: 'Actions resolve immediately',
  },
  structured: {
    label: 'Structured',
    color: 'blue',
    tooltip: 'All players submit before the narrator responds',
  },
  cinematic: {
    label: 'Cinematic',
    color: 'purple',
    tooltip: 'The narrator sets the pace',
  },
};

export interface TurnModeIndicatorProps {
  mode: GameMode;
}

export function TurnModeIndicator({ mode }: TurnModeIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const prevModeRef = useRef<GameMode | null>(null);

  useEffect(() => {
    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      setTransitioning(true);
    } else {
      setTransitioning(false);
    }
    prevModeRef.current = mode;
  }, [mode]);

  const config = MODE_CONFIG[mode];

  return (
    <div
      data-testid="turn-mode-indicator"
      data-mode={mode}
      data-color={config.color}
      data-transitioning={transitioning ? 'true' : undefined}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span>{config.label}</span>
      {showTooltip && (
        <div data-testid="turn-mode-tooltip">
          {config.tooltip}
        </div>
      )}
    </div>
  );
}
