interface ReconnectBannerProps {
  readyState: number;
}

export function ReconnectBanner({ readyState }: ReconnectBannerProps) {
  if (readyState === WebSocket.OPEN) return null;
  return (
    <div role="status" className="reconnect-banner">
      Reconnecting...
    </div>
  );
}
