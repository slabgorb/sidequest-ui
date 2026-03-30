interface ConnectionBadgeProps {
  connected: boolean;
}

export function ConnectionBadge({ connected }: ConnectionBadgeProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: connected ? "#4a9" : "#e55" }}
      />
      <span style={{ color: connected ? "#4a9" : "#e55" }}>
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
