import type { TropeStatus } from "../../types";

interface TropeTrackProps {
  trope: TropeStatus;
}

export function TropeTrack({ trope }: TropeTrackProps) {
  const isHot = trope.progress > 0.7;

  return (
    <div className="flex items-center gap-3 mb-2">
      <div
        className="text-xs w-[120px] text-right truncate"
        style={{ color: isHot ? "#e83" : "#aaa" }}
      >
        {trope.name}
      </div>
      <div
        className="flex-1 h-[14px] relative rounded"
        style={{ background: "#222" }}
      >
        {/* Progress bar */}
        <div
          className="h-full rounded"
          style={{
            width: `${trope.progress * 100}%`,
            background: isHot ? "#e83" : "#48a",
            transition: "width 0.3s ease",
          }}
        />
        {/* Beat markers */}
        {trope.beats_fired.map((beat, i) => (
          <div
            key={i}
            className="absolute top-[-2px]"
            style={{
              left: `${Math.min((i + 1) * 20, 95)}%`,
              color: "#fc6",
              fontSize: 10,
            }}
            title={beat}
          >
            &#9670;
          </div>
        ))}
      </div>
      <div className="text-xs w-[40px]" style={{ color: "#888" }}>
        {(trope.progress * 100).toFixed(0)}%
      </div>
    </div>
  );
}
