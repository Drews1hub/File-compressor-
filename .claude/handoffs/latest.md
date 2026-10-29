# Handoff: join CDs into one audiobook (2026-10-29)

**Goal:** FileFit is a free in-browser file compressor and converter (nothing is uploaded). The user wants to combine the tracks from several audiobook CDs into one audiobook, so they don't have to switch discs. Dropping the files in should produce a single M4B that plays straight through from the first track to the last.

**Done:** Nothing in code yet. This session only set the goal.

**Decisions:**
- The output is one M4B, with the tracks joined in the order the user sets. Nothing is split or re-chaptered unless the user asks.
- Earlier M4B work is already on the branch (`c083d35`, `js/convert.js` `m4b` args with `-f ipod`). Reuse it, don't rebuild it.

**Open:**
- Design questions to ask the user before coding:
  1. How should the files be picked? Options: a "Join into one audiobook" action on a multi-file selection, or a checkbox per row with a join button.
  2. Track order: by file name (CD1 track 01, CD1 track 02, CD2 track 01...), or by the order dropped? Name order is the likely default, and the user can reorder.
  3. Chapter markers: keep one chapter per source file, or none?
- Likely approach: ffmpeg concat (the concat demuxer or the concat filter) with the same AAC 128k args, run in the existing ffmpeg.wasm engine (`js/engine.js`). Put the join logic in `js/convert.js` and the UI in `app.js`.
- Carried over from the previous session, still open:
  - MP3 instead of M4B: `app.js` `convertFile` (around line 320) auto-starts conversion using the top "Convert to" setting saved in localStorage. Options: (A) wait for the user to press Convert per row (recommended), or (B) auto-start only for a format picked during the current visit.
  - Apple Books on High Sierra only takes EPUB and PDF, not M4B. This can't be solved in FileFit. Suggest QuickTime or an iPhone audiobook app.
  - Dropping many WMA files at once can leave the oldest row stuck. Needs status text and console errors from the user.

**Where things live:**
- Repo: `/home/user/File-compressor-`, branch `claude/clever-edison-ad8mje`, pushed.
- Convert logic: `js/convert.js` (`AUDIO_ARGS`, `TARGETS`, `convertMedia`). Row picker and auto-start: `app.js` (`convertFile`). Audio compress: `js/compress.js`. Engine: ffmpeg.wasm in `js/engine.js`, with the vendored build in `vendor/ffmpeg-core/`.
- Previous handoff (M4B issue): `.claude/handoffs/2026-10-29-m4b-convert.md`.
- Reference PDF: `docs/reference/best-online-file-converters-2026.pdf`.
