import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

/**
 * Tests for TranscriptPreview component.
 *
 * Story 57-10 AC mapping:
 *   AC-2: Shows transcript in preview state
 *   AC-3: Confirm button/Enter triggers onConfirm
 *   AC-4: Discard button/Escape triggers onDiscard
 *   AC-6: Transcript is editable
 */

describe("TranscriptPreview", () => {
  let TranscriptPreview: typeof import("@/components/TranscriptPreview").TranscriptPreview;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/components/TranscriptPreview");
    TranscriptPreview = mod.TranscriptPreview;
  });

  it("renders transcript text in preview state", () => {
    render(
      <TranscriptPreview
        transcript="I search the room"
        state="preview"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("I search the room")).toBeDefined();
  });

  it("shows recording indicator in recording state", () => {
    render(
      <TranscriptPreview
        transcript=""
        state="recording"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText(/recording/i)).toBeDefined();
  });

  it("shows transcribing indicator in transcribing state", () => {
    render(
      <TranscriptPreview
        transcript=""
        state="transcribing"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText(/transcribing/i)).toBeDefined();
  });

  it("does not render in idle state", () => {
    const { container } = render(
      <TranscriptPreview
        transcript=""
        state="idle"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("calls onEdit when transcript text is changed", () => {
    const onEdit = vi.fn();
    render(
      <TranscriptPreview
        transcript="I search the room"
        state="preview"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
        onEdit={onEdit}
      />,
    );

    const input = screen.getByDisplayValue("I search the room");
    fireEvent.change(input, { target: { value: "I search the dungeon" } });

    expect(onEdit).toHaveBeenCalledWith("I search the dungeon");
  });
});
