/**
 * Story 15-3: TTS-aware mic gating hook.
 *
 * This hook coordinates AudioEngine voice playback lifecycle with
 * VoiceChatHandle mic muting. When TTS plays, mic is muted to prevent
 * feedback loops. When TTS ends, mic is unmuted.
 *
 * The hook doesn't exist yet — these tests define the contract.
 */
import { renderHook, act } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useTtsMicGating } from "../useTtsMicGating";
import type { VoiceChatHandle } from "../usePushToTalk";
import { AudioEngine } from "@/audio/AudioEngine";
import {
  installWebAudioMock,
  installLocalStorageMock,
  type MockAudioContext,
} from "@/audio/__tests__/web-audio-mock";

describe("useTtsMicGating (Story 15-3)", () => {
  let ctx: MockAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    ctx = installWebAudioMock();
    installLocalStorageMock();
    AudioEngine.resetInstance();
    engine = AudioEngine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    AudioEngine.resetInstance();
    vi.restoreAllMocks();
  });

  function makeVoiceChatHandle(): VoiceChatHandle {
    return {
      muteOutgoing: vi.fn(),
      unmuteOutgoing: vi.fn(),
    };
  }

  function playTestVoice(): void {
    const pcm = new ArrayBuffer(4800);
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000;
    engine.playVoicePCM(pcm, 24000);
  }

  it("mutes mic when TTS voice playback starts", async () => {
    const handle = makeVoiceChatHandle();
    renderHook(() => useTtsMicGating(handle));

    await act(async () => {
      playTestVoice();
      // Allow promise chain to settle
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(handle.muteOutgoing).toHaveBeenCalledTimes(1);
  });

  it("unmutes mic when TTS voice playback ends", async () => {
    const handle = makeVoiceChatHandle();
    renderHook(() => useTtsMicGating(handle));

    await act(async () => {
      playTestVoice();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Trigger source ended
    await act(async () => {
      const source = ctx._sourceNodes[ctx._sourceNodes.length - 1];
      source._triggerEnded();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(handle.unmuteOutgoing).toHaveBeenCalledTimes(1);
  });

  it("does not bounce mic state between sequential TTS segments", async () => {
    const handle = makeVoiceChatHandle();
    renderHook(() => useTtsMicGating(handle));

    await act(async () => {
      // Queue two TTS segments
      playTestVoice();
      playTestVoice();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Muted once at start
    expect(handle.muteOutgoing).toHaveBeenCalledTimes(1);

    // End first segment
    await act(async () => {
      ctx._sourceNodes[0]._triggerEnded();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should NOT have unmuted between segments
    expect(handle.unmuteOutgoing).toHaveBeenCalledTimes(0);

    // End second segment
    await act(async () => {
      ctx._sourceNodes[1]._triggerEnded();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Now unmuted
    expect(handle.unmuteOutgoing).toHaveBeenCalledTimes(1);
  });

  it("works without voiceChat handle (graceful degradation)", async () => {
    // Should not throw when voiceChat is undefined
    const { unmount } = renderHook(() => useTtsMicGating(undefined));

    await act(async () => {
      playTestVoice();
      await new Promise((r) => setTimeout(r, 10));
    });

    // No crash — just no muting since there's no handle
    unmount();
  });

  it("cleans up listener on unmount", async () => {
    const handle = makeVoiceChatHandle();
    const { unmount } = renderHook(() => useTtsMicGating(handle));

    unmount();

    // Play voice after unmount — should NOT trigger mute
    await act(async () => {
      playTestVoice();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(handle.muteOutgoing).not.toHaveBeenCalled();
  });

  it("handles voiceChat handle changing between renders", async () => {
    const handle1 = makeVoiceChatHandle();
    const handle2 = makeVoiceChatHandle();

    const { rerender } = renderHook(
      ({ handle }) => useTtsMicGating(handle),
      { initialProps: { handle: handle1 as VoiceChatHandle | undefined } },
    );

    // Switch to handle2
    rerender({ handle: handle2 });

    await act(async () => {
      playTestVoice();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should mute on handle2, not handle1
    expect(handle1.muteOutgoing).not.toHaveBeenCalled();
    expect(handle2.muteOutgoing).toHaveBeenCalledTimes(1);
  });
});
