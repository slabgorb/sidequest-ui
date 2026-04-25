import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
