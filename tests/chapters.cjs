const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('js/chapters.js', 'utf8').replace(/^export /gm, '');
const { trackNumber, chapterPlan } = new Function(`${source};return { trackNumber, chapterPlan };`)();
// The order the Join tool puts dropped files in (app.js).
const sortNames = (names) => [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const firsts = (plan) => plan.map((c) => c.first);

// Track numbers: the "Track N" label wins over the prefix; prefixes are the fallback.
assert.equal(trackNumber('001-001 Track 1.m4b'), 1);
assert.equal(trackNumber('014-014 Track 3.m4b'), 3);
assert.equal(trackNumber('001-012 Track 10.m4b'), 10);
assert.equal(trackNumber('003 Track 01.m4a'), 1);
assert.equal(trackNumber('Track_07.mp3'), 7);
assert.equal(trackNumber('02-03 Intro.mp3'), 3);
assert.equal(trackNumber('1-01 Prologue.m4a'), 1);
assert.equal(trackNumber('07 Intro.mp3'), 7);
assert.equal(trackNumber('Soundtrack Suite.mp3'), null);
assert.equal(trackNumber('Intro.mp3'), null);

// A book of 139 files whose track numbering starts over at Track 1 in every chapter.
const sizes = [6, 9, 5, 8, 7, 7, 6, 10, 4, 8, 7, 9, 6, 8, 7, 5, 9, 8, 10]; // 139 tracks in 19 chapters
assert.equal(sizes.reduce((a, b) => a + b), 139);
const expected = sizes.map((_, k) => sizes.slice(0, k).reduce((a, b) => a + b, 0));
const shuffle = (a) => a.map((v) => [Math.sin(v.length * 7919 + v.charCodeAt(4) * 31 + v.charCodeAt(6)), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const variants = {
  // Running number twice, then the track label: 001-001 Track 1 … 007-007 Track 1.
  running: (i, k, t) => `${String(i + 1).padStart(3, '0')}-${String(i + 1).padStart(3, '0')} Track ${t}.m4b`,
  // Chapter, then running number: 001-001 Track 1 … 002-007 Track 1.
  chapterRunning: (i, k, t) => `${String(k + 1).padStart(3, '0')}-${String(i + 1).padStart(3, '0')} Track ${t}.m4b`,
  // Chapter, then track in chapter: 001-001 Track 1 … 002-001 Track 1.
  chapterTrack: (i, k, t) => `${String(k + 1).padStart(3, '0')}-${String(t).padStart(3, '0')} Track ${t}.m4b`,
};
for (const [label, nameOf] of Object.entries(variants)) {
  const names = [];
  sizes.forEach((size, k) => { for (let t = 1; t <= size; t++) names.push(nameOf(names.length, k, t)); });
  const sorted = sortNames(shuffle(names));
  assert.deepEqual(sorted, names, `${label}: numeric prefixes put the files back in order`);
  const plan = chapterPlan(sorted, 'resets');
  assert.equal(plan.length, 19, `${label}: one chapter per reset to Track 1`);
  assert.deepEqual(firsts(plan), expected, `${label}: chapters start at each Track 1`);
  assert.deepEqual(plan.map((c) => c.title), sizes.map((_, k) => `Chapter ${k + 1}`));
  // The other choices are unchanged: one chapter per file.
  assert.equal(chapterPlan(sorted, 'numbered').length, 139);
  assert.equal(chapterPlan(sorted, 'numbered')[138].title, 'Track 139');
  assert.equal(chapterPlan(sorted, 'filename')[0].title, sorted[0].replace(/\.m4b$/, ''));
}

// Track 10 and Track 11 are not resets; a one-track chapter (Track 1 straight after Track 1) is.
assert.deepEqual(firsts(chapterPlan(['001 Track 1', '002 Track 2', '003 Track 10', '004 Track 11', '005 Track 1', '006 Track 1', '007 Track 2'], 'resets')), [0, 4, 5]);
// A missing Track 1 still counts as numbering starting over.
assert.deepEqual(firsts(chapterPlan(['01 Track 1', '02 Track 2', '03 Track 3', '04 Track 2', '05 Track 3'], 'resets')), [0, 3]);
// No resets at all: the whole book is one chapter.
assert.equal(chapterPlan(['Track 1', 'Track 2', 'Track 3'], 'resets').length, 1);
// A name without any number is reported by name.
assert.throws(() => chapterPlan(['001 Track 1', 'Bonus.m4b'], 'resets'), /"Bonus\.m4b" has no track number/);

console.log('Passed: track numbers from names, numeric-prefix ordering of 139 files, chapters at every Track 1 reset (3 naming styles), numbered/filename options unchanged.');
