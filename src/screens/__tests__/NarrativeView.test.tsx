import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { NarrativeView } from "@/screens/NarrativeView";
import { MessageType, type GameMessage } from "@/types/protocol";

function msg(
  type: MessageType,
  payload: Record<string, unknown> = {},
): GameMessage {
  return { type, payload, player_id: "narrator" };
}

function narrationChunk(text: string): GameMessage {
  return msg(MessageType.NARRATION_CHUNK, { text });
}

function narrationEnd(): GameMessage {
  return msg(MessageType.NARRATION_END);
}

function narration(text: string): GameMessage {
  return msg(MessageType.NARRATION, { text });
}

function image(url: string, alt?: string, caption?: string): GameMessage {
  return msg(MessageType.IMAGE, { url, alt, caption });
}

describe("NarrativeView", () => {
  // -- empty state -----------------------------------------------------------
  it("renders an empty container when no messages provided", () => {
    const { container } = render(<NarrativeView messages={[]} />);
    const narrative = container.querySelector("[data-testid='narrative-view']");
    expect(narrative).toBeInTheDocument();
  });

  // -- full narration --------------------------------------------------------
  it("displays narration text from a NARRATION message", () => {
    render(
      <NarrativeView
        messages={[narration("The forest grows dark around you.")]}
      />,
    );
    expect(
      screen.getByText("The forest grows dark around you."),
    ).toBeInTheDocument();
  });

  // -- streaming chunks ------------------------------------------------------
  it("appends NARRATION_CHUNK text incrementally", () => {
    const { rerender } = render(
      <NarrativeView messages={[narrationChunk("The door ")]} />,
    );
    expect(screen.getByText(/The door/)).toBeInTheDocument();

    rerender(
      <NarrativeView
        messages={[narrationChunk("The door "), narrationChunk("creaks open.")]}
      />,
    );
    expect(screen.getByText(/The door\s*creaks open\./)).toBeInTheDocument();
  });

  // -- narration end ---------------------------------------------------------
  it("marks a narrative segment complete on NARRATION_END", () => {
    render(
      <NarrativeView
        messages={[
          narrationChunk("A tale begins."),
          narrationEnd(),
          narrationChunk("A new chapter."),
        ]}
      />,
    );
    // NARRATION_END should produce a visual separator between segments
    const separators = document.querySelectorAll("[data-testid='segment-separator']");
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  // -- inline images ---------------------------------------------------------
  it("renders inline images from IMAGE messages within narrative flow", () => {
    render(
      <NarrativeView
        messages={[
          narration("You enter the chamber."),
          image("https://example.com/chamber.png", "A dark chamber"),
          narration("Shadows dance on the walls."),
        ]}
      />,
    );
    const img = screen.getByAltText("A dark chamber");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/chamber.png");
  });

  // -- auto-scroll -----------------------------------------------------------
  it("auto-scrolls to bottom when new content arrives", () => {
    const { rerender } = render(
      <NarrativeView messages={[narration("Line one.")]} />,
    );

    const scrollEl = document.querySelector("[data-testid='narrative-view']");
    expect(scrollEl).not.toBeNull();

    // Add more content
    rerender(
      <NarrativeView
        messages={[narration("Line one."), narration("Line two.")]}
      />,
    );

    // scrollTop should be at the bottom (scrollHeight - clientHeight)
    expect(scrollEl!.scrollTop).toBe(
      scrollEl!.scrollHeight - scrollEl!.clientHeight,
    );
  });

  // -- user scroll up stops auto-scroll --------------------------------------
  it("stops auto-scrolling when user scrolls up", async () => {
    const user = userEvent.setup();

    const messages = Array.from({ length: 20 }, (_, i) =>
      narration(`Paragraph ${i + 1}. `.repeat(5)),
    );
    const { rerender } = render(<NarrativeView messages={messages} />);

    const scrollEl = document.querySelector("[data-testid='narrative-view']");
    expect(scrollEl).not.toBeNull();

    // Simulate user scrolling up by setting scrollTop and firing scroll event
    Object.defineProperty(scrollEl!, "scrollTop", {
      value: 0,
      writable: true,
    });
    scrollEl!.dispatchEvent(new Event("scroll", { bubbles: true }));

    // Add new content — should NOT auto-scroll since user scrolled up
    const prevScrollTop = scrollEl!.scrollTop;
    rerender(
      <NarrativeView
        messages={[...messages, narration("New content after scroll-up.")]}
      />,
    );

    expect(scrollEl!.scrollTop).toBe(prevScrollTop);
  });

  // -- resume auto-scroll on scroll to bottom --------------------------------
  it("resumes auto-scroll when user scrolls back to bottom", () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      narration(`Paragraph ${i + 1}. `.repeat(5)),
    );
    const { rerender } = render(<NarrativeView messages={messages} />);

    const scrollEl = document.querySelector("[data-testid='narrative-view']");
    expect(scrollEl).not.toBeNull();

    // Simulate scroll up
    Object.defineProperty(scrollEl!, "scrollTop", {
      value: 0,
      writable: true,
    });
    scrollEl!.dispatchEvent(new Event("scroll", { bubbles: true }));

    // Simulate scroll back to bottom
    Object.defineProperty(scrollEl!, "scrollTop", {
      value: scrollEl!.scrollHeight - scrollEl!.clientHeight,
      writable: true,
    });
    scrollEl!.dispatchEvent(new Event("scroll", { bubbles: true }));

    // New content should auto-scroll again
    rerender(
      <NarrativeView
        messages={[...messages, narration("New content after scroll-restore.")]}
      />,
    );

    expect(scrollEl!.scrollTop).toBe(
      scrollEl!.scrollHeight - scrollEl!.clientHeight,
    );
  });

  // -- HTML formatting -------------------------------------------------------
  it("supports HTML formatting in narrative text", () => {
    render(
      <NarrativeView
        messages={[
          narration("The <strong>ancient</strong> tome <em>glows</em> softly."),
        ]}
      />,
    );
    const strong = document.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent("ancient");

    const em = document.querySelector("em");
    expect(em).toBeInTheDocument();
    expect(em).toHaveTextContent("glows");
  });

  // -- XSS sanitization ------------------------------------------------------
  it("sanitizes HTML to prevent XSS", () => {
    render(
      <NarrativeView
        messages={[
          narration(
            'Safe text <img src=x onerror="alert(1)"> and <script>alert("xss")</script> end.',
          ),
        ]}
      />,
    );
    // The script tag should be stripped
    expect(document.querySelector("script")).toBeNull();
    // The onerror handler should be stripped
    const imgs = document.querySelectorAll("img[onerror]");
    expect(imgs.length).toBe(0);
    // Safe text should still render
    expect(screen.getByText(/Safe text/)).toBeInTheDocument();
  });

  // -- SESSION_EVENT join ------------------------------------------------------
  it("renders SESSION_EVENT join as a system message", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.SESSION_EVENT, {
            event: "join",
            player_name: "Thrain",
          }),
        ]}
      />,
    );
    const systemMsg = screen.getByText(/Thrain.*joined/i);
    expect(systemMsg).toBeInTheDocument();
    expect(systemMsg.closest("[data-testid='system-message']")).toBeInTheDocument();
  });

  // -- SESSION_EVENT leave -----------------------------------------------------
  it("renders SESSION_EVENT leave as a system message", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.SESSION_EVENT, {
            event: "leave",
            player_name: "Elara",
          }),
        ]}
      />,
    );
    const systemMsg = screen.getByText(/Elara.*left/i);
    expect(systemMsg).toBeInTheDocument();
    expect(systemMsg.closest("[data-testid='system-message']")).toBeInTheDocument();
  });

  // -- TURN_STATUS -------------------------------------------------------------
  it("renders TURN_STATUS as a turn indicator", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.TURN_STATUS, {
            player_name: "Thrain",
            status: "active",
          }),
        ]}
      />,
    );
    const turnIndicator = screen.getByText(/Thrain/);
    expect(turnIndicator).toBeInTheDocument();
    expect(turnIndicator.closest("[data-testid='turn-status']")).toBeInTheDocument();
  });

  // -- ERROR -------------------------------------------------------------------
  it("renders ERROR as an alert", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.ERROR, {
            message: "Connection lost to server.",
          }),
        ]}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Connection lost to server.");
  });

  // -- CHARACTER_SHEET ---------------------------------------------------------
  it("renders CHARACTER_SHEET as system info", () => {
    render(
      <NarrativeView
        messages={[
          msg(MessageType.CHARACTER_SHEET, {
            name: "Thrain",
            class: "Warrior",
            level: 3,
          }),
        ]}
      />,
    );
    const charInfo = screen.getByText(/Thrain/);
    expect(charInfo).toBeInTheDocument();
    expect(charInfo.closest("[data-testid='system-message']")).toBeInTheDocument();
  });

  // -- unknown message types ignored -------------------------------------------
  it("silently ignores unknown message types without crashing", () => {
    const { container } = render(
      <NarrativeView
        messages={[
          narration("Before unknown."),
          { type: "TOTALLY_UNKNOWN" as MessageType, payload: { data: "nope" }, player_id: "x" },
          narration("After unknown."),
        ]}
      />,
    );
    expect(screen.getByText("Before unknown.")).toBeInTheDocument();
    expect(screen.getByText("After unknown.")).toBeInTheDocument();
    // Should not render any content for the unknown message
    expect(container.querySelectorAll("[data-testid='narrative-view'] > div > *").length).toBe(2);
  });

  // -- TTS dedup: NARRATION skipped when chunks follow --------------------------
  it("skips NARRATION text when NARRATION_CHUNKs follow (TTS active)", () => {
    render(
      <NarrativeView
        messages={[
          narration("Full text arrives first."),
          narrationEnd(),
          narrationChunk("Full text "),
          narrationChunk("arrives first."),
        ]}
      />,
    );
    // The NARRATION text should be deduplicated — only chunk text renders
    const textElements = document.querySelectorAll(".prose");
    // Should have exactly 1 text block (the accumulated chunks), not 2
    expect(textElements.length).toBe(1);
    expect(textElements[0].textContent).toMatch(/Full text\s*arrives first\./);
  });

  it("renders NARRATION normally when no chunks follow (TTS off)", () => {
    render(
      <NarrativeView
        messages={[
          narration("No TTS here, just text."),
          narrationEnd(),
        ]}
      />,
    );
    expect(screen.getByText("No TTS here, just text.")).toBeInTheDocument();
  });

  it("deduplicates NARRATION before chunks from server reorder", () => {
    // Server sends NARRATION first (direct), then chunks arrive (async TTS).
    // After buffer flush, messages arrive as: chunks, NARRATION, NARRATION_END
    render(
      <NarrativeView
        messages={[
          narrationChunk("Sentence one."),
          narrationChunk("Sentence two."),
          narration("Sentence one. Sentence two."),
          narrationEnd(),
        ]}
      />,
    );
    const textElements = document.querySelectorAll(".prose");
    expect(textElements.length).toBe(1);
    expect(textElements[0].textContent).toMatch(/Sentence one.*Sentence two/);
  });

  // -- mixed message types render in order -------------------------------------
  it("renders multiple message types in correct order", () => {
    render(
      <NarrativeView
        messages={[
          narration("The adventure begins."),
          msg(MessageType.SESSION_EVENT, { event: "join", player_name: "Kael" }),
          msg(MessageType.TURN_STATUS, { player_name: "Kael", status: "active" }),
          narration("Kael steps forward."),
          msg(MessageType.ERROR, { message: "Dice roll failed." }),
        ]}
      />,
    );
    expect(screen.getByText("The adventure begins.")).toBeInTheDocument();
    expect(screen.getByText(/Kael.*joined/i)).toBeInTheDocument();
    expect(screen.getByTestId("turn-status")).toHaveTextContent(/Kael/);
    expect(screen.getByText("Kael steps forward.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Dice roll failed.");
  });
});
