import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for useWhisper hook — React wrapper around LocalTranscriber.
 *
 * Story 57-9 AC mapping:
 *   AC-1: Hook exposes status lifecycle
 *   AC-6: Hook exposes loadProgress
 */

// Mock LocalTranscriber
vi.mock("@/audio/LocalTranscriber", () => {
  const MockTranscriber = vi.fn().mockImplementation(function () {
    return {
      status: "unloaded",
      isWebGPU: false,
      initialize: vi.fn().mockImplementation(async function (this: any) {
        this.status = "ready";
      }),
      transcribe: vi.fn().mockResolvedValue("Hello world"),
    };
  });
  return { LocalTranscriber: MockTranscriber };
});

describe("useWhisper", () => {
  let useWhisper: typeof import("@/hooks/useWhisper").useWhisper;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/hooks/useWhisper");
    useWhisper = mod.useWhisper;
  });

  it("does not initialize when enabled is false", () => {
    const { result } = renderHook(() => useWhisper({ enabled: false }));

    expect(result.current.status).toBe("unloaded");
    expect(result.current).toHaveProperty("loadProgress");
    expect(result.current).toHaveProperty("isWebGPU");
    expect(result.current).toHaveProperty("transcribe");
    expect(typeof result.current.transcribe).toBe("function");
  });

  it("exposes status, loadProgress, isWebGPU, and transcribe", () => {
    const { result } = renderHook(() => useWhisper({ enabled: true }));

    expect(result.current).toHaveProperty("status");
    expect(result.current).toHaveProperty("loadProgress");
    expect(result.current).toHaveProperty("isWebGPU");
    expect(result.current).toHaveProperty("transcribe");
    expect(typeof result.current.transcribe).toBe("function");
  });

  it("transcribe function returns a string", async () => {
    const { result } = renderHook(() => useWhisper({ enabled: true }));

    // Wait for initialization
    await waitFor(() => {
      expect(result.current.status).not.toBe("loading");
    });

    let text: string = "";
    await act(async () => {
      text = await result.current.transcribe(new Float32Array(16000));
    });

    expect(typeof text).toBe("string");
  });
});
