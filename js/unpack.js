// Decompression stays off the UI thread and is bounded by output bytes and entry count.
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const active = new Set();
export function cancelUnpack() {
  for (const stop of [...active]) stop();
}
export async function unpack(file, format = 'zip') {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds the 256 MiB safety limit.');
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./unpack-worker.js', import.meta.url));
    let timer;
    const finish = (error, result) => {
      clearTimeout(timer); active.delete(stop); worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const stop = () => finish(new Error('Cancelled.'));
    active.add(stop);
    timer = setTimeout(() => finish(new Error('Archive processing timed out.')), 30000);
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
    worker.onerror = () => finish(new Error('Could not unpack this archive.'));
    worker.postMessage({ buffer, format }, [buffer]);
  });
}
