import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useVoiceChat } from "@/hooks/useVoiceChat";

// ---------------------------------------------------------------------------
// WebRTC / Media mocks — jsdom doesn't implement these APIs
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

class MockMediaStream {
  id: string;
  private _tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.id = `stream-${Math.random().toString(36).slice(2)}`;
    this._tracks = tracks;
  }

  getTracks(): MockMediaStreamTrack[] {
    return this._tracks;
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this._tracks.filter((t) => t.kind === "audio");
  }
}

let mockGetUserMedia: ReturnType<typeof vi.fn>;
let capturedStream: MockMediaStream;

// Minimal RTCPeerConnection stub — PeerMesh tests cover the details
class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = [];

  ontrack: ((ev: { streams: MockMediaStream[] }) => void) | null = null;
  onicecandidate: ((ev: { candidate: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";

  addTrack = vi.fn();
  close = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" }));
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: "answer-sdp" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});

  constructor() {
    MockRTCPeerConnection.instances.push(this);
  }

  simulateTrack(stream?: MockMediaStream) {
    const s = stream ?? new MockMediaStream([new MockMediaStreamTrack("audio")]);
    this.ontrack?.({ streams: [s] });
  }
}

// ---------------------------------------------------------------------------
// Install / tear-down
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockRTCPeerConnection.instances = [];

  capturedStream = new MockMediaStream([new MockMediaStreamTrack("audio")]);
  mockGetUserMedia = vi.fn().mockResolvedValue(capturedStream);

  vi.stubGlobal("MediaStream", MockMediaStream);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection as any);
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: mockGetUserMedia },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVoiceChat", () => {
  const defaultOptions = {
    peers: [] as string[],
    onSignal: vi.fn(),
  };

  // -- AC-1: Local audio stream captured ------------------------------------
  describe("AC-1: getUserMedia audio capture", () => {
    it("requests microphone access with echo cancellation on mount", async () => {
      renderHook(() => useVoiceChat(defaultOptions));

      // Allow the async getUserMedia to resolve
      await vi.waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          audio: { echoCancellation: true },
        });
      });
    });

    it("captures a local MediaStream with one audio track", async () => {
      const { result } = renderHook(() => useVoiceChat(defaultOptions));

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      expect(result.current.localStream).toBe(capturedStream);
      expect(result.current.localStream!.getAudioTracks()).toHaveLength(1);
    });

    it("stops local tracks on unmount", async () => {
      const { result, unmount } = renderHook(() => useVoiceChat(defaultOptions));

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      const track = capturedStream.getAudioTracks()[0];
      unmount();

      expect(track.stop).toHaveBeenCalled();
    });
  });

  // -- AC-2: Peer connections created on peer join --------------------------
  describe("AC-2: peer connections on join", () => {
    it("creates a peer connection when a new peer appears", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      // Wait for getUserMedia
      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      // Add a peer
      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("generates an SDP offer for the new peer", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(onSignal).toHaveBeenCalledWith(
          "player-2",
          expect.objectContaining({ type: "offer" }),
        );
      });
    });
  });

  // -- AC-3: SDP answer handling -------------------------------------------
  describe("AC-3: SDP answer handling", () => {
    it("completes connection when SDP answer is received via handleSignal", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      });

      const pc = MockRTCPeerConnection.instances[0];

      await act(async () => {
        result.current.handleSignal("player-2", {
          type: "answer",
          sdp: "remote-answer-sdp",
        });
      });

      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: "answer",
        sdp: "remote-answer-sdp",
      });
    });
  });

  // -- AC-4: Remote audio streams exposed -----------------------------------
  describe("AC-4: peerStreams map", () => {
    it("exposes remote audio stream keyed by player ID", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      });

      const pc = MockRTCPeerConnection.instances[0];
      const remoteStream = new MockMediaStream([new MockMediaStreamTrack("audio")]);

      act(() => {
        pc.simulateTrack(remoteStream);
      });

      expect(result.current.peerStreams.get("player-2")).toBe(remoteStream);
    });

    it("peerStreams starts empty", () => {
      const { result } = renderHook(() => useVoiceChat(defaultOptions));

      expect(result.current.peerStreams).toBeInstanceOf(Map);
      expect(result.current.peerStreams.size).toBe(0);
    });
  });

  // -- AC-5: Peer connections cleaned up on leave ---------------------------
  describe("AC-5: cleanup on peer leave", () => {
    it("closes peer connection when peer is removed from list", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      // Add peer
      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      });

      const pc = MockRTCPeerConnection.instances[0];

      // Remove peer
      rerender({ peers: [], onSignal });

      await vi.waitFor(() => {
        expect(pc.close).toHaveBeenCalled();
      });
    });

    it("removes peer from peerStreams when peer leaves", async () => {
      const onSignal = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      rerender({ peers: ["player-2"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      });

      const pc = MockRTCPeerConnection.instances[0];
      act(() => {
        pc.simulateTrack(new MockMediaStream([new MockMediaStreamTrack("audio")]));
      });

      expect(result.current.peerStreams.has("player-2")).toBe(true);

      // Remove peer
      rerender({ peers: [], onSignal });

      await vi.waitFor(() => {
        expect(result.current.peerStreams.has("player-2")).toBe(false);
      });
    });

    it("cleans up all connections on unmount", async () => {
      const onSignal = vi.fn();
      const { result, rerender, unmount } = renderHook(
        (props) => useVoiceChat(props),
        { initialProps: { peers: [] as string[], onSignal } },
      );

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      rerender({ peers: ["player-2", "player-3"], onSignal });

      await vi.waitFor(() => {
        expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(2);
      });

      const pcs = [...MockRTCPeerConnection.instances];

      unmount();

      for (const pc of pcs) {
        expect(pc.close).toHaveBeenCalled();
      }
    });
  });

  // -- Mute/unmute ----------------------------------------------------------
  describe("mute/unmute", () => {
    it("exposes muted state defaulting to false", async () => {
      const { result } = renderHook(() => useVoiceChat(defaultOptions));

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      expect(result.current.muted).toBe(false);
    });

    it("disables local audio track when muted", async () => {
      const { result } = renderHook(() => useVoiceChat(defaultOptions));

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      act(() => {
        result.current.setMuted(true);
      });

      expect(result.current.muted).toBe(true);
      const track = capturedStream.getAudioTracks()[0];
      expect(track.enabled).toBe(false);
    });

    it("re-enables local audio track when unmuted", async () => {
      const { result } = renderHook(() => useVoiceChat(defaultOptions));

      await vi.waitFor(() => {
        expect(result.current.localStream).toBeDefined();
      });

      act(() => result.current.setMuted(true));
      act(() => result.current.setMuted(false));

      expect(result.current.muted).toBe(false);
      const track = capturedStream.getAudioTracks()[0];
      expect(track.enabled).toBe(true);
    });
  });
});
