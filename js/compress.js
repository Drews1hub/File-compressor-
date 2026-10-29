import { ext, baseName, fmt, fmtDuration, tick, canvasToBlob, drawToCanvas } from './util.js';
import { decodeImage, encodeImageUnder } from './images.js';
import { withPdf, renderPage } from './pdf.js';
import { ffmpegJob } from './engine.js';

// ---------- images ----------

async function compressImage(file, target, progress) {
  const bitmap = await decodeImage(file, progress);
  const { blob, width, height } = await encodeImageUnder(bitmap, target, progress);
  bitmap.close?.();
  return {
    outputs: [{ blob, name: `${baseName(file.name)}-compressed.jpg` }],
    note: `Saved as JPEG at ${width}×${height}.`,
  };
}

// ---------- video ----------

// Scale so the shorter side is `px`, keeping even dimensions (H.264 needs them). Works for portrait and landscape.
const shortSide = (px) => `scale='if(gt(iw,ih),-2,${px})':'if(gt(iw,ih),${px},-2)'`;

async function compressVideo(file, target, progress) {
  return ffmpegJob(file, progress, async (job) => {
    const { duration, video, audio } = job.info;
    if (!video) {
      if (audio) return compressAudioJob(job, file, target);
      throw new Error("Couldn't find any video in this file.");
    }
    if (!duration) throw new Error("Couldn't tell how long this video is, so the right quality can't be worked out.");

    // Total bit budget per second, in kbit/s. Each retry scales it by how much the last try overshot.
    let totalK = (target * 8) / duration / 1000;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const audioK = !audio ? 0 : totalK > 1500 ? 128 : totalK > 600 ? 96 : totalK > 250 ? 64 : 32;
      const videoK = Math.floor(totalK * 0.96 - audioK); // ~4% for container overhead
      if (videoK < 40) {
        throw new Error(`This ${fmtDuration(duration)} video can't fit in ${fmt(target)} and still be watchable. ` +
          'Trim it into shorter clips, or raise the target size.');
      }
      const cap = videoK >= 2500 ? 1080 : videoK >= 1200 ? 720 : videoK >= 600 ? 480 : videoK >= 250 ? 360 : 240;
      const short = Math.min(video.width, video.height);
      const height = short > cap ? cap : short;

      const args = ['-i', job.input, '-map', '0:v:0'];
      if (audio) args.push('-map', '0:a:0');
      if (short > cap) args.push('-vf', shortSide(cap));
      if (video.fps > 31) args.push('-r', '30'); // halves the work for 60 fps phone video
      args.push('-c:v', 'libx264', '-preset', 'superfast', '-b:v', `${videoK}k`,
        '-maxrate', `${Math.round(videoK * 1.5)}k`, '-bufsize', `${videoK * 2}k`, '-pix_fmt', 'yuv420p');
      if (audio) args.push('-c:a', 'aac', '-b:a', `${audioK}k`, ...(audioK <= 32 ? ['-ac', '1'] : []));
      args.push('-movflags', '+faststart');

      const label = attempt === 1 ? `Compressing to ${height}p` : `Retrying a bit smaller (try ${attempt})`;
      const blob = await job.encode(args, 'mp4', 'video/mp4', { duration, label });
      if (blob.size <= target) {
        return {
          outputs: [{ blob, name: `${baseName(file.name)}-compressed.mp4` }],
          note: `Saved as MP4 (H.264) at ${height}p, about ${videoK} kbit/s video${audio ? ` + ${audioK} kbit/s sound` : ''}.`,
        };
      }
      totalK *= (target / blob.size) * 0.95;
    }
    throw new Error('Could not get the video under the target size. Try trimming it or raising the target.');
  });
}

// ---------- audio ----------

const MP3_RATES = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192];

async function compressAudioJob(job, file, target) {
  const { duration, audio } = job.info;
  if (!audio) throw new Error("Couldn't find any sound in this file.");
  if (!duration) throw new Error("Couldn't tell how long this recording is.");

  let budgetK = (target * 8) / duration / 1000 * 0.97;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const k = MP3_RATES.filter((r) => r <= budgetK).pop();
    if (!k) {
      throw new Error(`This ${fmtDuration(duration)} recording can't fit in ${fmt(target)}. Split it into shorter parts, or raise the target size.`);
    }
    const mono = k < 64;
    const blob = await job.encode(['-i', job.input, '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', `${k}k`,
      ...(mono ? ['-ac', '1'] : [])], 'mp3', 'audio/mpeg', { duration, label: `Compressing to ${k} kbit/s MP3` });
    if (blob.size <= target) {
      return {
        outputs: [{ blob, name: `${baseName(file.name)}-compressed.mp3` }],
        note: `Saved as MP3 at ${k} kbit/s${mono ? ' (mono)' : ''}.`,
      };
    }
    budgetK = k - 1;
  }
  throw new Error('Could not get the audio under the target size.');
}

const compressAudio = (file, target, progress) =>
  ffmpegJob(file, progress, (job) => compressAudioJob(job, file, target));

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

const compressPdf = (file, target, progress) => withPdf(file, async (pdf) => {
  let dpi = 150;
  let quality = 0.75;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { blob, projected } = await rasterizePdf(pdf, dpi, quality, target, progress);
    if (blob && blob.size <= target) {
      return {
        outputs: [{ blob, name: `${baseName(file.name)}-compressed.pdf` }],
        note: `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} rendered at ${dpi} DPI. Text is no longer selectable, but Claude can still read it.`,
      };
    }
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

async function compressOffice(file, target, progress) {
  const entries = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(entries);
  const media = names.filter((n) => /\/media\//i.test(n));
  if (!media.length) return compressOther(file, target, progress);

  let maxDim = 2400;
  let quality = 0.8;
  for (let attempt = 0; attempt < 6; attempt++) {
    const out = {};
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      let data = entries[name];
      if (media.includes(name)) {
        progress?.(`Images up to ${maxDim}px: ${name.split('/').pop()}`, i / names.length);
        data = await shrinkMedia(data, name, maxDim, quality);
      }
      out[name] = [data, { level: /\.(jpe?g|png|gif|mp4|m4a|mp3|wav|wmv|emf|wdp)$/i.test(name) ? 0 : 9 }];
    }
    const zipped = fflate.zipSync(out);
    if (zipped.length <= target) {
      return {
        outputs: [{ blob: new Blob([zipped], { type: file.type }), name: `${baseName(file.name)}-compressed.${ext(file.name)}` }],
        note: `Pictures resized to at most ${maxDim}px. Text and layout unchanged.`,
      };
    }
    maxDim = Math.floor(maxDim * 0.7);
    quality = Math.max(0.5, quality - 0.08);
    if (maxDim < 500) break;
  }
  throw new Error("Even with pictures shrunk this file is too big. It may contain video or audio — remove those, or save it as PDF and try again.");
}

// ---------- text ----------

async function splitText(file, target, progress) {
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

async function compressOther(file, target, progress) {
  progress?.('Zipping…');
  const data = new Uint8Array(await file.arrayBuffer());
  const zipped = fflate.zipSync({ [file.name]: [data, { level: 9 }] });
  if (zipped.length > target) {
    throw new Error(`Zipping only got it to ${fmt(zipped.length)} — this kind of file is already compressed and can't be shrunk further here.`);
  }
  return {
    outputs: [{ blob: new Blob([zipped], { type: 'application/zip' }), name: `${file.name}.zip` }],
    note: "Zipped. Claude may not open every archive, so if it can't, try converting the file to PDF or text instead.",
  };
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
