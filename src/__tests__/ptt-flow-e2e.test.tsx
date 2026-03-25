import { renderHook, act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Story 57-29: PTT flow end-to-end WIRING tests.
 *
 * These test the composition of usePushToTalk + useVoiceChat + useWhisper + useGameSocket,
 * NOT the individual hooks (those are tested in their own files).
 *
 * AC mapping:
 *   AC-1: Space key mutes WebRTC outbound track immediately
 *   AC-2: Key release triggers Whisper STT and shows TranscriptPreview
 *   AC-3: Confirm sends PLAYER_ACTION message via WebSocket
 *   AC-4: Discard cancels without sending
 *   AC-5: InputBar shows recording indicator (CSS class)
 *   AC-extra: WebRTC unmutes on key release even if STT still processing
 *   AC-extra: STT timeout after 30s
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock audioToFloat32 — bypass OfflineAudioContext
vi.mock("@/audio/audioPreprocess", () => ({
  audioToFloat32: vi.fn().mockResolvedValue(new Float32Array(16000)),
}));

// Mock base-ui Input to avoid jsdom detectBrowser crash
vi.mock("@base-ui/react/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

// ---------------------------------------------------------------------------
// MediaRecorder mock
// ---------------------------------------------------------------------------

let mockRecorderInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  ondataavailable: ((e: any) => void) | null;
  onstop: (() => void) | null;
  state: string;
};

function createMockMediaRecorder() {
  mockRecorderInstance = {
    start: vi.fn().mockImplementation(function (this: any) {
      this.state = "recording";
    }),
    stop: vi.fn().mockImplementation(function (this: any) {
      this.state = "inactive";
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob([new ArrayBuffer(100)], { type: "audio/webm" }),
        });
      }
      if (this.onstop) this.onstop();
    }),
    ondataavailable: null,
    onstop: null,
    state: "inactive",
  };
  return mockRecorderInstance;
}

// ---------------------------------------------------------------------------
// Shared state for composing hooks in tests
// ---------------------------------------------------------------------------

