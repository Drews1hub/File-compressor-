import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

const MB = 1000 * 1000;
// Aim a little under the limit so rounding on the upload side never tips a file over.
const SAFETY = 0.97;

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
const OFFICE_EXT = ['docx', 'pptx', 'xlsx'];
const TEXT_EXT = ['txt', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'md', 'markdown', 'log', 'xml', 'html', 'htm',
  'yaml', 'yml', 'ini', 'toml', 'sql', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'h', 'cpp', 'hpp',
  'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'sh', 'css', 'scss', 'tex', 'srt', 'vtt'];

const $ = (sel) => document.querySelector(sel);
const drop = $('#drop');
const picker = $('#picker');
const results = $('#results');
const targetInput = $('#target');

// ---------- helpers ----------

const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
const baseName = (name) => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name);
const fmt = (bytes) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
const tick = () => new Promise((r) => setTimeout(r, 0));

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Browser could not encode the image'))), type, quality));
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function drawToCanvas(bitmap, scale, background) {
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

function kindOf(file) {
  const e = ext(file.name);
  if (file.type === 'application/pdf' || e === 'pdf') return 'pdf';
  if (OFFICE_EXT.includes(e)) return 'office';
  if (IMAGE_EXT.includes(e) || (file.type.startsWith('image/') && e !== 'svg')) return 'image';
  if (TEXT_EXT.includes(e) || file.type.startsWith('text/')) return 'text';
  return 'other';
}

// ---------- images ----------

// Biggest JPEG under `target` for this bitmap: binary search on quality, then shrink resolution if needed.
async function encodeImageUnder(bitmap, target, progress) {
  const MAX_DIM = 8000; // Claude downsizes anything larger anyway
  let scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const MIN_Q = 0.45;
  const MAX_Q = 0.92;

  for (let attempt = 0; attempt < 15; attempt++) {
    const canvas = drawToCanvas(bitmap, scale, '#ffffff');
    progress?.(`Trying ${canvas.width}×${canvas.height}…`);

    const top = await canvasToBlob(canvas, 'image/jpeg', MAX_Q);
    if (top.size <= target) return { blob: top, width: canvas.width, height: canvas.height };

    const bottom = await canvasToBlob(canvas, 'image/jpeg', MIN_Q);
    if (bottom.size > target) {
      // Even low quality is too big: shrink pixels in proportion to the overshoot.
      scale *= Math.min(0.9, Math.sqrt(target / bottom.size) * 0.95);
      continue;
    }

    let lo = MIN_Q, hi = MAX_Q, best = bottom;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const b = await canvasToBlob(canvas, 'image/jpeg', mid);
      if (b.size <= target) { best = b; lo = mid; } else { hi = mid; }
    }
    return { blob: best, width: canvas.width, height: canvas.height };
  }
  throw new Error('Could not get the image small enough');
}

async function compressImage(file, target, progress) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("Your browser can't read this image format (HEIC/TIFF often fail). Convert it to JPG or PNG first.");
  }
  const { blob, width, height } = await encodeImageUnder(bitmap, target, progress);
  bitmap.close?.();
  return {
    outputs: [{ blob, name: `${baseName(file.name)}-compressed.jpg` }],
    note: `Saved as JPEG at ${width}×${height}.`,
  };
}

// ---------- PDF ----------

async function rasterizePdf(pdf, dpi, quality, target, progress) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  let total = 0;
  const n = pdf.numPages;

  for (let i = 1; i <= n; i++) {
    progress?.(`Page ${i} of ${n} at ${dpi} DPI…`, i / n);
    const page = await pdf.getPage(i);
    const pts = page.getViewport({ scale: 1 }); // PDF points, 72 per inch
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = makeCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const jpeg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', quality)).arrayBuffer());
    canvas.width = canvas.height = 0;
    page.cleanup();
    total += jpeg.length;

    // Bail out early when it's clearly going to overshoot, so the next attempt starts sooner.
    const projected = (total / i) * n;
    if (i >= 3 && i < n && projected > target * 1.25) return { projected };

    const size = [pts.width, pts.height];
    const orientation = pts.width > pts.height ? 'l' : 'p';
    if (!doc) doc = new jsPDF({ unit: 'pt', format: size, orientation, compress: true });
    else doc.addPage(size, orientation);
    doc.addImage(jpeg, 'JPEG', 0, 0, pts.width, pts.height, undefined, 'NONE');
    await tick();
  }
  const blob = doc.output('blob');
  return { blob, projected: blob.size };
}

async function compressPdf(file, target, progress) {
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e) {
    task.destroy();
    if (e?.name === 'PasswordException') throw new Error('This PDF is password-protected. Remove the password first.');
    throw new Error("Couldn't open this PDF.");
  }

  try {
    return await fitPdf(pdf, file, target, progress);
  } finally {
    task.destroy();
  }
}

async function fitPdf(pdf, file, target, progress) {
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
}

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

// ---------- UI ----------

const HANDLERS = { image: compressImage, pdf: compressPdf, office: compressOffice, text: splitText, other: compressOther };

function addRow(file) {
  const li = document.createElement('li');
  li.innerHTML = `<div class="name"></div><div class="status">Waiting…</div><progress hidden></progress>`;
  li.querySelector('.name').textContent = `${file.name} · ${fmt(file.size)}`;
  results.prepend(li);
  return li;
}

function addDownloads(li, outputs) {
  const box = document.createElement('div');
  box.className = 'downloads';
  for (const { blob, name } of outputs) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.textContent = `⬇ ${name} (${fmt(blob.size)})`;
    box.append(a);
  }
  li.append(box);
}

async function processFile(file) {
  const li = addRow(file);
  const status = li.querySelector('.status');
  const bar = li.querySelector('progress');
  const target = Math.max(1, Number(targetInput.value) || 30) * MB;

  if (file.size <= target) {
    status.textContent = `Already under ${fmt(target)} — no changes needed.`;
    status.className = 'status ok';
    addDownloads(li, [{ blob: file, name: file.name }]);
    return;
  }

  const progress = (msg, frac) => {
    status.textContent = msg;
    if (frac != null) { bar.hidden = false; bar.value = frac; }
  };

  try {
    const { outputs, note } = await HANDLERS[kindOf(file)](file, target * SAFETY, progress);
    const total = outputs.reduce((s, o) => s + o.blob.size, 0);
    status.textContent = outputs.length > 1
      ? `Done — ${outputs.length} files, each under ${fmt(target)}.`
      : `Done — ${fmt(file.size)} → ${fmt(total)}.`;
    status.className = 'status ok';
    if (note) {
      const p = document.createElement('div');
      p.className = 'note';
      p.textContent = note;
      li.append(p);
    }
    addDownloads(li, outputs);
  } catch (e) {
    console.error(e);
    status.textContent = e.message || String(e);
    status.className = 'status err';
  } finally {
    bar.hidden = true;
  }
}

let queue = Promise.resolve();
function handleFiles(files) {
  // One at a time: big images and PDFs need a lot of memory.
  for (const f of files) queue = queue.then(() => processFile(f));
}

picker.addEventListener('change', () => { handleFiles([...picker.files]); picker.value = ''; });
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); handleFiles([...e.dataTransfer.files]); });
// Dropping outside the box shouldn't navigate away from the page.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
