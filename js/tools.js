// The "File tools" tab: trim, merge/split PDFs, photos → PDF, rotate/resize photos, open archives.
import { ext, baseName, fmt, fmtDuration, kindOf, canvasToBlob, makeCanvas, loadScript, tick, VIDEO_EXT, AUDIO_EXT } from './util.js';
import { decodeImage, canEncode } from './images.js';
import { ffmpegJob } from './engine.js';

let pdfLibReady = null;
const loadPdfLib = () => {
  pdfLibReady ??= loadScript(new URL('../vendor/pdf-lib.min.js', import.meta.url).href).then(() => window.PDFLib);
  pdfLibReady.catch(() => { pdfLibReady = null; });
  return pdfLibReady;
};

// Which files each tool accepts, and whether it works on a list of files (true) or one file at a time.
export const TOOLS = {
  trim: { accepts: (f) => ['video', 'audio'].includes(kindOf(f)), multi: false, what: 'videos or audio files' },
  'join-audio': { accepts: (f) => kindOf(f) === 'audio', multi: true, what: 'audio files' },
  'merge-pdf': { accepts: (f) => kindOf(f) === 'pdf', multi: true, what: 'PDFs' },
  'split-pdf': { accepts: (f) => kindOf(f) === 'pdf', multi: false, what: 'PDFs' },
  'photos-pdf': { accepts: (f) => kindOf(f) === 'image', multi: true, what: 'photos' },
  'photo-edit': { accepts: (f) => kindOf(f) === 'image', multi: false, what: 'photos' },
  extract: { accepts: (f) => /\.(zip|tar|tgz|tar\.gz|gz)$/i.test(f.name), multi: false, what: 'ZIP, TAR or TAR.GZ archives' },
};

// "1:23", "83", "1:02:03.5" → seconds. Blank → null.
export function parseTime(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) throw new Error(`"${t}" isn't a time. Use minutes:seconds, like 1:30.`);
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

// ---------- trim ----------

