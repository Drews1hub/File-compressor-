// Thin wrapper around ffmpeg.wasm for video, audio and odd image formats.
// The engine is ~32 MB, so it's only downloaded the first time a file needs it.
import { FFmpeg } from '../vendor/ffmpeg/index.js';
import { fmt } from './util.js';

const CORE = new URL('../vendor/ffmpeg-core/', import.meta.url).href;
const WASM_BYTES = 32232419; // used for the download bar; content-length is unreliable when gzipped

let wasmPromise = null;
let jobCount = 0;

// The engine core is downloaded once, however many jobs start at the same time.
function fetchWasm(progress) {
  wasmPromise ??= downloadWasm(progress).catch((e) => { wasmPromise = null; throw e; });
  return wasmPromise;
}

async function downloadWasm(progress) {
  progress?.(`Downloading the video engine (one time only, ${fmt(WASM_BYTES)})…`, 0);
  const res = await fetch(CORE + 'ffmpeg-core.wasm');
  if (!res.ok || !res.body) throw new Error("Couldn't download the video engine. Check your connection and try again.");
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress?.(`Downloading the video engine (one time only, ${fmt(WASM_BYTES)})…`, Math.min(1, loaded / WASM_BYTES));
  }
  return URL.createObjectURL(new Blob(chunks, { type: 'application/wasm' }));
}

// A stalled download or a worker that never reports back would otherwise hold up every file queued behind it.
const START_TIMEOUT_MS = 90 * 1000;
// Longest a single ffmpeg run may go without printing anything before it counts as hung.
const STALL_MS = 120 * 1000;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Each job gets its own engine, so several jobs can run side by side (see app.js).
async function startEngine(progress) {
  const wasm = await fetchWasm(progress);
  progress?.('Starting the video engine…');
  const ff = new FFmpeg();
  await ff.load({ coreURL: CORE + 'ffmpeg-core.js', wasmURL: wasm });
  return ff;
}

function shutdown(ff) {
  try { ff.terminate(); } catch { /* already gone */ }
}

// Engines stopped by cancelEngine(), keyed by the progress callback a job reports through.
const stoppers = new WeakMap();

// Stops the engine running the job that reports through `progress`. Other jobs keep going.
export function cancelEngine(progress) {
  stoppers.get(progress)?.();
}

const toSeconds = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);

function parseInfo(text) {
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  const v = /Stream #\S+.*?: Video: (\w+).*?, (\d{2,5})x(\d{2,5})/.exec(text);
  const fps = /, ([\d.]+) fps/.exec(text);
  const a = /Stream #\S+.*?: Audio: (\w+)/.exec(text);
  // Cover art in music files shows up as a one-frame video stream.
  const isCover = v && /\(attached pic\)/.test(text.split('\n').find((l) => l.includes(v[0])) ?? '');
  return {
    duration: d ? toSeconds(d[1], d[2], d[3]) : 0,
    video: v && !isCover ? { codec: v[1], width: Number(v[2]), height: Number(v[3]), fps: fps ? Number(fps[1]) : 0 } : null,
    audio: a ? { codec: a[1] } : null,
  };
}

// Mounts `file` read-only inside ffmpeg (no copy into memory), probes it, and hands `fn` a job object.
export async function ffmpegJob(file, progress, fn) {
  let cancelled = false;
  const ff = await withTimeout(startEngine(progress), START_TIMEOUT_MS,
    "The video engine didn't start. Check your connection, then reload the page and try again.");
  const stop = () => { cancelled = true; shutdown(ff); };
  if (progress) stoppers.set(progress, stop);
  const id = ++jobCount;
  const dir = `/in${id}`;
  await ff.createDir(dir);
  await ff.mount('WORKERFS', { files: [file] }, dir);
  const input = `${dir}/${file.name}`;
  const outputs = [];

  async function run(args, { duration = 0, label = 'Working' } = {}) {
    const logs = [];
    let lastActivity = Date.now();
    const onLog = ({ message }) => {
      lastActivity = Date.now();
      logs.push(message);
      if (logs.length > 300) logs.shift();
      const t = /time=\s*(\d+):(\d+):([\d.]+)/.exec(message);
      if (t && duration) {
        const frac = Math.min(1, toSeconds(t[1], t[2], t[3]) / duration);
        progress?.(`${label}… ${Math.round(frac * 100)}%`, frac);
      }
    };
    // If ffmpeg goes quiet for too long it has hung, so fail instead of blocking the queue for good.
    let watchdog;
    const stalled = new Promise((_, reject) => {
      watchdog = setInterval(() => {
        if (Date.now() - lastActivity > STALL_MS) reject(new Error('The conversion stopped responding. Try again, or try a shorter file.'));
      }, 5000);
    });
    ff.on('log', onLog);
    try {
      const code = await Promise.race([ff.exec(['-hide_banner', '-nostdin', ...args]), stalled]);
      return { code, logs };
    } finally {
      clearInterval(watchdog);
      ff.off('log', onLog);
      stalled.catch(() => {});
    }
  }

  const job = {
    input,
    info: null,
    run,
    // Runs ffmpeg writing to a new file with extension `outExt` (placed last in args) and returns it as a Blob.
    async encode(args, outExt, type, opts) {
      const out = `/out${id}-${outputs.length}.${outExt}`;
      outputs.push(out);
      const { code, logs } = await run([...args, '-y', out], opts);
      if (code !== 0) {
        const reason = logs.filter((l) => /error|invalid|not supported|unsupported|could not|unable/i.test(l)).slice(-2).join(' ');
        throw new Error(`The conversion failed${reason ? `: ${reason}` : '.'}`);
      }
      const data = await ff.readFile(out);
      await ff.deleteFile(out).catch(() => {});
      return new Blob([data], { type });
    },
  };

  try {
    job.info = parseInfo((await run(['-i', input])).logs.join('\n'));
    return await fn(job);
  } catch (e) {
    if (cancelled) throw new Error('Cancelled.');
    if (/abort|memory|terminate|RuntimeError/i.test(String(e?.message ?? e))) {
      throw new Error('Ran out of memory. Try a shorter file, or close other tabs and try again.');
    }
    throw e;
  } finally {
    if (progress) stoppers.delete(progress);
    // Each job's engine is shut down when it finishes, so memory from one file can't build up across a long queue.
    shutdown(ff);
  }
}
