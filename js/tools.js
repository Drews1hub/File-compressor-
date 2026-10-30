import { unpack, MAX_ARCHIVE_BYTES } from './unpack.js';
import { chapterPlan } from './chapters.js?v=20261030-chapter-fix';
// The "File tools" tab: trim, merge/split PDFs, photos → PDF, rotate/resize photos, open archives.
import { ext, baseName, fmt, fmtDuration, kindOf, canvasToBlob, makeCanvas, loadScript, tick, VIDEO_EXT, AUDIO_EXT } from './util.js';
import { decodeImage, canEncode } from './images.js';
import { ffmpegJob, openEngine } from './engine.js';
import { audiobookTags } from './convert.js';

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
  'split-audio': { accepts: (f) => kindOf(f) === 'audio', multi: false, what: 'audiobooks' },
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

// Chapter metadata for the joined book, from the plan made by chapterPlan(); none for a single file
// (its own chapters are kept). `index` is the input number the metadata file gets.
async function chapterInput(job, durations, index, book) {
  if (durations.length < 2) return { extra: [], map: [] };
  // Each file's start time in milliseconds; the last entry is the end of the book.
  const starts = [0];
  for (const d of durations) starts.push(starts[starts.length - 1] + Math.round(d * 1000));
  const chapters = book.chapters.map((c, k) => {
    const end = starts[book.chapters[k + 1]?.first ?? durations.length];
    return `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${starts[c.first]}\nEND=${end}\ntitle=${escapeMeta(c.title)}\n`;
  });
  const meta = await job.writeText(`;FFMETADATA1\n${chapters.join('')}`, 'txt');
  return { extra: ['-i', meta], map: ['-map_chapters', String(index)] };
}

// "139 files joined …, 12 chapters." plus, for chapters found from the track numbers, where each one starts.
function joinSummary(n, total, book) {
  const c = book.chapters.length;
  return `Done — ${n} files joined into one audiobook, ${fmtDuration(total)} long, ${c} chapter${c === 1 ? '' : 's'}.`;
}
function chapterNote(book) {
  if (book.chapterNames !== 'resets') return '';
  return ` Chapters start where the track numbering starts over: files ${book.chapters.map((c) => c.first + 1).join(', ')} in the list.`;
}

// Copies the AAC audio of each track straight into the book: no re-encoding, so no quality loss.
async function copyJoin(job, files, durations, total, book) {
  const n = files.length;
  if (n === 1) {
    const blob = await job.encode(['-i', job.input, '-map', '0:a:0', '-c', 'copy', '-map_chapters', '0', ...book.meta, '-f', 'ipod'],
      'm4b', 'audio/mp4', { duration: total, label: 'Copying' });
    return { outputs: [{ blob, name: book.file }], summary: `Done — one audiobook, ${fmtDuration(total)} long.`, note: 'Audio copied as-is, so quality is unchanged.' };
  }
  // The concat demuxer reads a list of files; quotes inside a path are escaped the way ffmpeg expects.
  const list = await job.writeText(job.inputs.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join('\n') + '\n', 'txt');
  const chapters = await chapterInput(job, durations, 1, book);
  const blob = await job.encode(['-f', 'concat', '-safe', '0', '-i', list, ...chapters.extra,
    '-map', '0:a:0', ...chapters.map, '-c', 'copy', ...book.meta, '-f', 'ipod'],
  'm4b', 'audio/mp4', { duration: total, label: 'Joining' });
  return {
    outputs: [{ blob, name: book.file }],
    summary: joinSummary(n, total, book),
    note: `Audio copied as-is, so quality is unchanged.${chapterNote(book)}`,
  };
}

// Re-encodes the tracks into one AAC book on a single engine. Every track is resampled to one format,
// so files with different sample rates or mono/stereo can be joined.
async function reencodeJoin(job, files, durations, total, book) {
  const n = files.length;
  const inputs = job.inputs.flatMap((path) => ['-i', path]);
  const chains = job.inputs.map((_, i) => `[${i}:a:0]${TO_STEREO_44K}[a${i}]`);
  const concat = `${job.inputs.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[out]`;
  const chapters = await chapterInput(job, durations, n, book);
  const blob = await job.encode([...inputs, ...chapters.extra, '-filter_complex', [...chains, concat].join(';'),
    '-map', '[out]', ...chapters.map, '-c:a', 'aac', '-b:a', '192k', ...book.meta, '-f', 'ipod'],
  'm4b', 'audio/mp4', { duration: total, label: 'Joining' });
  return {
    outputs: [{ blob, name: book.file }],
    summary: n > 1
      ? joinSummary(n, total, book)
      : `Done — one audiobook, ${fmtDuration(total)} long.`,
    note: `Re-encoded to AAC 192k so the tracks join cleanly.${chapterNote(book)}`,
  };
}

