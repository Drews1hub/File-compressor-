import { ext, baseName, fmt, fmtDuration, tick, canvasToBlob, drawToCanvas } from './util.js';
import { decodeImage, encodeImageUnder, pickImageType, typeExt, typeLabel } from './images.js';
import { withPdf, renderPage } from './pdf.js';
import { ffmpegJob } from './engine.js';

// Every compressor takes (file, opts, progress). opts:
//   mode:        'size' (fit under opts.target bytes) or 'level' (use the opts.level strength)
//   target:      byte limit for 'size' mode
//   level:       'light' | 'balanced' | 'strong'
//   imageFormat: 'auto' | 'jpg' | 'webp'
//   maxSide:     largest image side in px, 0 = no limit
//   maxRes:      video height cap (shorter side), 0 = auto
//   mute:        drop the sound from videos

const LEVELS = {
  light: { quality: 0.85, maxDim: 4000, crf: 23, res: 1080, audioK: 128, mp3: 192, dpi: 150, pdfQ: 0.8, officeDim: 2400, officeQ: 0.85 },
  balanced: { quality: 0.72, maxDim: 2560, crf: 28, res: 720, audioK: 96, mp3: 128, dpi: 100, pdfQ: 0.65, officeDim: 1600, officeQ: 0.7 },
  strong: { quality: 0.55, maxDim: 1600, crf: 32, res: 480, audioK: 64, mp3: 64, dpi: 72, pdfQ: 0.5, officeDim: 1000, officeQ: 0.55 },
};

// In strength mode the result can come out bigger than the original (say, an already well-compressed photo).
// Then hand back the original instead.
function keepSmaller(file, output, note) {
  if (output.blob.size < file.size) return { outputs: [output], note };
  return {
    outputs: [{ blob: file, name: file.name }],
    note: "This setting couldn't make the file any smaller, so here's the original unchanged.",
  };
}

// ---------- images ----------

async function compressImage(file, opts, progress) {
  const bitmap = await decodeImage(file, progress);
  try {
    const type = await pickImageType(bitmap, opts.imageFormat);
    const name = `${baseName(file.name)}-compressed.${typeExt(type)}`;
    const maxDim = Math.min(opts.maxSide || Infinity, opts.mode === 'level' ? LEVELS[opts.level].maxDim : 8000);
    const kept = type === 'image/jpeg' ? '' : ' Transparency kept.';

    if (opts.mode === 'size') {
      const { blob, width, height } = await encodeImageUnder(bitmap, opts.target, progress, { type, maxDim });
      return { outputs: [{ blob, name }], note: `Saved as ${typeLabel(type)} at ${width}×${height}.${kept}` };
    }

    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = drawToCanvas(bitmap, scale, type === 'image/jpeg' ? '#ffffff' : null);
    progress?.(`Saving ${canvas.width}×${canvas.height}…`);
    const blob = await canvasToBlob(canvas, type, LEVELS[opts.level].quality);
    return keepSmaller(file, { blob, name }, `Saved as ${typeLabel(type)} at ${canvas.width}×${canvas.height}.${kept}`);
  } finally {
    bitmap.close?.();
  }
}

// ---------- video ----------

// Scale so the shorter side is `px`, keeping even dimensions (H.264 needs them). Works for portrait and landscape.
const shortSide = (px) => `scale='if(gt(iw,ih),-2,${px})':'if(gt(iw,ih),${px},-2)'`;
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

