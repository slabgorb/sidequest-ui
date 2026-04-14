import type { ActiveSession } from "./useSessions";

export interface CurrentSessionsProps {
  /** Sessions matching the currently-selected genre/world. */
  sessions: ActiveSession[];
}

/**
 * Translate the engine's `turn_mode` label into a player-facing word.
 * Hidden in `free_play` (the default — saying "free play" tells you nothing).
 */
function turnModeLabel(mode: string): string | null {
  switch (mode) {
    case "structured":
      return "sealed turn";
    case "cinematic":
      return "cutscene";
    default:
      return null;
  }
}

/**
 * "Currently in this world" panel rendered below the world preview.
 *
 * One row per active session. Each row reads as a sentence: which players
 * are connected (by display name), what turn they're on, where they are,
 * and what kind of round is in progress. Empty list = component renders
 * nothing — the lobby never shows a "0 players online" sadness signal.
 *
 * The display is deliberately dense and gamer-literate. The audience is
 * a four-person tabletop group, not a stranger landing on a marketing page.
 */
export function CurrentSessions({ sessions }: CurrentSessionsProps) {
  if (sessions.length === 0) return null;

  return (
    <section className="w-full max-w-4xl mt-6">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-2">
        Currently in this world
      </h2>
      <ul className="flex flex-col gap-1">
        {sessions.map((session) => {
          const names = session.players.map((p) => p.display_name).join(" · ");
          const modeWord = turnModeLabel(session.turn_mode);
          return (
            <li
              key={session.session_id}
              className="text-sm text-foreground/80 px-3 py-1.5
                         border-l-2 border-l-muted-foreground/40"
            >
              <span className="text-foreground/95 font-medium">{names}</span>
              <span className="text-muted-foreground/60">
                {" — turn "}
                <span className="tabular-nums text-foreground/75">
                  {session.current_turn}
                </span>
                {session.current_location && (
                  <>
                    {" · "}
                    <span className="italic">{session.current_location}</span>
                  </>
                )}
                {modeWord && (
                  <>
                    {" · "}
                    {modeWord}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
