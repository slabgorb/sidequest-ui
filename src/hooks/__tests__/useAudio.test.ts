import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  installWebAudioMock,
  installLocalStorageMock,
  type MockAudioContext,
} from "@/audio/__tests__/web-audio-mock";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase)
// ---------------------------------------------------------------------------
import { useAudio } from "@/hooks/useAudio";
import { AudioEngine } from "@/audio/AudioEngine";

describe("useAudio", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    AudioEngine.resetInstance();
    ctx = installWebAudioMock();
    installLocalStorageMock();
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // Hook lifecycle
  // -----------------------------------------------------------------------

  describe("Hook lifecycle", () => {
    it("returns engine reference on mount", () => {
      const { result } = renderHook(() => useAudio());
      expect(result.current.engine).not.toBeNull();
    });

    it("disposes engine on unmount", () => {
      const { unmount } = renderHook(() => useAudio());
      unmount();
      expect(ctx.close).toHaveBeenCalled();
    });

    it("engine is stable across re-renders (same reference)", () => {
      const { result, rerender } = renderHook(() => useAudio());
      const firstEngine = result.current.engine;
      rerender();
      expect(result.current.engine).toBe(firstEngine);
    });
  });

  // -----------------------------------------------------------------------
  // Exposed methods
  // -----------------------------------------------------------------------

  describe("Exposed methods", () => {
    it("exposes resume function", () => {
      const { result } = renderHook(() => useAudio());
      expect(typeof result.current.resume).toBe("function");
    });

    it("resume() calls engine.resume()", async () => {
      const { result } = renderHook(() => useAudio());
      await act(async () => {
        await result.current.resume();
      });
      expect(ctx.resume).toHaveBeenCalled();
    });

    it("exposes playMusic function", () => {
      const { result } = renderHook(() => useAudio());
      expect(typeof result.current.playMusic).toBe("function");
    });

    it("exposes playSfx function", () => {
      const { result } = renderHook(() => useAudio());
      expect(typeof result.current.playSfx).toBe("function");
    });

    it("exposes playVoice function", () => {
      const { result } = renderHook(() => useAudio());
      expect(typeof result.current.playVoice).toBe("function");
    });

    it("exposes setVolume function", () => {
      const { result } = renderHook(() => useAudio());
      expect(typeof result.current.setVolume).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // Rule #6: React hooks — stable callbacks
  // -----------------------------------------------------------------------

  describe("Rule #6: stable callbacks across renders", () => {
    it("resume callback is stable across re-renders", () => {
      const { result, rerender } = renderHook(() => useAudio());
      const firstResume = result.current.resume;
      rerender();
      expect(result.current.resume).toBe(firstResume);
    });

    it("playMusic callback is stable across re-renders", () => {
      const { result, rerender } = renderHook(() => useAudio());
      const first = result.current.playMusic;
      rerender();
      expect(result.current.playMusic).toBe(first);
    });

    it("setVolume callback is stable across re-renders", () => {
      const { result, rerender } = renderHook(() => useAudio());
      const first = result.current.setVolume;
      rerender();
      expect(result.current.setVolume).toBe(first);
    });
  });
});