const TO_STEREO_44K = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';

// How many engines to encode with at once: one core is left for the page, and four is plenty.
const encodeWorkers = (tracks) => Math.min(tracks, 4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));

// Runs ffmpeg on every file, several at a time on separate engines, and returns the outputs in order.
// `buildArgs(i, job)` gives { args, ext, type } for file i. Each file is encoded once, on its own engine.
async function encodeEach(files, durations, total, progress, workers, buildArgs) {
  const done = new Array(files.length).fill(0);
  const outputs = new Array(files.length);
  const report = () => {
    const frac = durations.reduce((sum, d, i) => sum + d * done[i], 0) / (total || 1);
    progress?.(`Joining… ${Math.round(frac * 100)}%`, frac);
  };
  let next = 0;
  let failure = null;
  const worker = async () => {
    let engine;
    try {
      engine = await openEngine(progress);
      while (!failure && next < files.length) {
        const i = next++;
        outputs[i] = await ffmpegJob(files[i], (_text, frac) => {
          if (typeof frac === 'number') { done[i] = frac; report(); }
        }, (job) => {
          const { args, ext, type } = buildArgs(i, job);
          return job.encode(args, ext, type, { duration: durations[i], label: 'Joining' });
        }, { engine });
        done[i] = 1;
        report();
      }
    } catch (e) {
      failure ??= e;
    } finally {
      engine?.close();
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  if (failure) throw failure;
  return outputs;
}

// Encodes each track to AAC on its own engine, several at a time. Same encoder and settings as the single-engine
// path, so the sound is the same; the pieces are joined afterwards without encoding again.
async function encodeTracks(files, durations, total, progress, workers) {
  const blobs = await encodeEach(files, durations, total, progress, workers, (_i, job) => ({
    args: ['-i', job.input, '-map', '0:a:0', '-af', TO_STEREO_44K, '-c:a', 'aac', '-b:a', '192k', '-f', 'ipod'],
    ext: 'm4a',
    type: 'audio/mp4',
  }));
  return blobs.map((blob, i) => new File([blob], `part-${String(i + 1).padStart(4, '0')}.m4a`, { type: 'audio/mp4' }));
}

// Reads every track's length and format.
function readTracks(files, progress) {
  return ffmpegJob(files, progress, async (job) => {
    const durations = [];
    const infos = [];
    for (let i = 0; i < files.length; i++) {
      progress?.(`Reading ${files[i].name} (${i + 1} of ${files.length})…`, i / files.length);
      const info = await job.probe(job.inputs[i]);
      if (!info.audio) throw new Error(`${files[i].name} has no sound track, so it can't be joined.`);
      infos.push(info.audio);
      durations.push(info.duration);
    }
    return { durations, infos, total: durations.reduce((sum, d) => sum + d, 0) };
  });
}

// One audiobook file per track, all tagged with the same album and numbered in order, so iTunes lists them as one
// book you can open to see every track. AAC tracks are copied as they are; others are re-encoded to AAC 192k.
async function separateTracks(files, progress, title, author) {
  const n = files.length;
  const book = title || 'Audiobook';
  // iTunes groups tracks by album artist, so the author goes there; without one, the book title stands in.
  const artist = author || book;
  const { durations, infos, total } = await readTracks(files, progress);
  const blobs = await encodeEach(files, durations, total, progress, encodeWorkers(n), (i, job) => ({
    args: ['-i', job.input, '-map', '0:a:0',
      ...(infos[i].codec === 'aac' ? ['-c:a', 'copy'] : ['-af', TO_STEREO_44K, '-c:a', 'aac', '-b:a', '192k']),
      '-metadata', `title=${baseName(files[i].name)}`, '-metadata', `album=${book}`, '-metadata', `artist=${artist}`,
      '-metadata', `album_artist=${artist}`,
      '-metadata', `track=${i + 1}/${n}`, '-metadata', 'media_type=2', '-metadata', 'genre=Audiobook',
      '-brand', 'M4B ', '-f', 'ipod'],
    ext: 'm4b',
    type: 'audio/mp4',
  }));
  const digits = Math.max(2, String(n).length);
  return {
    outputs: blobs.map((blob, i) => ({
      blob,
      name: `${String(i + 1).padStart(digits, '0')} ${audiobookTags(baseName(files[i].name)).file}`,
    })),
    summary: `Done — ${n} track${n === 1 ? '' : 's'}, listed together as "${book}".`,
    note: 'Each track is its own file, numbered in order, so iTunes shows them as one book. Add them all to iTunes together.',
  };
}

// Chapters from ffmpeg's metadata export: [CHAPTER] blocks with TIMEBASE, START, END and title.
// Values are in the block's own timebase; text uses backslash escapes for = ; # and \.
function parseChapters(text) {
  const chapters = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '[CHAPTER]') {
      open = { base: 1 / 1000, start: 0, end: 0, title: '' };
      chapters.push(open);
    } else if (open) {
      const m = /^(TIMEBASE|START|END|title)=(.*)$/.exec(line);
      if (!m) continue;
      if (m[1] === 'TIMEBASE') {
        const [num, den] = m[2].split('/').map(Number);
        if (num && den) open.base = num / den;
      } else if (m[1] === 'title') {
        open.title = m[2].replace(/\\(.)/g, '$1').trim();
      } else {
        open[m[1].toLowerCase()] = Number(m[2]);
      }
    }
  }
  return chapters.map((c) => ({ start: c.start * c.base, end: c.end * c.base, title: c.title }));
}

