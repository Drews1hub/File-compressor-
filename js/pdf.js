import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { makeCanvas } from './util.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.shim.mjs', import.meta.url).href;

// Opens a PDF, runs `fn(pdf)`, and always frees the document afterwards.
export async function withPdf(file, fn) {
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
    return await fn(pdf);
  } finally {
    task.destroy();
  }
}

// Renders one page onto a white canvas. Returns the canvas and the page size in PDF points.
export async function renderPage(pdf, number, dpi) {
  const page = await pdf.getPage(number);
  const pts = page.getViewport({ scale: 1 }); // 72 points per inch
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = makeCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();
  return { canvas, width: pts.width, height: pts.height };
}

export async function pageText(pdf, number) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) text += item.str + (item.hasEOL ? '\n' : '');
  page.cleanup();
  return text;
}
