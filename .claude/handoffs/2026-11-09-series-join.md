# Handoff: joining the Marcus Ryker series (2026-11-09)

**Goal:** FileFit is a free in-browser file converter (nothing is uploaded; keep it that way, the user asked for no personal data to be collected). The user, on a Mac with 48 GB RAM and Chrome, makes audiobooks for iTunes. Current task: join a series of M4B books into one file (Tools → Join audiobook, "One file"), e.g. "Marcus Ryker Series.m4b", 3350 MB, six books.

**Done** (all live; PRs #9 to #17 in `Drews1hub/File-compressor-`; working branch == live branch):
- Drop files anywhere on the page (`app.js`, `activeDrop`).
- "Number files" unticked by default, not saved; "Remove numbers from the front of file names" box (`#strip-numbers`, saved) strips names and title tags (`withoutNumber` in `js/util.js`).
- Separate tracks handles files over 100 MB one at a time (`workersFor` in `js/tools.js`).
- Crash messages keep the real error (`js/engine.js`): "Ran out of memory" only for memory errors; otherwise "The converter stopped unexpectedly", with ffmpeg's last lines.
- **New stitch joiner** `js/mp4join.js`: joins M4B/M4A parts (same AAC format) by reading only each file's index and stitching the audio as Blob slices. Writes chapters (QuickTime chapter track), audiobook tags, cover art. Tested byte-identical to ffmpeg concat at 584 MB and 3.5 GB; ffprobe and full decode OK. Not tested in iTunes or Apple Books.
- Mismatched parts: `joinAudiobook` in `js/tools.js` tries the stitch first. If refused, the reason names the file and both formats (e.g. "22.05 kHz stereo AAC" vs "44.1 kHz stereo AAC"). Over 1 GB it stops with that reason; under 1 GB it falls back to the ffmpeg join.
- Cache tags: `engine.js?v=20261104-engine-v` (must match in all 5 importers), `mp4join.js?v=20261105-why-refused`, app/index tag `20261105-why-refused`.

**Decisions:**
- No DRM stripping: Audible files (aax, aaxc, aa) are not supported and won't be built.
- Keep the live site's "Chapters where track numbering resets" and FAQ page; no separate Track 1 option.
- Don't restyle the "Remove numbers" box: the user likes it.
- Only merge to the live site when the user says "ship it".
- The user is fine with converting odd-format books to match, if they'd like to, but wants to be told the quality trade-off first.

**Open:**
- Series mismatch: the user's series has mixed AAC settings (Book 1 22.05 kHz stereo; Book 3 44.1 kHz stereo). The error names only the first mismatch. Next step, if the user says so: list every mismatched book (extend the refusal to report all of them). Options then: (a) "Separate tracks" (works now, no quality loss); (b) re-encode odd books up to 44.1 kHz stereo, then stitch (one extra lossy pass; upsampling adds no detail; it's the ffmpeg path, which may hit memory limits at this size, so test one book first).
- Series is one chapter per book; the user may want each book's own chapters kept (not built).
- Book 5 ("Libyan Diversion") earlier stalled with ffmpeg "memory access out of bounds". The stitch joiner should avoid that, but the user hasn't confirmed it on Book 5 yet.
- Unconfirmed in iTunes / Apple Books: the stitched M4B's chapters and cover.
- Older: WMA batch stuck row; AAC copy join adds ~0.02 s at each join.

**Where things live:**
- Repo `/home/user/File-compressor-`, working branch `claude/clever-edison-ad8mje`. Default branch `claude/wonderful-hypatia-9g13bo` serves GitHub Pages: https://drews1hub.github.io/File-compressor-/
- To ship: merge the default branch into the working branch, push, open a PR into the default branch, merge it. Check the live site after; if Pages sticks in "queued", a small version-tag change starts a fresh publish (happened on PR #14).
- Tests: `npm ci` then `npm test`. Browser checks: Playwright (`NODE_PATH=$(npm root -g)`) against `python3 -m http.server`. Test files live in `/tmp/claude-0/t/` (series, chap2, chap3, big, mixbig, mp3). Don't use `pkill -f` with a pattern that appears in your own command (exit 144); use `[h]ttp.server`.
- Tool tabs use cards (`data-tool-choice`), not the hidden `#tool` select.
