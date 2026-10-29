import { ext, baseName, kindOf, canvasToBlob, fmtDuration } from './util.js';
import { decodeImage, encodeImageAs } from './images.js';
import { withPdf, renderPage, pageText } from './pdf.js';
import { ffmpegJob } from './engine.js';
import { ocrConvert } from './ocr.js';
import { convertBook } from './ebook.js';

export const FORMAT_LABELS = {
  jpg: 'JPG', png: 'PNG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', tiff: 'TIFF', pdf: 'PDF',
  mp4: 'MP4', webm: 'WebM', mov: 'MOV', mkv: 'MKV', avi: 'AVI',
  mp3: 'MP3', wav: 'WAV', m4a: 'M4A', m4b: 'M4B (audiobook)', ogg: 'OGG', flac: 'FLAC', opus: 'Opus', txt: 'Text (TXT)',
  'pdf-ocr': 'Searchable PDF (OCR)', 'txt-ocr': 'Text from scan (OCR)',
  epub: 'EPUB (e-book)', html: 'Web page (HTML)',
};

const TARGETS = {
  image: ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'pdf', 'pdf-ocr', 'txt-ocr'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'gif', 'mp3', 'wav', 'm4a', 'm4b'],
  audio: ['mp3', 'wav', 'm4a', 'm4b', 'ogg', 'flac', 'opus'],
  pdf: ['jpg', 'png', 'txt', 'pdf-ocr', 'txt-ocr', 'epub'],
  ebook: ['epub', 'txt', 'html', 'pdf'],
};

// Plain-text files that can become an e-book.
const BOOK_TEXT = ['txt', 'md', 'markdown', 'html', 'htm'];

const SAME = { jpeg: 'jpg', tif: 'tiff', oga: 'ogg' };

// Output formats offered for this file (never its own format).
export function targetsFor(file) {
  const kind = kindOf(file);
  const own = SAME[ext(file.name)] ?? ext(file.name);
  let list = TARGETS[kind] ?? [];
  if (kind === 'image' && own === 'gif') list = [...list, 'mp4', 'webm']; // animated GIF → video
  if (kind === 'text' && BOOK_TEXT.includes(own)) list = ['epub'];
  return list.filter((t) => t !== own);
}

const MIME = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', m4b: 'audio/mp4', ogg: 'audio/ogg',
  flac: 'audio/flac', opus: 'audio/ogg',
};

const AUDIO_ARGS = {
  mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
  wav: ['-c:a', 'pcm_s16le'],
  m4a: ['-c:a', 'aac', '-b:a', '192k'],
  // Audiobooks: AAC in an MP4 container with the .m4b extension. Chapters carry over from the source.
  m4b: ['-c:a', 'aac', '-b:a', '128k', '-f', 'ipod'],
  ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
  flac: ['-c:a', 'flac'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
};

// Video codec settings when the streams can't simply be copied into the new container.
function videoArgs(to, video) {
  const short = Math.min(video.width, video.height);
  switch (to) {
    case 'webm': {
      const k = short >= 1080 ? 4000 : short >= 720 ? 2500 : 1200;
      return ['-c:v', 'libvpx', '-b:v', `${k}k`, '-crf', '10', '-deadline', 'realtime', '-cpu-used', '8',
        '-c:a', 'libopus', '-b:a', '128k'];
    }
    case 'avi':
      return ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame', '-q:a', '3'];
    default: // mp4, mov, mkv
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        // H.264 needs even width and height.
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '160k'];
  }
}

// Containers that can take these streams as-is, which is near-instant instead of re-encoding.
function canCopy(to, { video, audio }) {
  const a = audio?.codec;
  if (['mp4', 'mov'].includes(to)) return video.codec === 'h264' && (!a || ['aac', 'mp3'].includes(a));
  if (to === 'mkv') return video.codec === 'h264' && (!a || ['aac', 'mp3', 'opus', 'vorbis', 'flac'].includes(a));
  if (to === 'webm') return ['vp8', 'vp9'].includes(video.codec) && (!a || ['opus', 'vorbis'].includes(a));
  return false;
}

