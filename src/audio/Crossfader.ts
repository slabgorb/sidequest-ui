const DEFAULT_FADE_MS = 3000;

export class Crossfader {
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;

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

      // Clean up old source after fade
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

    // Create new source with its own gain node for crossfade
    const newGain = ctx.createGain();
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + fadeSec);
    newGain.connect(targetGain);

    const source = ctx.createBufferSource();
    source.buffer = newBuffer;
    source.loop = true;
    source.connect(newGain);
    source.start();

    this.currentSource = source;
    this.currentGain = newGain;
  }

  stop(): void {
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
