const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
const { document } = parseHTML('<!doctype html><html><body></body></html>');
const source = fs.readFileSync('js/sanitize.js', 'utf8').replace('export function', 'function');
const sanitize = new Function('document', source + ';return sanitizeBookHtml;')(document);
const dirty = '<h1 id="chapter">Title</h1><p>Hello <em>world</em></p>' +
  '<script>alert(1)</script><iframe srcdoc="bad"></iframe><svg onload="bad()"></svg>' +
  '<img src="data:image/png;base64,aA==" onerror="bad()" srcset="https://tracker.invalid/x">' +
  '<img src="https://tracker.invalid/x"><img src="data:image/svg+xml;base64,aA==">' +
  '<a href="javascript:bad()" onclick="bad()">bad</a><a href="https://example.com">good</a>' +
  '<a href="#chapter">chapter</a><table><tr><td colspan="2">cell</td></tr></table>';
const result = sanitize(dirty);
assert.doesNotMatch(result, /script|iframe|svg|onerror|onclick|srcset|tracker|javascript:/i);
assert.match(result, /<em>world<\/em>/);
assert.match(result, /id="chapter"/);
assert.match(result, /href="#chapter"/);
assert.match(result, /href="https:\/\/example.com"/);
assert.match(result, /data:image\/png;base64,aA==/);
assert.match(result, /colspan="2"/);
assert.equal(sanitize(result), result);
console.log('Passed: active markup/remote images removed; headings, text, links, tables and raster images retained; sanitizer idempotent.');
