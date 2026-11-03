import { sanitizeBookHtml } from './sanitize.js';
import { unpack } from './unpack.js';
// E-books: read EPUB, MOBI / AZW / AZW3 and FB2 (plus plain text, Markdown, HTML and PDF text) into one simple
// shape, then write EPUB, HTML, TXT or PDF. Everything happens in the browser.
import { baseName, ext } from './util.js';
import { withPdf, pageText } from './pdf.js';

// A book is { title, author, chapters: [{ title, html }] }. Chapter html is plain body markup with images as data: URIs.

const parser = new DOMParser();
const decoder = new TextDecoder();
const htmlDoc = (s) => parser.parseFromString(s, 'text/html');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const squash = (s) => s.replace(/\s+/g, ' ').trim();
// Text of an element with line breaks read as spaces.
const textOf = (el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return c.textContent;
};

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const IMAGE_EXTS = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([e, t]) => [t, e === 'jpeg' ? 'jpg' : e]));

function dataUri(bytes, type) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

const blobToDataUri = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// ---------- reading ----------

// Resolves href (as written inside the file `from`) to a path inside the zip.
function zipPath(from, href) {
  const url = new URL(href.split('#')[0], `http://x/${from}`);
  return decodeURIComponent(url.pathname.slice(1));
}

async function readEpub(file, progress) {
  let files;
  try {
    files = await unpack(file);
  } catch {
    throw new Error("Couldn't open this EPUB. The file may be damaged.");
  }
  const text = (path) => (files[path] ? decoder.decode(files[path]) : '');
  const container = parser.parseFromString(text('META-INF/container.xml'), 'application/xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath || !files[opfPath]) throw new Error("This EPUB doesn't have a readable table of contents file.");
  const opf = parser.parseFromString(text(opfPath), 'application/xml');
  const meta = (name) => opf.getElementsByTagNameNS('*', name)[0]?.textContent.trim() ?? '';

  const manifest = {};
  for (const it of opf.getElementsByTagNameNS('*', 'item')) {
    manifest[it.getAttribute('id')] = { path: zipPath(opfPath, it.getAttribute('href')), type: it.getAttribute('media-type'), props: it.getAttribute('properties') ?? '' };
  }
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')].map((r) => manifest[r.getAttribute('idref')]).filter(Boolean);

  // Chapter names from the table of contents (EPUB 3 nav, or the older NCX file).
  const labels = {};
  const nav = Object.values(manifest).find((m) => m.props.split(' ').includes('nav'));
  if (nav) {
    for (const a of htmlDoc(text(nav.path)).querySelectorAll('nav a[href]')) labels[zipPath(nav.path, a.getAttribute('href'))] ??= squash(a.textContent);
  } else {
    const ncx = Object.values(manifest).find((m) => m.type === 'application/x-dtbncx+xml');
    if (ncx) {
      for (const p of parser.parseFromString(text(ncx.path), 'application/xml').getElementsByTagNameNS('*', 'navPoint')) {
        const src = p.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src');
        if (src) labels[zipPath(ncx.path, src)] ??= squash(p.getElementsByTagNameNS('*', 'text')[0]?.textContent ?? '');
      }
    }
  }

  const chapters = [];
  let n = 0;
  for (const item of spine) {
    if (!/x?html/.test(item.type) || !files[item.path]) continue;
    progress?.(`Reading chapter ${++n} of ${spine.length}…`, n / spine.length);
    const doc = htmlDoc(text(item.path));
    for (const img of doc.querySelectorAll('img[src]')) {
      const p = zipPath(item.path, img.getAttribute('src'));
      const type = IMAGE_TYPES[ext(p)];
      if (files[p] && type) img.setAttribute('src', dataUri(files[p], type));
      else img.remove();
    }
    doc.querySelectorAll('script, style, link').forEach((el) => el.remove());
    const html = doc.body.innerHTML.trim();
    if (!squash(doc.body.textContent) && !doc.querySelector('img')) continue;
    const heading = squash(doc.querySelector('h1, h2, h3')?.textContent ?? '');
    chapters.push({ title: labels[item.path] || heading || `Chapter ${chapters.length + 1}`, html });
  }
  if (!chapters.length) throw new Error("Couldn't find any readable pages in this EPUB.");
  return { title: meta('title') || baseName(file.name), author: meta('creator'), chapters };
}

async function readMobi(file, progress) {
  const { initMobiFile, initKf8File } = await import('../vendor/mobi-parser.mjs');
  // The MOBI header says which flavour this is: 8 is KF8 (AZW3), anything older is classic MOBI.
  const first = new DataView(await file.slice(78, 82).arrayBuffer());
  const rec0 = first.byteLength === 4 ? first.getUint32(0) : 0;
  const header = new DataView(await file.slice(rec0, rec0 + 48).arrayBuffer());
  const kf8 = header.byteLength >= 40 && header.getUint32(36) === 8;
  let mobi;
  try {
    mobi = await (kf8 ? initKf8File : initMobiFile)(file);
  } catch {
    throw new Error("Couldn't open this Kindle book. It may be copy-protected (DRM), which can't be converted, or the file is damaged.");
  }
  try {
    const meta = mobi.getMetadata();
    const spine = mobi.getSpine();
    const chapters = [];
    for (const [i, ch] of spine.entries()) {
      progress?.(`Reading chapter ${i + 1} of ${spine.length}…`, (i + 1) / spine.length);
      const loaded = mobi.loadChapter(ch.id);
      if (!loaded) continue;
      const doc = htmlDoc(loaded.html);
      for (const img of doc.querySelectorAll('img[src^="blob:"]')) {
        try { img.setAttribute('src', await blobToDataUri(await (await fetch(img.getAttribute('src'))).blob())); } catch { img.remove(); }
      }
      doc.querySelectorAll('script, style, link').forEach((el) => el.remove());
      if (!squash(doc.body.textContent) && !doc.querySelector('img')) continue;
      const heading = squash(doc.querySelector('h1, h2, h3')?.textContent ?? '');
      chapters.push({ title: heading || `Chapter ${chapters.length + 1}`, html: doc.body.innerHTML.trim() });
    }
    if (!chapters.length) throw new Error("Couldn't find any readable pages in this Kindle book.");
    return { title: meta.title || baseName(file.name), author: (meta.author ?? []).join(', '), chapters };
  } finally {
    mobi.destroy?.();
  }
}

async function readFb2(file) {
  const doc = parser.parseFromString(await file.text(), 'application/xml');
  if (doc.querySelector('parsererror') || !doc.getElementsByTagName('FictionBook').length) throw new Error("Couldn't read this FB2 book.");
  const first = (el, name) => el?.getElementsByTagName(name)[0];
  const info = first(doc, 'title-info');
  const title = squash(first(info, 'book-title')?.textContent ?? '') || baseName(file.name);
  const a = first(info, 'author');
  const author = a ? ['first-name', 'middle-name', 'last-name'].map((n) => squash(first(a, n)?.textContent ?? '')).filter(Boolean).join(' ') : '';
  const pics = {};
  for (const b of doc.getElementsByTagName('binary')) pics[b.getAttribute('id')] = `data:${b.getAttribute('content-type')};base64,${b.textContent.replace(/\s+/g, '')}`;
  const tags = { p: 'p', emphasis: 'em', strong: 'strong', title: 'h2', subtitle: 'h3', cite: 'blockquote', epigraph: 'blockquote', v: 'p', 'text-author': 'p', section: 'section' };
  const html = (node) => {
    let out = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { out += esc(c.textContent); continue; }
      if (c.nodeType !== 1) continue;
      const name = c.localName;
      if (name === 'image') {
        const href = c.getAttribute('l:href') ?? c.getAttribute('xlink:href') ?? c.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        const src = pics[(href ?? '').replace('#', '')];
        out += src ? `<img src="${src}" alt="">` : '';
      } else if (name === 'empty-line') out += '<br>';
      else if (tags[name]) out += `<${tags[name]}>${html(c)}</${tags[name]}>`;
      else out += html(c);
    }
    return out;
  };
  const body = doc.getElementsByTagName('body')[0];
  const sections = [...body.children].filter((c) => c.localName === 'section');
  const chapters = (sections.length ? sections : [body]).map((s, i) => {
    const heading = squash(first(s, 'title')?.textContent ?? '');
    return { title: heading || `Chapter ${i + 1}`, html: html(s) };
  }).filter((c) => squash(c.html.replace(/<[^>]+>/g, '')) || c.html.includes('<img'));
  if (!chapters.length) throw new Error("Couldn't find any text in this FB2 book.");
  return { title, author, chapters };
}