// Cuts one audiobook into a file per chapter, numbered in order and tagged with the same album, artist and
// album artist, so iTunes lists them as one book. AAC is copied as it is; other formats are re-encoded to AAC 192k.
export async function splitAudiobook(file, { title = '', author = '' }, progress) {
  const { chapters, codec } = await ffmpegJob(file, progress, async (job) => {
    if (!job.info.audio) throw new Error("Couldn't find any sound in this file.");
    const meta = await job.encode(['-i', job.input, '-f', 'ffmetadata'], 'txt', 'text/plain', { duration: job.info.duration, label: 'Reading chapters' });
    return { chapters: parseChapters(await meta.text()), codec: job.info.audio.codec };
  });
  if (chapters.length < 2) {
    throw new Error('This file has no chapter markers, so there is nothing to split it by. Books joined with "One file, with a chapter for each track" have them.');
  }
  const n = chapters.length;
  const book = title.trim() || baseName(file.name);
  const artist = author.trim() || book;
  const lengths = chapters.map((c) => Math.max(0, c.end - c.start));
  const total = lengths.reduce((sum, d) => sum + d, 0);
  const trackTitle = (i) => chapters[i].title || `Part ${i + 1}`;
  const blobs = await encodeEach(new Array(n).fill(file), lengths, total, progress, encodeWorkers(n), (i, job) => ({
    args: ['-ss', String(chapters[i].start), '-i', job.input, '-t', String(lengths[i]), '-map', '0:a:0',
      ...(codec === 'aac' ? ['-c:a', 'copy'] : ['-af', TO_STEREO_44K, '-c:a', 'aac', '-b:a', '192k']),
      '-map_chapters', '-1', '-metadata', `title=${trackTitle(i)}`, '-metadata', `album=${book}`,
      '-metadata', `artist=${artist}`, '-metadata', `album_artist=${artist}`, '-metadata', `track=${i + 1}/${n}`,
      '-metadata', 'media_type=2', '-metadata', 'genre=Audiobook', '-brand', 'M4B ', '-f', 'ipod'],
    ext: 'm4b',
    type: 'audio/mp4',
  }));
  const digits = Math.max(2, String(n).length);
  return {
    outputs: blobs.map((blob, i) => ({ blob, name: `${String(i + 1).padStart(digits, '0')} ${audiobookTags(trackTitle(i)).file}` })),
    summary: `Done — ${n} tracks, listed together as "${book}".`,
    note: `Cut at the ${n} chapter markers. ${codec === 'aac' ? 'The audio was copied as it is, so quality is unchanged.' : 'Re-encoded to AAC 192k.'} Add all the files to iTunes together.`,
  };
}

