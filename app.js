import { MB, fmt, kindOf } from './js/util.js';
import { COMPRESSORS } from './js/compress.js';
import { convert, targetsFor, FORMAT_LABELS } from './js/convert.js';
import { cancelEngine } from './js/engine.js';
import { makeZip, makeTarGz, droppedFiles } from './js/archive.js';
import { TOOLS, parseTime, trimMedia, mergePdfs, splitPdf, photosToPdf, editPhoto, extractArchive } from './js/tools.js';

// Aim a little under the limit so rounding on the upload side never tips a file over.
const SAFETY = 0.97;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const results = $('#results');
const convertTo = $('#convert-to');

// ---------- settings (remembered per browser) ----------

const SETTINGS_KEY = 'file-squeeze-settings';
const SETTING_FIELDS = ['#target', '#unit', '#percent', '#image-format', '#max-side', '#max-res', '#mute', '#convert-to',
  '#archive-type', '#tool', '#pdf-page'];
const checked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;

function saveSettings() {
  const data = { goal: checked('goal'), level: checked('level') };
  for (const sel of SETTING_FIELDS) { const el = $(sel); data[sel] = el.type === 'checkbox' ? el.checked : el.value; }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
}

function loadSettings() {
  let data;
  try { data = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { return; }
  if (!data) return;
  for (const sel of SETTING_FIELDS) {
    const el = $(sel);
    if (data[sel] == null) continue;
    if (el.type === 'checkbox') el.checked = data[sel]; else el.value = data[sel];
  }
  for (const name of ['goal', 'level']) {
    const radio = document.querySelector(`input[name="${name}"][value="${data[name]}"]`);
    if (radio) radio.checked = true;
  }
}

function showGoal() {
  const goal = checked('goal');
  for (const el of $$('.goal')) el.hidden = el.dataset.goal !== goal;
  $('#percent-out').textContent = `At most ${$('#percent').value}% of the original size`;
}

// Byte limit for one file, or null when compressing by strength.
function limitFor(file) {
  const goal = checked('goal');
  if (goal === 'level') return null;
  if (goal === 'percent') return Math.floor(file.size * Number($('#percent').value) / 100);
  const n = Math.max(1, Number($('#target').value) || 30);
  return n * ($('#unit').value === 'kb' ? 1000 : MB);
}

function compressOptions(limit) {
  return {
    mode: limit == null ? 'level' : 'size',
    target: limit == null ? 0 : limit * SAFETY,
    level: checked('level'),
    imageFormat: $('#image-format').value,
    maxSide: Number($('#max-side').value),
    maxRes: Number($('#max-res').value),
    mute: $('#mute').checked,
  };
}

// ---------- work queue ----------

// One file at a time: big images, PDFs and videos need a lot of memory.
let queue = Promise.resolve();
let running = null;

function enqueue(row, run) {
  row.cancelled = false;
  row.setStatus('Waiting…');
  row.cancelBtn.hidden = false;
  row.li.dataset.busy = '';
  queue = queue.then(async () => {
    if (row.cancelled) return;
    running = row;
    try { await row.work(run); } finally { running = null; }
  });
}

// ---------- results ----------

// Every finished output, for "Download all".
let allOutputs = [];

function updateBulk() {
  $('#bulk').hidden = !results.children.length;
  $('#download-all').hidden = allOutputs.length < 2;
}

function makeRow(file) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div class="row-head"><div class="name"></div><button type="button" class="cancel" hidden>Cancel</button></div>
    <div class="picker" hidden></div>
    <div class="status"></div>
    <progress hidden></progress>
    <div class="note" hidden></div>
    <div class="downloads"></div>`;
  li.querySelector('.name').textContent = `${file.name} · ${fmt(file.size)}`;
  results.prepend(li);
  updateBulk();

  const status = li.querySelector('.status');
  const bar = li.querySelector('progress');
  const note = li.querySelector('.note');
  const cancelBtn = li.querySelector('.cancel');

  const row = {
    li,
    cancelBtn,
    cancelled: false,
    // Only ffmpeg jobs can be stopped part-way; everything else is quick enough to just finish.
    stoppable: ['video', 'audio'].includes(kindOf(file)),
    setStatus(msg, cls = '') { status.textContent = msg; status.className = `status ${cls}`; },
    progress(msg, frac) {
      status.textContent = msg;
      if (frac != null) { bar.hidden = false; bar.value = frac; }
    },
    setNote(text) { note.textContent = text || ''; note.hidden = !text; },
    addDownloads(outputs) {
      const box = li.querySelector('.downloads');
      for (const { blob, name } of outputs) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.textContent = `⬇ ${name} (${fmt(blob.size)})`;
        box.append(a);
        allOutputs.push({ blob, name, li });
      }
      updateBulk();
    },
    // Wraps a unit of work with the shared busy / done / error handling.
    async work(fn) {
      cancelBtn.hidden = !row.stoppable;
      try {
        const { outputs, note: text, summary } = await fn((msg, frac) => row.progress(msg, frac));
        row.setStatus(summary, 'ok');
        row.setNote(text);
        row.addDownloads(outputs);
      } catch (e) {
        console.error(e);
        row.setStatus(row.cancelled ? 'Cancelled.' : e.message || String(e), 'err');
      } finally {
        bar.hidden = true;
        cancelBtn.hidden = true;
        delete li.dataset.busy;
      }
    },
  };

  cancelBtn.addEventListener('click', () => {
    row.cancelled = true;
    cancelBtn.hidden = true;
    if (running === row) cancelEngine();
    else {
      row.setStatus('Cancelled.', 'err');
      delete li.dataset.busy;
      li.querySelectorAll('.picker select, .picker button').forEach((el) => { el.disabled = false; });
    }
  });
  return row;
}

// ---------- compress ----------

function compressFile(file) {
  const row = makeRow(file);
  const limit = limitFor(file);

  if (limit != null && file.size <= limit) {
    row.setStatus(`Already under ${fmt(limit)} — no changes needed.`, 'ok');
    row.addDownloads([{ blob: file, name: file.name }]);
    return;
  }

  const opts = compressOptions(limit);
  enqueue(row, async (progress) => {
    const res = await COMPRESSORS[kindOf(file)](file, opts, progress);
    const total = res.outputs.reduce((s, o) => s + o.blob.size, 0);
    const pct = Math.round((total / file.size) * 100);
    res.summary = res.outputs.length > 1
      ? `Done — ${res.outputs.length} files, each under ${fmt(limit)}.`
      : res.outputs[0].blob === file
        ? 'Kept as is.'
        : `Done — ${fmt(file.size)} → ${fmt(total)} (${pct}% of the original).`;
    return res;
  });
}

// ---------- convert ----------

function convertFile(file) {
  const row = makeRow(file);
  const formats = targetsFor(file);
  if (!formats.length) {
    row.setStatus('No conversions for this file type yet. Images, videos, audio and PDFs can be converted.', 'err');
    return;
  }

  const picker = row.li.querySelector('.picker');
  picker.hidden = false;
  picker.innerHTML = '<span>Convert to</span> <select></select> <button type="button">Convert</button>';
  const select = picker.querySelector('select');
  const button = picker.querySelector('button');
  for (const f of formats) select.add(new Option(FORMAT_LABELS[f], f));

  const start = () => {
    const to = select.value;
    button.disabled = select.disabled = true;
    enqueue(row, async (progress) => {
      try {
        const res = await convert(file, to, progress);
        res.summary = `Done — converted to ${FORMAT_LABELS[to]}.`;
        return res;
      } finally {
        button.disabled = select.disabled = false;
        button.textContent = 'Convert again';
      }
    });
  };
  button.addEventListener('click', start);

  const preferred = convertTo.value;
  if (preferred && formats.includes(preferred)) {
    select.value = preferred;
    start();
  } else {
    row.setStatus(preferred
      ? `Can't make ${FORMAT_LABELS[preferred]} from this file — pick another format.`
      : 'Pick a format and press Convert.');
  }
}