describe("PTT flow end-to-end wiring (57-29)", () => {
  let usePushToTalk: typeof import("@/hooks/usePushToTalk").usePushToTalk;
  let mockTranscribe: ReturnType<typeof vi.fn>;
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockMuteOutgoing: ReturnType<typeof vi.fn>;
  let mockUnmuteOutgoing: ReturnType<typeof vi.fn>;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock MediaRecorder
    vi.stubGlobal(
      "MediaRecorder",
      vi.fn().mockImplementation(function () { return createMockMediaRecorder(); }),
    );

    // Mock getUserMedia
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });

    mockTranscribe = vi.fn().mockResolvedValue("I search the room");
    mockMuteOutgoing = vi.fn();
    mockUnmuteOutgoing = vi.fn();
    mockSend = vi.fn();
    mockOnConfirm = vi.fn();

    const mod = await import("@/hooks/usePushToTalk");
    usePushToTalk = mod.usePushToTalk;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: Key press mutes WebRTC outbound track immediately
  // -------------------------------------------------------------------------
  describe("AC-1: Space key mutes WebRTC", () => {
    it("calls voiceChat.muteOutgoing() on Space keydown", async () => {
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: mockOnConfirm,
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });

      expect(mockMuteOutgoing).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe("recording");
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Key release triggers Whisper STT and shows preview
  // -------------------------------------------------------------------------
  describe("AC-2: Release triggers STT and preview", () => {
    it("calls voiceChat.unmuteOutgoing() on Space keyup", async () => {
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: mockOnConfirm,
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });

      expect(mockUnmuteOutgoing).toHaveBeenCalledTimes(1);
    });

    it("calls whisper.transcribe() with recorded audio on keyup", async () => {
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: mockOnConfirm,
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });

      expect(mockTranscribe).toHaveBeenCalled();

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.state).toBe("preview");
        });
      });

      expect(result.current.transcript).toBe("I search the room");
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Confirm sends PLAYER_ACTION via WebSocket
  // -------------------------------------------------------------------------
  describe("AC-3: Confirm sends PLAYER_ACTION", () => {
    it("dispatches PLAYER_ACTION message with transcript text on confirm", async () => {
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: (text: string) => {
            mockSend({
              type: "PLAYER_ACTION",
              payload: { action: text },
              player_id: "",
            });
          },
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      // Full PTT cycle
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });
      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.state).toBe("preview");
        });
      });

      // Confirm
      act(() => {
        result.current.confirm();
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PLAYER_ACTION",
          payload: expect.objectContaining({ action: "I search the room" }),
        }),
      );
      expect(result.current.state).toBe("idle");
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Discard cancels without sending
  // -------------------------------------------------------------------------
  describe("AC-4: Discard cancels without sending", () => {
    it("hides preview and sends no WebSocket message on discard", async () => {
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: (text: string) => {
            mockSend({
              type: "PLAYER_ACTION",
              payload: { action: text },
              player_id: "",
            });
          },
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      // Full PTT cycle
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });
      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.state).toBe("preview");
        });
      });

      // Discard
      act(() => {
        result.current.discard();
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(result.current.state).toBe("idle");
      expect(result.current.transcript).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: InputBar shows recording indicator via VoiceOrnament
  // -------------------------------------------------------------------------
  describe("AC-5: InputBar PTT recording indicator", () => {
    const defaultProps = {
      onSend: vi.fn(),
      micEnabled: true,
      onMicToggle: vi.fn(),
      onPttStart: vi.fn(),
      onPttStop: vi.fn(),
      transcript: null,
      onTranscriptEdit: vi.fn(),
      onTranscriptConfirm: vi.fn(),
      onTranscriptDiscard: vi.fn(),
      duration: 0,
    };

    it("shows filled ornament when mic is on and idle", async () => {
      const { default: InputBar } = await import("@/components/InputBar");

      render(<InputBar {...defaultProps} pttState="idle" />);

      const button = screen.getByTestId("ptt-button");
      expect(button.dataset.mic).toBe("on");
      expect(button.textContent).toBe("✦");
    });

    it("shows recording duration when recording", async () => {
      const { default: InputBar } = await import("@/components/InputBar");

      render(<InputBar {...defaultProps} pttState="recording" duration={3} />);

      const button = screen.getByTestId("ptt-button");
      expect(button.textContent).toBe("3s");
    });

    it("shows hollow ornament when mic is off", async () => {
      const { default: InputBar } = await import("@/components/InputBar");

      render(<InputBar {...defaultProps} micEnabled={false} pttState="idle" />);

      const button = screen.getByTestId("ptt-button");
      expect(button.dataset.mic).toBe("off");
      expect(button.textContent).toBe("◇");
    });
  });

  // -------------------------------------------------------------------------
  // AC-extra: WebRTC unmutes immediately on key release, even if STT still processing
  // -------------------------------------------------------------------------
  describe("WebRTC unmutes immediately on key release", () => {
    it("unmutes before STT completes", async () => {
      // Make transcription take a long time
      let resolveTranscribe: (value: string) => void;
      const slowTranscribe = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveTranscribe = resolve;
          }),
      );

      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: slowTranscribe,
          onConfirm: mockOnConfirm,
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });

      // Unmute should be called immediately on keyup, before STT resolves
      expect(mockUnmuteOutgoing).toHaveBeenCalledTimes(1);
      // STT should still be in progress
      expect(result.current.state).toBe("transcribing");

      // Resolve STT
      await act(async () => {
        resolveTranscribe!("I search the room");
      });

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.state).toBe("preview");
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-extra: STT timeout after 30s
  // -------------------------------------------------------------------------
  describe("STT timeout after 30s", () => {
    it("returns to idle if transcription takes longer than 30s", async () => {
      // Transcription that never resolves
      const hangingTranscribe = vi.fn(() => new Promise<string>(() => {}));

      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: hangingTranscribe,
          onConfirm: mockOnConfirm,
          voiceChat: {
            muteOutgoing: mockMuteOutgoing,
            unmuteOutgoing: mockUnmuteOutgoing,
          },
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });

      // Should be transcribing
      expect(result.current.state).toBe("transcribing");

      // Advance past 30s timeout
      await act(async () => {
        vi.advanceTimersByTime(31000);
      });

      // Should have timed out and returned to idle
      expect(result.current.state).toBe("idle");
    });
  });
});
