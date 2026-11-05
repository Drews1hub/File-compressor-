// Joins MP4 audio files (M4B, M4A) into one audiobook without decoding them or loading them into memory.
// Only each file's index (the "moov" box, a few MB at most) is read. The audio itself goes into the result as
// slices of the original files, which the browser reads from disk when the result is saved, so a book of any
// size joins in seconds with almost no memory. A new index is written with the joined sample tables, a chapter
// track (the kind iTunes and Apple Books read) and audiobook tags.
// Everything happens in this page: nothing is uploaded. No imports, so it can be tested outside a browser.

// Thrown when the files can't be joined this way (not MP4, a different audio format, an unusual layout).
// The caller then falls back to the slower ffmpeg join.
export class NotJoinable extends Error {}

const MAX_INDEX = 256 * 1024 * 1024;

const fourccAt = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const u32At = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64At = (b, o) => u32At(b, o) * 2 ** 32 + u32At(b, o + 4);

async function readBytes(file, start, length) {
  return new Uint8Array(await file.slice(start, start + length).arrayBuffer());
}

// The boxes at the top level of a file, read from their 8- or 16-byte headers only.
async function topBoxes(file) {
  const boxes = [];
  for (let pos = 0; pos + 8 <= file.size;) {
    const h = await readBytes(file, pos, 16);
    let size = u32At(h, 0);
    let header = 8;
    if (size === 1) { size = u64At(h, 8); header = 16; } else if (size === 0) size = file.size - pos;
    if (size < header) throw new NotJoinable(`${file.name} isn't laid out like an MP4 file.`);
    if (pos + size > file.size) throw new NotJoinable(`${file.name} looks incomplete (it ends early).`);
    boxes.push({ type: fourccAt(h, 4), start: pos, size, header });
    pos += size;
  }
  return boxes;
}

// The child boxes inside box `b` of buffer `buf`. `skip` is extra bytes before the first child (meta has 4).
function kids(buf, b, skip = 0) {
  const out = [];
  const end = b.start + b.size;
  for (let pos = b.start + b.header + skip; pos + 8 <= end;) {
    let size = u32At(buf, pos);
    let header = 8;
    if (size === 1) { size = u64At(buf, pos + 8); header = 16; } else if (size === 0) size = end - pos;
    if (size < header || pos + size > end) break;
    out.push({ type: fourccAt(buf, pos + 4), start: pos, size, header });
    pos += size;
  }
  return out;
}
const child = (buf, b, type, skip) => kids(buf, b, skip).find((k) => k.type === type);
// Start of a full box's fields, after its version and flags.
const body = (b) => b.start + b.header + 4;
// iTunes writes meta as a full box; some older files leave the version and flags out.
const metaSkip = (buf, meta) => (fourccAt(buf, meta.start + meta.header + 4) === 'hdlr' ? 0 : 4);

// What makes two AAC streams joinable: same codec, rate, channels and decoder setup (bitrates may differ).
function audioFormat(buf, stsd) {
  if (u32At(buf, body(stsd)) !== 1) throw new NotJoinable('A file has more than one audio format inside it.');
  const entry = { start: body(stsd) + 4 };
  const format = fourccAt(buf, entry.start + 4);
  if (format !== 'mp4a') throw new NotJoinable(`The audio is ${format}, not AAC.`);
  const channels = (buf[entry.start + 24] << 8) | buf[entry.start + 25];
  const rate = u32At(buf, entry.start + 32) >>> 16;
  // The decoder setup lives in the esds box's DecoderSpecificInfo (descriptor tag 5).
  const end = stsd.start + stsd.size;
  let esds = -1;
  for (let i = entry.start + 36; i + 4 <= end; i++) if (fourccAt(buf, i) === 'esds') { esds = i - 4; break; }
  let asc = '';
  if (esds >= 0) {
    const stop = esds + u32At(buf, esds);
    // A descriptor is a tag byte, a length of 1-4 bytes (7 bits each), then its contents.
    const desc = (at) => {
      let len = 0;
      let j = at + 1;
      for (let k = 0; k < 4; k++) { const b = buf[j++]; len = (len << 7) | (b & 0x7f); if (!(b & 0x80)) break; }
      return { tag: buf[at], data: j, len };
    };
    const es = desc(esds + 12); // ES_Descriptor
    if (es.tag === 3) {
      const flags = buf[es.data + 2];
      let at = es.data + 3;
      if (flags & 0x80) at += 2;
      if (flags & 0x40) at += 1 + buf[at];
      if (flags & 0x20) at += 2;
      const config = desc(at); // DecoderConfigDescriptor: type, stream type, buffer size and bitrates, then the setup
      if (config.tag === 4) {
        const info = desc(config.data + 13);
        if (info.tag === 5 && info.data + info.len <= stop) asc = Array.from(buf.subarray(info.data, info.data + info.len)).join(',');
      }
    }
  }
  return `${format}|${channels}|${rate}|${asc}`;
}

