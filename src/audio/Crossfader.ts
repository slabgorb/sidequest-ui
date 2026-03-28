const DEFAULT_FADE_MS = 3000;

export class Crossfader {
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  async crossfade(
    ctx: AudioContext,
    newBuffer: AudioBuffer,
    targetGain: GainNode,
    fadeMs: number = DEFAULT_FADE_MS,
  ): Promise<void> {
    const now = ctx.currentTime;
    const fadeSec = fadeMs / 1000;

    // Fade out old track if playing
    if (this.currentSource && this.currentGain) {
      const oldGain = this.currentGain;
      const oldSource = this.currentSource;
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + fadeSec);

      oldSource.onended = () => {
        oldSource.disconnect();
        oldGain.disconnect();
      };

      try {
        oldSource.stop(now + fadeSec);
      } catch {
        // Source may have already stopped
      }
    }

    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    // Create new source — fade in, play once, fade out at the end
    const newGain = ctx.createGain();
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + fadeSec);
    newGain.connect(targetGain);

    const source = ctx.createBufferSource();
    source.buffer = newBuffer;
    source.connect(newGain);
    source.start();

    this.currentSource = source;
    this.currentGain = newGain;

    // Schedule fade-out before the track ends naturally
    const trackDurationMs = newBuffer.duration * 1000;
    if (trackDurationMs > fadeMs) {
      this.fadeTimer = setTimeout(() => {
        if (this.currentSource === source && this.currentGain === newGain) {
          const t = ctx.currentTime;
          newGain.gain.setValueAtTime(newGain.gain.value, t);
          newGain.gain.linearRampToValueAtTime(0, t + fadeSec);
        }
      }, trackDurationMs - fadeMs);
    }

    // Clean up when track ends
    source.onended = () => {
      source.disconnect();
      newGain.disconnect();
      if (this.currentSource === source) {
        this.currentSource = null;
        this.currentGain = null;
      }
    };
  }

  stop(): void {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Source may have already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    if (this.currentGain) {
      this.currentGain.disconnect();
      this.currentGain = null;
    }
  }
}
