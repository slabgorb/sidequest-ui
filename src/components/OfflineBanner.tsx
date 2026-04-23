// MP-03 Task 8 — surfaced when the narrator-host is unreachable so the
// table knows the cached view is no longer live. ReconnectBanner handles
// the short-term "trying to reconnect" window; OfflineBanner is the
// escalation for when reconnect has given up or been offline long enough
// that players should assume the session is read-only.

export interface OfflineBannerProps {
  offline: boolean;
}

export function OfflineBanner({ offline }: OfflineBannerProps) {
  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="w-full bg-destructive/10 text-destructive-foreground text-center py-1 text-sm tracking-wide"
    >
      Narrator unreachable — showing cached state (read-only)
    </div>
  );
}
