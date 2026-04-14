import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JourneyHistory } from "@/screens/lobby/JourneyHistory";
import { appendHistory, loadHistory } from "@/screens/lobby/historyStore";

describe("JourneyHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const prettyGenre = (slug: string) => slug.replace(/_/g, " ");
  const prettyWorld = (_genre: string, slug: string) => slug.replace(/_/g, " ");

  it("renders nothing when history is empty", () => {
    const { container } = render(
      <JourneyHistory
        onSelect={vi.fn()}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per stored entry, newest first", () => {
    appendHistory({
      player_name: "Older",
      genre: "victoria",
      world: "albion",
    });
    // Force a millisecond gap so timestamps differ.
    appendHistory({
      player_name: "Newer",
      genre: "spaghetti_western",
      world: "dust_and_lead",
    });

    render(
      <JourneyHistory
        onSelect={vi.fn()}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );

    const buttons = screen.getAllByRole("button");
    // The first button (excluding the X buttons inside) is "Newer".
    expect(buttons[0]).toHaveTextContent(/Newer/);
    expect(buttons[0]).toHaveTextContent(/spaghetti western/);
  });

  it("calls onSelect with the entry when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    appendHistory({
      player_name: "Keith",
      genre: "victoria",
      world: "albion",
    });

    render(
      <JourneyHistory
        onSelect={onSelect}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );

    await user.click(screen.getByText(/Keith/).closest("button")!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      player_name: "Keith",
      genre: "victoria",
      world: "albion",
    });
  });

  it("removes the entry from localStorage when X is clicked", async () => {
    const user = userEvent.setup();
    appendHistory({
      player_name: "Keith",
      genre: "victoria",
      world: "albion",
    });
    appendHistory({
      player_name: "Sam",
      genre: "spaghetti_western",
      world: "dust_and_lead",
    });

    render(
      <JourneyHistory
        onSelect={vi.fn()}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );

    // Find the X button for Keith via aria-label.
    const forgetKeith = screen.getByRole("button", { name: /forget keith/i });
    await user.click(forgetKeith);

    const remaining = loadHistory();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].player_name).toBe("Sam");
  });

  it("X click does not also trigger row select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    appendHistory({
      player_name: "Keith",
      genre: "victoria",
      world: "albion",
    });

    render(
      <JourneyHistory
        onSelect={onSelect}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );

    const forgetBtn = screen.getByRole("button", { name: /forget keith/i });
    await user.click(forgetBtn);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hides itself after the last entry is removed", async () => {
    const user = userEvent.setup();
    appendHistory({
      player_name: "Keith",
      genre: "victoria",
      world: "albion",
    });

    const { container } = render(
      <JourneyHistory
        onSelect={vi.fn()}
        prettyGenre={prettyGenre}
        prettyWorld={prettyWorld}
      />,
    );

    const forgetBtn = screen.getByRole("button", { name: /forget keith/i });
    await user.click(forgetBtn);

    expect(container).toBeEmptyDOMElement();
  });
});
