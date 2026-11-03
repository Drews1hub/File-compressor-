const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const fflate = require('../vendor/fflate.min.js');
function unpack(input, format, limit) {
  let response;
  const context = { Uint8Array, Error, Number, Object, fflate, importScripts() {}, self: { postMessage(data) { response = data; } } };
  let source = fs.readFileSync('js/unpack-worker.js', 'utf8');
  if (limit) source = source.replace('256 * 1024 * 1024', String(limit));
  vm.runInNewContext(source, context);
  context.self.onmessage({ data: { buffer: input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), format } });
  return response;
}
const archive = fflate.zipSync({ 'hello.txt': fflate.strToU8('hello'), 'folder/test.txt': fflate.strToU8('world') });
let r = unpack(archive, 'zip');
assert.equal(fflate.strFromU8(r.result['hello.txt']), 'hello');
assert.equal(fflate.strFromU8(r.result['folder/test.txt']), 'world');
r = unpack(zlib.gzipSync(Buffer.from('hello')), 'gzip');
assert.equal(Buffer.from(r.result.data).toString(), 'hello');
for (const format of ['zip', 'gzip']) {
  const bytes = new Uint8Array(10000);
  const compressed = format === 'zip' ? fflate.zipSync({ 'large.txt': bytes }) : zlib.gzipSync(bytes);
  assert.match(unpack(compressed, format, 1024).error, /safety limit/);
}
const entries = Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [String(i), new Uint8Array()]));
assert.match(unpack(fflate.zipSync(entries), 'zip').error, /entry safety limit/);
const src = fs.readFileSync('js/tools.js', 'utf8');
const readTar = new Function('TextDecoder', src.slice(src.indexOf('export function readTar'), src.indexOf('export async function extractArchive')).replace('export ', '') + ';return readTar;')(TextDecoder);
const tar = new Uint8Array(1536); tar[0] = 97; tar[156] = 48;
tar.set(new TextEncoder().encode('00000000005'), 124); tar.set(new TextEncoder().encode('hello'), 512);
assert.equal(new TextDecoder().decode(readTar(tar)[0].data), 'hello');
for (const size of ['-0000001000', '00000010000', 'garbage']) {
  tar.fill(0, 124, 136); tar.set(new TextEncoder().encode(size), 124);
  assert.throws(() => readTar(tar), /invalid|Invalid|Truncated/);
}
console.log('Passed: ZIP/GZIP round trips, expanded size limits, entry count limit, valid TAR, negative/oversized/invalid TAR sizes.');
