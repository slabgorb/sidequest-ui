import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

// Mock useWhisper to avoid @huggingface/transformers dependency in tests
vi.mock("@/hooks/useWhisper", () => ({
  useWhisper: () => ({
    transcribe: vi.fn().mockResolvedValue(""),
    status: "ready" as const,
    loadProgress: 1,
    isWebGPU: false,
  }),
}));

import App from "./App";

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
});

afterEach(() => {
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    // App should produce *something* in the DOM.
    expect(document.body.querySelector("#root, [data-testid='app']") ?? document.body.firstElementChild).toBeTruthy();
  });

  it("shows ConnectScreen when not connected", () => {
    render(<App />);
    // ConnectScreen should be visible by default (not connected yet).
    expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
  });

  it("has a main content area", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
