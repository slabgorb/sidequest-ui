interface ReconnectBannerProps {
  visible: boolean;
}

export function ReconnectBanner({ visible }: ReconnectBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="reconnect-banner w-full bg-amber-600/90 text-white text-center text-sm py-1 px-3 shadow animate-pulse"
    >
      Reconnecting...
    </div>
  );
}
