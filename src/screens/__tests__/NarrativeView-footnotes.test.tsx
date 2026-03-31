import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { NarrativeView } from "@/screens/NarrativeView";
import { MessageType, type GameMessage } from "@/types/protocol";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msg(
  type: MessageType,
  payload: Record<string, unknown> = {},
): GameMessage {
  return { type, payload, player_id: "narrator" };
}

function narrationWithFootnotes(
  text: string,
  footnotes: Array<{ marker?: number; summary: string; category?: string; is_new?: boolean }>,
): GameMessage {
  return msg(MessageType.NARRATION, { text, footnotes });
}

// ---------------------------------------------------------------------------
// AC-1: Parse footnote markers [N] from narration prose
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-1: parse markers from prose", () => {
  it("converts [1] marker in prose to a superscript link", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The ancient ruins[1] stand before you.",
            [{ marker: 1, summary: "Built by the Precursors 10,000 years ago." }],
          ),
        ]}
      />,
    );
    const sup = document.querySelector("sup");
    expect(sup).toBeInTheDocument();
    expect(sup).toHaveTextContent("1");
  });

  it("converts [^1] caret-style marker to a superscript link", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The glowing crystal[^1] pulses with energy.",
            [{ marker: 1, summary: "A shard of the World Engine." }],
          ),
        ]}
      />,
    );
    const sup = document.querySelector("sup");
    expect(sup).toBeInTheDocument();
    expect(sup).toHaveTextContent("1");
  });

  it("converts multiple markers [1], [2], [3] in the same prose", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The tower[1] overlooks the valley[2] near the old bridge[3].",
            [
              { marker: 1, summary: "The Watchtower of Elen." },
              { marker: 2, summary: "The Valley of Bones." },
              { marker: 3, summary: "Collapsed during the Third War." },
            ],
          ),
        ]}
      />,
    );
    const sups = document.querySelectorAll("sup");
    expect(sups.length).toBe(3);
    expect(sups[0]).toHaveTextContent("1");
    expect(sups[1]).toHaveTextContent("2");
    expect(sups[2]).toHaveTextContent("3");
  });

  it("does not strip markers — they become visible superscript numbers", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The king[1] declared war.",
            [{ marker: 1, summary: "King Aldric the Bold." }],
          ),
        ]}
      />,
    );
    // The prose should contain the marker as a superscript, not be stripped
    const proseEl = document.querySelector(".prose");
    expect(proseEl).toBeInTheDocument();
    // Should NOT have the raw "[1]" text
    expect(proseEl!.textContent).not.toContain("[1]");
    // Should have a superscript element with "1"
    const sup = proseEl!.querySelector("sup");
    expect(sup).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Render markers as superscript numbered links
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-2: superscript links", () => {
  it("renders marker inside an anchor tag within <sup>", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The gate[1] is locked.",
            [{ marker: 1, summary: "Sealed by the Warden." }],
          ),
        ]}
      />,
    );
    const link = document.querySelector("sup a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("1");
  });

  it("link has href pointing to the footnote anchor", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "A mysterious figure[2] appears.",
            [{ marker: 2, summary: "The Stranger." }],
          ),
        ]}
      />,
    );
    const link = document.querySelector("sup a");
    expect(link).toBeInTheDocument();
    expect(link!.getAttribute("href")).toBe("#footnote-2");
  });
});

