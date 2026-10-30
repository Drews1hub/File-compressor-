importScripts('../vendor/fflate.min.js');
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 10000;
self.onmessage = ({ data: { buffer, format } }) => {
  try {
    const input = new Uint8Array(buffer);
    let total = 0, count = 0, completed = 0;
    const result = Object.create(null);
    const budget = (n) => {
      total += n;
      if (total > MAX_BYTES) throw new Error('Expanded archive exceeds the 256 MiB safety limit.');
    };
    const join = (chunks, size) => {
      const out = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
      return out;
    };
    let stream;
    if (format === 'zip') {
      stream = new fflate.Unzip((file) => {
        if (++count > MAX_FILES) throw new Error('Archive exceeds the 10,000 entry safety limit.');
        if (file.originalSize > MAX_BYTES - total) throw new Error('Expanded archive exceeds the 256 MiB safety limit.');
        let size = 0; const chunks = [];
        file.ondata = (error, chunk, final) => {
          if (error) throw error;
          budget(chunk.length); size += chunk.length; chunks.push(chunk);
          if (final) { result[file.name] = join(chunks, size); completed++; }
        };
        file.start();
      });
      stream.register(fflate.UnzipInflate);
    } else {
      const chunks = [];
      stream = new fflate.Gunzip((chunk, final) => {
        budget(chunk.length); chunks.push(chunk);
        if (final) result.data = join(chunks, total);
      });
    }
    // Small input chunks bound transient inflation allocations, including forged size headers.
    for (let i = 0; i < input.length; i += 1024) stream.push(input.subarray(i, i + 1024), i + 1024 >= input.length);
    if (format === 'zip' && completed !== count) throw new Error('Truncated archive.');
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message || 'Invalid archive.' }); }
};
