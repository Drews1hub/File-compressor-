import { MB, fmt, kindOf } from './js/util.js';
import { COMPRESSORS } from './js/compress.js';
import { convert, targetsFor, FORMAT_LABELS } from './js/convert.js';
import { cancelEngine } from './js/engine.js';
import { makeZip, makeTarGz, droppedFiles } from './js/archive.js';
import { TOOLS, parseTime, trimMedia, joinAudiobook, mergePdfs, splitPdf, photosToPdf, editPhoto, extractArchive } from './js/tools.js';

// Aim a little under the limit so rounding on the upload side never tips a file over.
const SAFETY = 0.97;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const results = $('#results');
const convertTo = $('#convert-to');

// ---------- settings (remembered per browser) ----------

// Key kept from the old name so saved settings carry over.
const SETTINGS_KEY = 'file-squeeze-settings';
const SETTING_FIELDS = ['#target', '#unit', '#percent', '#image-format', '#max-side', '#max-res', '#mute', '#convert-to',
  '#archive-type', '#tool', '#pdf-page', '#number-files'];
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

// The most recently queued job that hasn't finished yet, so a waiting row can name what it's waiting for.
let lastQueued = null;

function enqueue(row, run) {
  // A new batch starts when nothing from the last one is still waiting or working.
  if ([...batch].every((r) => r.finished || !r.li.isConnected)) batch.clear();
  row.frac = 0;
  row.finished = false;
  batch.add(row);
  updateOverall();
  // A fresh ticket per job, so a cancelled job that's still queued can't run after the row is restarted.
  const ticket = {};
  row.ticket = ticket;
  row.cancelled = false;
  const ahead = lastQueued && 'busy' in lastQueued.li.dataset ? lastQueued : null;
  row.setStatus(ahead ? `Waiting for ${ahead.name} to finish…` : 'Waiting…');
  row.cancelBtn.hidden = false;
  row.li.dataset.busy = '';
  lastQueued = row;
  queue = queue.then(async () => {
    try {
      if (row.cancelled || row.ticket !== ticket) return;
      running = row;
      await row.work(run);
    } finally {
      running = null;
      if (lastQueued === row) lastQueued = null;
    }
  });
}

// ---------- overall progress ring ----------

// Every row queued since the list was last idle; the ring shows how far along they are together.
const batch = new Set();
const RING = 2 * Math.PI * 19;

function updateOverall() {
  const rows = [...batch].filter((r) => r.li.isConnected);
  const box = $('#overall');
  box.hidden = !rows.length;
  if (!rows.length) return;
  const done = rows.filter((r) => r.finished).length;
  const frac = rows.reduce((sum, r) => sum + (r.finished ? 1 : Math.min(r.frac, 0.99)), 0) / rows.length;
  const pct = done === rows.length ? 100 : Math.min(99, Math.floor(frac * 100));
  box.classList.toggle('done', pct === 100);
  box.setAttribute('aria-valuenow', pct);
  box.querySelector('.ring-fg').style.strokeDashoffset = RING * (1 - pct / 100);
  box.querySelector('.pct').textContent = `${pct}%`;
  box.querySelector('.overall-label').textContent = pct === 100
    ? (rows.length === 1 ? 'All done' : `All ${rows.length} files done`)
    : `${done} of ${rows.length} file${rows.length === 1 ? '' : 's'} done`;
}

// ---------- results ----------

// Every finished output, for "Download all".
let allOutputs = [];

function updateBulk() {
  $('#bulk').hidden = !results.children.length;
  $('#save-files').hidden = $('#download-all').hidden = $('#number-label').hidden = allOutputs.length < 2;
}

