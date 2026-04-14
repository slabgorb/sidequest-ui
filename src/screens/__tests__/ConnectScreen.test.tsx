import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectScreen } from "@/screens/ConnectScreen";
import type { GenresResponse } from "@/types/genres";

const STORAGE_KEY = "sidequest-connect";

/**
 * Shared fixture matching the enriched `/api/genres` shape.
 *
 * Two genres: `low_fantasy` (two worlds) and `road_warrior` (one world,
 * to exercise the auto-select-single-world path). Both worlds carry the
 * full WorldMeta fields so WorldPreview renders without null checks.
 */
const GENRES: GenresResponse = {
  low_fantasy: {
    name: "Low Fantasy",
    description: "Gritty medieval adventures.",
    worlds: [
      {
        slug: "greyhawk",
        name: "Greyhawk",
        description: "The Flanaess, a continent of warring kingdoms.",
        era: null,
        setting: null,
        inspirations: [],
        axis_snapshot: {},
        hero_image: null,
      },
      {
        slug: "forgotten_realms",
        name: "Forgotten Realms",
        description: "Faerûn — a world of high fantasy.",
        era: null,
        setting: null,
        inspirations: [],
        axis_snapshot: {},
        hero_image: null,
      },
    ],
  },
  road_warrior: {
    name: "Road Warrior",
    description: "Vehicular post-apocalypse.",
    worlds: [
      {
        slug: "wasteland",
        name: "Wasteland",
        description: "Nothing but dust and engines.",
        era: null,
        setting: null,
        inspirations: [],
        axis_snapshot: {},
        hero_image: null,
      },
    ],
  },
};

describe("ConnectScreen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -- rendering -------------------------------------------------------------
  it("renders a player name input", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByLabelText(/what name shall be yours/i)).toBeInTheDocument();
  });

  it("renders a genre radio group with one row per genre", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    const genreGroup = screen.getByRole("radiogroup", { name: /genre/i });
    expect(genreGroup).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /low fantasy/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /road warrior/i })).toBeInTheDocument();
  });

  it("renders the empty-state preview when no genre is selected", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByText(/choose a genre to see what awaits/i)).toBeInTheDocument();
  });

  it("shows the world radio group only after a genre is picked", async () => {
    const user = userEvent.setup();
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

    // No world group yet.
    expect(screen.queryByRole("radiogroup", { name: /world/i })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));

    // World group appears with both worlds from low_fantasy.
    expect(screen.getByRole("radiogroup", { name: /world/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /greyhawk/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /forgotten realms/i })).toBeInTheDocument();
  });

  it("renders the world preview description after a world is picked", async () => {
    const user = userEvent.setup();
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));
    await user.click(screen.getByRole("radio", { name: /greyhawk/i }));

    expect(
      screen.getByText(/the flanaess, a continent of warring kingdoms/i),
    ).toBeInTheDocument();
  });

  // -- validation ------------------------------------------------------------
  it("disables submit when fields are empty", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByRole("button", { name: /begin/i })).toBeDisabled();
  });

  it("auto-selects the sole world when a single-world genre is picked", async () => {
    const user = userEvent.setup();
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

    await user.click(screen.getByRole("radio", { name: /road warrior/i }));

    const wastelandRadio = screen.getByRole("radio", { name: /wasteland/i });
    expect(wastelandRadio).toHaveAttribute("aria-checked", "true");
  });

  // -- submit ----------------------------------------------------------------
  it("calls onConnect with name, genre, and world on submit", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    render(<ConnectScreen onConnect={onConnect} genres={GENRES} />);

    await user.type(
      screen.getByLabelText(/what name shall be yours/i),
      "Aberu",
    );
    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));
    await user.click(screen.getByRole("radio", { name: /greyhawk/i }));
    await user.click(screen.getByRole("button", { name: /begin/i }));

    expect(onConnect).toHaveBeenCalledWith("Aberu", "low_fantasy", "greyhawk");
  });

  // -- loading state ---------------------------------------------------------
  it("shows a connecting indicator during connection", () => {
    render(
      <ConnectScreen
        onConnect={vi.fn()}
        genres={GENRES}
        isConnecting={true}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // -- error state -----------------------------------------------------------
  it("shows an error message on connection failure", () => {
    render(
      <ConnectScreen
        onConnect={vi.fn()}
        genres={GENRES}
        error="Connection refused"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/connection refused/i);
  });

  it("shows a retry button when genres failed to load", async () => {
    const user = userEvent.setup();
    const onRetryGenres = vi.fn();
    render(
      <ConnectScreen
        onConnect={vi.fn()}
        genres={{}}
        genreError
        onRetryGenres={onRetryGenres}
      />,
    );

    const retry = screen.getByRole("button", { name: /retry/i });
    await user.click(retry);
    expect(onRetryGenres).toHaveBeenCalled();
  });

  // -- localStorage persistence -----------------------------------------------
  describe("localStorage persistence", () => {
    it("pre-fills player name from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ playerName: "Rincewind", genre: "", world: "" }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
      expect(
        screen.getByLabelText(/what name shall be yours/i),
      ).toHaveValue("Rincewind");
    });

    it("pre-selects genre and world from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      const lowFantasyRadio = screen.getByRole("radio", {
        name: /low fantasy/i,
      });
      expect(lowFantasyRadio).toHaveAttribute("aria-checked", "true");

      const greyhawkRadio = screen.getByRole("radio", { name: /greyhawk/i });
      expect(greyhawkRadio).toHaveAttribute("aria-checked", "true");
    });

    it("renders with empty fields when localStorage is empty", () => {
      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
      expect(
        screen.getByLabelText(/what name shall be yours/i),
      ).toHaveValue("");
    });

    it("fields remain editable after pre-fill", async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ playerName: "Rincewind", genre: "", world: "" }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      const nameInput = screen.getByLabelText(/what name shall be yours/i);
      expect(nameInput).toHaveValue("Rincewind");

      await user.clear(nameInput);
      await user.type(nameInput, "Twoflower");
      expect(nameInput).toHaveValue("Twoflower");
    });

    it("saves to localStorage on submit", async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      await user.click(screen.getByRole("button", { name: /begin/i }));

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toEqual({
        playerName: "Rincewind",
        genre: "low_fantasy",
        world: "greyhawk",
      });
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
      expect(
        screen.getByLabelText(/what name shall be yours/i),
      ).toHaveValue("");
    });
  });
});
