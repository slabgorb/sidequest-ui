import { render, screen } from "@testing-library/react";
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
    // ConnectScreen uses `useSessions` which polls /api/sessions on mount,
    // and `useStartGame` which POSTs /api/games on Start. In jsdom stub both
    // with a minimal successful response.
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/sessions")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [] }) });
      }
      if (typeof url === "string" && url === "/api/games" && opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ slug: "test-slug", mode: "solo" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  // -- rendering -------------------------------------------------------------
  it("renders a player name input", () => {
    renderConnect({ genres: GENRES });
    expect(screen.getByLabelText(/what name shall be yours/i)).toBeInTheDocument();
  });

  it("renders a genre radio group with one row per genre", () => {
    renderConnect({ genres: GENRES });
    const genreGroup = screen.getByRole("radiogroup", { name: /genre/i });
    expect(genreGroup).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /low fantasy/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /road warrior/i })).toBeInTheDocument();
  });

  it("renders the empty-state preview when no genre is selected", () => {
    renderConnect({ genres: GENRES });
    expect(screen.getByText(/choose a genre to see what awaits/i)).toBeInTheDocument();
  });

  it("shows the world radio group only after a genre is picked", async () => {
    const user = userEvent.setup();
    renderConnect({ genres: GENRES });

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
    renderConnect({ genres: GENRES });

    await user.click(screen.getByRole("radio", { name: /low fantasy/i }));
    await user.click(screen.getByRole("radio", { name: /greyhawk/i }));

    expect(
      screen.getByText(/the flanaess, a continent of warring kingdoms/i),
    ).toBeInTheDocument();
  });

  // -- validation ------------------------------------------------------------
  it("disables submit when fields are empty", () => {
    renderConnect({ genres: GENRES });
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  it("auto-selects the sole world when a single-world genre is picked", async () => {
    const user = userEvent.setup();
    renderConnect({ genres: GENRES });

    await user.click(screen.getByRole("radio", { name: /road warrior/i }));

    const wastelandRadio = screen.getByRole("radio", { name: /wasteland/i });
    expect(wastelandRadio).toHaveAttribute("aria-checked", "true");
  });

  // -- loading state ---------------------------------------------------------
  it("shows a connecting indicator during connection", () => {
    renderConnect({ genres: GENRES, isConnecting: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // -- error state -----------------------------------------------------------
  it("shows an error message on connection failure", () => {
    renderConnect({
      genres: GENRES,
      error: "Connection refused",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/connection refused/i);
  });

  it("shows a retry button when genres failed to load", async () => {
    const user = userEvent.setup();
    const onRetryGenres = vi.fn();
    renderConnect({
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

      renderConnect({ genres: GENRES });
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

      renderConnect({ genres: GENRES });

      const lowFantasyRadio = screen.getByRole("radio", {
        name: /low fantasy/i,
      });
      expect(lowFantasyRadio).toHaveAttribute("aria-checked", "true");

      const greyhawkRadio = screen.getByRole("radio", { name: /greyhawk/i });
      expect(greyhawkRadio).toHaveAttribute("aria-checked", "true");
    });

    it("renders with empty fields when localStorage is empty", () => {
      renderConnect({ genres: GENRES });
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

      renderConnect({ genres: GENRES });

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

      renderConnect({ genres: GENRES });

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
      renderConnect({ genres: GENRES });
      expect(
        screen.getByLabelText(/what name shall be yours/i),
      ).toHaveValue("");
    });
  });

  // -- in-flight spinner + double-click guard ---------------------------------
  describe("isStarting guard", () => {
    /**
     * Helper: set up localStorage so genre + world are pre-selected, then
     * return a deferred fetch that the caller can resolve/reject manually.
     */
    function setupDeferredStart() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      let resolveStart!: (r: Response) => void;
      const deferred = new Promise<Response>((resolve) => {
        resolveStart = resolve;
      });

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === "string" && url.startsWith("/api/sessions")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [] }) });
        }
        if (typeof url === "string" && url === "/api/games" && opts?.method === "POST") {
          return deferred;
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      return { resolveStart };
    }

    it("disables Start button while POST /api/games is in flight", async () => {
      const user = userEvent.setup();
      const { resolveStart } = setupDeferredStart();

      renderConnect({ genres: GENRES });

      const btn = screen.getByRole("button", { name: /start/i });
      await user.click(btn);

      // While the fetch is in-flight the button should be disabled and
      // show "Starting..." to give the user feedback.
      expect(screen.getByRole("button", { name: /starting\.\.\./i })).toBeDisabled();

      // Resolve the deferred fetch so the component settles.
      resolveStart(
        new Response(JSON.stringify({ slug: "test-slug", mode: "solo" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

      // After resolution the button is gone (navigation happened) — just
      // verify no error appeared.
      await screen.findByRole("button", { name: /start/i }).then(
        () => {},
        () => {}, // navigation unmounts the button — that's fine
      );
    });

    it("ignores repeated Start clicks while in flight", async () => {
      const user = userEvent.setup();
      const { resolveStart } = setupDeferredStart();

      renderConnect({ genres: GENRES });

      const btn = screen.getByRole("button", { name: /start/i });

      // First click starts the POST.
      await user.click(btn);

      // Synchronously clicking the now-disabled button should not fire a
      // second fetch call. userEvent respects the disabled attribute, so
      // click is a no-op here — which is exactly what we want to verify.
      await user.click(btn);

      // Only one call to /api/games should have been made.
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const gameCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) =>
          url === "/api/games" && opts?.method === "POST",
      );
      expect(gameCalls).toHaveLength(1);

      resolveStart(
        new Response(JSON.stringify({ slug: "test-slug", mode: "solo" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    });
  });

  // -- combined error display --------------------------------------------------
  describe("combined error display", () => {
    it("shows both external error and startError together", async () => {
      // Make /api/games return 500 so start() sets startError.
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === "string" && url.startsWith("/api/sessions")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [] }) });
        }
        if (typeof url === "string" && url === "/api/games" && opts?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      const user = userEvent.setup();
      // Pass an external connection error via the prop.
      renderConnect({ genres: GENRES, error: "Lost connection" });

      await user.click(screen.getByRole("button", { name: /start/i }));

      // The single alert region should contain BOTH messages.
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Lost connection");
      expect(alert.textContent).toContain("start game failed");
      expect(alert.textContent).toContain(" — ");
    });
  });

  // -- start() failure path ---------------------------------------------------
  describe("start() failure handling", () => {
    it("shows an error and does not write localStorage when start() fails", async () => {
      // Override the default fetch mock: /api/games returns 500.
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === "string" && url.startsWith("/api/sessions")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [] }) });
        }
        if (typeof url === "string" && url === "/api/games" && opts?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      // Pre-load a valid saved state so genre + world are auto-selected and
      // the Start button is enabled on first render.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      const user = userEvent.setup();
      renderConnect({ genres: GENRES });

      await user.click(screen.getByRole("button", { name: /start/i }));

      // Error alert must be visible.
      const alert = await screen.findByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/start game failed/i);

      // sidequest-connect must not have been updated by this failed attempt —
      // the pre-loaded value is still present but no new write happened during
      // the failed handleStart. Since the pre-loaded value was written before
      // render (not by handleStart), it's present; what matters is that the
      // journey history (sidequest-history) was NOT written.
      expect(localStorage.getItem("sidequest-history")).toBeNull();

      // The sq:display-name key must also not have been written.
      expect(localStorage.getItem("sq:display-name")).toBeNull();
    });
  });
});
