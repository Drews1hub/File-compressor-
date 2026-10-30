// Where the chapters of a joined audiobook begin. No imports, so the rules can be tested without a browser.

// The track number in a file name: the number after "Track" if there is one (001-003 Track 3 → 3),
// else the second of two leading numbers (02-03 Intro → 3), else a lone leading number (07 Intro → 7).
export function trackNumber(name) {
  const label = name.replace(/\.[^.]*$/, '');
  const m = /\btrack\s*[-_#.]?\s*(\d+)(?!\d)/i.exec(label)
    ?? /^\s*\d+\s*[-_.]\s*(\d+)(?!\d)/.exec(label)
    ?? /^\s*(\d+)(?!\d)/.exec(label);
  return m ? Number(m[1]) : null;
}

// One entry per chapter: the index of its first file and its title. 'resets' starts a new chapter wherever the
// track numbering starts over (Track 6 followed by Track 1); 'filename' and 'numbered' give every file its own chapter.
export function chapterPlan(names, mode) {
  if (mode !== 'resets') {
    return names.map((name, i) => ({ first: i, title: mode === 'filename' ? name.replace(/\.[^.]*$/, '') : `Track ${i + 1}` }));
  }
  const nums = names.map(trackNumber);
  const missing = nums.indexOf(null);
  if (missing >= 0) {
    throw new Error(`"${names[missing]}" has no track number, so the chapter breaks can't be found. Choose another option under Chapter names.`);
  }
  const plan = [];
  nums.forEach((n, i) => {
    if (i === 0 || n <= nums[i - 1]) plan.push({ first: i, title: `Chapter ${plan.length + 1}` });
  });
  return plan;
}
