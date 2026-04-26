/**
 * MultiplayerSessionStatus — small panel that surfaces session state during
 * lobby and chargen phases of an MP game (playtest 2026-04-26 GAP).
 *
 * Two information needs identified during the Ralph⇄Potsie playtest:
 *   1. Player 1 has no invite affordance after starting an MP session — they
 *      can't easily share the URL with Player 2. Solved here with a copy-able
 *      "Share this link" block.
 *   2. Mid-chargen, no signal of who else is at the table or what state they're
 *      in. Alex (slow reader) needs to know if the table is waiting on them;
 *      Sebastien (mechanics-first) wants to see the seat-count concretely.
 *
 * Designed for chargen-time and lobby-waiting; not a full-game presence widget
 * (the in-game UI has TURN_STATUS / PausedBanner / PARTY_STATUS for that).
 */

import { useState } from "react";

export interface SessionPlayerStatus {
  id: string;
  /** "in-chargen" = connected but no character claimed yet; "ready" = chargen
   *  done, awaiting other players or the opening turn; "playing" = past the
   *  start of the first narrator turn. The widget is meant for the first two
   *  states; once everyone is "playing" the parent should hide the widget. */
  status: "in-chargen" | "ready" | "playing";
  /** True if this row represents the local player. */
  isSelf: boolean;
}

export interface MultiplayerSessionStatusProps {
  /** Game slug — turned into a shareable `/play/<slug>` URL. */
  slug: string;
  /** All known players in this session (self + peers). */
  players: SessionPlayerStatus[];
}

/**
 * Build the shareable URL for this session. Uses the page's current origin so
 * the link works on whichever hostname the host happens to be running under
 * (the playtest uses `player1.local`, `player2.local`, etc.).
 */
function buildShareUrl(slug: string): string {
  return `${window.location.origin}/play/${slug}`;
}

function statusLabel(status: SessionPlayerStatus["status"]): string {
  switch (status) {
    case "in-chargen":
      return "creating character";
    case "ready":
      return "ready";
    case "playing":
      return "playing";
  }
}

export function MultiplayerSessionStatus({
  slug,
  players,
}: MultiplayerSessionStatusProps) {
  const shareUrl = buildShareUrl(slug);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (older browsers, insecure context); the
      // textbox is still selectable so the player can copy manually.
    }
  };

  // Players sorted: self first, then alphabetical. Stable order matters so
  // the widget doesn't flicker rows on every state update.
  const sorted = [...players].sort((a, b) => {
    if (a.isSelf && !b.isSelf) return -1;
    if (!a.isSelf && b.isSelf) return 1;
    return a.id.localeCompare(b.id);
  });

  // "Waiting on" line — if nobody is in-chargen, omit (everyone's ready).
  const waitingOn = sorted.filter((p) => p.status === "in-chargen");

  return (
    <section
      aria-label="Multiplayer session status"
      data-testid="mp-session-status"
      className="border-b border-border/30 bg-muted/20 px-4 py-3 flex flex-col gap-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70 shrink-0">
          Share this link
        </span>
        <input
          readOnly
          aria-label="Shareable game URL"
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[12rem] bg-background/60 border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground font-mono"
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy shareable URL"
          className="rounded bg-primary/80 px-3 py-1 text-primary-foreground text-xs uppercase tracking-wider hover:bg-primary"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
          At the table
        </span>
        <ul className="flex flex-col gap-0.5">
          {sorted.map((p) => (
            <li
              key={p.id}
              data-testid={`mp-roster-${p.id}`}
              data-status={p.status}
              className="flex items-center gap-2 text-sm"
            >
              <span
                aria-hidden="true"
                className={
                  p.status === "ready" || p.status === "playing"
                    ? "inline-block w-2 h-2 rounded-full shrink-0 bg-emerald-500"
                    : "inline-block w-2 h-2 rounded-full shrink-0 bg-amber-500 animate-pulse"
                }
              />
              <span className="text-foreground">{p.id}</span>
              {p.isSelf && (
                <span className="text-xs text-muted-foreground/60">(you)</span>
              )}
              <span className="text-xs text-muted-foreground/70 ml-auto">
                {statusLabel(p.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {waitingOn.length > 0 && (
        <p
          role="status"
          data-testid="mp-waiting-on"
          className="text-xs italic text-muted-foreground/80"
        >
          Waiting on:{" "}
          {waitingOn
            .map((p) => (p.isSelf ? `${p.id} (you)` : p.id))
            .join(", ")}
        </p>
      )}
    </section>
  );
}
