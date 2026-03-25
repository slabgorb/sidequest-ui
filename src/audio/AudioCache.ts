/**
 * Caches decoded AudioBuffers to avoid redundant fetch + decode cycles.
 */
export class AudioCache {
  private cache: Map<string, AudioBuffer> = new Map();

  async getBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.cache.set(url, audioBuffer);
    return audioBuffer;
  }
}