function makeRow(file) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div class="row-head">
      <div class="name"></div>
      <div class="row-actions">
        <button type="button" class="cancel" hidden>Cancel</button>
        <button type="button" class="remove" aria-label="Remove from list" title="Remove from list">✕</button>
      </div>
    </div>
    <div class="picker" hidden></div>
    <div class="status"></div>
    <progress hidden></progress>
    <div class="note" hidden></div>
    <div class="downloads"></div>`;
  li.querySelector('.name').textContent = `${file.name} · ${fmt(file.size)}`;
  // Oldest first, so the list (and "Download all") reads in the order files were added.
  results.append(li);
  updateBulk();

  const status = li.querySelector('.status');
  const bar = li.querySelector('progress');
  const note = li.querySelector('.note');
  const cancelBtn = li.querySelector('.cancel');

  // Cancelling rejects this promise, which releases the queue even if the job itself is stuck.
  let abort;
  const aborted = new Promise((_, reject) => { abort = reject; });
  aborted.catch(() => {});

  const row = {
    li,
    name: file.name,
    cancelBtn,
    cancelled: false,
    setStatus(msg, cls = '') { status.textContent = msg; status.className = `status ${cls}`; },
    progress(msg, frac) {
      status.textContent = msg;
      if (frac != null) {
        bar.hidden = false;
        bar.value = frac;
        // The one-time engine download has its own 0-100%, which isn't progress on the file.
        if (!/^Downloading/.test(msg)) { row.frac = frac; updateOverall(); }
      }
    },
    setNote(text) { note.textContent = text || ''; note.hidden = !text; },
    addDownloads(outputs) {
      const box = li.querySelector('.downloads');
      for (const { blob, name } of outputs) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.textContent = `Download ${name} (${fmt(blob.size)})`;
        box.append(a);
        allOutputs.push({ blob, name, li });
      }
      updateBulk();
    },
    // Wraps a unit of work with the shared busy / done / error handling.
    // Every job reports progress often, so a cancel takes effect at its next progress update.
    async work(fn) {
      row.progress('Starting…');
      try {
        const res = await Promise.race([
          fn((msg, frac) => {
            if (row.cancelled) throw new Error('Cancelled.');
            row.progress(msg, frac);
          }),
          aborted,
        ]);
        if (row.cancelled) throw new Error('Cancelled.');
        const { outputs, note: text, summary } = res;
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
        row.finished = true;
        updateOverall();
      }
    },
  };

  // Stops this row's job: a waiting job is skipped, a running one stops at its next step
  // (video and audio stop at once, because the converter engine is restarted).
  row.cancel = () => {
    if (!('busy' in li.dataset)) return;
    row.cancelled = true;
    cancelBtn.hidden = true;
    if (running === row) {
      row.setStatus('Cancelling…', 'err');
      abort(new Error('Cancelled.'));
      cancelEngine();
    } else {
      row.setStatus('Cancelled.', 'err');
      delete li.dataset.busy;
      row.finished = true;
      updateOverall();
      li.querySelectorAll('.picker select, .picker button').forEach((el) => { el.disabled = false; });
    }
  };
  cancelBtn.addEventListener('click', row.cancel);

  li.querySelector('.remove').addEventListener('click', () => {
    row.cancel();
    li.querySelectorAll('.downloads a').forEach((a) => URL.revokeObjectURL(a.href));
    li.remove();
    allOutputs = allOutputs.filter((o) => o.li !== li);
    updateBulk();
    updateOverall();
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
    const res = await (COMPRESSORS[kindOf(file)] ?? COMPRESSORS.other)(file, opts, progress);
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
  picker.innerHTML = '<span>Convert to</span> <select></select> <input type="text" class="book-title" placeholder="Book title (optional)" autocomplete="off" hidden> <button type="button">Convert</button>';
  const select = picker.querySelector('select');
  const button = picker.querySelector('button');
  const titleBox = picker.querySelector('.book-title');
  for (const f of formats) select.add(new Option(FORMAT_LABELS[f], f));
  // Audiobooks take a title, which names the file and is stored in it.
  const showTitle = () => { titleBox.hidden = select.value !== 'm4b'; };
  select.addEventListener('change', showTitle);

  const start = () => {
    const to = select.value;
    button.disabled = select.disabled = titleBox.disabled = true;
    enqueue(row, async (progress) => {
      try {
        const res = await convert(file, to, progress, { title: titleBox.value });
        res.summary = `Done — converted to ${FORMAT_LABELS[to]}.`;
        return res;
      } finally {
        button.disabled = select.disabled = titleBox.disabled = false;
        button.textContent = 'Convert again';
      }
    });
  };
  button.addEventListener('click', start);

  const preferred = convertTo.value;
  if (preferred === 'm4b' && formats.includes('m4b')) {
    // Wait, so the book title can be typed before converting.
    select.value = 'm4b';
    showTitle();
    row.setStatus('Type the book title (optional), then press Convert.');
  } else if (preferred && formats.includes(preferred)) {
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
  'join-audio': ['Drop the audio tracks, all discs at once', 'Everything is joined into one audiobook file, with a chapter at the start of each track so you can still skip between discs. Files dropped together are sorted by name; use the arrows to fix the order.'],
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
  const makeLabel = {
    'join-audio': `Join ${n} file${n === 1 ? '' : 's'} into one audiobook`,
    'merge-pdf': `Merge ${n} PDF${n === 1 ? '' : 's'}`,
  };
  $('#tool-make').textContent = makeLabel[tool] ?? `Make a PDF from ${n} photo${n === 1 ? '' : 's'}`;
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
  // Tracks dropped together go in name order, so Disc 1 Track 01 comes before Disc 2 Track 01.
  if (tool === 'join-audio') items = [...items].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
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
  if (tool === 'join-audio') {
    const title = $('#book-title').value;
    const author = $('#book-author').value;
    const row = makeRow({ name: `${title.trim() || 'audiobook'}.m4b`, size: total });
    enqueue(row, (progress) => joinAudiobook(files, progress, { title, author, separate: $('#book-output').value === 'tracks' }));
  } else if (tool === 'merge-pdf') {
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

// Every finished output with the name it's saved under, in list order.
function orderedOutputs() {
  // List order, not finishing order, so a retried or late-converted file keeps its place.
  const ordered = [...results.children].flatMap((li) => allOutputs.filter((o) => o.li === li));
  // A number in front keeps the order in players and file managers that sort by name ("Track 10" after "Track 9").
  const width = Math.max(2, String(ordered.length).length);
  const number = $('#number-files').checked;
  const used = new Set();
  return ordered.map(({ name, blob }, i) => {
    let path = number ? `${String(i + 1).padStart(width, '0')} - ${name}` : name;
    // Without numbers two rows can share a name; don't let one overwrite the other.
    for (let n = 2; used.has(path.toLowerCase()); n++) path = name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(path.toLowerCase());
    return { path, blob };
  });
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

async function withBusy(btn, fn) {
  btn.disabled = true;
  const label = btn.textContent;
  try { await fn((text) => { btn.textContent = text; }); } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

$('#download-all').addEventListener('click', () => withBusy($('#download-all'), async (say) => {
  say('Packing…');
  saveBlob(await makeZip(orderedOutputs()), 'filefit-results.zip');
}));

// The files themselves, no ZIP. Chrome and Edge can write them all into a folder you pick;
// other browsers get one ordinary download per file (the browser may ask once to allow that).
$('#save-files').addEventListener('click', () => withBusy($('#save-files'), async (say) => {
  const files = orderedOutputs();
  if (window.showDirectoryPicker) {
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'filefit-save', mode: 'readwrite' }); } catch (e) {
      if (e.name === 'AbortError') return;   // closed the folder picker
      throw e;
    }
    for (const [i, { path, blob }] of files.entries()) {
      say(`Saving ${i + 1} of ${files.length}…`);
      const writable = await (await dir.getFileHandle(path, { create: true })).createWritable();
      await writable.write(blob);
      await writable.close();
    }
    say(`Saved ${files.length} files`);
    await new Promise((r) => setTimeout(r, 2000));
    return;
  }
  for (const [i, { path, blob }] of files.entries()) {
    say(`Downloading ${i + 1} of ${files.length}…`);
    saveBlob(blob, path);
    // Browsers drop downloads that are started too close together.
    await new Promise((r) => setTimeout(r, 500));
  }
}));

$('#clear-results').addEventListener('click', () => {
  // Leave rows that are still waiting or working; drop the rest.
  for (const li of [...results.children]) {
    if ('busy' in li.dataset) continue;
    li.querySelectorAll('.downloads a').forEach((a) => URL.revokeObjectURL(a.href));
    li.remove();
  }
  allOutputs = allOutputs.filter((o) => o.li.isConnected);
  updateBulk();
  updateOverall();
});

// ---------- wiring ----------

const HANDLE = {
  compress: (items) => items.forEach(({ file }) => compressFile(file)),
  convert: (items) => items.forEach(({ file }) => convertFile(file)),
  zip: addToZip,
  tools: toolFiles,
};

// Browsers hand over picked or dropped files (and folder contents) in no reliable order,
// so each batch is sorted by name the way people number tracks: "Track 2" before "Track 10".
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const inOrder = (items) => items.sort((a, b) => byName.compare(a.path, b.path));

for (const drop of $$('.drop')) {
  const input = drop.querySelector('input');
  const run = HANDLE[drop.dataset.mode];
  const handle = (items) => run(inOrder(items));
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
for (const el of $$('#panel-compress input, #panel-compress select, #convert-to, #archive-type, #tool, #pdf-page, #number-files')) {
  el.addEventListener('change', () => { showGoal(); saveSettings(); });
}
$('#percent').addEventListener('input', showGoal);
