/**
 * MultiplayerTurnBanner — turn ownership cue above the InputBar.
 *
 * Solves two playtest 2026-04-24 bugs at once:
 *   1. "Multiplayer view has no turn indicator" — neither player's UI
 *      tells them whose turn it is. (Sebastien needs the mechanical
 *      handle; Alex needs to know the wait is normal.)
 *   2. "Considering your words…" hangs read as crashes — without a
 *      heartbeat or "waiting on X" line, the 30-90s narrator turn looks
 *      like a freeze.
 *
 * Renders nothing in single-player (no peers to wait on, no turn to
 * announce). In multiplayer, renders one of three states:
 *   - "You have the floor" — local player's turn (active or no
 *     specific active player but local hasn't submitted).
 *   - "It's <Name>'s turn…" — peer is acting.
 *   - "Waiting for the narrator…" — turn submitted, narration pending.
 */
export interface MultiplayerTurnBannerProps {
  isMultiplayer: boolean;
  /** WebSocket connected — drives the heartbeat dot. */
  wsConnected: boolean;
  /** Active player from server TURN_STATUS (null in sealed-letter mode). */
  activePlayerName?: string | null;
  /** Active player's id (used to disambiguate when names collide). */
  activePlayerId?: string | null;
  /** Local player's id — compares against activePlayerId. */
  localPlayerId?: string | null;
  /** Local character's display name — used in "You have the floor". */
  localCharacterName?: string | null;
  /** True after local player submits — narrator is thinking. */
  thinking?: boolean;
}

export function MultiplayerTurnBanner({
  isMultiplayer,
  wsConnected,
  activePlayerName,
  activePlayerId,
  localPlayerId,
  localCharacterName,
  thinking,
}: MultiplayerTurnBannerProps) {
  if (!isMultiplayer) return null;

  // Decide what the banner says.
  const localIsActive =
    activePlayerId !== undefined &&
    activePlayerId !== null &&
    localPlayerId !== undefined &&
    localPlayerId !== null &&
    activePlayerId === localPlayerId;

  let label: string;
  let tone: "you" | "peer" | "thinking";

  if (thinking) {
    // Narrator is composing — show "thinking" regardless of who the active
    // player is. Previously this branch required ``!localIsActive``, but
    // once the server emits TURN_STATUS{active} on PLAYER_ACTION receipt
    // (ADR-036 sealed-letter pacing), the actor's tab has BOTH
    // ``thinking=true`` AND ``localIsActive=true``. "Waiting for the
    // narrator…" is the right cue for that state — the actor knows they
    // submitted and is waiting for prose to land.
    label = "Waiting for the narrator…";
    tone = "thinking";
  } else if (
    activePlayerName &&
    !localIsActive &&
    activePlayerName !== localCharacterName
  ) {
    label = `It's ${activePlayerName}'s turn…`;
    tone = "peer";
  } else {
    label = localCharacterName
      ? `${localCharacterName} — you have the floor`
      : "You have the floor";
    tone = "you";
  }

  // Dot color: green when WS open, amber when reconnecting/closed.
  // The `aria-live` attribute lets screen readers announce turn changes.
  return (
    <div
      data-testid="multiplayer-turn-banner"
      data-tone={tone}
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 px-3 py-1.5 mb-1 rounded-md text-sm border-l-4 ${
        tone === "you"
          ? "border-l-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-semibold"
          : tone === "peer"
            ? "border-l-amber-500/70 bg-amber-500/10 text-amber-200/90"
            : "border-l-muted-foreground/40 bg-muted/30 text-muted-foreground"
      }`}
    >
      <span
        data-testid="ws-heartbeat-dot"
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          wsConnected
            ? "bg-emerald-500 animate-pulse"
            : "bg-amber-500/70 animate-pulse"
        }`}
      />
      <span className="flex-1">{label}</span>
    </div>
  );
}
