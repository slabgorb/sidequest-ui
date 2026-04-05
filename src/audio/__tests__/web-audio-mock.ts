/**
 * Web Audio API mock for vitest/jsdom.
 *
 * jsdom does not implement the Web Audio API, so we provide a minimal
 * mock of AudioContext, GainNode, AudioBufferSourceNode, and AudioBuffer
 * that tracks scheduling calls for assertion in tests.
 */
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// AudioParam mock
// ---------------------------------------------------------------------------

export interface MockAudioParam {
  value: number;
  defaultValue: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

export function createMockAudioParam(defaultValue = 1): MockAudioParam {
  const param: MockAudioParam = {
    value: defaultValue,
    defaultValue,
    setValueAtTime: vi.fn().mockImplementation(function (this: MockAudioParam, value: number) {
      this.value = value;
      return this;
    }),
    linearRampToValueAtTime: vi.fn().mockImplementation(function (this: MockAudioParam, value: number) {
      this.value = value;
      return this;
    }),
    exponentialRampToValueAtTime: vi.fn().mockImplementation(function (this: MockAudioParam, value: number) {
      this.value = value;
      return this;
    }),
    cancelScheduledValues: vi.fn(),
  };
  // Bind all methods
  param.setValueAtTime = param.setValueAtTime.bind(param);
  param.linearRampToValueAtTime = param.linearRampToValueAtTime.bind(param);
  param.exponentialRampToValueAtTime = param.exponentialRampToValueAtTime.bind(param);
  return param;
}

// ---------------------------------------------------------------------------
// GainNode mock
// ---------------------------------------------------------------------------

export interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  context: MockAudioContext;
}

// ---------------------------------------------------------------------------
// AudioBufferSourceNode mock
// ---------------------------------------------------------------------------

export interface MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null;
  loop: boolean;
  playbackRate: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
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
  getChannelData: ReturnType<typeof vi.fn>;
  copyToChannel: ReturnType<typeof vi.fn>;
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
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  suspend: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  _gainNodes: MockGainNode[];
  _sourceNodes: MockAudioBufferSourceNode[];
}

export function createMockAudioContext(): MockAudioContext {
  const ctx: MockAudioContext = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockImplementation(async function (this: MockAudioContext) {
      this.state = "running";
    }),
    close: vi.fn().mockImplementation(async function (this: MockAudioContext) {
      this.state = "closed";
    }),
    suspend: vi.fn().mockImplementation(async function (this: MockAudioContext) {
      this.state = "suspended";
    }),
    createGain: vi.fn(),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
    decodeAudioData: vi.fn(),
    _gainNodes: [],
    _sourceNodes: [],
  };

  // Bind resume/close/suspend
  ctx.resume = ctx.resume.bind(ctx);
  ctx.close = ctx.close.bind(ctx);
  ctx.suspend = ctx.suspend.bind(ctx);

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
    (channels: number, length: number, sampleRate: number) =>
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
