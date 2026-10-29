import { MB, fmt, kindOf } from './js/util.js';
import { COMPRESSORS } from './js/compress.js';
import { convert, targetsFor, FORMAT_LABELS } from './js/convert.js';
import { cancelEngine } from './js/engine.js';

// Aim a little under the limit so rounding on the upload side never tips a file over.
const SAFETY = 0.97;

const $ = (sel) => document.querySelector(sel);
const results = $('#results');
const targetInput = $('#target');
const convertTo = $('#convert-to');

// ---------- work queue ----------

// One file at a time: big images, PDFs and videos need a lot of memory.
let queue = Promise.resolve();
let running = null;

function enqueue(row, run) {
  row.cancelled = false;
  row.setStatus('Waiting…');
  row.cancelBtn.hidden = false;
  queue = queue.then(async () => {
    if (row.cancelled) return;
    running = row;
    try { await row.work(run); } finally { running = null; }
  });
}

// ---------- result rows ----------

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
      }
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
      }
    },
  };

  cancelBtn.addEventListener('click', () => {
    row.cancelled = true;
    cancelBtn.hidden = true;
    if (running === row) cancelEngine();
    else {
      row.setStatus('Cancelled.', 'err');
      li.querySelectorAll('.picker select, .picker button').forEach((el) => { el.disabled = false; });
    }
  });
  return row;
}

// ---------- compress ----------

function compressFile(file) {
  const row = makeRow(file);
  const target = Math.max(1, Number(targetInput.value) || 30) * MB;

  if (file.size <= target) {
    row.setStatus(`Already under ${fmt(target)} — no changes needed.`, 'ok');
    row.addDownloads([{ blob: file, name: file.name }]);
    return;
  }

  enqueue(row, async (progress) => {
    const res = await COMPRESSORS[kindOf(file)](file, target * SAFETY, progress);
    const total = res.outputs.reduce((s, o) => s + o.blob.size, 0);
    res.summary = res.outputs.length > 1
      ? `Done — ${res.outputs.length} files, each under ${fmt(target)}.`
      : `Done — ${fmt(file.size)} → ${fmt(total)}.`;
    return res;
  });
}

// ---------- convert ----------

function convertFile(file) {
  const row = makeRow(file);
  const formats = targetsFor(file);
  if (!formats.length) {
    row.setStatus("No conversions for this file type yet. Images, videos, audio and PDFs can be converted.", 'err');
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

// ---------- wiring ----------

const HANDLE = { compress: compressFile, convert: convertFile };

for (const drop of document.querySelectorAll('.drop')) {
  const input = drop.querySelector('input');
  const handle = (files) => files.forEach(HANDLE[drop.dataset.mode]);
  input.addEventListener('change', () => { handle([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
}
// Dropping outside the box shouldn't navigate away from the page.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('[role="tab"]')) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
  });
}

for (const b of document.querySelectorAll('.presets button')) {
  b.addEventListener('click', () => { targetInput.value = b.dataset.mb; });
}
