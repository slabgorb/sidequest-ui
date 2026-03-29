import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PeerMesh } from "@/webrtc/PeerMesh";

export interface UseVoiceChatOptions {
  peers: string[];
  onSignal: (peerId: string, signal: Record<string, unknown>) => void;
}

export interface UseVoiceChatReturn {
  localStream: MediaStream | null;
  peerStreams: Map<string, MediaStream>;
  handleSignal: (peerId: string, signal: Record<string, unknown>) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  muteOutgoing: () => void;
  unmuteOutgoing: () => void;
}

export function useVoiceChat({ peers, onSignal }: UseVoiceChatOptions): UseVoiceChatReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Map<string, MediaStream>>(new Map());
  const [muted, setMutedState] = useState(false);
  const meshRef = useRef<PeerMesh | null>(null);
  const prevPeersRef = useRef<string[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  // Capture local audio — gracefully degrade if mediaDevices unavailable
  // (insecure HTTP context: navigator.mediaDevices is undefined)
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true } })
      .then((stream) => {
        if (!cancelled) {
          localStreamRef.current = stream;
          flushSync(() => setLocalStream(stream));
        }
      })
      .catch(() => {
        // Permission denied or device unavailable — voice stays disabled
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Create/update mesh when localStream is ready
  useEffect(() => {
    if (!localStream) return;

    if (!meshRef.current) {
      meshRef.current = new PeerMesh({
        iceConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
        localStream,
        onSignal: (peerId, signal) => onSignalRef.current(peerId, signal),
        onPeerStream: () => {
          setPeerStreams(new Map(meshRef.current!.getPeerStreams()));
        },
      });
    }

    const mesh = meshRef.current;
    const prevPeers = prevPeersRef.current;
    const currentPeers = new Set(peers);
    const previousPeers = new Set(prevPeers);

    // Add new peers
    for (const peerId of peers) {
      if (!previousPeers.has(peerId)) {
        mesh.addPeer(peerId);
      }
    }

    // Remove departed peers
    for (const peerId of prevPeers) {
      if (!currentPeers.has(peerId)) {
        mesh.removePeer(peerId);
        setPeerStreams(new Map(mesh.getPeerStreams()));
      }
    }

    prevPeersRef.current = peers;
  }, [localStream, peers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.destroy();
        meshRef.current = null;
      }
      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const handleSignal = useCallback(
    (peerId: string, signal: Record<string, unknown>) => {
      if (meshRef.current) {
        meshRef.current.handleSignal(peerId, signal).then(() => {
          setPeerStreams(new Map(meshRef.current!.getPeerStreams()));
        });
      }
    },
    [],
  );

  const setMuted = useCallback(
    (value: boolean) => {
      setMutedState(value);
      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getAudioTracks()) {
          track.enabled = !value;
        }
      }
    },
    [],
  );

  const muteOutgoing = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = false;
      }
    }
  }, []);

  const unmuteOutgoing = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = true;
      }
    }
  }, []);

  return { localStream, peerStreams, handleSignal, muted, setMuted, muteOutgoing, unmuteOutgoing };
}