// "44.1 kHz stereo AAC" from an audioFormat() string, for messages.
function describeFormat(format) {
  const [, channels, rate, asc] = format.split('|');
  const kind = { 5: 'HE-AAC', 29: 'HE-AAC v2' }[Number(asc.split(',')[0]) >> 3] ?? 'AAC';
  const layout = { 1: 'mono', 2: 'stereo' }[channels] ?? `${channels}-channel`;
  return `${Number(rate) / 1000} kHz ${layout} ${kind}`;
}

// Reads one file's audio track: its sample tables, the byte ranges its audio sits in, and its cover art.
async function readTrack(file) {
  const tops = await topBoxes(file);
  const moovBox = tops.find((b) => b.type === 'moov');
  if (!moovBox) throw new NotJoinable(`${file.name} isn't an MP4 audio file.`);
  if (moovBox.size > MAX_INDEX) throw new NotJoinable(`${file.name} has an unusually large index.`);
  const buf = await readBytes(file, moovBox.start, moovBox.size);
  const moov = { start: 0, size: buf.length, header: moovBox.header };
  if (child(buf, moov, 'mvex')) throw new NotJoinable(`${file.name} is a fragmented MP4.`);

  const traks = kids(buf, moov).filter((k) => k.type === 'trak');
  const sound = traks.map((trak) => {
    const mdia = child(buf, trak, 'mdia');
    const hdlr = mdia && child(buf, mdia, 'hdlr');
    return hdlr && fourccAt(buf, body(hdlr) + 4) === 'soun' ? { trak, mdia } : null;
  }).filter(Boolean);
  if (sound.length !== 1) throw new NotJoinable(`${file.name} doesn't have exactly one sound track.`);
  const { mdia } = sound[0];
  const mdhd = child(buf, mdia, 'mdhd');
  const stbl = child(buf, child(buf, mdia, 'minf') ?? { start: 0, size: 0, header: 0 }, 'stbl');
  if (!mdhd || !stbl) throw new NotJoinable(`${file.name} is missing parts of its index.`);
  const timescale = u32At(buf, body(mdhd) + (buf[body(mdhd) - 4] === 1 ? 16 : 8));

  const get = (type) => child(buf, stbl, type);
  const stsd = get('stsd');
  const stts = get('stts');
  const stsc = get('stsc');
  const stsz = get('stsz');
  const stco = get('stco') ?? get('co64');
  if (!stsd || !stts || !stsc || !stsz || !stco) throw new NotJoinable(`${file.name} has an index this joiner doesn't handle.`);

  const timeRuns = [];
  let samples = 0;
  let duration = 0;
  for (let i = 0, n = u32At(buf, body(stts)); i < n; i++) {
    const count = u32At(buf, body(stts) + 4 + i * 8);
    const delta = u32At(buf, body(stts) + 8 + i * 8);
    timeRuns.push([count, delta]);
    samples += count;
    duration += count * delta;
  }

  const fixedSize = u32At(buf, body(stsz));
  const sizeCount = u32At(buf, body(stsz) + 4);
  if (sizeCount !== samples || samples === 0) throw new NotJoinable(`${file.name} has an index that doesn't add up.`);
  const sizes = new Uint32Array(samples);
  for (let i = 0; i < samples; i++) sizes[i] = fixedSize || u32At(buf, body(stsz) + 8 + i * 4);

  const wide = stco.type === 'co64';
  const chunkCount = u32At(buf, body(stco));
  const offsets = new Array(chunkCount);
  for (let i = 0; i < chunkCount; i++) offsets[i] = wide ? u64At(buf, body(stco) + 4 + i * 8) : u32At(buf, body(stco) + 4 + i * 4);

  const chunkRuns = [];
  for (let i = 0, n = u32At(buf, body(stsc)); i < n; i++) {
    const at = body(stsc) + 4 + i * 12;
    if (u32At(buf, at + 8) !== 1) throw new NotJoinable(`${file.name} switches audio format partway through.`);
    chunkRuns.push([u32At(buf, at), u32At(buf, at + 4)]);
  }

  // Samples per chunk, then the bytes each chunk covers; neighbouring chunks are merged into one range.
  const perChunk = new Uint32Array(chunkCount);
  chunkRuns.forEach(([first, count], k) => {
    const next = chunkRuns[k + 1]?.[0] ?? chunkCount + 1;
    for (let c = first; c < next && c <= chunkCount; c++) perChunk[c - 1] = count;
  });
  const ranges = [];
  let s = 0;
  for (let c = 0; c < chunkCount; c++) {
    let bytes = 0;
    for (let k = 0; k < perChunk[c]; k++) bytes += sizes[s++];
    const start = offsets[c];
    if (start + bytes > file.size) throw new NotJoinable(`${file.name} looks incomplete (its audio runs past the end).`);
    const last = ranges[ranges.length - 1];
    if (last && last[1] === start) last[1] += bytes; else ranges.push([start, start + bytes]);
  }
  if (s !== samples) throw new NotJoinable(`${file.name} has an index that doesn't add up.`);

  // Cover art, if any, from moov/udta/meta/ilst/covr, kept as the box it is.
  let cover = null;
  const udta = child(buf, moov, 'udta');
  const meta = udta && child(buf, udta, 'meta');
  const ilst = meta && child(buf, meta, 'ilst', metaSkip(buf, meta));
  const covr = ilst && child(buf, ilst, 'covr');
  if (covr) cover = buf.slice(covr.start, covr.start + covr.size);

  return {
    format: audioFormat(buf, stsd),
    stsd: buf.slice(stsd.start, stsd.start + stsd.size),
    timescale, timeRuns, duration, sizes, perChunk, chunkRuns, ranges, cover,
  };
}

