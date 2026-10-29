// Thin wrapper around ffmpeg.wasm for video, audio and odd image formats.
// The engine is ~32 MB, so it's only downloaded the first time a file needs it.
import { FFmpeg } from '../vendor/ffmpeg/index.js';
import { fmt } from './util.js';

const CORE = new URL('../vendor/ffmpeg-core/', import.meta.url).href;
const WASM_BYTES = 32232419; // used for the download bar; content-length is unreliable when gzipped

let enginePromise = null;
let wasmURL = null;
let jobCount = 0;
let cancelled = false;

async function fetchWasm(progress) {
  if (wasmURL) return wasmURL;
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
  wasmURL = URL.createObjectURL(new Blob(chunks, { type: 'application/wasm' }));
  return wasmURL;
}

function getEngine(progress) {
  if (!enginePromise) {
    enginePromise = (async () => {
      const wasm = await fetchWasm(progress);
      progress?.('Starting the video engine…');
      const ff = new FFmpeg();
      await ff.load({ coreURL: CORE + 'ffmpeg-core.js', wasmURL: wasm });
      return ff;
    })();
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

function resetEngine() {
  const p = enginePromise;
  enginePromise = null;
  p?.then((ff) => ff.terminate()).catch(() => {});
}

// Stops whatever ffmpeg is doing. The engine restarts on the next job.
export function cancelEngine() {
  cancelled = true;
  resetEngine();
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
  cancelled = false;
  const ff = await getEngine(progress);
  const id = ++jobCount;
  const dir = `/in${id}`;
  await ff.createDir(dir);
  await ff.mount('WORKERFS', { files: [file] }, dir);
  const input = `${dir}/${file.name}`;
  const outputs = [];

  async function run(args, { duration = 0, label = 'Working' } = {}) {
    const logs = [];
    const onLog = ({ message }) => {
      logs.push(message);
      if (logs.length > 300) logs.shift();
      const t = /time=\s*(\d+):(\d+):([\d.]+)/.exec(message);
      if (t && duration) {
        const frac = Math.min(1, toSeconds(t[1], t[2], t[3]) / duration);
        progress?.(`${label}… ${Math.round(frac * 100)}%`, frac);
      }
    };
    ff.on('log', onLog);
    try {
      const code = await ff.exec(['-hide_banner', '-nostdin', ...args]);
      return { code, logs };
    } finally {
      ff.off('log', onLog);
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
    // An out-of-memory abort leaves the engine unusable, so start fresh next time.
    if (/abort|memory|terminate|RuntimeError/i.test(String(e?.message ?? e))) {
      resetEngine();
      throw new Error('Ran out of memory. Try a shorter file, or close other tabs and try again.');
    }
    throw e;
  } finally {
    if (enginePromise) {
      for (const out of outputs) await ff.deleteFile(out).catch(() => {});
      await ff.unmount(dir).catch(() => {});
      await ff.deleteDir(dir).catch(() => {});
    }
  }
}
