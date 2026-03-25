import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Story 57-13: PTT mic muting — hold key cuts WebRTC track to peers.
 *
 * AC mapping:
 *   AC-1: PTT press mutes WebRTC track (sender.track.enabled = false)
 *   AC-2: PTT release unmutes WebRTC track (sender.track.enabled = true)
 *   AC-3: Mute happens before recording starts
 *   AC-4: Unmute happens after recording stops
 */

// Mock audioToFloat32 to bypass OfflineAudioContext
vi.mock("@/audio/audioPreprocess", () => ({
  audioToFloat32: vi.fn().mockResolvedValue(new Float32Array(16000)),
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
// Mock WebRTC sender tracks
// ---------------------------------------------------------------------------

class MockMediaStreamTrack {
  kind: string;
  enabled: boolean = true;
  id: string;
  stop = vi.fn();

  constructor(kind = "audio") {
    this.kind = kind;
    this.id = `track-${Math.random().toString(36).slice(2)}`;
  }
}

class MockRTCRtpSender {
  track: MockMediaStreamTrack;

  constructor(track: MockMediaStreamTrack) {
    this.track = track;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Story 57-13: PTT mic muting", () => {
  let usePushToTalk: typeof import("@/hooks/usePushToTalk").usePushToTalk;
  let mockTranscribe: ReturnType<typeof vi.fn>;
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockMuteOutgoing: ReturnType<typeof vi.fn>;
  let mockUnmuteOutgoing: ReturnType<typeof vi.fn>;
  let callOrder: string[];

  beforeEach(async () => {
    vi.resetModules();
    callOrder = [];

    // Mock MediaRecorder — track call order
    vi.stubGlobal(
      "MediaRecorder",
      vi.fn().mockImplementation(function () {
        const recorder = createMockMediaRecorder();
        const origStart = recorder.start;
        recorder.start = vi.fn().mockImplementation(function (this: any, ...args: any[]) {
          callOrder.push("recording_start");
          return origStart.apply(this, args);
        });
        const origStop = recorder.stop;
        recorder.stop = vi.fn().mockImplementation(function (this: any, ...args: any[]) {
          callOrder.push("recording_stop");
          return origStop.apply(this, args);
        });
        return recorder;
      }),
    );

    // Mock getUserMedia
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });

    mockTranscribe = vi.fn().mockResolvedValue("I search the room");
    mockOnConfirm = vi.fn();
    mockMuteOutgoing = vi.fn().mockImplementation(() => {
      callOrder.push("mute_outgoing");
    });
    mockUnmuteOutgoing = vi.fn().mockImplementation(() => {
      callOrder.push("unmute_outgoing");
    });

    const mod = await import("@/hooks/usePushToTalk");
    usePushToTalk = mod.usePushToTalk;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: PTT press mutes WebRTC track
  // -------------------------------------------------------------------------
  describe("AC-1: PTT press mutes WebRTC track", () => {
    it("calls muteOutgoing when Space is pressed", async () => {
      renderHook(() =>
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
    });

    it("does not call muteOutgoing on repeat key events", async () => {
      renderHook(() =>
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

      // Simulate repeat events (state is now "recording", so keydown should be ignored)
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });

      expect(mockMuteOutgoing).toHaveBeenCalledTimes(1);
    });

    it("does not call muteOutgoing without voiceChat handle", async () => {
      // PTT should still work without voiceChat — just no muting
      const { result } = renderHook(() =>
        usePushToTalk({
          transcribe: mockTranscribe,
          onConfirm: mockOnConfirm,
          // no voiceChat
        }),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      });

      expect(result.current.state).toBe("recording");
      // No crash — gracefully skipped
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: PTT release unmutes WebRTC track
  // -------------------------------------------------------------------------
  describe("AC-2: PTT release unmutes WebRTC track", () => {
    it("calls unmuteOutgoing when Space is released", async () => {
      renderHook(() =>
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

    it("unmutes even when transcription is slow", async () => {
      let resolveTranscribe: (v: string) => void;
      const slowTranscribe = vi.fn(
        () => new Promise<string>((resolve) => { resolveTranscribe = resolve; }),
      );

      renderHook(() =>
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

      // Unmute called immediately, before STT resolves
      expect(mockUnmuteOutgoing).toHaveBeenCalledTimes(1);

      // Cleanup: resolve the pending transcription
      await act(async () => {
        resolveTranscribe!("done");
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Mute happens before recording starts
  // -------------------------------------------------------------------------
  describe("AC-3: Mute happens before recording starts", () => {
    it("mutes WebRTC track before MediaRecorder.start()", async () => {
      renderHook(() =>
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

      // Wait for recording to start (async getUserMedia)
      await act(async () => {
        await vi.waitFor(() => {
          expect(callOrder).toContain("recording_start");
        });
      });

      const muteIdx = callOrder.indexOf("mute_outgoing");
      const recordIdx = callOrder.indexOf("recording_start");

      expect(muteIdx).toBeGreaterThanOrEqual(0);
      expect(recordIdx).toBeGreaterThanOrEqual(0);
      expect(muteIdx).toBeLessThan(recordIdx);
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Unmute happens after recording stops
  // -------------------------------------------------------------------------
  describe("AC-4: Unmute happens after recording stops", () => {
    it("unmutes WebRTC track after MediaRecorder.stop()", async () => {
      renderHook(() =>
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

      // Wait for recording to start
      await act(async () => {
        await vi.waitFor(() => {
          expect(callOrder).toContain("recording_start");
        });
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      });

      // Both recording_stop and unmute should have happened
      expect(callOrder).toContain("recording_stop");
      expect(callOrder).toContain("unmute_outgoing");

      // unmute_outgoing should be AFTER recording_stop (keyup handler calls stopRecording then unmuteOutgoing)
      // Actually in current code: keyup calls unmuteOutgoing then stopRecording
      // Per AC-4 spec: recording stop must precede unmute
      const stopIdx = callOrder.indexOf("recording_stop");
      const unmuteIdx = callOrder.indexOf("unmute_outgoing");

      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(unmuteIdx).toBeGreaterThanOrEqual(0);
      expect(stopIdx).toBeLessThan(unmuteIdx);
    });
  });

  // -------------------------------------------------------------------------
  // useVoiceChat: muteOutgoing/unmuteOutgoing integration
  // -------------------------------------------------------------------------
  describe("useVoiceChat muteOutgoing/unmuteOutgoing", () => {
    let useVoiceChat: typeof import("@/hooks/useVoiceChat").useVoiceChat;
    let capturedStream: any;

    beforeEach(async () => {
      vi.resetModules();

      class MockStream {
        id = `stream-${Math.random().toString(36).slice(2)}`;
        private _tracks: MockMediaStreamTrack[];
        constructor(tracks: MockMediaStreamTrack[] = []) {
          this._tracks = tracks;
        }
        getTracks() { return this._tracks; }
        getAudioTracks() { return this._tracks.filter((t) => t.kind === "audio"); }
      }

      capturedStream = new MockStream([new MockMediaStreamTrack("audio")]);

      vi.stubGlobal("MediaStream", MockStream);
      vi.stubGlobal("RTCPeerConnection", class {
        static instances: any[] = [];
        ontrack: any = null;
        onicecandidate: any = null;
        addTrack = vi.fn();
        close = vi.fn();
        createOffer = vi.fn(async () => ({ type: "offer", sdp: "sdp" }));
        createAnswer = vi.fn(async () => ({ type: "answer", sdp: "sdp" }));
        setLocalDescription = vi.fn(async () => {});
        setRemoteDescription = vi.fn(async () => {});
        addIceCandidate = vi.fn(async () => {});
        constructor() { (RTCPeerConnection as any).instances.push(this); }
      } as any);
      vi.stubGlobal("navigator", {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(capturedStream) },
      });

      const mod = await import("@/hooks/useVoiceChat");
      useVoiceChat = mod.useVoiceChat;
    });

    it("exposes muteOutgoing method", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ peers: [], onSignal: vi.fn() }),
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      expect(typeof result.current.muteOutgoing).toBe("function");
    });

    it("exposes unmuteOutgoing method", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ peers: [], onSignal: vi.fn() }),
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      expect(typeof result.current.unmuteOutgoing).toBe("function");
    });

    it("muteOutgoing disables local audio track", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ peers: [], onSignal: vi.fn() }),
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      act(() => {
        result.current.muteOutgoing();
      });

      const track = capturedStream.getAudioTracks()[0];
      expect(track.enabled).toBe(false);
    });

    it("unmuteOutgoing re-enables local audio track", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ peers: [], onSignal: vi.fn() }),
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      act(() => {
        result.current.muteOutgoing();
      });

      act(() => {
        result.current.unmuteOutgoing();
      });

      const track = capturedStream.getAudioTracks()[0];
      expect(track.enabled).toBe(true);
    });
  });
});
