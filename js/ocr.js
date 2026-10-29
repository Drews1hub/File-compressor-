// OCR: reads text out of scanned PDFs and photos with Tesseract (English), running in the browser.
import { baseName, kindOf, canvasToBlob, makeCanvas, loadScript } from './util.js';
import { decodeImage } from './images.js';
import { withPdf, renderPage } from './pdf.js';

const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
const DPI = 200;          // resolution scanned PDF pages are rendered at for reading
const MAX_SIDE = 3200;    // photos bigger than this are scaled down first, so a 12 MP photo doesn't take minutes
// Smallest WebAssembly module that uses SIMD; the faster core needs it.
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

let tesseractReady;
const loadTesseract = () => (tesseractReady ??= loadScript(`${BASE}tesseract.min.js`).then(() => window.Tesseract));

async function startWorker(onProgress) {
  const T = await loadTesseract();
  const core = WebAssembly.validate(SIMD_PROBE) ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
  return T.createWorker('eng', 1, {
    workerPath: `${BASE}worker.min.js`,
    corePath: `${BASE}core/${core}`,
    langPath: `${BASE}lang`,
    cacheMethod: 'none',
    logger: (m) => { if (m.status === 'recognizing text') onProgress(m.progress); },
  });
}

// Calls fn(count, getPage) where getPage(i) renders page i (1-based) to { canvas, width, height } in PDF points.
async function withPages(file, fn) {
  if (kindOf(file) === 'pdf') {
    return withPdf(file, (pdf) => fn(pdf.numPages, (i) => renderPage(pdf, i, DPI)));
  }
  const bitmap = await decodeImage(file);
  try {
    return await fn(1, async () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = makeCanvas(bitmap.width * scale, bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return { canvas, width: bitmap.width * 0.75, height: bitmap.height * 0.75 }; // px → pt at 96 DPI
    });
  } finally {
    bitmap.close?.();
  }
}

// Lays each recognized word over the page picture as invisible text, so the PDF can be searched and selected.
function addPage(doc, first, { canvas, width, height }, jpeg, words) {
  if (!first) doc.addPage([width, height], width > height ? 'l' : 'p');
  doc.addImage(jpeg, 'JPEG', 0, 0, width, height, undefined, 'NONE');
  const k = width / canvas.width;
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const target = (w.bbox.x1 - w.bbox.x0) * k;
    const byHeight = (w.bbox.y1 - w.bbox.y0) * k;
    doc.setFontSize(1);
    const perPoint = doc.getTextWidth(text) || 1;
    // Size the hidden word so its natural width matches the printed word; any gap left over goes into letter spacing.
    const size = Math.max(2, Math.min(target / perPoint, byHeight * 2.6));
    doc.setFontSize(size);
    const opts = { renderingMode: 'invisible' };
    const extra = target - perPoint * size;
    if (text.length > 1 && Math.abs(extra) > 0.5) opts.charSpace = extra / (text.length - 1);
    doc.text(text, w.bbox.x0 * k, w.bbox.y1 * k - size * 0.2, opts);
  }
}

export async function ocrConvert(file, to, progress) {
  const wantPdf = to === 'pdf-ocr';
  let fraction = 0;
  let label = 'Starting the text reader…';
  let count = 1;
  let cancelError = null;
  // The worker calls this from its own thread; a cancel is thrown back at the next page.
  const worker = await startWorker((p) => {
    try { progress?.(label, fraction + p / count); } catch (e) { cancelError = e; }
  });
  try {
    progress?.(label);
    return await withPages(file, async (pages, getPage) => {
      count = pages;
      const { jsPDF } = window.jspdf;
      let doc = null;
      let text = '';
      let words = 0;
      for (let i = 1; i <= count; i++) {
        label = count > 1 ? `Reading page ${i} of ${count}…` : 'Reading the text…';
        fraction = (i - 1) / count;
        progress?.(label, fraction);
        const page = await getPage(i);
        const { data } = await worker.recognize(page.canvas, {}, wantPdf ? { text: true, blocks: true } : { text: true });
        if (cancelError) throw cancelError;
        text += (count > 1 ? `\n\n----- Page ${i} -----\n\n` : '') + data.text.trim();
        if (wantPdf) {
          const pageWords = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
          words += pageWords.length;
          const jpeg = new Uint8Array(await (await canvasToBlob(page.canvas, 'image/jpeg', 0.75)).arrayBuffer());
          doc ??= new jsPDF({ unit: 'pt', format: [page.width, page.height], orientation: page.width > page.height ? 'l' : 'p', compress: true });
          addPage(doc, i === 1, page, jpeg, pageWords);
        } else {
          words += data.text.split(/\s+/).filter(Boolean).length;
        }
        page.canvas.width = page.canvas.height = 0;
        fraction = i / count;
        progress?.(label, fraction);
      }
      const name = baseName(file.name);
      const none = !words ? 'No text was found. Try a sharper or straighter picture.' : '';
      const note = `English text only. ${none}`.trim();
      if (wantPdf) return { outputs: [{ blob: doc.output('blob'), name: `${name}-searchable.pdf` }], note };
      return { outputs: [{ blob: new Blob([text.trim() + '\n'], { type: 'text/plain' }), name: `${name}.txt` }], note };
    });
  } finally {
    await worker.terminate();
  }
}