// ---------- zip ----------

let zipItems = [];

function renderZipList() {
  const box = $('#zip-list');
  box.hidden = !zipItems.length;
  const ul = box.querySelector('ul');
  ul.replaceChildren(...zipItems.map(({ path, file }) => {
    const li = document.createElement('li');
    li.innerHTML = '<span></span><span></span>';
    li.firstChild.textContent = path;
    li.lastChild.textContent = fmt(file.size);
    return li;
  }));
  const total = zipItems.reduce((s, i) => s + i.file.size, 0);
  $('#zip-make').textContent = `Make archive (${zipItems.length} file${zipItems.length === 1 ? '' : 's'}, ${fmt(total)})`;
}

function addToZip(items) {
  zipItems.push(...items);
  renderZipList();
}

$('#zip-make').addEventListener('click', () => {
  const items = zipItems;
  const type = $('#archive-type').value;
  const base = ($('#archive-name').value.trim() || 'files').replace(/[\\/:*?"<>|]+/g, '-');
  const name = `${base}.${type === 'zip' ? 'zip' : 'tar.gz'}`;
  const total = items.reduce((s, i) => s + i.file.size, 0);
  zipItems = [];
  renderZipList();

  const row = makeRow({ name, size: total });
  enqueue(row, async (progress) => {
    const files = items.map(({ path, file }) => ({ path, blob: file }));
    const blob = await (type === 'zip' ? makeZip : makeTarGz)(files, progress);
    return {
      outputs: [{ blob, name }],
      summary: `Done — ${items.length} file${items.length === 1 ? '' : 's'}, ${fmt(total)} → ${fmt(blob.size)}.`,
      note: '',
    };
  });
});
$('#zip-clear').addEventListener('click', () => { zipItems = []; renderZipList(); });

// ---------- tools ----------

const TOOL_TEXT = {
  trim: ['Drop videos or audio to trim', 'Times are minutes:seconds, like 1:30. Leave End blank to keep everything after Start.'],
  'merge-pdf': ['Drop the PDFs to merge', 'Pages keep their text and quality. Put the list in order, then merge.'],
  'split-pdf': ['Drop a PDF to split', 'Every part keeps its text selectable.'],
  'photos-pdf': ['Drop the photos for your PDF', 'One photo per page, in the order listed. iPhone HEIC photos work too.'],
  'photo-edit': ['Drop photos to edit', 'Every photo you drop gets the same changes.'],
  extract: ['Drop a ZIP or TAR.GZ to open', 'Each file inside gets its own download button.'],
};

let toolItems = [];

function showTool() {
  const tool = $('#tool').value;
  for (const el of $$('.tool-opts')) el.hidden = el.dataset.tool !== tool;
  [$('#tool-drop-title').textContent, $('#tool-hint').textContent] = TOOL_TEXT[tool];
  toolItems = [];
  renderToolList();
}

function renderToolList() {
  const tool = $('#tool').value;
  const box = $('#tool-list');
  box.hidden = !TOOLS[tool].multi || !toolItems.length;
  box.querySelector('ol').replaceChildren(...toolItems.map((file, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="item"><span></span><span class="size"></span>
      <button type="button" data-move="-1" aria-label="Move up">↑</button>
      <button type="button" data-move="1" aria-label="Move down">↓</button>
      <button type="button" data-remove aria-label="Remove">✕</button></div>`;
    li.querySelector('span').textContent = file.name;
    li.querySelector('.size').textContent = fmt(file.size);
    li.querySelector('[data-move="-1"]').disabled = i === 0;
    li.querySelector('[data-move="1"]').disabled = i === toolItems.length - 1;
    li.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      const j = i + Number(b.dataset.move);
      [toolItems[i], toolItems[j]] = [toolItems[j], toolItems[i]];
      renderToolList();
    }));
    li.querySelector('[data-remove]').addEventListener('click', () => { toolItems.splice(i, 1); renderToolList(); });
    return li;
  }));
  const n = toolItems.length;
  $('#tool-make').textContent = tool === 'merge-pdf' ? `Merge ${n} PDF${n === 1 ? '' : 's'}` : `Make a PDF from ${n} photo${n === 1 ? '' : 's'}`;
}

// Reads the current tool's settings; throws a readable error for bad input.
function toolSettings(tool) {
  switch (tool) {
    case 'trim': return { start: parseTime($('#trim-start').value), end: parseTime($('#trim-end').value), exact: !$('#trim-quick').checked };
    case 'split-pdf': return { mode: checked('split-mode'), ranges: $('#split-ranges').value };
    case 'photo-edit': return { rotate: Number($('#edit-rotate').value), resize: $('#edit-resize').value, flip: $('#edit-flip').checked };
    default: return {};
  }
}

const SINGLE_TOOLS = {
  trim: [trimMedia, 'Done — trimmed.'],
  'split-pdf': [splitPdf, 'Done — split.'],
  'photo-edit': [editPhoto, 'Done.'],
  extract: [(file, _s, progress) => extractArchive(file, progress), 'Done — opened.'],
};

function toolFiles(items) {
  const tool = $('#tool').value;
  const spec = TOOLS[tool];
  for (const { file } of items) {
    if (!spec.accepts(file)) {
      makeRow(file).setStatus(`This tool works with ${spec.what}. Pick another tool above for this file.`, 'err');
    } else if (spec.multi) {
      toolItems.push(file);
    } else {
      const row = makeRow(file);
      let settings;
      try { settings = toolSettings(tool); } catch (e) { row.setStatus(e.message, 'err'); continue; }
      const [fn, summary] = SINGLE_TOOLS[tool];
      enqueue(row, async (progress) => ({ ...(await fn(file, settings, progress)), summary }));
    }
  }
  renderToolList();
}

$('#tool-make').addEventListener('click', () => {
  const tool = $('#tool').value;
  const files = toolItems;
  if (!files.length) return;
  toolItems = [];
  renderToolList();
  const total = files.reduce((s, f) => s + f.size, 0);
  if (tool === 'merge-pdf') {
    const row = makeRow({ name: 'merged.pdf', size: total });
    enqueue(row, async (progress) => {
      const { blob, pages } = await mergePdfs(files, progress);
      return { outputs: [{ blob, name: 'merged.pdf' }], summary: `Done — ${files.length} PDFs, ${pages} pages in total.`, note: '' };
    });
  } else {
    const page = $('#pdf-page').value;
    const row = makeRow({ name: 'photos.pdf', size: total });
    enqueue(row, async (progress) => {
      const blob = await photosToPdf(files, { page }, progress);
      return { outputs: [{ blob, name: 'photos.pdf' }], summary: `Done — ${files.length} page${files.length === 1 ? '' : 's'}.`, note: '' };
    });
  }
});
$('#tool-clear').addEventListener('click', () => { toolItems = []; renderToolList(); });
$('#tool').addEventListener('change', showTool);

// ---------- download all / clear ----------

$('#download-all').addEventListener('click', async () => {
  const btn = $('#download-all');
  btn.disabled = true;
  const label = btn.textContent;
  try {
    btn.textContent = 'Packing…';
    const blob = await makeZip(allOutputs.map(({ name, blob: b }) => ({ path: name, blob: b })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'file-squeeze-results.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

$('#clear-results').addEventListener('click', () => {
  // Leave rows that are still waiting or working; drop the rest.
  for (const li of [...results.children]) {
    if ('busy' in li.dataset) continue;
    li.querySelectorAll('.downloads a').forEach((a) => URL.revokeObjectURL(a.href));
    li.remove();
  }
  allOutputs = allOutputs.filter((o) => o.li.isConnected);
  updateBulk();
});

// ---------- wiring ----------

const HANDLE = {
  compress: (items) => items.forEach(({ file }) => compressFile(file)),
  convert: (items) => items.forEach(({ file }) => convertFile(file)),
  zip: addToZip,
  tools: toolFiles,
};

for (const drop of $$('.drop')) {
  const input = drop.querySelector('input');
  const handle = HANDLE[drop.dataset.mode];
  input.addEventListener('change', () => {
    handle([...input.files].map((file) => ({ file, path: file.name })));
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    droppedFiles(e.dataTransfer).then(handle);
  });
}
// Dropping outside the box shouldn't navigate away from the page.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

for (const tab of $$('[role="tab"]')) {
  tab.addEventListener('click', () => {
    for (const t of $$('[role="tab"]')) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
  });
}

for (const b of $$('.presets button')) {
  b.addEventListener('click', () => { $('#target').value = b.dataset.mb; $('#unit').value = 'mb'; saveSettings(); });
}

loadSettings();
showGoal();
showTool();
for (const el of $$('#panel-compress input, #panel-compress select, #convert-to, #archive-type, #tool, #pdf-page')) {
  el.addEventListener('change', () => { showGoal(); saveSettings(); });
}
$('#percent').addEventListener('input', showGoal);
