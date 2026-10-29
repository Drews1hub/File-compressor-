import { ext, canvasToBlob, makeCanvas, drawToCanvas, loadScript } from './util.js';
import { ffmpegJob } from './engine.js';

let heicReady = null;
const loadHeic = () => {
  heicReady ??= loadScript(new URL('../vendor/heic2any.min.js', import.meta.url).href).then(() => window.heic2any);
  heicReady.catch(() => { heicReady = null; });
  return heicReady;
};

const isHeic = (file) => ['heic', 'heif'].includes(ext(file.name)) || /hei[cf]/i.test(file.type);

// Decodes any image we can get our hands on into an ImageBitmap.
// Order: the browser itself → HEIC decoder (iPhone photos) → ffmpeg (TIFF and other odd formats).
export async function decodeImage(file, progress) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch { /* fall through */ }

  if (isHeic(file)) {
    progress?.('Reading iPhone (HEIC) photo…');
    const heic2any = await loadHeic();
    let png;
    try {
      png = await heic2any({ blob: file, toType: 'image/png' });
    } catch {
      throw new Error("Couldn't read this HEIC photo. It may be damaged or use a format variant that isn't supported.");
    }
    return createImageBitmap(Array.isArray(png) ? png[0] : png);
  }

  progress?.('Reading image with the converter engine…');
  const png = await ffmpegJob(file, progress, (job) => {
    if (!job.info.video) throw new Error("This image format isn't supported. Try saving it as JPG or PNG first.");
    return job.encode(['-i', job.input, '-frames:v', '1'], 'png', 'image/png', { label: 'Reading image' });
  });
  return createImageBitmap(png);
}

const encodable = {};
// Whether this browser's canvas can write `type` (Safari can't write WebP and hands back PNG instead).
export async function canEncode(type) {
  encodable[type] ??= canvasToBlob(makeCanvas(1, 1), type).then((b) => b.type === type).catch(() => false);
  return encodable[type];
}

// True if any pixel is noticeably see-through. Checks a small copy, which is plenty to spot a transparent background.
export function hasAlpha(bitmap) {
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = drawToCanvas(bitmap, scale, null);
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

// Output type for compressed photos: 'auto' keeps transparency (WebP, or PNG where WebP can't be written).
export async function pickImageType(bitmap, pref) {
  if (pref === 'jpg') return 'image/jpeg';
  const webp = await canEncode('image/webp');
  if (pref === 'webp') return webp ? 'image/webp' : 'image/jpeg';
  if (!hasAlpha(bitmap)) return 'image/jpeg';
  return webp ? 'image/webp' : 'image/png';
}

export const typeExt = (type) => ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }[type]);
export const typeLabel = (type) => ({ 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/png': 'PNG' }[type]);

// Biggest image under `target` for this bitmap: binary search on quality, then shrink resolution if needed.
// PNG has no quality setting, so for PNG only the resolution goes down.
export async function encodeImageUnder(bitmap, target, progress, { type = 'image/jpeg', maxDim = 8000 } = {}) {
  let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const lossy = type !== 'image/png';
  const background = type === 'image/jpeg' ? '#ffffff' : null;
  const MIN_Q = 0.45;
  const MAX_Q = 0.92;

  for (let attempt = 0; attempt < 15; attempt++) {
    const canvas = drawToCanvas(bitmap, scale, background);
    progress?.(`Trying ${canvas.width}×${canvas.height}…`);

    const top = await canvasToBlob(canvas, type, MAX_Q);
    if (top.size <= target) return { blob: top, width: canvas.width, height: canvas.height };

    const bottom = lossy ? await canvasToBlob(canvas, type, MIN_Q) : top;
    if (bottom.size > target) {
      // Even low quality is too big: shrink pixels in proportion to the overshoot.
      scale *= Math.min(0.9, Math.sqrt(target / bottom.size) * 0.95);
      continue;
    }

    let lo = MIN_Q, hi = MAX_Q, best = bottom;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const b = await canvasToBlob(canvas, type, mid);
      if (b.size <= target) { best = b; lo = mid; } else { hi = mid; }
    }
    return { blob: best, width: canvas.width, height: canvas.height };
  }
  throw new Error('Could not get the image small enough');
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff' };

// Encodes a bitmap as jpg / png / webp / gif / bmp / tiff.
export async function encodeImageAs(bitmap, to, progress) {
  const canvas = drawToCanvas(bitmap, 1, to === 'jpg' || to === 'bmp' ? '#ffffff' : null);
  if (['jpg', 'png', 'webp'].includes(to)) {
    const blob = await canvasToBlob(canvas, MIME[to], 0.92);
    // Safari can't write WebP and quietly hands back a PNG; fall through to ffmpeg for that.
    if (blob.type === MIME[to]) return blob;
  }
  const png = await canvasToBlob(canvas, 'image/png');
  const file = new File([png], 'image.png', { type: 'image/png' });
  const args = {
    webp: ['-c:v', 'libwebp', '-quality', '90'],
    gif: ['-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse'],
    bmp: ['-pix_fmt', 'bgr24'],
    tiff: ['-compression_algo', 'deflate'],
  }[to];
  return ffmpegJob(file, progress, (job) =>
    job.encode(['-i', job.input, '-frames:v', '1', ...args], to, MIME[to], { label: `Saving ${to.toUpperCase()}` }));
}
