import { useEffect, useRef } from "react";

interface ReconnectBannerProps {
  readyState: number;
}

export function ReconnectBanner({ readyState }: ReconnectBannerProps) {
  // Only show after we've seen a successful OPEN. First-load CONNECTING/CLOSED
  // is not "reconnecting" — it's "connecting for the first time," and the
  // ConnectScreen already owns that UX.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (readyState === WebSocket.OPEN) wasOpenRef.current = true;
  }, [readyState]);

  if (!wasOpenRef.current || readyState === WebSocket.OPEN) return null;
  return (
    <div
      role="status"
      className="reconnect-banner w-full bg-amber-600/90 text-white text-center text-sm py-1 px-3 shadow animate-pulse"
    >
      Reconnecting...
    </div>
  );
}