async function compressVideo(file, opts, progress) {
  return ffmpegJob(file, progress, async (job) => {
    const { duration, video, audio: hasAudio } = job.info;
    if (!video) {
      if (hasAudio) return compressAudioJob(job, file, opts);
      throw new Error("Couldn't find any video in this file.");
    }
    const audio = hasAudio && !opts.mute;
    const short = Math.min(video.width, video.height);
    const name = `${baseName(file.name)}-compressed.mp4`;
    const sound = (k) => (audio ? ` + ${k} kbit/s sound` : hasAudio ? ', sound removed' : '');

    // Shared start of the command: pick streams, cap resolution and frame rate.
    const start = (cap) => {
      const args = ['-i', job.input, '-map', '0:v:0', ...(audio ? ['-map', '0:a:0'] : [])];
      args.push('-vf', short > cap ? shortSide(cap) : EVEN);
      if (video.fps > 31) args.push('-r', '30'); // halves the work for 60 fps phone video
      return args;
    };

    if (opts.mode === 'level') {
      const L = LEVELS[opts.level];
      const cap = Math.min(L.res, opts.maxRes || Infinity);
      const height = Math.min(short, cap);
      const args = [...start(cap), '-c:v', 'libx264', '-preset', 'superfast', '-crf', String(L.crf), '-pix_fmt', 'yuv420p'];
      if (audio) args.push('-c:a', 'aac', '-b:a', `${L.audioK}k`);
      args.push('-movflags', '+faststart');
      const blob = await job.encode(args, 'mp4', 'video/mp4', { duration, label: `Compressing to ${height}p` });
      return keepSmaller(file, { blob, name }, `Saved as MP4 (H.264) at ${height}p${sound(L.audioK)}.`);
    }

    if (!duration) throw new Error("Couldn't tell how long this video is, so the right quality can't be worked out.");
    const target = opts.target;
    // Total bit budget per second, in kbit/s. Each retry scales it by how much the last try overshot.
    let totalK = (target * 8) / duration / 1000;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const audioK = !audio ? 0 : totalK > 1500 ? 128 : totalK > 600 ? 96 : totalK > 250 ? 64 : 32;
      const videoK = Math.floor(totalK * 0.96 - audioK); // ~4% for container overhead
      if (videoK < 40) {
        throw new Error(`This ${fmtDuration(duration)} video can't fit in ${fmt(target)} and still be watchable. ` +
          'Trim it into shorter clips, or raise the target size.');
      }
      const auto = videoK >= 2500 ? 1080 : videoK >= 1200 ? 720 : videoK >= 600 ? 480 : videoK >= 250 ? 360 : 240;
      const cap = Math.min(auto, opts.maxRes || Infinity);
      const height = Math.min(short, cap);

      const args = [...start(cap), '-c:v', 'libx264', '-preset', 'superfast', '-b:v', `${videoK}k`,
        '-maxrate', `${Math.round(videoK * 1.5)}k`, '-bufsize', `${videoK * 2}k`, '-pix_fmt', 'yuv420p'];
      if (audio) args.push('-c:a', 'aac', '-b:a', `${audioK}k`, ...(audioK <= 32 ? ['-ac', '1'] : []));
      args.push('-movflags', '+faststart');

      const label = attempt === 1 ? `Compressing to ${height}p` : `Retrying a bit smaller (try ${attempt})`;
      const blob = await job.encode(args, 'mp4', 'video/mp4', { duration, label });
      if (blob.size <= target) {
        return { outputs: [{ blob, name }], note: `Saved as MP4 (H.264) at ${height}p, about ${videoK} kbit/s video${sound(audioK)}.` };
      }
      totalK *= (target / blob.size) * 0.95;
    }
    throw new Error('Could not get the video under the target size. Try trimming it or raising the target.');
  });
}

// ---------- audio ----------

const MP3_RATES = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192];

const mp3Args = (job, k) => ['-i', job.input, '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', `${k}k`, ...(k < 64 ? ['-ac', '1'] : [])];

async function compressAudioJob(job, file, opts) {
  const { duration, audio } = job.info;
  if (!audio) throw new Error("Couldn't find any sound in this file.");
  const name = `${baseName(file.name)}-compressed.mp3`;

  if (opts.mode === 'level') {
    const k = LEVELS[opts.level].mp3;
    const blob = await job.encode(mp3Args(job, k), 'mp3', 'audio/mpeg', { duration, label: `Compressing to ${k} kbit/s MP3` });
    return keepSmaller(file, { blob, name }, `Saved as MP3 at ${k} kbit/s.`);
  }

  if (!duration) throw new Error("Couldn't tell how long this recording is.");
  const target = opts.target;
  let budgetK = (target * 8) / duration / 1000 * 0.97;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const k = MP3_RATES.filter((r) => r <= budgetK).pop();
    if (!k) {
      throw new Error(`This ${fmtDuration(duration)} recording can't fit in ${fmt(target)}. Split it into shorter parts, or raise the target size.`);
    }
    const blob = await job.encode(mp3Args(job, k), 'mp3', 'audio/mpeg', { duration, label: `Compressing to ${k} kbit/s MP3` });
    if (blob.size <= target) {
      return { outputs: [{ blob, name }], note: `Saved as MP3 at ${k} kbit/s${k < 64 ? ' (mono)' : ''}.` };
    }
    budgetK = k - 1;
  }
  throw new Error('Could not get the audio under the target size.');
}

