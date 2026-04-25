import { AudioCache } from "./AudioCache";
import { Crossfader } from "./Crossfader";

type ChannelName = "music" | "sfx";
type VolumeTarget = ChannelName | "master";

const STORAGE_KEY = "sidequest_audio_volumes";

interface VolumeState {
  music: number;
  sfx: number;
  master: number;
}

const DEFAULT_VOLUMES: VolumeState = {
  music: 1.0,
  sfx: 1.0,
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

  /** Return the current singleton without creating one — used by HMR cleanup. */
  static peekInstance(): AudioEngine | null {
    return AudioEngine.instance;
  }

  private ctx: AudioContext;
  private channels: Record<ChannelName, GainNode>;
  private masterGain: GainNode;
  private crossfader: Crossfader;
  private volumes: VolumeState;
  private preMuteVolumes: Partial<Record<ChannelName, number>> = {};
  private activeSources: AudioBufferSourceNode[] = [];
  private cache = new AudioCache();

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

    this.channels = { music: musicGain, sfx: sfxGain };
    this.crossfader = new Crossfader();
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

// Vite HMR cleanup — playtest 2026-04-25 [P1-NEW] "Multiple music tracks
// playing simultaneously". When this module (or a transitive dep that
// invalidates it) re-evaluates, the static ``AudioEngine.instance`` field
// resets to null but the OLD instance's ``AudioContext`` stays alive and
// connected to ``destination``. The next ``getInstance()`` call spawns a
// fresh context; both are routed to the speakers and any in-flight music
// buffers from the orphan layer audibly. Each subsequent HMR stacks
// another layer.
//
// Closing the singleton's context BEFORE the module swaps is the only
// hook Vite gives us to break that chain — ``import.meta.hot.dispose``
// runs while the old module is still reachable, so we can call into the
// instance's existing ``dispose()`` which closes the AudioContext and
// disconnects all gains. The new module's ``getInstance()`` then sees
// ``ctx.state === "closed"`` and constructs a fresh engine cleanly.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const inst = AudioEngine.peekInstance();
    if (inst) {
      try {
        inst.dispose();
      } catch (err) {
        // Best-effort cleanup — if dispose throws, the new context will
        // still play but we'll have logged the leak source.
        console.warn("[AudioEngine] HMR dispose failed:", err);
      }
    }
    AudioEngine.resetInstance();
  });
}