function convertMedia(file, to, progress) {
  return ffmpegJob(file, progress, async (job) => {
    const { duration, video, audio } = job.info;
    const name = `${baseName(file.name)}.${to}`;
    const opts = { duration, label: `Converting to ${FORMAT_LABELS[to]}` };

    if (AUDIO_ARGS[to]) {
      if (!audio) throw new Error('This file has no sound track to convert.');
      const blob = await job.encode(['-i', job.input, '-map', '0:a:0', ...AUDIO_ARGS[to]], to, MIME[to], opts);
      return { outputs: [{ blob, name }], note: video ? 'Sound track only — the picture was dropped.' : '' };
    }

    if (!video) throw new Error("Couldn't find any video in this file.");

    if (to === 'gif') {
      const blob = await job.encode(['-i', job.input, '-vf',
        "fps=12,scale='min(480,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
        '-loop', '0'], 'gif', MIME.gif, opts);
      const long = duration > 30 ? ` GIFs get big fast — this clip is ${fmtDuration(duration)}, so consider trimming it.` : '';
      return { outputs: [{ blob, name }], note: `12 frames per second, up to 480px wide, no sound.${long}` };
    }

    const maps = ['-map', '0:v:0', ...(audio ? ['-map', '0:a:0'] : [])];
    const faststart = ['mp4', 'mov'].includes(to) ? ['-movflags', '+faststart'] : [];
    if (canCopy(to, job.info)) {
      try {
        const blob = await job.encode(['-i', job.input, ...maps, '-c', 'copy', ...faststart], to, MIME[to], opts);
        return { outputs: [{ blob, name }], note: 'Streams copied as-is, so quality is unchanged.' };
      } catch { /* fall back to re-encoding */ }
    }
    const blob = await job.encode(['-i', job.input, ...maps, ...videoArgs(to, video), ...faststart], to, MIME[to], opts);
    return { outputs: [{ blob, name }], note: '' };
  });
}

async function convertImage(file, to, progress) {
  // Animated GIFs go to ffmpeg directly so every frame is kept.
  if (['mp4', 'webm'].includes(to)) return convertMedia(file, to, progress);

  const bitmap = await decodeImage(file, progress);
  const name = `${baseName(file.name)}.${to}`;
  try {
    if (to === 'pdf') {
      const { jsPDF } = window.jspdf;
      const jpeg = new Uint8Array(await (await encodeImageAs(bitmap, 'jpg', progress)).arrayBuffer());
      const w = bitmap.width * 0.75; // px → pt at 96 DPI
      const h = bitmap.height * 0.75;
      const doc = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'l' : 'p', compress: true });
      doc.addImage(jpeg, 'JPEG', 0, 0, w, h, undefined, 'NONE');
      return { outputs: [{ blob: doc.output('blob'), name }], note: '' };
    }
    progress?.(`Saving as ${FORMAT_LABELS[to]}…`);
    const blob = await encodeImageAs(bitmap, to, progress);
    const canHaveAlpha = ['png', 'webp', 'gif', 'avif', 'ico'].includes(ext(file.name));
    const flat = canHaveAlpha && ['jpg', 'bmp'].includes(to) ? 'Any transparent areas were filled with white.' : '';
    return { outputs: [{ blob, name }], note: ext(file.name) === 'gif' ? 'Only the first frame of the GIF was kept.' : flat };
  } finally {
    bitmap.close?.();
  }
}

const convertPdf = (file, to, progress) => withPdf(file, async (pdf) => {
  const n = pdf.numPages;
  const base = baseName(file.name);

  if (to === 'txt') {
    let text = '';
    for (let i = 1; i <= n; i++) {
      progress?.(`Reading text from page ${i} of ${n}…`, i / n);
      text += (n > 1 ? `\n\n----- Page ${i} -----\n\n` : '') + (await pageText(pdf, i));
    }
    const empty = !text.replace(/-+ Page \d+ -+/g, '').trim();
    return {
      outputs: [{ blob: new Blob([text.trim() + '\n'], { type: 'text/plain' }), name: `${base}.txt` }],
      note: empty ? 'No text found — this looks like a scanned PDF. Convert it to JPG instead.' : '',
    };
  }

  const type = to === 'png' ? 'image/png' : 'image/jpeg';
  const width = String(n).length;
  const pages = {};
  let single = null;
  for (let i = 1; i <= n; i++) {
    progress?.(`Page ${i} of ${n}…`, i / n);
    const { canvas } = await renderPage(pdf, i, 150);
    const blob = await canvasToBlob(canvas, type, 0.9);
    canvas.width = canvas.height = 0;
    if (n === 1) single = blob;
    else pages[`${base}-page${String(i).padStart(width, '0')}.${to}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  if (single) return { outputs: [{ blob: single, name: `${base}.${to}` }], note: 'Rendered at 150 DPI.' };
  return {
    outputs: [{ blob: new Blob([fflate.zipSync(pages)], { type: 'application/zip' }), name: `${base}-pages.zip` }],
    note: `${n} pages rendered at 150 DPI, bundled in a ZIP.`,
  };
});

const CONVERTERS = { image: convertImage, video: convertMedia, audio: convertMedia, pdf: convertPdf };

export function convert(file, to, progress) {
  const fn = to.endsWith('-ocr') ? ocrConvert : to === 'epub' || kindOf(file) === 'ebook' ? convertBook : CONVERTERS[kindOf(file)];
  if (!fn || !targetsFor(file).includes(to)) throw new Error(`Can't convert this file to ${FORMAT_LABELS[to] ?? to}.`);
  return fn(file, to, progress);
}
