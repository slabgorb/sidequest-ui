import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock audioToFloat32 to bypass OfflineAudioContext in test env
vi.mock("@/audio/audioPreprocess", () => ({
  audioToFloat32: vi.fn().mockResolvedValue(new Float32Array(16000)),
}));

/**
 * Tests for usePushToTalk — PTT key binding, MediaRecorder, STT, confirm/discard.
 *
 * Story 57-10 AC mapping:
 *   AC-1: Space key starts/stops recording
 *   AC-2: Transcript preview after transcription
 *   AC-3: Enter confirms and sends PLAYER_ACTION
 *   AC-4: Escape discards transcript
 *   AC-5: Space in InputBar types normally (no PTT)
 *   AC-6: Transcript is editable
 *   AC-7: Mic permission denied disables PTT
 */

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
        this.ondataavailable({ data: new Blob([new ArrayBuffer(100)], { type: "audio/webm" }) });
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
// Setup
// ---------------------------------------------------------------------------

describe("usePushToTalk", () => {
  let usePushToTalk: typeof import("@/hooks/usePushToTalk").usePushToTalk;
  let mockTranscribe: ReturnType<typeof vi.fn>;
  let mockOnConfirm: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Mock MediaRecorder
    vi.stubGlobal("MediaRecorder", vi.fn().mockImplementation(function () {
      return createMockMediaRecorder();
    }));

    // Mock getUserMedia
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });

    mockTranscribe = vi.fn().mockResolvedValue("I search the room");
    mockOnConfirm = vi.fn();

    const mod = await import("@/hooks/usePushToTalk");
    usePushToTalk = mod.usePushToTalk;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-1: Space starts/stops recording
  it("starts recording on Space keydown", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    expect(result.current.state).toBe("idle");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    expect(result.current.state).toBe("recording");
  });

  it("stops recording and transcribes on Space keyup", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });

    // Should have called transcribe
    expect(mockTranscribe).toHaveBeenCalled();
  });

  // AC-2: Transcript preview after transcription
  it("shows transcript after transcription completes", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    // Full PTT cycle: keydown → keyup → transcription resolves
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });

    // Wait for transcription to complete
    await act(async () => {
      await vi.waitFor(() => {
        expect(result.current.state).toBe("preview");
      });
    });

    expect(result.current.transcript).toBe("I search the room");
  });

  // AC-3: Enter confirms
  it("confirm sends text via onConfirm and returns to idle", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    // Get to preview state
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

    expect(mockOnConfirm).toHaveBeenCalledWith("I search the room");
    expect(result.current.state).toBe("idle");
  });

  // AC-4: Escape discards
  it("discard clears transcript without calling onConfirm", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    // Get to preview
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

    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
    expect(result.current.transcript).toBeNull();
  });

  // AC-6: Transcript is editable
  it("editTranscript updates the transcript text", async () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    // Get to preview
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

    // Edit
    act(() => {
      result.current.editTranscript("I search the dungeon");
    });

    expect(result.current.transcript).toBe("I search the dungeon");

    // Confirm sends edited version
    act(() => {
      result.current.confirm();
    });

    expect(mockOnConfirm).toHaveBeenCalledWith("I search the dungeon");
  });

  // AC-7: Mic permission denied
  it("stays idle when mic permission is denied", async () => {
    // Override getUserMedia to reject
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Not allowed", "NotAllowedError")),
      },
    });

    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    // Should remain idle — mic denied
    expect(result.current.state).toBe("idle");
  });

  // AC-1: Initial state
  it("starts in idle state with null transcript", () => {
    const { result } = renderHook(() =>
      usePushToTalk({ transcribe: mockTranscribe, onConfirm: mockOnConfirm }),
    );

    expect(result.current.state).toBe("idle");
    expect(result.current.transcript).toBeNull();
    expect(result.current.duration).toBe(0);
  });
});
