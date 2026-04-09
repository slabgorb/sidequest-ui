// 0.3 ducks music loudly enough that voice narration cuts through clearly —
// 0.5 was not a deep enough duck and let music compete with the narrator.
const DUCK_LEVEL = 0.3;
const DUCK_RAMP_MS = 200;
const UNDUCK_RAMP_MS = 500;

export class Ducker {
  private musicGain: GainNode;
  private isDucked = false;

  constructor(musicGain: GainNode) {
    this.musicGain = musicGain;
  }

  duck(): void {
    this.isDucked = true;
    const now = this.musicGain.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(
      DUCK_LEVEL,
      now + DUCK_RAMP_MS / 1000,
    );
  }

  unduck(): void {
    this.isDucked = false;
    const now = this.musicGain.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(
      1.0,
      now + UNDUCK_RAMP_MS / 1000,
    );
  }
}
