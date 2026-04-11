import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioStatus } from "../AudioStatus";
import type { AudioStatusProps } from "../AudioStatus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sq-audio-volumes";

const defaultProps: AudioStatusProps = {
  nowPlaying: { title: "Tense Battle", mood: "tense" },
  volumes: { music: 0.7, sfx: 0.8 },
  muted: { music: false, sfx: false },
  onVolumeChange: vi.fn(),
  onMuteToggle: vi.fn(),
};

function renderAudioStatus(overrides: Partial<AudioStatusProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<AudioStatus {...props} />);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Now-playing track display
// ---------------------------------------------------------------------------

describe("AudioStatus — now-playing display", () => {
  it("shows track title", () => {
    renderAudioStatus();
    expect(screen.getByText(/Tense Battle/)).toBeInTheDocument();
  });

  it("shows mood badge", () => {
    renderAudioStatus();
    expect(screen.getByTestId("mood-badge")).toHaveTextContent("tense");
  });

  it("renders nothing for now-playing when nowPlaying is null", () => {
    renderAudioStatus({ nowPlaying: null });
    expect(screen.queryByTestId("now-playing")).not.toBeInTheDocument();
  });

  it("updates display when nowPlaying changes", () => {
    const { rerender } = render(<AudioStatus {...defaultProps} />);
    expect(screen.getByText(/Tense Battle/)).toBeInTheDocument();

    rerender(
      <AudioStatus
        {...defaultProps}
        nowPlaying={{ title: "Triumphant March", mood: "triumphant" }}
      />,
    );
    expect(screen.getByText(/Triumphant March/)).toBeInTheDocument();
    expect(screen.getByTestId("mood-badge")).toHaveTextContent("triumphant");
    expect(screen.queryByText("Tense Battle")).not.toBeInTheDocument();
  });

  it("wraps track info in a now-playing container", () => {
    renderAudioStatus();
    const container = screen.getByTestId("now-playing");
    expect(within(container).getByText(/Tense Battle/)).toBeInTheDocument();
    expect(within(container).getByTestId("mood-badge")).toBeInTheDocument();
  });

  it("normalizes mood underscores into spaces for display", () => {
    renderAudioStatus({
      nowPlaying: { title: "Slow Burn", mood: "low_tension" },
    });
    expect(screen.getByTestId("mood-badge")).toHaveTextContent("low tension");
  });
});

// ---------------------------------------------------------------------------
// Volume sliders (music + sfx — voice channel was removed with TTS)
// ---------------------------------------------------------------------------

describe("AudioStatus — volume sliders", () => {
  it("renders one slider per channel (music, sfx)", () => {
    renderAudioStatus();
    expect(screen.getByTestId("volume-slider-music")).toBeInTheDocument();
    expect(screen.getByTestId("volume-slider-sfx")).toBeInTheDocument();
  });

  it("does not render a voice slider — TTS was removed", () => {
    renderAudioStatus();
    expect(screen.queryByTestId("volume-slider-voice")).not.toBeInTheDocument();
  });

  it("music slider reflects current volume as percentage", () => {
    renderAudioStatus({ volumes: { music: 0.42, sfx: 0.5 } });
    const slider = within(screen.getByTestId("volume-slider-music")).getByRole(
      "slider",
    );
    expect(slider).toHaveValue("42");
  });

  it("sfx slider reflects current volume as percentage", () => {
    renderAudioStatus({ volumes: { music: 0.5, sfx: 0.91 } });
    const slider = within(screen.getByTestId("volume-slider-sfx")).getByRole(
      "slider",
    );
    expect(slider).toHaveValue("91");
  });

  it("sliders have range 0–100", () => {
    renderAudioStatus();
    const music = within(screen.getByTestId("volume-slider-music")).getByRole(
      "slider",
    );
    expect(music).toHaveAttribute("min", "0");
    expect(music).toHaveAttribute("max", "100");
  });

  it("calls onVolumeChange with channel and normalized value when slider changes", async () => {
    const onVolumeChange = vi.fn();
    renderAudioStatus({ onVolumeChange });
    const user = userEvent.setup();
    const slider = within(screen.getByTestId("volume-slider-music")).getByRole(
      "slider",
    ) as HTMLInputElement;
    // userEvent doesn't drive range inputs cleanly — fire change directly.
    slider.value = "50";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onVolumeChange).toHaveBeenCalledWith("music", 0.5);
    // Suppress unused-user lint
    void user;
  });
});

// ---------------------------------------------------------------------------
// Mute toggles
// ---------------------------------------------------------------------------

describe("AudioStatus — mute toggles", () => {
  it("renders a mute button per channel", () => {
    renderAudioStatus();
    expect(screen.getByTestId("mute-btn-music")).toBeInTheDocument();
    expect(screen.getByTestId("mute-btn-sfx")).toBeInTheDocument();
  });

  it("does not render a voice mute button — TTS was removed", () => {
    renderAudioStatus();
    expect(screen.queryByTestId("mute-btn-voice")).not.toBeInTheDocument();
  });

  it("mute buttons have aria-label", () => {
    renderAudioStatus();
    expect(screen.getByTestId("mute-btn-music")).toHaveAttribute(
      "aria-label",
      "Mute music",
    );
    expect(screen.getByTestId("mute-btn-sfx")).toHaveAttribute(
      "aria-label",
      "Mute sfx",
    );
  });

  it("calls onMuteToggle with channel name on click", async () => {
    const onMuteToggle = vi.fn();
    renderAudioStatus({ onMuteToggle });
    const user = userEvent.setup();
    await user.click(screen.getByTestId("mute-btn-music"));
    expect(onMuteToggle).toHaveBeenCalledWith("music");
  });

  it("visually distinguishes muted from unmuted state via data-muted", () => {
    renderAudioStatus({ muted: { music: true, sfx: false } });
    expect(screen.getByTestId("mute-btn-music")).toHaveAttribute(
      "data-muted",
      "true",
    );
    expect(screen.getByTestId("mute-btn-sfx")).toHaveAttribute(
      "data-muted",
      "false",
    );
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe("AudioStatus — persistence", () => {
  it("restores volumes from localStorage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ music: 0.25, sfx: 0.4, muted: { music: false, sfx: false } }),
    );
    const onVolumeChange = vi.fn();
    renderAudioStatus({ onVolumeChange });
    // Restore loop fires onVolumeChange for any persisted values that differ
    // from the current props, so the parent state hydrates from disk.
    expect(onVolumeChange).toHaveBeenCalledWith("music", 0.25);
    expect(onVolumeChange).toHaveBeenCalledWith("sfx", 0.4);
  });

  it("does not call onVolumeChange when localStorage matches current props", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ music: 0.7, sfx: 0.8, muted: { music: false, sfx: false } }),
    );
    const onVolumeChange = vi.fn();
    renderAudioStatus({ onVolumeChange });
    expect(onVolumeChange).not.toHaveBeenCalled();
  });
});
