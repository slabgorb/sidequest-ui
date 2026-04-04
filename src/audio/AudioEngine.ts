import { AudioCache } from "./AudioCache";
import { Crossfader } from "./Crossfader";
import { Ducker } from "./Ducker";

type ChannelName = "music" | "sfx" | "voice";
type VolumeTarget = ChannelName | "master";

const STORAGE_KEY = "sidequest_audio_volumes";

interface VolumeState {
  music: number;
  sfx: number;
  voice: number;
  master: number;
}

const DEFAULT_VOLUMES: VolumeState = {
  music: 1.0,
  sfx: 1.0,
  voice: 1.0,
  master: 1.0,
};

function loadVolumes(): VolumeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOLUMES };
    const parsed = JSON.parse(raw) as Partial<VolumeState>;
    return {
      music: parsed.music ?? DEFAULT_VOLUMES.music,
      sfx: parsed.sfx ?? DEFAULT_VOLUMES.sfx,
      voice: parsed.voice ?? DEFAULT_VOLUMES.voice,
      master: parsed.master ?? DEFAULT_VOLUMES.master,
    };
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

function saveVolumes(volumes: VolumeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
  } catch {
    // localStorage may be unavailable
  }
}

export class AudioEngine {
  /* ------------------------------------------------------------------ */
  /* Singleton for the autoplay-gate pattern: ConnectScreen unlocks once */
  /* ------------------------------------------------------------------ */
  private static instance: AudioEngine | null = null;

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance || AudioEngine.instance.ctx.state === "closed") {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /** Reset singleton (for tests). */
  static resetInstance(): void {
    AudioEngine.instance = null;
  }

  private ctx: AudioContext;
  private channels: Record<ChannelName, GainNode>;
  private masterGain: GainNode;
  private crossfader: Crossfader;
  private ducker: Ducker;
  private volumes: VolumeState;
  private preMuteVolumes: Partial<Record<ChannelName, number>> = {};
  private activeSources: AudioBufferSourceNode[] = [];
  private voiceChain: Promise<void> = Promise.resolve();
  private cache = new AudioCache();
  private _voicePlaybackRate = 1.0;

  constructor() {
    this.ctx = new AudioContext();
    this.volumes = loadVolumes();

    // Build audio graph: channels → master → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumes.master;
    this.masterGain.connect(this.ctx.destination);

    const musicGain = this.ctx.createGain();
    musicGain.gain.value = this.volumes.music;
    musicGain.connect(this.masterGain);

    const sfxGain = this.ctx.createGain();
    sfxGain.gain.value = this.volumes.sfx;
    sfxGain.connect(this.masterGain);

    const voiceGain = this.ctx.createGain();
    voiceGain.gain.value = this.volumes.voice;
    voiceGain.connect(this.masterGain);

    this.channels = { music: musicGain, sfx: sfxGain, voice: voiceGain };
    this.crossfader = new Crossfader();
    this.ducker = new Ducker(musicGain);
  }

  async resume(): Promise<void> {
    await this.ctx.resume();
  }

  /**
   * Ensure AudioContext is in "running" state.
   * Browsers suspend AudioContext until a user gesture; call this from a
   * click/tap handler (e.g. ConnectScreen "Join Game") to unlock audio.
   * Also registers a visibility-change listener so audio resumes when the
   * user returns to a backgrounded tab.
   */
  async ensureResumed(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.registerVisibilityHandler();
  }

  private visibilityHandlerRegistered = false;

  private registerVisibilityHandler(): void {
    if (this.visibilityHandlerRegistered) return;
    this.visibilityHandlerRegistered = true;

    const handler = () => {
      if (document.visibilityState === "visible" && this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
    };
    document.addEventListener("visibilitychange", handler);
  }

  async playMusic(url: string, fadeMs?: number): Promise<void> {
    const audioBuffer = await this.cache.getBuffer(this.ctx, url);
    await this.crossfader.crossfade(
      this.ctx,
      audioBuffer,
      this.channels.music,
      fadeMs,
    );
  }

  duckMusic(): void {
    this.ducker.duck();
  }

  restoreMusic(): void {
    this.ducker.unduck();
  }

  stopMusic(fadeMs?: number): void {
    if (fadeMs) {
      const now = this.ctx.currentTime;
      this.channels.music.gain.setValueAtTime(
        this.channels.music.gain.value,
        now,
      );
      this.channels.music.gain.linearRampToValueAtTime(
        0,
        now + fadeMs / 1000,
      );
    }
    this.crossfader.stop();
  }

  async playSfx(url: string): Promise<void> {
    const audioBuffer = await this.cache.getBuffer(this.ctx, url);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.channels.sfx);
    source.onended = () => {
      source.disconnect();
      this.activeSources = this.activeSources.filter((s) => s !== source);
    };
    source.start();
    this.activeSources.push(source);
  }

  async playVoice(audioData: ArrayBuffer, onStart?: () => void): Promise<void> {
    const audioBuffer = await this.ctx.decodeAudioData(audioData);
    this.playVoiceBuffer(audioBuffer, onStart);
  }

  /**
   * Play raw PCM s16le audio through the voice channel with music ducking.
   * Converts PCM int16 samples to float32 and creates an AudioBuffer directly,
   * bypassing decodeAudioData (which can't decode raw PCM).
   */
  playVoicePCM(pcmData: ArrayBuffer, sampleRate = 24000, onStart?: () => void): void {
    // Ensure alignment
    const aligned = new ArrayBuffer(pcmData.byteLength);
    new Uint8Array(aligned).set(new Uint8Array(pcmData));
    const s16 = new Int16Array(aligned);
    const float32 = new Float32Array(s16.length);
    for (let i = 0; i < s16.length; i++) {
      float32[i] = s16[i] / 32768;
    }
    if (float32.length === 0) return;

    const audioBuffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    this.playVoiceBuffer(audioBuffer, onStart);
  }

  /**
   * Queue a voice segment for sequential playback with music ducking.
   * Optional `onStart` fires just before audio begins — used to synchronize
   * text reveal with TTS playback so narration text appears as the voice reads.
   */
  private playVoiceBuffer(audioBuffer: AudioBuffer, onStart?: () => void): void {
    // Queue segments so they play sequentially, not all at once.
    this.voiceChain = this.voiceChain.then(
      () =>
        new Promise<void>((resolve) => {
          this.ducker.duck();

          const source = this.ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = this._voicePlaybackRate;
          source.connect(this.channels.voice);
          source.onended = () => {
            this.ducker.unduck();
            source.disconnect();
            this.activeSources = this.activeSources.filter((s) => s !== source);
            resolve();
          };
          onStart?.();
          source.start();
          this.activeSources.push(source);
        }),
    );
  }

  setVolume(channel: VolumeTarget, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[channel] = clamped;

    if (channel === "master") {
      this.masterGain.gain.value = clamped;
    } else {
      this.channels[channel].gain.value = clamped;
    }

    saveVolumes(this.volumes);
  }

  getVolume(channel: VolumeTarget): number {
    return this.volumes[channel];
  }

  mute(channel: ChannelName): void {
    this.preMuteVolumes[channel] = this.volumes[channel];
    this.setVolume(channel, 0);
  }

  unmute(channel: ChannelName): void {
    const restored = this.preMuteVolumes[channel] ?? 1.0;
    delete this.preMuteVolumes[channel];
    this.setVolume(channel, restored);
  }

  /** Voice playback rate (0.5–2.0). Affects all future TTS segments. */
  get voicePlaybackRate(): number {
    return this._voicePlaybackRate;
  }

  set voicePlaybackRate(rate: number) {
    this._voicePlaybackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  dispose(): void {
    // Stop all active sources
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Source may have already stopped
      }
    }
    this.activeSources = [];

    this.crossfader.stop();

    // Disconnect all channel gains
    for (const gain of Object.values(this.channels)) {
      gain.disconnect();
    }
    this.masterGain.disconnect();

    this.ctx.close();
  }
}
