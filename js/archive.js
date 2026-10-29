// Bundling files into ZIP or TAR.GZ archives, and reading files out of dropped folders.

// Already-compressed formats gain nothing from deflate, so store them as-is (much faster).
const STORED = /\.(jpe?g|png|gif|webp|avif|heic|mp4|m4v|mov|mkv|webm|avi|mp3|m4a|aac|ogg|opus|flac|zip|gz|tgz|7z|rar|bz2|xz|docx|pptx|xlsx|pdf)$/i;

function zipAsync(entries) {
  return new Promise((resolve, reject) =>
    fflate.zip(entries, (err, data) => (err ? reject(err) : resolve(data))));
}

// `files` is [{ path, blob }]. Duplicate paths get " (2)", " (3)"… added before the extension.
function uniquePaths(files) {
  const seen = new Map();
  return files.map(({ path, blob }) => {
    let p = path;
    const n = seen.get(p.toLowerCase()) ?? 0;
    seen.set(p.toLowerCase(), n + 1);
    if (n) {
      const dot = p.lastIndexOf('.');
      p = dot > p.lastIndexOf('/') ? `${p.slice(0, dot)} (${n + 1})${p.slice(dot)}` : `${p} (${n + 1})`;
    }
    return { path: p, blob };
  });
}

export async function makeZip(files, progress) {
  const entries = {};
  const list = uniquePaths(files);
  for (let i = 0; i < list.length; i++) {
    progress?.(`Reading ${i + 1} of ${list.length}…`, i / list.length);
    const { path, blob } = list[i];
    entries[path] = [new Uint8Array(await blob.arrayBuffer()), { level: STORED.test(path) ? 0 : 6 }];
  }
  progress?.('Packing…');
  return new Blob([await zipAsync(entries)], { type: 'application/zip' });
}

// Minimal POSIX ustar writer.
function tarHeader(path, size, mtime) {
  const enc = new TextEncoder();
  const h = new Uint8Array(512);
  const put = (offset, str, len) => h.set(enc.encode(str).subarray(0, len), offset);
  const octal = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';

  let name = path;
  let prefix = '';
  if (enc.encode(name).length > 100) {
    // Long paths: split at a folder boundary into the 155-byte prefix and 100-byte name fields.
    const cut = path.lastIndexOf('/', 155);
    if (cut > 0) { prefix = path.slice(0, cut); name = path.slice(cut + 1); }
  }
  put(0, name, 100);
  put(100, '0000644\0', 8);
  put(108, '0000000\0', 8);
  put(116, '0000000\0', 8);
  put(124, octal(size, 12), 12);
  put(136, octal(Math.floor(mtime / 1000), 12), 12);
  put(148, '        ', 8); // checksum is computed with this field as spaces
  put(156, '0', 1);
  put(257, 'ustar\0', 6);
  put(263, '00', 2);
  put(345, prefix, 155);
  let sum = 0;
  for (const b of h) sum += b;
  put(148, sum.toString(8).padStart(6, '0') + '\0 ', 8);
  return h;
}

export async function makeTarGz(files, progress) {
  const list = uniquePaths(files);
  const parts = [];
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    progress?.(`Reading ${i + 1} of ${list.length}…`, i / list.length);
    const { path, blob } = list[i];
    const data = new Uint8Array(await blob.arrayBuffer());
    const pad = (512 - (data.length % 512)) % 512;
    parts.push(tarHeader(path, data.length, blob.lastModified ?? Date.now()), data, new Uint8Array(pad));
    total += 512 + data.length + pad;
  }
  parts.push(new Uint8Array(1024)); // two empty blocks end the archive
  total += 1024;
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { tar.set(p, offset); offset += p.length; }
  progress?.('Compressing…');
  const gz = await new Promise((resolve, reject) =>
    fflate.gzip(tar, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))));
  return new Blob([gz], { type: 'application/gzip' });
}

// Reads a drop into [{ file, path }], walking into dropped folders so their structure is kept.
// Must be called synchronously from the drop handler (the entries vanish after the event).
export function droppedFiles(dataTransfer) {
  const entries = [...(dataTransfer.items ?? [])].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  const plain = [...dataTransfer.files].map((file) => ({ file, path: file.name }));
  if (!entries.length) return Promise.resolve(plain);

  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  return Promise.all(entries.map((e) => walk(e, ''))).then(() => out);
}