// ---------- writing boxes ----------

const enc = new TextEncoder();
// Box type names are bytes; "©" is the single byte 0xA9 in iTunes tag names.
const type4 = (t) => Uint8Array.from(t, (ch) => ch.charCodeAt(0));

// Big-endian 32-bit values. Takes an array, so long tables never become function arguments
// (a million arguments would overflow the call stack).
function u32list(values) {
  const out = new Uint8Array(values.length * 4);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) dv.setUint32(i * 4, values[i] >>> 0);
  return out;
}
const u32s = (...values) => u32list(values);
const u16s = (...values) => {
  const out = new Uint8Array(values.length * 2);
  values.forEach((v, i) => { out[i * 2] = v >> 8; out[i * 2 + 1] = v & 0xff; });
  return out;
};
const u64 = (v) => u32s(Math.floor(v / 2 ** 32), v % 2 ** 32);

function box(type, ...parts) {
  const size = 8 + parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(type4(type), 4);
  let at = 8;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const full = (type, version, flags, ...parts) => box(type, Uint8Array.of(version, flags >> 16, (flags >> 8) & 0xff, flags & 0xff), ...parts);

const MATRIX = u32s(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);
const LANG_UND = u16s(0x55c4);

// Duration fields: version 1 boxes hold 64-bit values when the 32-bit ones would overflow.
const big = (v) => v > 0xffffffff;

function mvhd(durationMs, nextTrack) {
  const v = big(durationMs) ? 1 : 0;
  return full('mvhd', v, 0, v ? u64(0) : u32s(0), v ? u64(0) : u32s(0), u32s(1000), v ? u64(durationMs) : u32s(durationMs),
    u32s(0x10000), u16s(0x100), new Uint8Array(10), MATRIX, new Uint8Array(24), u32s(nextTrack));
}

function tkhd(id, flags, durationMs, volume) {
  const v = big(durationMs) ? 1 : 0;
  return full('tkhd', v, flags, v ? u64(0) : u32s(0), v ? u64(0) : u32s(0), u32s(id, 0), v ? u64(durationMs) : u32s(durationMs),
    new Uint8Array(8), u16s(0, 0, volume, 0), MATRIX, u32s(0, 0));
}

function mdhd(timescale, duration) {
  const v = big(duration) ? 1 : 0;
  return full('mdhd', v, 0, v ? u64(0) : u32s(0), v ? u64(0) : u32s(0), u32s(timescale), v ? u64(duration) : u32s(duration), LANG_UND, u16s(0));
}

const hdlr = (handler, name) => full('hdlr', 0, 0, u32s(0), type4(handler), new Uint8Array(12), enc.encode(`${name}\0`));
const dinf = () => box('dinf', full('dref', 0, 0, u32s(1), full('url ', 0, 1)));

function sampleTables(stsd, timeRuns, sizes, chunkRuns, offsets) {
  const stts = [];
  for (const [count, delta] of timeRuns) {
    const last = stts[stts.length - 1];
    if (last && last[1] === delta) last[0] += count; else stts.push([count, delta]);
  }
  const fixed = sizes.every((v) => v === sizes[0]) ? sizes[0] : 0;
  const sizeTable = fixed ? new Uint8Array(0) : new Uint8Array(sizes.length * 4);
  if (!fixed) { const dv = new DataView(sizeTable.buffer); sizes.forEach((v, i) => dv.setUint32(i * 4, v)); }
  const co64 = new Uint8Array(offsets.length * 8);
  const dv = new DataView(co64.buffer);
  offsets.forEach((v, i) => { dv.setUint32(i * 8, Math.floor(v / 2 ** 32)); dv.setUint32(i * 8 + 4, v % 2 ** 32); });
  return box('stbl', stsd,
    full('stts', 0, 0, u32s(stts.length), u32list(stts.flat())),
    full('stsc', 0, 0, u32s(chunkRuns.length), u32list(chunkRuns.flatMap(([first, count]) => [first, count, 1]))),
    full('stsz', 0, 0, u32s(fixed, sizes.length), sizeTable),
    full('co64', 0, 0, u32s(offsets.length), co64));
}

// The chapter track's sample description, as QuickTime and iTunes expect it (the same one ffmpeg writes).
const TEXT_ENTRY = box('text', new Uint8Array(6), u16s(1), Uint8Array.of(
  0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0x0d, 0x66, 0x74, 0x61, 0x62, 0, 1, 0, 1, 0));
const ENCD = Uint8Array.of(0, 0, 0, 0x0c, 0x65, 0x6e, 0x63, 0x64, 0, 0, 1, 0); // the text is UTF-8

// gmhd as ffmpeg writes it for a QuickTime text track.
const GMHD = box('gmhd', full('gmin', 0, 0, u16s(0x40, 0x8000, 0x8000, 0x8000, 0, 0)),
  box('text', u16s(1), u32s(0, 0, 0, 1, 0, 0, 0, 0x4000), u16s(0)));

function tag(name, data, kind = 1) {
  return box(name, box('data', u32s(kind, 0), data));
}

// ---------- joining ----------

/**
 * Joins `files` (in order) into one M4B Blob.
 * `chapters` is [{ first, title }]: the index of the file each chapter starts at, and its name.
 * Throws NotJoinable when the files can't be joined this way.
 */
export async function joinMp4Audio(files, { chapters = [], title = '', author = '' } = {}, progress) {
  const tracks = [];
  for (let i = 0; i < files.length; i++) {
    progress?.(`Reading ${files[i].name} (${i + 1} of ${files.length})…`, i / files.length);
    try {
      tracks.push(await readTrack(files[i]));
    } catch (e) {
      if (e?.name === 'NotFoundError' || e?.name === 'NotReadableError') {
        throw new Error(`The browser lost access to ${files[i].name}. If it's in iCloud Drive or another synced folder, download it first ("Download Now" in Finder), or copy the files to a folder that isn't synced, then add them again.`);
      }
      throw e;
    }
  }
  const first = tracks[0];
  const odd = tracks.findIndex((t) => t.format !== first.format || t.timescale !== first.timescale);
  if (odd > 0) {
    const a = describeFormat(first.format);
    const b = describeFormat(tracks[odd].format);
    throw new NotJoinable(`"${files[odd].name}" is ${b === a ? 'encoded with different AAC settings' : b}, but "${files[0].name}" is ${a}. Parts can only be stitched together when they all match.`);
  }

  // Joined sample tables, file after file.
  const timeRuns = tracks.flatMap((t) => t.timeRuns);
  const sizes = new Uint32Array(tracks.reduce((s, t) => s + t.sizes.length, 0));
  const chunkRuns = [];
  const fileStarts = [];
  let sampleAt = 0;
  let chunkBase = 0;
  let mediaTime = 0;
  for (const t of tracks) {
    sizes.set(t.sizes, sampleAt);
    sampleAt += t.sizes.length;
    for (const [firstChunk, count] of t.chunkRuns) {
      if (chunkRuns[chunkRuns.length - 1]?.[1] !== count) chunkRuns.push([firstChunk + chunkBase, count]);
    }
    chunkBase += t.perChunk.length;
    fileStarts.push(mediaTime);
    mediaTime += t.duration;
  }
  const { timescale } = first;
  const totalMs = Math.round((mediaTime / timescale) * 1000);

  // Each source chunk keeps its place inside its file's ranges; offsets are relative to the start of the audio.
  const chunkOffsets = [];
  const parts = [];
  let dataLen = 0;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    // The file's audio ranges go into the output in order; its chunks fill those ranges in the same order.
    const rangeStartOut = [];
    for (const [a, b] of t.ranges) { rangeStartOut.push(dataLen); parts.push(files[i].slice(a, b)); dataLen += b - a; }
    let s = 0;
    let r = 0;
    let posInRange = 0;
    for (let c = 0; c < t.perChunk.length; c++) {
      let bytes = 0;
      for (let k = 0; k < t.perChunk[c]; k++) bytes += t.sizes[s++];
      // An empty chunk at the very end has no range of its own; it points at the end of this file's audio.
      while (bytes && r < t.ranges.length && posInRange >= t.ranges[r][1] - t.ranges[r][0]) { r++; posInRange = 0; }
      chunkOffsets.push(r < t.ranges.length ? rangeStartOut[r] + posInRange : dataLen);
      posInRange += bytes;
    }
  }

  // Chapter text samples go after the audio, inside the same mdat.
  const marks = (chapters.length ? chapters : [{ first: 0, title: title || 'Chapter 1' }])
    .map((c) => ({ ms: Math.round((fileStarts[c.first] / timescale) * 1000), title: c.title }))
    .filter((c, i, all) => i === 0 || c.ms > all[i - 1].ms);
  const chapterSamples = marks.map((c) => { const text = enc.encode(c.title); return new Uint8Array([...u16s(text.length), ...text, ...ENCD]); });
  const chapterDurations = marks.map((c, i) => Math.max(1, (marks[i + 1]?.ms ?? totalMs) - c.ms));
  const chapterOffsets = [];
  for (const sample of chapterSamples) { chapterOffsets.push(dataLen); parts.push(sample); dataLen += sample.length; }

  const ftyp = box('ftyp', type4('M4B '), u32s(0), type4('M4B '), type4('M4A '), type4('mp42'), type4('isom'));

  const by = author.trim();
  const name = title.trim();
  const tags = [
    ...(name ? [tag('©nam', enc.encode(name)), tag('©alb', enc.encode(name))] : []),
    ...(by ? [tag('©ART', enc.encode(by)), tag('aART', enc.encode(by))] : []),
    tag('©gen', enc.encode('Audiobook')),
    tag('stik', Uint8Array.of(2), 21),
    ...(first.cover ? [first.cover] : []),
  ];
  const udta = box('udta', full('meta', 0, 0, full('hdlr', 0, 0, u32s(0), type4('mdir'), type4('appl'), new Uint8Array(8), Uint8Array.of(0)),
    box('ilst', ...tags)));

  const buildMoov = (dataStart) => box('moov',
    mvhd(totalMs, 3),
    box('trak',
      tkhd(1, 3, totalMs, 0x100),
      box('tref', box('chap', u32s(2))),
      box('mdia', mdhd(timescale, mediaTime), hdlr('soun', 'SoundHandler'),
        box('minf', full('smhd', 0, 0, u32s(0)), dinf(),
          sampleTables(first.stsd, timeRuns, sizes, chunkRuns, chunkOffsets.map((o) => o + dataStart))))),
    box('trak',
      tkhd(2, 0, totalMs, 0),
      box('mdia', mdhd(1000, totalMs), hdlr('text', 'Chapters'),
        box('minf', GMHD, dinf(),
          sampleTables(full('stsd', 0, 0, u32s(1), TEXT_ENTRY), chapterDurations.map((d) => [1, d]),
            Uint32Array.from(chapterSamples, (c) => c.length), [[1, 1]], chapterOffsets.map((o) => o + dataStart))))),
    udta);

  // The index goes before the audio so players can start without reading to the end. Its size doesn't
  // depend on the offsets it holds (they are all 64-bit), so build it once to measure, then for real.
  const moovSize = buildMoov(0).length;
  const dataStart = ftyp.length + moovSize + 16;
  const moov = buildMoov(dataStart);
  const mdatHeader = new Uint8Array([...u32s(1), ...type4('mdat'), ...u64(16 + dataLen)]);
  progress?.('Joining…', 1);
  return {
    blob: new Blob([ftyp, moov, mdatHeader, ...parts], { type: 'audio/mp4' }),
    duration: mediaTime / timescale,
    chapters: marks.length,
  };
}
