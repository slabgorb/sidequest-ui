import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectScreen } from "@/screens/ConnectScreen";

const GENRES = ["low_fantasy", "road_warrior", "elemental_harmony"];
const STORAGE_KEY = "sidequest-connect";

describe("ConnectScreen", () => {
  // -- rendering -------------------------------------------------------------
  it("renders a player name input", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
  });

  it("renders a genre select", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByLabelText(/genre/i)).toBeInTheDocument();
  });

  // -- validation ------------------------------------------------------------
  it("disables submit when fields are empty", () => {
    render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);
    expect(screen.getByRole("button", { name: /begin/i })).toBeDisabled();
  });

  // -- submit ----------------------------------------------------------------
  it("calls onConnect with player name and genre on submit", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          low_fantasy: { worlds: ["greyhawk"] },
        }),
    });

    render(<ConnectScreen onConnect={onConnect} genres={GENRES} />);

    await user.type(screen.getByLabelText(/player name/i), "Aberu");
    // Select genre — interact via the combo/select role
    await user.selectOptions(screen.getByLabelText(/genre/i), "low_fantasy");
    // Wait for worlds to load and auto-select the single world
    await waitFor(() => {
      expect(screen.getByLabelText(/world/i)).toHaveValue("greyhawk");
    });
    await user.click(screen.getByRole("button", { name: /begin/i }));

    expect(onConnect).toHaveBeenCalledWith("Aberu", "low_fantasy", "greyhawk");
  });

  // -- loading state ---------------------------------------------------------
  it("shows a loading spinner during connection", () => {
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

  // -- localStorage persistence -----------------------------------------------
  describe("localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear();
      // Mock fetch for world loading
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            low_fantasy: { worlds: ["greyhawk", "forgotten_realms"] },
            road_warrior: { worlds: ["wasteland"] },
          }),
      });
    });

    it("pre-fills player name from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ playerName: "Rincewind", genre: "", world: "" }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      expect(screen.getByLabelText(/player name/i)).toHaveValue("Rincewind");
    });

    it("pre-fills genre from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ playerName: "", genre: "low_fantasy", world: "" }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      expect(screen.getByLabelText(/genre/i)).toHaveValue("low_fantasy");
    });

    it("pre-fills saved world after worlds load", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/world/i)).toHaveValue("greyhawk");
      });
    });

    it("renders with empty fields when localStorage is empty", () => {
      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      expect(screen.getByLabelText(/player name/i)).toHaveValue("");
      expect(screen.getByLabelText(/genre/i)).toHaveValue("");
    });

    it("fields remain editable after pre-fill", async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ playerName: "Rincewind", genre: "", world: "" }),
      );

      render(<ConnectScreen onConnect={vi.fn()} genres={GENRES} />);

      const nameInput = screen.getByLabelText(/player name/i);
      expect(nameInput).toHaveValue("Rincewind");

      await user.clear(nameInput);
      await user.type(nameInput, "Twoflower");
      expect(nameInput).toHaveValue("Twoflower");
    });

    it("saves to localStorage on submit", async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerName: "Rincewind",
          genre: "low_fantasy",
          world: "greyhawk",
        }),
      );

      render(<ConnectScreen onConnect={onConnect} genres={GENRES} />);

      // Wait for worlds to load and world to be pre-filled
      await waitFor(() => {
        expect(screen.getByLabelText(/world/i)).toHaveValue("greyhawk");
      });

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

      expect(screen.getByLabelText(/player name/i)).toHaveValue("");
      expect(screen.getByLabelText(/genre/i)).toHaveValue("");
    });
  });
});
