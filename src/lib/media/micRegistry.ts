const streams = new Set<MediaStream>();

export function registerMicStream(stream: MediaStream) {
  streams.add(stream);
}

export function unregisterMicStream(stream: MediaStream | null) {
  if (stream) streams.delete(stream);
}

export function stopAllMicStreams(reason?: string) {
  if (reason) console.log(`[MicRegistry] Stopping all streams: ${reason}`);
  streams.forEach(s => {
    try { s.getTracks().forEach(t => t.stop()); } catch (e) { console.error(e); }
  });
  streams.clear();
}