const compressAudio = (file, opts, progress) =>
  ffmpegJob(file, progress, (job) => compressAudioJob(job, file, opts));

// ---------- PDF ----------

async function rasterizePdf(pdf, dpi, quality, target, progress) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  let total = 0;
  const n = pdf.numPages;

  for (let i = 1; i <= n; i++) {
    progress?.(`Page ${i} of ${n} at ${dpi} DPI…`, i / n);
    const { canvas, width, height } = await renderPage(pdf, i, dpi);
    const jpeg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', quality)).arrayBuffer());
    canvas.width = canvas.height = 0;
    total += jpeg.length;

    // Bail out early when it's clearly going to overshoot, so the next attempt starts sooner.
    const projected = (total / i) * n;
    if (i >= 3 && i < n && projected > target * 1.25) return { projected };

    const size = [width, height];
    const orientation = width > height ? 'l' : 'p';
    if (!doc) doc = new jsPDF({ unit: 'pt', format: size, orientation, compress: true });
    else doc.addPage(size, orientation);
    doc.addImage(jpeg, 'JPEG', 0, 0, width, height, undefined, 'NONE');
    await tick();
  }
  const blob = doc.output('blob');
  return { blob, projected: blob.size };
}

const compressPdf = (file, opts, progress) => withPdf(file, async (pdf) => {
  const name = `${baseName(file.name)}-compressed.pdf`;
  const pages = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}`;
  const note = (dpi) => `${pages} rendered at ${dpi} DPI. Text is no longer selectable, but Claude can still read it.`;

  if (opts.mode === 'level') {
    const { dpi, pdfQ } = LEVELS[opts.level];
    const { blob } = await rasterizePdf(pdf, dpi, pdfQ, Infinity, progress);
    return keepSmaller(file, { blob, name }, note(dpi));
  }

  const target = opts.target;
  let dpi = 150;
  let quality = 0.75;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { blob, projected } = await rasterizePdf(pdf, dpi, quality, target, progress);
    if (blob && blob.size <= target) return { outputs: [{ blob, name }], note: note(dpi) };
    // JPEG bytes scale roughly with pixel count, i.e. DPI².
    const ratio = target / projected;
    const nextDpi = Math.floor(dpi * Math.sqrt(ratio) * 0.92);
    if (dpi <= 50 && quality <= 0.4) break;
    dpi = Math.max(50, Math.min(dpi - 5, nextDpi));
    quality = Math.max(0.4, quality - 0.08);
  }
  throw new Error('This PDF has too many pages to fit even at low quality. Split it into smaller PDFs first.');
});

// ---------- Office (docx / pptx / xlsx) ----------

async function shrinkMedia(data, name, maxDim, quality) {
  const e = ext(name);
  if (!['jpg', 'jpeg', 'png'].includes(e) || data.length < 100 * 1000) return data;
  let bitmap;
  try { bitmap = await createImageBitmap(new Blob([data])); } catch { return data; }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  // The file extension decides the content type inside the package, so keep the format.
  // PNG can only get smaller by losing pixels; JPEG can also drop quality.
  if (e === 'png' && scale === 1) { bitmap.close?.(); return data; }
  const canvas = drawToCanvas(bitmap, scale, e === 'png' ? null : '#ffffff');
  bitmap.close?.();
  const blob = await canvasToBlob(canvas, e === 'png' ? 'image/png' : 'image/jpeg', quality);
  const out = new Uint8Array(await blob.arrayBuffer());
  return out.length < data.length ? out : data;
}

async function rebuildOffice(entries, maxDim, quality, progress) {
  const names = Object.keys(entries);
  const out = {};
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    let data = entries[name];
    if (/\/media\//i.test(name)) {
      progress?.(`Images up to ${maxDim}px: ${name.split('/').pop()}`, i / names.length);
      data = await shrinkMedia(data, name, maxDim, quality);
    }
    out[name] = [data, { level: /\.(jpe?g|png|gif|mp4|m4a|m4b|mp3|wav|wmv|emf|wdp)$/i.test(name) ? 0 : 9 }];
  }
  return fflate.zipSync(out);
}

async function compressOffice(file, opts, progress) {
  const entries = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!Object.keys(entries).some((n) => /\/media\//i.test(n))) return compressOther(file, opts, progress);
  const result = (zipped, maxDim) => ({
    blob: new Blob([zipped], { type: file.type }),
    name: `${baseName(file.name)}-compressed.${ext(file.name)}`,
    note: `Pictures resized to at most ${maxDim}px. Text and layout unchanged.`,
  });

  if (opts.mode === 'level') {
    const { officeDim, officeQ } = LEVELS[opts.level];
    const { blob, name, note } = result(await rebuildOffice(entries, officeDim, officeQ, progress), officeDim);
    return keepSmaller(file, { blob, name }, note);
  }

  let maxDim = 2400;
  let quality = 0.8;
  for (let attempt = 0; attempt < 6; attempt++) {
    const zipped = await rebuildOffice(entries, maxDim, quality, progress);
    if (zipped.length <= opts.target) {
      const { blob, name, note } = result(zipped, maxDim);
      return { outputs: [{ blob, name }], note };
    }
    maxDim = Math.floor(maxDim * 0.7);
    quality = Math.max(0.5, quality - 0.08);
    if (maxDim < 500) break;
  }
  throw new Error("Even with pictures shrunk this file is too big. It may contain video or audio — remove those, or save it as PDF and try again.");
}

// ---------- text ----------

async function splitText(file, opts, progress) {
  // Splitting only makes sense against a size limit; for a strength, just zip it.
  if (opts.mode === 'level') return compressOther(file, opts, progress);
  const target = opts.target;
  const e = ext(file.name);
  const text = await file.text();
  const enc = new TextEncoder();
  const lines = text.split(/(?<=\n)/);
  const header = ['csv', 'tsv'].includes(e) ? lines[0] ?? '' : '';
  const room = target - enc.encode(header).length;

  const parts = [];
  let cur = [];
  let curBytes = 0;
  const flush = () => {
    if (!cur.length) return;
    parts.push(header + cur.join(''));
    cur = [];
    curBytes = 0;
  };

  for (let i = header ? 1 : 0; i < lines.length; i++) {
    let line = lines[i];
    let bytes = enc.encode(line).length;
    // A single line bigger than a whole part: cut it into pieces by characters.
    while (bytes > room) {
      flush();
      const take = Math.floor(line.length * (room / bytes) * 0.95);
      cur.push(line.slice(0, take));
      flush();
      line = line.slice(take);
      bytes = enc.encode(line).length;
    }
    if (curBytes + bytes > room) flush();
    cur.push(line);
    curBytes += bytes;
    if (i % 50000 === 0) { progress?.('Splitting…', i / lines.length); await tick(); }
  }
  flush();

  const width = String(parts.length).length;
  return {
    outputs: parts.map((p, i) => ({
      blob: new Blob([p], { type: file.type || 'text/plain' }),
      name: `${baseName(file.name)}-part${String(i + 1).padStart(width, '0')}of${parts.length}${e ? '.' + e : ''}`,
    })),
    note: `Split into ${parts.length} parts on line boundaries${header ? ', each with the header row' : ''}. Upload them all to the same chat.`,
  };
}

// ---------- everything else ----------

async function compressOther(file, opts, progress) {
  progress?.('Zipping…');
  const data = new Uint8Array(await file.arrayBuffer());
  const zipped = fflate.zipSync({ [file.name]: [data, { level: 9 }] });
  const output = { blob: new Blob([zipped], { type: 'application/zip' }), name: `${file.name}.zip` };
  const note = "Zipped. Claude may not open every archive, so if it can't, try converting the file to PDF or text instead.";
  if (opts.mode === 'level') return keepSmaller(file, output, note);
  if (zipped.length > opts.target) {
    throw new Error(`Zipping only got it to ${fmt(zipped.length)} — this kind of file is already compressed and can't be shrunk further here.`);
  }
  return { outputs: [output], note };
}

export const COMPRESSORS = {
  image: compressImage,
  video: compressVideo,
  audio: compressAudio,
  pdf: compressPdf,
  office: compressOffice,
  text: splitText,
  other: compressOther,
};