// Joins the tracks, in the order given, into one M4B. With several files the chapters follow the Chapter names
// choice: one wherever the track numbering starts over, or one per file.
// A single file keeps whatever chapters it already has.
export async function joinAudiobook(files, progress, { title = '', author = '', separate = false, chapterNames = 'resets' } = {}) {
  if (separate) return separateTracks(files, progress, title.trim(), author.trim());
  const book = audiobookTags(title, 'audiobook', author);
  book.chapterNames = chapterNames;
  const n = files.length;
  // Worked out before any audio is read, so a file name without a track number is reported straight away.
  book.chapters = n > 1 ? chapterPlan(files.map((f) => f.name), chapterNames) : [];

  // Pass 1: read every track. If they are all AAC in one format they are copied straight in (lossless, seconds).
  // A single track, or a computer with no spare core, is re-encoded here; anything else goes on to pass 2.
  const pass = await ffmpegJob(files, progress, async (job) => {
    const durations = [];
    const infos = [];
    for (let i = 0; i < n; i++) {
      progress?.(`Reading ${files[i].name} (${i + 1} of ${n})…`, i / n);
      const info = await job.probe(job.inputs[i]);
      if (!info.audio) throw new Error(`${files[i].name} has no sound track, so it can't be joined.`);
      infos.push(info.audio);
      durations.push(info.duration);
    }
    const total = durations.reduce((s, d) => s + d, 0);

    const first = infos[0];
    if (infos.every((a) => a.codec === 'aac' && a.rate === first.rate && a.channels === first.channels)) {
      try {
        return { result: await copyJoin(job, files, durations, total, book) };
      } catch { /* fall back to re-encoding */ }
    }
    if (n < 2 || encodeWorkers(n) < 2) return { result: await reencodeJoin(job, files, durations, total, book) };
    return { durations, total };
  });
  if (pass.result) return pass.result;

  // Pass 2: encode the tracks several at a time, then join the finished pieces without encoding again.
  const parts = await encodeTracks(files, pass.durations, pass.total, progress, encodeWorkers(n));
  return ffmpegJob(parts, progress, async (job) => {
    // Chapter times come from the encoded pieces, which are a few milliseconds longer than the originals.
    const durations = [];
    for (let i = 0; i < n; i++) durations.push((await job.probe(job.inputs[i])).duration);
    const total = durations.reduce((s, d) => s + d, 0);
    const result = await copyJoin(job, files, durations, total, book);
    return { ...result, note: `Re-encoded to AAC 192k so the tracks join cleanly.${chapterNote(book)}` };
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

export function readTar(data) {
  const files = [];
  const dec = new TextDecoder();
  const str = (o, n) => dec.decode(data.subarray(o, o + n)).replace(/\0.*$/s, '');
  let longName = null;
  let entryCount = 0;
  for (let off = 0; off + 512 <= data.length;) {
    if (data[off] === 0) break; // end-of-archive blocks
    let name = str(off, 100);
    const prefix = str(off + 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const sizeText = str(off + 124, 12).trim() || '0';
    if (!/^[0-7]+$/.test(sizeText)) throw new Error('Invalid TAR entry size.');
    const size = Number.parseInt(sizeText, 8);
    const next = off + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || next <= off || next > data.length) throw new Error('Truncated or invalid TAR entry.');
    if (++entryCount > 10000) throw new Error('Archive exceeds the 10,000 entry safety limit.');
    const type = String.fromCharCode(data[off + 156]);
    const body = data.subarray(off + 512, off + 512 + size);
    if (type === 'L') longName = dec.decode(body).replace(/\0.*$/s, ''); // GNU long file name
    else if (type === '0' || type === '\0') { files.push({ path: longName ?? name, data: body }); longName = null; }
    off = next;
  }
  return files;
}

export async function extractArchive(file, progress) {
  progress?.('Opening…');
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds the 256 MiB safety limit.');
  let data = new Uint8Array(await file.arrayBuffer());
  let entries;
  try {
    if (data[0] === 0x50 && data[1] === 0x4b) {
      const unzipped = await unpack(file);
      entries = Object.entries(unzipped).filter(([p]) => !p.endsWith('/') && !p.startsWith('__MACOSX/')).map(([path, d]) => ({ path, data: d }));
    } else {
      if (data[0] === 0x1f && data[1] === 0x8b) data = (await unpack(file, 'gzip')).data;
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
