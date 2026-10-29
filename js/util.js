export const MB = 1000 * 1000;

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'ico'];
export const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'flv', '3gp', '3g2', 'mpg', 'mpeg',
  'mts', 'm2ts', 'ogv'];
export const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wma', 'aiff', 'aif', 'amr'];
export const OFFICE_EXT = ['docx', 'pptx', 'xlsx'];
export const TEXT_EXT = ['txt', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'md', 'markdown', 'log', 'xml', 'html', 'htm',
  'yaml', 'yml', 'ini', 'toml', 'sql', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'h', 'cpp', 'hpp',
  'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'sh', 'css', 'scss', 'tex', 'srt', 'vtt'];

export const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
export const baseName = (name) => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name);
export const fmt = (bytes) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
export const tick = () => new Promise((r) => setTimeout(r, 0));

export function fmtDuration(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function kindOf(file) {
  const e = ext(file.name);
  const type = file.type || '';
  if (type === 'application/pdf' || e === 'pdf') return 'pdf';
  if (OFFICE_EXT.includes(e)) return 'office';
  if (IMAGE_EXT.includes(e) || (type.startsWith('image/') && e !== 'svg')) return 'image';
  if (VIDEO_EXT.includes(e) || type.startsWith('video/')) return 'video';
  if (AUDIO_EXT.includes(e) || type.startsWith('audio/')) return 'audio';
  if (TEXT_EXT.includes(e) || type.startsWith('text/')) return 'text';
  return 'other';
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Browser could not encode the image'))), type, quality));
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function drawToCanvas(bitmap, scale, background) {
  const canvas = makeCanvas(bitmap.width * scale, bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Couldn't load ${src.split('/').pop()}. Check your connection and reload.`));
    document.head.append(s);
  });
}
