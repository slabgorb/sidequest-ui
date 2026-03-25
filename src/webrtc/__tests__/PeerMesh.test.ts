import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PeerMesh } from "@/webrtc/PeerMesh";

// ---------------------------------------------------------------------------
// WebRTC API mocks — jsdom doesn't implement WebRTC
// ---------------------------------------------------------------------------

class MockRTCSessionDescription {
  type: string;
  sdp: string;
  constructor(init: { type: string; sdp: string }) {
    this.type = init.type;
    this.sdp = init.sdp;
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

class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = [];

  configuration: RTCConfiguration;
  localDescription: MockRTCSessionDescription | null = null;
  remoteDescription: MockRTCSessionDescription | null = null;
  connectionState: string = "new";

  ontrack: ((ev: { streams: MockMediaStream[] }) => void) | null = null;
  onicecandidate: ((ev: { candidate: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack = vi.fn();
  close = vi.fn(() => {
    this.connectionState = "closed";
    this.onconnectionstatechange?.();
  });

  createOffer = vi.fn(async () => ({
    type: "offer" as const,
    sdp: "mock-sdp-offer",
  }));

  createAnswer = vi.fn(async () => ({
    type: "answer" as const,
    sdp: "mock-sdp-answer",
  }));

  setLocalDescription = vi.fn(async (desc: { type: string; sdp: string }) => {
    this.localDescription = new MockRTCSessionDescription(desc);
  });

  setRemoteDescription = vi.fn(async (desc: { type: string; sdp: string }) => {
    this.remoteDescription = new MockRTCSessionDescription(desc);
  });

  addIceCandidate = vi.fn(async () => {});

  constructor(config?: RTCConfiguration) {
    this.configuration = config ?? {};
    MockRTCPeerConnection.instances.push(this);
  }

  /** Test helper — simulate a remote track arriving. */
  simulateTrack(stream?: MockMediaStream) {
    const s = stream ?? new MockMediaStream([new MockMediaStreamTrack("audio")]);
    this.ontrack?.({ streams: [s] });
  }

  /** Test helper — simulate an ICE candidate. */
  simulateIceCandidate(candidate: unknown = { candidate: "mock-candidate" }) {
    this.onicecandidate?.({ candidate });
  }

  /** Test helper — simulate connection state change. */
  simulateConnectionState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

// ---------------------------------------------------------------------------
// Install / tear-down
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockRTCPeerConnection.instances = [];
  vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
  vi.stubGlobal("RTCSessionDescription", MockRTCSessionDescription);
  vi.stubGlobal("MediaStream", MockMediaStream);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLocalStream(): MockMediaStream {
  return new MockMediaStream([new MockMediaStreamTrack("audio")]);
}

function latestPeer(): MockRTCPeerConnection {
  return MockRTCPeerConnection.instances[MockRTCPeerConnection.instances.length - 1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PeerMesh", () => {
  const defaultIceConfig: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // -- AC-2: Peer connections created on peer join --------------------------
  describe("AC-2: peer connection creation", () => {
    it("creates an RTCPeerConnection with ICE config when a peer is added", () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      mesh.addPeer("player-2");

      expect(MockRTCPeerConnection.instances).toHaveLength(1);
      expect(MockRTCPeerConnection.instances[0].configuration).toEqual(defaultIceConfig);
    });

    it("adds local audio track to the peer connection", () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      mesh.addPeer("player-2");

      const pc = latestPeer();
      expect(pc.addTrack).toHaveBeenCalledWith(
        localStream.getAudioTracks()[0],
        localStream,
      );
    });

    it("generates an SDP offer and signals it to the new peer", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      expect(latestPeer().createOffer).toHaveBeenCalled();
      expect(latestPeer().setLocalDescription).toHaveBeenCalled();
      expect(onSignal).toHaveBeenCalledWith("player-2", {
        type: "offer",
        sdp: "mock-sdp-offer",
      });
    });

    it("creates separate connections for multiple peers", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");
      await mesh.addPeer("player-3");

      expect(MockRTCPeerConnection.instances).toHaveLength(2);
    });

    it("forwards ICE candidates via onSignal", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      // Clear the offer signal call
      onSignal.mockClear();

      latestPeer().simulateIceCandidate({ candidate: "ice-1", sdpMid: "0" });

      expect(onSignal).toHaveBeenCalledWith("player-2", {
        type: "candidate",
        candidate: { candidate: "ice-1", sdpMid: "0" },
      });
    });
  });

  // -- AC-3: SDP answer handling -------------------------------------------
  describe("AC-3: SDP answer handling", () => {
    it("sets remote description when SDP answer is received", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      const pc = latestPeer();

      await mesh.handleSignal("player-2", {
        type: "answer",
        sdp: "remote-sdp-answer",
      });

      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: "answer",
        sdp: "remote-sdp-answer",
      });
    });

