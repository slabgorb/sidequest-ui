export function PausedBanner({ paused, waitingFor }: { paused: boolean; waitingFor: string[] }) {
  if (!paused) return null;
  return (
    <div role="status" aria-live="polite">
      Paused — waiting for {waitingFor.join(', ')}
    </div>
  );
}