export function trimMedia(file, { start, end, exact }, progress) {
  return ffmpegJob(file, progress, async (job) => {
    const { duration, video, audio } = job.info;
    if (!video && !audio) throw new Error("Couldn't find any video or sound in this file.");
    const s = start ?? 0;
    const e = end ?? duration;
    if (duration && s >= duration) throw new Error(`The start is past the end of the clip (it's ${fmtDuration(duration)} long).`);
    if (e != null && e <= s) throw new Error('The end time has to be after the start time.');
    const length = e != null ? e - s : 0;
    const opts = { duration: length || duration, label: 'Trimming' };
    const timing = ['-ss', String(s), '-i', job.input, ...(e != null ? ['-t', String(length)] : [])];
    const range = `${fmtDuration(s)}–${fmtDuration(e ?? duration)}`;

    if (video && exact) {
      // Re-encoding cuts on the exact frame; copying can only cut on the nearest keyframe.
      const blob = await job.encode([...timing, '-map', '0:v:0', ...(audio ? ['-map', '0:a:0'] : []),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'], 'mp4', 'video/mp4', opts);
      return { outputs: [{ blob, name: `${baseName(file.name)}-trimmed.mp4` }], note: `Kept ${range}, cut on the exact frame. Saved as MP4.` };
    }

    const e2 = ext(file.name);
    const out = VIDEO_EXT.includes(e2) || AUDIO_EXT.includes(e2) ? e2 : video ? 'mp4' : 'm4a';
    const blob = await job.encode([...timing, '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero',
      ...(['mp4', 'mov', 'm4v', 'm4a', 'm4b'].includes(out) ? ['-movflags', '+faststart'] : []),
      ...(out === 'm4b' ? ['-f', 'ipod'] : [])], out, file.type || 'application/octet-stream', opts);
    return {
      outputs: [{ blob, name: `${baseName(file.name)}-trimmed.${out}` }],
      note: `Kept ${range} without re-encoding, so quality is unchanged.${video ? ' Quick cuts start on the nearest keyframe, so the clip may begin a little early; untick "Quick cut" for an exact cut.' : ''}`,
    };
  });
}

// ---------- audiobook join ----------

// Chapter titles in FFMETADATA: these characters must be escaped with a backslash.
const escapeMeta = (s) => s.replace(/[=;#\\\n]/g, '\\$&');

// Joins the tracks, in the order given, into one M4B. Each file becomes a chapter, so the book can be navigated by disc and track.
export function joinAudiobook(files, progress) {
  return ffmpegJob(files, progress, async (job) => {
    const n = files.length;
    const durations = [];
    for (let i = 0; i < n; i++) {
      progress?.(`Reading ${files[i].name} (${i + 1} of ${n})…`, i / n);
      const { duration, audio } = await job.probe(job.inputs[i]);
      if (!audio) throw new Error(`${files[i].name} has no sound track, so it can't be joined.`);
      durations.push(duration);
    }
    const total = durations.reduce((s, d) => s + d, 0);

    // Chapter times in milliseconds, so each file starts where the previous one ended.
    let start = 0;
    const chapters = files.map((file, i) => {
      const end = start + Math.round(durations[i] * 1000);
      const chapter = `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${start}\nEND=${end}\ntitle=${escapeMeta(baseName(file.name))}\n`;
      start = end;
      return chapter;
    });
    const meta = await job.writeText(`;FFMETADATA1\n${chapters.join('')}`, 'txt');

    // Every track is resampled to one format, so files with different sample rates or mono/stereo can be joined.
    const inputs = job.inputs.flatMap((path) => ['-i', path]);
    const chains = job.inputs.map((_, i) =>
      `[${i}:a:0]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
    const concat = `${job.inputs.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[out]`;
    const blob = await job.encode([...inputs, '-i', meta, '-filter_complex', [...chains, concat].join(';'),
      '-map', '[out]', '-map_chapters', String(n), '-c:a', 'aac', '-b:a', '128k', '-f', 'ipod'],
    'm4b', 'audio/mp4', { duration: total, label: 'Joining' });
    return {
      outputs: [{ blob, name: 'audiobook.m4b' }],
      summary: `Done — ${n} file${n === 1 ? '' : 's'} joined, ${fmtDuration(total)} long, one chapter per file.`,
      note: 'Re-encoded to AAC 128k so the tracks join cleanly.',
    };
  });
}

// ---------- PDFs ----------

async function loadPdf(PDFLib, file) {
  try {
    return await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
  } catch (e) {
    if (/encrypt/i.test(e?.message)) throw new Error(`${file.name} is password-protected. Remove the password first.`);
    throw new Error(`Couldn't open ${file.name} as a PDF.`);
  }
}

export async function mergePdfs(files, progress) {
  const PDFLib = await loadPdfLib();
  const out = await PDFLib.PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    progress?.(`Adding ${files[i].name} (${i + 1} of ${files.length})…`, i / files.length);
    const src = await loadPdf(PDFLib, files[i]);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
    await tick();
  }
  progress?.('Saving…');
  const blob = new Blob([await out.save()], { type: 'application/pdf' });
  return { blob, pages: out.getPageCount() };
}

// "1-3, 5, 8-" → [[0,1,2],[4],[7..last]] (zero-based page numbers).
export function parseRanges(text, count) {
  const groups = [];
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" isn't a page range. Use something like 1-3, 5, 8-10.`);
    const a = Number(m[1] ?? 1);
    const b = m[2] ? Number(m[3] ?? count) : a;
    if (a < 1 || b > count || a > b) throw new Error(`Pages ${part} don't exist — this PDF has ${count} page${count === 1 ? '' : 's'}.`);
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  if (!groups.length) throw new Error('Type the pages you want, like 1-3, 5.');
  return groups;
}

export async function splitPdf(file, { mode, ranges }, progress) {
  const PDFLib = await loadPdfLib();
  const src = await loadPdf(PDFLib, file);
  const count = src.getPageCount();
  const groups = mode === 'every' ? src.getPageIndices().map((i) => [i]) : parseRanges(ranges, count);
  const base = baseName(file.name);
  const label = (g) => (g.length === 1 ? `p${g[0] + 1}` : `p${g[0] + 1}-${g[g.length - 1] + 1}`);

  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    progress?.(`Making part ${i + 1} of ${groups.length}…`, i / groups.length);
    const doc = await PDFLib.PDFDocument.create();
    for (const page of await doc.copyPages(src, groups[i])) doc.addPage(page);
    parts.push({ name: `${base}-${label(groups[i])}.pdf`, data: await doc.save() });
    await tick();
  }
  if (parts.length === 1) {
    return { outputs: [{ blob: new Blob([parts[0].data], { type: 'application/pdf' }), name: parts[0].name }], note: '' };
  }
  const zipped = fflate.zipSync(Object.fromEntries(parts.map((p) => [p.name, [p.data, { level: 6 }]])));
  return {
    outputs: [{ blob: new Blob([zipped], { type: 'application/zip' }), name: `${base}-split.zip` }],
    note: `${parts.length} PDFs, bundled in a ZIP. Text stays selectable.`,
  };
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

export async function photosToPdf(files, { page }, progress) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (let i = 0; i < files.length; i++) {
    progress?.(`Adding ${files[i].name} (${i + 1} of ${files.length})…`, i / files.length);
    const bitmap = await decodeImage(files[i], progress);
    const canvas = makeCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const jpeg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', 0.9)).arrayBuffer());
    const iw = canvas.width * 0.75; // px → pt at 96 DPI
    const ih = canvas.height * 0.75;
    canvas.width = canvas.height = 0;

    let pw = iw, ph = ih, x = 0, y = 0, w = iw, h = ih;
    if (PAGE_SIZES[page]) {
      // Turn the page to match the photo, then fit the photo inside a small margin.
      [pw, ph] = PAGE_SIZES[page];
      if (iw > ih) [pw, ph] = [ph, pw];
      const margin = 24;
      const s = Math.min((pw - 2 * margin) / iw, (ph - 2 * margin) / ih);
      w = iw * s; h = ih * s; x = (pw - w) / 2; y = (ph - h) / 2;
    }
    const orientation = pw > ph ? 'l' : 'p';
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [pw, ph], orientation, compress: true });
    else doc.addPage([pw, ph], orientation);
    doc.addImage(jpeg, 'JPEG', x, y, w, h, undefined, 'NONE');
    await tick();
  }
  return doc.output('blob');
}

// ---------- photos ----------

export async function editPhoto(file, { rotate, flip, resize }, progress) {
  const bitmap = await decodeImage(file, progress);
  const turned = rotate === 90 || rotate === 270;
  let scale = 1;
  if (resize === 'half') scale = 0.5;
  else if (Number(resize)) scale = Math.min(1, Number(resize) / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = makeCanvas(turned ? h : w, turned ? w : h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close?.();

  // Keep the format when the browser can write it; HEIC, TIFF and the like come back as JPG.
  const own = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext(file.name)];
  const type = own && (await canEncode(own)) ? own : own === 'image/webp' ? 'image/png' : 'image/jpeg';
  if (type === 'image/jpeg') {
    // JPEG has no transparency: paint white underneath what's already drawn.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const blob = await canvasToBlob(canvas, type, 0.92);
  const outExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  const did = [rotate && `rotated ${rotate}°`, flip && 'flipped', scale < 1 && `resized to ${canvas.width}×${canvas.height}`].filter(Boolean);
  return {
    outputs: [{ blob, name: `${baseName(file.name)}-edited.${outExt}` }],
    note: did.length ? `${did.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : 'Nothing to change was picked, so this is just a fresh copy.',
  };
}

// ---------- archives ----------

function readTar(data) {
  const files = [];
  const dec = new TextDecoder();
  const str = (o, n) => dec.decode(data.subarray(o, o + n)).replace(/\0.*$/s, '');
  let longName = null;
  for (let off = 0; off + 512 <= data.length;) {
    if (data[off] === 0) break; // end-of-archive blocks
    let name = str(off, 100);
    const prefix = str(off + 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(str(off + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(data[off + 156]);
    const body = data.subarray(off + 512, off + 512 + size);
    if (type === 'L') longName = dec.decode(body).replace(/\0.*$/s, ''); // GNU long file name
    else if (type === '0' || type === '\0') { files.push({ path: longName ?? name, data: body }); longName = null; }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

export async function extractArchive(file, progress) {
  progress?.('Opening…');
  let data = new Uint8Array(await file.arrayBuffer());
  let entries;
  try {
    if (data[0] === 0x50 && data[1] === 0x4b) {
      const unzipped = await new Promise((res, rej) => fflate.unzip(data, (err, out) => (err ? rej(err) : res(out))));
      entries = Object.entries(unzipped).filter(([p]) => !p.endsWith('/') && !p.startsWith('__MACOSX/')).map(([path, d]) => ({ path, data: d }));
    } else {
      if (data[0] === 0x1f && data[1] === 0x8b) data = await new Promise((res, rej) => fflate.gunzip(data, (err, out) => (err ? rej(err) : res(out))));
      const isTar = data.length >= 512 && new TextDecoder().decode(data.subarray(257, 262)) === 'ustar';
      entries = isTar ? readTar(data) : [{ path: file.name.replace(/\.gz$/i, '') || 'file', data }];
    }
  } catch {
    throw new Error("Couldn't open this archive. It may be damaged, password-protected, or a format that isn't supported (RAR and 7Z aren't).");
  }
  if (!entries.length) throw new Error('This archive is empty.');
  const outputs = entries.map(({ path, data: d }) => ({ blob: new Blob([d]), name: path.split('/').pop() || 'file' }));
  const total = outputs.reduce((s, o) => s + o.blob.size, 0);
  return { outputs, note: `${outputs.length} file${outputs.length === 1 ? '' : 's'}, ${fmt(total)} in total.` };
}
