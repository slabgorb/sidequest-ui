/**
 * Convert audio Blob (from MediaRecorder) to Float32Array at 16kHz mono for Whisper.
 */
export async function audioToFloat32(
  audioBlob: Blob,
  targetSampleRate: number = 16000,
): Promise<Float32Array> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, 1, targetSampleRate);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetSampleRate),
    targetSampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
}
