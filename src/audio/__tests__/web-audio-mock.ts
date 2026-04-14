/**
 * Web Audio API mock for vitest/jsdom.
 *
 * jsdom does not implement the Web Audio API, so we provide a minimal
 * mock of AudioContext, GainNode, AudioBufferSourceNode, and AudioBuffer
 * that tracks scheduling calls for assertion in tests.
 */
import { vi, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// AudioParam mock
// ---------------------------------------------------------------------------

export interface MockAudioParam {
  value: number;
  defaultValue: number;
  setValueAtTime: Mock;
  linearRampToValueAtTime: Mock;
  exponentialRampToValueAtTime: Mock;
  cancelScheduledValues: Mock;
}

export function createMockAudioParam(defaultValue = 1): MockAudioParam {
  // IMPORTANT: do NOT use `.bind(param)` on these vi.fn mocks — bind() returns
  // a plain Function that drops the `.mock` tracking property, which breaks
  // every test that introspects `linearRampToValueAtTime.mock.calls`. Capture
  // `param` via closure instead and mutate `param.value` directly.
  const param: MockAudioParam = {
    value: defaultValue,
    defaultValue,
    setValueAtTime: vi.fn((value: number) => {
      param.value = value;
      return param;
    }),
    linearRampToValueAtTime: vi.fn((value: number) => {
      param.value = value;
      return param;
    }),
    exponentialRampToValueAtTime: vi.fn((value: number) => {
      param.value = value;
      return param;
    }),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

// ---------------------------------------------------------------------------
// GainNode mock
// ---------------------------------------------------------------------------

export interface MockGainNode {
  gain: MockAudioParam;
  connect: Mock;
  disconnect: Mock;
  context: MockAudioContext;
}

// ---------------------------------------------------------------------------
// AudioBufferSourceNode mock
// ---------------------------------------------------------------------------

export interface MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null;
  loop: boolean;
  playbackRate: MockAudioParam;
  connect: Mock;
  disconnect: Mock;
  start: Mock;
  stop: Mock;
  onended: (() => void) | null;
  _triggerEnded: () => void;
}

// ---------------------------------------------------------------------------
// AudioBuffer mock
// ---------------------------------------------------------------------------

export interface MockAudioBuffer {
  duration: number;
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  getChannelData: Mock;
  copyToChannel: Mock;
}

export function createMockAudioBuffer(duration = 5, length?: number, sampleRate = 44100): MockAudioBuffer {
  const actualLength = length ?? duration * sampleRate;
  const channelData = new Float32Array(actualLength);
  return {
    duration,
    length: actualLength,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: vi.fn().mockReturnValue(channelData),
    copyToChannel: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// AudioContext mock
// ---------------------------------------------------------------------------

export interface MockAudioContext {
  state: "suspended" | "running" | "closed";
  currentTime: number;
  destination: Record<string, unknown>;
  resume: Mock;
  close: Mock;
  suspend: Mock;
  createGain: Mock;
  createBuffer: Mock;
  createBufferSource: Mock;
  decodeAudioData: Mock;
  _gainNodes: MockGainNode[];
  _sourceNodes: MockAudioBufferSourceNode[];
}

export function createMockAudioContext(): MockAudioContext {
  // Same closure-capture pattern as createMockAudioParam — `.bind(ctx)`
  // on a vi.fn mock strips its `.mock` tracking and breaks every test
  // that asserts on `ctx.resume`/`ctx.close` call counts.
  const ctx: MockAudioContext = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    close: vi.fn(async () => {
      ctx.state = "closed";
    }),
    suspend: vi.fn(async () => {
      ctx.state = "suspended";
    }),
    createGain: vi.fn(),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
    decodeAudioData: vi.fn(),
    _gainNodes: [],
    _sourceNodes: [],
  };

  ctx.createGain.mockImplementation(() => {
    const node: MockGainNode = {
      gain: createMockAudioParam(1),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      context: ctx,
    };
    ctx._gainNodes.push(node);
    return node;
  });

  ctx.createBuffer.mockImplementation(
    (_channels: number, length: number, sampleRate: number) =>
      createMockAudioBuffer(length / sampleRate, length, sampleRate),
  );

  ctx.createBufferSource.mockImplementation(() => {
    const source: MockAudioBufferSourceNode = {
      buffer: null,
      loop: false,
      playbackRate: createMockAudioParam(1),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
      _triggerEnded() {
        if (this.onended) this.onended();
      },
    };
    ctx._sourceNodes.push(source);
    return source;
  });

  ctx.decodeAudioData.mockImplementation(async () => createMockAudioBuffer());

  return ctx;
}

// ---------------------------------------------------------------------------
// Install / uninstall globals
// ---------------------------------------------------------------------------

export function installWebAudioMock(): MockAudioContext {
  const ctx = createMockAudioContext();
  vi.stubGlobal(
    "AudioContext",
    vi.fn().mockImplementation(function () { return ctx; }),
  );
  return ctx;
}

export function installLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  const storage: Storage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}
