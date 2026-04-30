import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderSegment } from "../narrativeRenderers";
import type { NarrativeSegment } from "@/lib/narrativeSegments";

describe("renderSegment — knowledge footnote presentation", () => {
  it("renders footnote is_new markers as an uppercase 'New' pill", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>The compass twitches against your ribs.</p>",
      footnotes: [
        { marker: 1, summary: "Brecca Half-Hand is a Torchwarden elder.", is_new: true },
      ],
    };
    render(<>{renderSegment(seg, 0)}</>);
    const pill = screen.getByTestId("knowledge-new-pill");
    expect(pill).toHaveTextContent(/^New$/);
    expect(pill.className).toMatch(/rounded-full/);
  });

  it("uses 'Knowledge Gained' header on the footnote aside", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [{ marker: 1, summary: "A fact.", is_new: false }],
    };
    render(<>{renderSegment(seg, 0)}</>);
    expect(screen.getByText("Knowledge Gained")).toBeInTheDocument();
  });

  it("omits footnote aside when there are no footnotes", () => {
    const seg: NarrativeSegment = { kind: "text", html: "<p>x</p>", footnotes: [] };
    render(<>{renderSegment(seg, 0)}</>);
    expect(screen.queryByTestId("world-facts")).toBeNull();
  });
});

describe("renderSegment — knowledge collapsible", () => {
  afterEach(() => {
    // Reset URL hash between tests so :target-driven auto-open is isolated.
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  });

  it("renders the Knowledge Gained block collapsed by default", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [
        { marker: 1, summary: "Fact one.", is_new: true },
        { marker: 2, summary: "Fact two.", is_new: true },
      ],
    };
    render(<>{renderSegment(seg, 0)}</>);
    const details = screen.getByTestId("world-facts") as HTMLDetailsElement;
    expect(details.tagName).toBe("DETAILS");
    expect(details.open).toBe(false);
  });

  it("shows the total item count in the summary regardless of is_new flags", () => {
    // Pingpong 2026-04-30 "KNOWLEDGE GAINED banner accumulates": the
    // per-turn summary used to read "N new" and never decrement on
    // Knowledge-tab visit. The Knowledge tab badge owns ack/dismiss; the
    // inline summary now only carries a stable item count. Per-item NEW
    // pills inside the expanded block continue to mark first-introduction.
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [
        { marker: 1, summary: "A.", is_new: true },
        { marker: 2, summary: "B.", is_new: true },
        { marker: 3, summary: "C.", is_new: true },
        { marker: 4, summary: "D.", is_new: false },
      ],
    };
    render(<>{renderSegment(seg, 0)}</>);
    expect(screen.getByTestId("world-facts-count")).toHaveTextContent(/^4 items$/);
    // Per-item NEW pills still render for the three new entries.
    expect(screen.getAllByTestId("knowledge-new-pill")).toHaveLength(3);
  });

  it("shows total count when no entries are new (singular/plural)", () => {
    const segOne: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [{ marker: 1, summary: "A.", is_new: false }],
    };
    const { unmount } = render(<>{renderSegment(segOne, 0)}</>);
    expect(screen.getByTestId("world-facts-count")).toHaveTextContent(/^1 item$/);
    unmount();

    const segMany: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [
        { marker: 1, summary: "A.", is_new: false },
        { marker: 2, summary: "B.", is_new: false },
      ],
    };
    render(<>{renderSegment(segMany, 0)}</>);
    expect(screen.getByTestId("world-facts-count")).toHaveTextContent(/^2 items$/);
  });

  it("opens the details when the URL hash targets a contained footnote", () => {
    history.replaceState(null, "", "#footnote-2");
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [
        { marker: 1, summary: "A.", is_new: true },
        { marker: 2, summary: "B.", is_new: true },
      ],
    };
    render(<>{renderSegment(seg, 0)}</>);
    const details = screen.getByTestId("world-facts") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it("opens the details when a hashchange targets a contained footnote", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>x</p>",
      footnotes: [
        { marker: 7, summary: "G.", is_new: false },
      ],
    };
    render(<>{renderSegment(seg, 0)}</>);
    const details = screen.getByTestId("world-facts") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    history.replaceState(null, "", "#footnote-7");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(details.open).toBe(true);
  });
});

describe("renderSegment — chapter marker", () => {
  it("includes a descriptive title/aria-label on the dinkus row", () => {
    const seg: NarrativeSegment = {
      kind: "chapter-marker",
      text: "THE FILTRATION WARREN",
    };
    render(<>{renderSegment(seg, 0)}</>);
    const label = screen.getByLabelText("Chapter break");
    expect(label).toBeInTheDocument();
    expect(label.getAttribute("title")).toMatch(/chapter break/i);
  });
});

describe("renderSegment — prose sizing", () => {
  it("uses text-2xl for the current turn", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>Prose body.</p>",
      footnotes: [],
    };
    const { container } = render(<>{renderSegment(seg, 0)}</>);
    const prose = container.querySelector(".prose");
    expect(prose?.className).toContain("text-2xl");
  });

  it("uses text-lg for history turns", () => {
    const seg: NarrativeSegment = {
      kind: "text",
      html: "<p>Older prose.</p>",
      footnotes: [],
    };
    const { container } = render(
      <>{renderSegment(seg, 0, { isHistory: true })}</>,
    );
    const prose = container.querySelector(".prose");
    expect(prose?.className).toContain("text-lg");
  });
});
