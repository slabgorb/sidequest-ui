export interface PeerMeshOptions {
  iceConfig: RTCConfiguration;
  localStream: MediaStream;
  onSignal: (peerId: string, signal: Record<string, unknown>) => void;
  onPeerStream?: (peerId: string, stream: MediaStream) => void;
}

export class PeerMesh {
  private iceConfig: RTCConfiguration;
  private localStream: MediaStream;
  private onSignal: (peerId: string, signal: Record<string, unknown>) => void;
  private onPeerStream?: (peerId: string, stream: MediaStream) => void;
  private connections = new Map<string, RTCPeerConnection>();
  private streams = new Map<string, MediaStream>();

  constructor({ iceConfig, localStream, onSignal, onPeerStream }: PeerMeshOptions) {
    this.iceConfig = iceConfig;
    this.localStream = localStream;
    this.onSignal = onSignal;
    this.onPeerStream = onPeerStream;
  }

  async addPeer(peerId: string): Promise<void> {
    const pc = this.createConnection(peerId);
    this.connections.set(peerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.onSignal(peerId, { type: "offer", sdp: offer.sdp });
  }

  removePeer(peerId: string): void {
    const pc = this.connections.get(peerId);
    if (!pc) return;
    pc.close();
    this.connections.delete(peerId);
    this.streams.delete(peerId);
  }

  async handleSignal(peerId: string, signal: Record<string, unknown>): Promise<void> {
    if (signal.type === "offer") {
      const pc = this.createConnection(peerId);
      this.connections.set(peerId, pc);
      await pc.setRemoteDescription(signal as unknown as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.onSignal(peerId, { type: "answer", sdp: answer.sdp });
    } else if (signal.type === "answer") {
      const pc = this.connections.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(signal as unknown as RTCSessionDescriptionInit);
      }
    } else if (signal.type === "candidate") {
      const pc = this.connections.get(peerId);
      if (pc) {
        await pc.addIceCandidate(signal.candidate as RTCIceCandidateInit);
      }
    }
  }

  getPeerStreams(): Map<string, MediaStream> {
    return new Map(this.streams);
  }

  destroy(): void {
    for (const [peerId] of this.connections) {
      this.removePeer(peerId);
    }
  }

  private createConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.iceConfig);

    for (const track of this.localStream.getAudioTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.ontrack = (ev) => {
      this.streams.set(peerId, ev.streams[0]);
      this.onPeerStream?.(peerId, ev.streams[0]);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.onSignal(peerId, { type: "candidate", candidate: ev.candidate });
      }
    };

    return pc;
  }
}