// Plain text and Markdown become paragraphs; a "Chapter 1" style line (or a Markdown heading) starts a new chapter.
function textToHtml(raw, markdown) {
  const inline = (s) => {
    s = esc(s);
    if (!markdown) return s;
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  };
  const out = [];
  let para = [];
  const flush = () => { if (para.length) out.push(`<p>${para.map(inline).join(markdown ? ' ' : '<br>')}</p>`); para = []; };
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const h = markdown && /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (markdown && /^\s*[-*+]\s+/.test(line)) { flush(); out.push(`<p>• ${inline(line.replace(/^\s*[-*+]\s+/, ''))}</p>`); continue; }
    if (!line.trim()) flush(); else para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function splitChapters(html, fallbackTitle) {
  const doc = htmlDoc(html);
  const nodes = [...doc.body.children];
  const isBreak = (n) => /^h[12]$/i.test(n.tagName)
    || (n.tagName === 'P' && n.textContent.length < 60 && /^(chapter|part|book)\s+[\divxlcdm]+\b/i.test(n.textContent.trim()));
  if (nodes.filter(isBreak).length < 2) return [{ title: fallbackTitle, html }];
  const chapters = [];
  let cur = null;
  for (const n of nodes) {
    if (isBreak(n)) { cur = { title: squash(n.textContent), html: '' }; chapters.push(cur); }
    else if (!cur) { cur = { title: fallbackTitle, html: '' }; chapters.push(cur); }
    cur.html += n.outerHTML + '\n';
  }
  return chapters.filter((c) => squash(c.html.replace(/<[^>]+>/g, '')) || c.html.includes('<img'));
}

async function readPlain(file) {
  const e = ext(file.name);
  const raw = await file.text();
  const title = baseName(file.name);
  if (e === 'html' || e === 'htm') {
    const doc = htmlDoc(raw);
    doc.querySelectorAll('script, style, link').forEach((el) => el.remove());
    return { title: squash(doc.title) || title, author: '', chapters: splitChapters(doc.body.innerHTML, squash(doc.title) || title) };
  }
  return { title, author: '', chapters: splitChapters(textToHtml(raw, e === 'md' || e === 'markdown'), title) };
}

// Joins PDF text lines back into paragraphs: a line ending a sentence that stops short of the margin ends the paragraph.
function paragraphs(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const out = [];
  let cur = '';
  for (const line of lines) {
    if (!line) { if (cur) out.push(cur); cur = ''; continue; }
    cur = cur ? (cur.endsWith('-') ? cur.slice(0, -1) + line : `${cur} ${line}`) : line;
    if (/[.!?:”"]$/.test(line) && line.length < longest * 0.7) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}

async function readPdf(file, progress) {
  return withPdf(file, async (pdf) => {
    const group = 10;
    const chapters = [];
    for (let start = 1; start <= pdf.numPages; start += group) {
      const end = Math.min(pdf.numPages, start + group - 1);
      let html = '';
      for (let i = start; i <= end; i++) {
        progress?.(`Reading page ${i} of ${pdf.numPages}…`, i / pdf.numPages);
        html += paragraphs(await pageText(pdf, i)).map((p) => `<p>${esc(p)}</p>`).join('\n') + '\n';
      }
      chapters.push({ title: start === end ? `Page ${start}` : `Pages ${start}–${end}`, html });
    }
    if (!chapters.some((c) => squash(c.html.replace(/<[^>]+>/g, '')))) {
      throw new Error('No text found — this looks like a scanned PDF. Run it through OCR first (Convert to Searchable PDF).');
    }
    return { title: baseName(file.name), author: '', chapters };
  });
}

function readBook(file, progress) {
  const e = ext(file.name);
  if (e === 'epub') return readEpub(file, progress);
  if (e === 'fb2') return readFb2(file);
  if (['mobi', 'azw', 'azw3', 'kf8'].includes(e)) return readMobi(file, progress);
  if (e === 'pdf') return readPdf(file, progress);
  return readPlain(file);
}

// ---------- writing ----------

// Block-level text of some markup: [{ tag: 'h1'..'h6' | 'p', text }].
function blocks(html) {
  const out = [];
  const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,div,blockquote,pre,table,ul,ol,section,article,tr';
  const walk = (el) => {
    let run = '';
    const flush = () => { const t = squash(run); if (t) out.push({ tag: 'p', text: t }); run = ''; };
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { run += c.textContent; continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'img', 'head'].includes(tag)) continue;
      if (tag === 'br') { run += ' '; continue; }
      if (/^h[1-6]$/.test(tag)) { flush(); const t = squash(textOf(c)); if (t) out.push({ tag, text: t }); continue; }
      if (tag === 'pre') { flush(); const t = c.textContent.trim(); if (t) out.push({ tag: 'p', text: t, pre: true }); continue; }
      if (c.querySelector(BLOCK)) { flush(); walk(c); continue; }
      if (c.matches(BLOCK)) { flush(); const t = squash(textOf(c)); if (t) out.push({ tag: 'p', text: tag === 'li' ? `• ${t}` : t }); continue; }
      run += c.textContent;
    }
    flush();
  };
  walk(htmlDoc(html).body);
  return out;
}

function toText(book) {
  const parts = [book.title + (book.author ? `\nby ${book.author}` : '')];
  for (const ch of book.chapters) {
    const b = blocks(ch.html);
    const body = b.map((x) => x.text).join('\n\n');
    const showTitle = b[0]?.text !== ch.title && ch.title !== book.title;
    parts.push((showTitle && book.chapters.length > 1 ? `${ch.title.toUpperCase()}\n\n` : '') + body);
  }
  return parts.join('\n\n\n').trim() + '\n';
}

function toHtml(book) {
  const toc = book.chapters.length > 1
    ? `<nav><h2>Contents</h2><ol>${book.chapters.map((c, i) => `<li><a href="#c${i + 1}">${esc(c.title)}</a></li>`).join('')}</ol></nav>` : '';
  const body = book.chapters.map((c, i) => `<section id="c${i + 1}">\n${sanitizeBookHtml(c.html)}\n</section>`).join('\n<hr>\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(book.title)}</title>
<style>body{max-width:42rem;margin:2rem auto;padding:0 1rem;font:18px/1.6 Georgia,serif}img{max-width:100%;height:auto}hr{margin:3rem 0}</style>
</head><body>
<h1>${esc(book.title)}</h1>${book.author ? `<p><em>${esc(book.author)}</em></p>` : ''}
${toc}
${body}
</body></html>
`;
}

function toPdf(book, progress) {
  const { jsPDF } = window.jspdf;
  const W = 420, H = 595, M = 48; // A5, in points
  const doc = new jsPDF({ unit: 'pt', format: [W, H], compress: true });
  const size = { h1: 20, h2: 16, h3: 13, h4: 12, h5: 12, h6: 12 };
  let y = M;
  const room = (needed) => { if (y + needed > H - M) { doc.addPage([W, H]); y = M; } };
  const write = (text, pt, style, gap) => {
    doc.setFont('times', style);
    doc.setFontSize(pt);
    const lh = pt * 1.35;
    for (const line of doc.splitTextToSize(text, W - 2 * M)) {
      room(lh);
      doc.text(line, M, y + pt);
      y += lh;
    }
    y += gap;
  };

  // Title page
  y = H * 0.32;
  doc.setFont('times', 'bold'); doc.setFontSize(26);
  for (const line of doc.splitTextToSize(book.title, W - 2 * M)) { doc.text(line, W / 2, y, { align: 'center' }); y += 34; }
  if (book.author) { doc.setFont('times', 'italic'); doc.setFontSize(14); doc.text(book.author, W / 2, y + 12, { align: 'center' }); }

  const total = book.chapters.length;
  book.chapters.forEach((ch, i) => {
    progress?.(`Making the PDF: chapter ${i + 1} of ${total}…`, (i + 1) / total);
    const b = blocks(ch.html);
    doc.addPage([W, H]);
    y = M;
    if (b[0]?.text !== ch.title && ch.title !== book.title && total > 1) write(ch.title, 18, 'bold', 14);
    for (const x of b) {
      if (x.tag === 'p') write(x.text, 11, 'normal', 7);
      else { room(60); write(x.text, size[x.tag], 'bold', 8); }
    }
  });

  const pages = doc.getNumberOfPages();
  doc.setFont('times', 'normal'); doc.setFontSize(9);
  for (let p = 2; p <= pages; p++) { doc.setPage(p); doc.text(String(p - 1), W / 2, H - 24, { align: 'center' }); }
  return doc.output('blob');
}

const xhtmlBody = (html) => {
  const doc = htmlDoc(html);
  const ser = new XMLSerializer();
  return [...doc.body.childNodes].map((n) => ser.serializeToString(n)).join('');
};

function toEpub(book) {
  const files = {};
  const images = []; // { href, type }
  let imgN = 0;
  // Pictures embedded as data: URIs become real files inside the EPUB.
  const pullImages = (html) => html.replace(/(<img\b[^>]*?\bsrc=")data:([^;"]+);base64,([^"]+)(")/gi, (m, pre, type, b64, post) => {
    const e = IMAGE_EXTS[type];
    if (!e) return `${pre}${post}`;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const href = `images/img${++imgN}.${e}`;
    files[`OEBPS/${href}`] = [bytes, { level: 0 }];
    images.push({ href, type });
    return `${pre}../${href}${post}`;
  });

  const id = `urn:uuid:${crypto.randomUUID()}`;
  const chapterFiles = book.chapters.map((c, i) => {
    const name = `text/chapter${i + 1}.xhtml`;
    const body = xhtmlBody(pullImages(sanitizeBookHtml(c.html)));
    files[`OEBPS/${name}`] = fflate.strToU8(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><meta charset="utf-8"/><title>${esc(c.title)}</title><link rel="stylesheet" type="text/css" href="../style.css"/></head><body>
${body}
</body></html>`);
    return { name, title: c.title, id: `c${i + 1}` };
  });
  files['OEBPS/style.css'] = fflate.strToU8('body{line-height:1.5}img{max-width:100%;height:auto}p{margin:0 0 .8em}');
  files['OEBPS/nav.xhtml'] = fflate.strToU8(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head><body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${chapterFiles.map((c) => `<li><a href="${c.name}">${esc(c.title)}</a></li>`).join('')}</ol></nav>
</body></html>`);
  files['OEBPS/toc.ncx'] = fflate.strToU8(`<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head>
<docTitle><text>${esc(book.title)}</text></docTitle><navMap>${chapterFiles.map((c, i) =>
    `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(c.title)}</text></navLabel><content src="${c.name}"/></navPoint>`).join('')}</navMap></ncx>`);
  files['OEBPS/content.opf'] = fflate.strToU8(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${id}</dc:identifier><dc:title>${esc(book.title)}</dc:title>${book.author ? `<dc:creator>${esc(book.author)}</dc:creator>` : ''}<dc:language>en</dc:language>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
${chapterFiles.map((c) => `<item id="${c.id}" href="${c.name}" media-type="application/xhtml+xml"/>`).join('\n')}
${images.map((im, i) => `<item id="img${i + 1}" href="${im.href}" media-type="${im.type}"/>`).join('\n')}
</manifest>
<spine toc="ncx">${chapterFiles.map((c) => `<itemref idref="${c.id}"/>`).join('')}</spine>
</package>`);
  // The EPUB rules want "mimetype" first and stored uncompressed.
  const zip = fflate.zipSync({
    mimetype: [fflate.strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': fflate.strToU8('<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    ...files,
  });
  return new Blob([zip], { type: 'application/epub+zip' });
}

export async function convertBook(file, to, progress) {
  progress?.('Opening the book…');
  const book = await readBook(file, progress);
  progress?.('Writing the new file…', 1);
  const name = baseName(file.name);
  const chapters = `${book.chapters.length} chapter${book.chapters.length === 1 ? '' : 's'}`;
  if (to === 'epub') {
    const note = ext(file.name) === 'pdf' ? `Text only, ${chapters} (every 10 pages). Pictures and page layout aren't kept.` : `${chapters}.`;
    return { outputs: [{ blob: toEpub(book), name: `${name}.epub` }], note };
  }
  if (to === 'html') return { outputs: [{ blob: new Blob([toHtml(book)], { type: 'text/html' }), name: `${name}.html` }], note: `One web page with ${chapters}; pictures are embedded.` };
  if (to === 'txt') return { outputs: [{ blob: new Blob([toText(book)], { type: 'text/plain' }), name: `${name}.txt` }], note: `${chapters}, text only.` };
  if (to === 'pdf') {
    const latin = !/[^\u0000-ÿ‘’‚“”„–—…•†‡‰‹›€™ŒœŠšŸŽžƒˆ˜]/.test(book.chapters.map((c) => c.html).join(''));
    const warn = latin ? '' : ' Letters outside the Western alphabet can\'t be shown in PDF; use EPUB or HTML for those.';
    return { outputs: [{ blob: toPdf(book, progress), name: `${name}.pdf` }], note: `Text only on A5 pages, ${chapters}. Pictures aren't included.${warn}` };
  }
  throw new Error(`Can't convert this book to ${to}.`);
}