    it("handles incoming SDP offer by creating an answer", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      // Peer sends us an offer (we didn't initiate)
      await mesh.handleSignal("player-2", {
        type: "offer",
        sdp: "remote-sdp-offer",
      });

      // Should create a connection and answer
      expect(MockRTCPeerConnection.instances.length).toBeGreaterThanOrEqual(1);
      const pc = latestPeer();
      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: "offer",
        sdp: "remote-sdp-offer",
      });
      expect(pc.createAnswer).toHaveBeenCalled();
      expect(onSignal).toHaveBeenCalledWith("player-2", {
        type: "answer",
        sdp: "mock-sdp-answer",
      });
    });

    it("adds received ICE candidates to the peer connection", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      await mesh.handleSignal("player-2", {
        type: "candidate",
        candidate: { candidate: "remote-ice", sdpMid: "0" },
      });

      expect(latestPeer().addIceCandidate).toHaveBeenCalledWith({
        candidate: "remote-ice",
        sdpMid: "0",
      });
    });
  });

  // -- AC-4: Remote audio streams exposed ----------------------------------
  describe("AC-4: remote audio streams", () => {
    it("exposes remote streams in peerStreams map keyed by player ID", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      const remoteStream = new MockMediaStream([new MockMediaStreamTrack("audio")]);
      latestPeer().simulateTrack(remoteStream);

      const streams = mesh.getPeerStreams();
      expect(streams.get("player-2")).toBe(remoteStream);
    });

    it("updates peerStreams when a new track arrives from existing peer", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");

      const stream1 = new MockMediaStream([new MockMediaStreamTrack("audio")]);
      const stream2 = new MockMediaStream([new MockMediaStreamTrack("audio")]);

      latestPeer().simulateTrack(stream1);
      latestPeer().simulateTrack(stream2);

      const streams = mesh.getPeerStreams();
      expect(streams.get("player-2")).toBe(stream2);
    });

    it("maintains streams for multiple peers independently", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");
      const pc2 = latestPeer();
      await mesh.addPeer("player-3");
      const pc3 = latestPeer();

      const stream2 = new MockMediaStream([new MockMediaStreamTrack("audio")]);
      const stream3 = new MockMediaStream([new MockMediaStreamTrack("audio")]);

      pc2.simulateTrack(stream2);
      pc3.simulateTrack(stream3);

      const streams = mesh.getPeerStreams();
      expect(streams.get("player-2")).toBe(stream2);
      expect(streams.get("player-3")).toBe(stream3);
      expect(streams.size).toBe(2);
    });
  });

  // -- AC-5: Peer connections cleaned up on leave --------------------------
  describe("AC-5: peer cleanup on leave", () => {
    it("closes the RTCPeerConnection when a peer is removed", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");
      const pc = latestPeer();

      mesh.removePeer("player-2");

      expect(pc.close).toHaveBeenCalled();
    });

    it("removes the peer from peerStreams on leave", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");
      latestPeer().simulateTrack(new MockMediaStream([new MockMediaStreamTrack("audio")]));

      expect(mesh.getPeerStreams().has("player-2")).toBe(true);

      mesh.removePeer("player-2");

      expect(mesh.getPeerStreams().has("player-2")).toBe(false);
    });

    it("cleans up all peers on destroy", async () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      await mesh.addPeer("player-2");
      await mesh.addPeer("player-3");

      const pcs = [...MockRTCPeerConnection.instances];

      mesh.destroy();

      for (const pc of pcs) {
        expect(pc.close).toHaveBeenCalled();
      }
      expect(mesh.getPeerStreams().size).toBe(0);
    });

    it("does not throw when removing a non-existent peer", () => {
      const onSignal = vi.fn();
      const localStream = createLocalStream();
      const mesh = new PeerMesh({ iceConfig: defaultIceConfig, localStream, onSignal });

      expect(() => mesh.removePeer("nonexistent")).not.toThrow();
    });
  });
});
