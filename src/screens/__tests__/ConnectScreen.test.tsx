import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

/**
 * Wraps ConnectScreen in a MemoryRouter so that useNavigate() (wired in
 * commit 3beb815) has a valid router context during unit tests.
 */
function renderConnect(props: Parameters<typeof ConnectScreen>[0]) {
  return render(
    <MemoryRouter>
      <ConnectScreen {...props} />
    </MemoryRouter>,
  );
}

describe("ConnectScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    // ConnectScreen uses `useSessions` which polls /api/sessions on mount.
    // In jsdom the call would unhandled-reject, so stub it with an empty
    // sessions list. Tests that care about presence override this with
    // a per-test mock.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    }) as unknown as typeof fetch;
  });

  // -- rendering -------------------------------------------------------------
  it("renders a player name input", () => {
    renderConnect({ onConnect: vi.fn(), genres: GENRES });
    expect(screen.getByLabelText(/what name shall be yours/i)).toBeInTheDocument();
  });

  it("renders a genre radio group with one row per genre", () => {
    renderConnect({ onConnect: vi.fn(), genres: GENRES });
    const genreGroup = screen.getByRole("radiogroup", { name: /genre/i });
    expect(genreGroup).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /low fantasy/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /road warrior/i })).toBeInTheDocument();
  });

  it("renders the empty-state preview when no genre is selected", () => {
    renderConnect({ onConnect: vi.fn(), genres: GENRES });
    expect(screen.getByText(/choose a genre to see what awaits/i)).toBeInTheDocument();
  });

  it("shows the world radio group only after a genre is picked", async () => {
    const user = userEvent.setup();
    renderConnect({ onConnect: vi.fn(), genres: GENRES });

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
    renderConnect({ onConnect: vi.fn(), genres: GENRES });

    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));
    await user.click(screen.getByRole("radio", { name: /greyhawk/i }));

    expect(
      screen.getByText(/the flanaess, a continent of warring kingdoms/i),
    ).toBeInTheDocument();
  });

  // -- validation ------------------------------------------------------------
  it("disables submit when fields are empty", () => {
    renderConnect({ onConnect: vi.fn(), genres: GENRES });
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  it("auto-selects the sole world when a single-world genre is picked", async () => {
    const user = userEvent.setup();
    renderConnect({ onConnect: vi.fn(), genres: GENRES });

    await user.click(screen.getByRole("radio", { name: /road warrior/i }));

    const wastelandRadio = screen.getByRole("radio", { name: /wasteland/i });
    expect(wastelandRadio).toHaveAttribute("aria-checked", "true");
  });

  // -- submit ----------------------------------------------------------------
  // NOTE: commit 3beb815 changed the Start button to POST /api/games and
  // navigate — onConnect is now called from the form's onSubmit handler,
  // not from the Start button click. The form submit path is tested here via
  // fireEvent.submit on the form element after filling all required fields.
  it("calls onConnect with name, genre, and world on submit", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    renderConnect({ onConnect, genres: GENRES });

    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));
    await user.click(screen.getByRole("radio", { name: /greyhawk/i }));
    await user.type(
      screen.getByLabelText(/what name shall be yours/i),
      "Aberu",
    );
    // The form's onSubmit handler (not the Start button) calls onConnect.
    // fireEvent.submit is the most direct way to exercise this path in jsdom.
    // The form element has no explicit role; query it directly.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.submit(document.querySelector("form")!);

    expect(onConnect).toHaveBeenCalledWith("Aberu", "low_fantasy", "greyhawk");
  });

  // -- loading state ---------------------------------------------------------
  it("shows a connecting indicator during connection", () => {
    renderConnect({ onConnect: vi.fn(), genres: GENRES, isConnecting: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // -- error state -----------------------------------------------------------
  it("shows an error message on connection failure", () => {
    renderConnect({
      onConnect: vi.fn(),
      genres: GENRES,
      error: "Connection refused",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/connection refused/i);
  });

  it("shows a retry button when genres failed to load", async () => {
    const user = userEvent.setup();
    const onRetryGenres = vi.fn();
    renderConnect({
      onConnect: vi.fn(),
      genres: {},
      genreError: true,
      onRetryGenres,
    });

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

      renderConnect({ onConnect: vi.fn(), genres: GENRES });
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

      renderConnect({ onConnect: vi.fn(), genres: GENRES });

      const lowFantasyRadio = screen.getByRole("radio", {
        name: /low fantasy/i,
      });
      expect(lowFantasyRadio).toHaveAttribute("aria-checked", "true");

      const greyhawkRadio = screen.getByRole("radio", { name: /greyhawk/i });
      expect(greyhawkRadio).toHaveAttribute("aria-checked", "true");
    });

    it("renders with empty fields when localStorage is empty", () => {
      renderConnect({ onConnect: vi.fn(), genres: GENRES });
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

      renderConnect({ onConnect: vi.fn(), genres: GENRES });

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

      renderConnect({ onConnect: vi.fn(), genres: GENRES });

      await user.click(screen.getByRole("button", { name: /start/i }));

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toEqual({
        playerName: "Rincewind",
        genre: "low_fantasy",
        world: "greyhawk",
      });
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
      renderConnect({ onConnect: vi.fn(), genres: GENRES });
      expect(
        screen.getByLabelText(/what name shall be yours/i),
      ).toHaveValue("");
    });
  });
});