// ---------------------------------------------------------------------------
// AC-3: Links scroll to corresponding footnote entry
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-3: scroll to footnote", () => {
  it("footnote entry has an id matching the marker number", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The sword[1] glows.",
            [{ marker: 1, summary: "Forged in dragonfire." }],
          ),
        ]}
      />,
    );
    const footnoteEl = document.getElementById("footnote-1");
    expect(footnoteEl).toBeInTheDocument();
    expect(footnoteEl).toHaveTextContent("Forged in dragonfire.");
  });

  it("each footnote entry has a unique id based on marker", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The castle[1] and the moat[2] are ancient.",
            [
              { marker: 1, summary: "Built by House Valen." },
              { marker: 2, summary: "Fed by underground springs." },
            ],
          ),
        ]}
      />,
    );
    expect(document.getElementById("footnote-1")).toBeInTheDocument();
    expect(document.getElementById("footnote-2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Keyboard accessibility
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-4: keyboard accessible", () => {
  it("footnote links are focusable via tab", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The map[1] reveals a path.",
            [{ marker: 1, summary: "Hand-drawn by the cartographer." }],
          ),
        ]}
      />,
    );
    const link = document.querySelector("sup a") as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    // Anchor tags are naturally focusable if they have href
    expect(link.getAttribute("href")).toBeTruthy();
  });

  it("footnote links have role or are semantic anchor elements", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The temple[1] echoes.",
            [{ marker: 1, summary: "Abandoned for centuries." }],
          ),
        ]}
      />,
    );
    const link = document.querySelector("sup a");
    expect(link).toBeInTheDocument();
    expect(link!.tagName).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// AC-5: Target footnote visual indication on scroll
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-5: target highlight", () => {
  it("footnote entry has a CSS :target-compatible id for highlight styling", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The beast[1] roars.",
            [{ marker: 1, summary: "A fire drake." }],
          ),
        ]}
      />,
    );
    const footnoteEl = document.getElementById("footnote-1");
    expect(footnoteEl).toBeInTheDocument();
    // The element should have a class that enables highlight on :target or data attribute
    // for scroll-target styling
    expect(
      footnoteEl!.classList.contains("target:bg-accent/20") ||
      footnoteEl!.hasAttribute("data-footnote-id")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Portrait-group segments support linked footnotes
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-6: portrait-group support", () => {
  it("renders linked footnote markers in portrait-group text segments", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.IMAGE, {
            url: "/portrait.png",
            alt: "NPC portrait",
            tier: "portrait",
            width: 256,
            height: 256,
          }),
          narrationWithFootnotes(
            "The merchant[1] greets you warmly.",
            [{ marker: 1, summary: "Sells rare potions." }],
          ),
        ]}
      />,
    );
    // Even if this ends up as a portrait-group, the footnote should be linked
    const sup = document.querySelector("sup a");
    expect(sup).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7: Graceful fallback for unmatched markers
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — AC-7: graceful fallback", () => {
  it("renders marker as plain superscript when no matching footnote data exists", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The door[1] and the key[2] are here.",
            [{ marker: 1, summary: "An iron door." }],
            // Note: marker [2] has no matching footnote entry
          ),
        ]}
      />,
    );
    // Should still render both superscripts without crashing
    const sups = document.querySelectorAll("sup");
    expect(sups.length).toBe(2);
  });

  it("renders footnotes without markers when marker field is null", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            "The story continues.",
            [{ summary: "A piece of lore." }],
          ),
        ]}
      />,
    );
    // Footnote section should still render below (no marker, but summary visible)
    expect(screen.getByText("A piece of lore.")).toBeInTheDocument();
  });

  it("renders narration without footnotes when footnotes array is empty", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes("Just plain text, no notes.", []),
        ]}
      />,
    );
    expect(screen.getByText("Just plain text, no notes.")).toBeInTheDocument();
    // No footnote section should appear
    expect(document.querySelector("[id^='footnote-']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rule enforcement: dangerouslySetInnerHTML sanitization (TS rule #6)
// ---------------------------------------------------------------------------

describe("NarrativeView footnotes — XSS safety", () => {
  it("sanitizes footnote marker injection attempts in prose text", () => {
    render(
      <NarrativeView
        messages={[
          narrationWithFootnotes(
            'The cave[1] is dark <script>alert("xss")</script>.',
            [{ marker: 1, summary: "A deep cave." }],
          ),
        ]}
      />,
    );
    expect(document.querySelector("script")).toBeNull();
    const sup = document.querySelector("sup");
    expect(sup).toBeInTheDocument();
  });
});
