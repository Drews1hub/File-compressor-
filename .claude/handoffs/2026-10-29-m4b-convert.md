# Handoff: FileFit, M4B conversion issue (2026-10-29)

**Goal:** FileFit is a free in-browser file compressor and converter (nothing is uploaded). The user converted an audiobook to M4B on the Convert tab, got MP3 back, and wants M4B. They also want that M4B to open in Apple Books.

**Done** (branch `claude/clever-edison-ad8mje`, repo `Drews1hub/File-compressor-`):
- Added the PC Tech Magazine converters article as a reference: `docs/reference/best-online-file-converters-2026.pdf`, commit `b7ecbe7`, pushed. No PR opened.
- Checked the hosting: GitHub Pages at https://drews1hub.github.io/File-compressor-/. No custom domain is configured (no `CNAME` file in the repo).
- Checked the M4B command natively with system ffmpeg: `-c:a aac -b:a 128k -f ipod` produces a valid M4B. The encoder itself is fine.

**Findings (from code reading, not yet confirmed in the browser):**
- Likely cause of the MP3 result: `app.js:320-322`. The top "Convert to" menu (`#convert-to`) is saved in localStorage with the other settings. If it was set to MP3 earlier, each dropped file starts converting to MP3 immediately, before the user picks M4B in the row's menu.
- The top menu defaults to "Choose for each file", so this only happens if it was changed at some point.
- Compress tab: audio always outputs `-compressed.mp3` (`js/compress.js:133`). M4B is not an option there.
- Apple Books on macOS High Sierra (10.13) only takes ebooks (EPUB, PDF). It rejects M4B. Audiobooks go in iTunes on High Sierra. The user said they don't want Books or iTunes, and that they "want it in Books", which can't be done.

**Decisions:**
- None made in code yet. The user has not chosen between:
  - **A:** stop auto-starting. Each row waits for the user to press Convert.
  - **B:** keep auto-start, but only when the user picks a format at the top during the current visit.
  - Recommended: A. Also offered: a "Convert all" button for batches. Undecided.

**Open:**
- Next step: confirm the MP3 cause. Ask the user to set the top menu to "Choose for each file", drop the same file, and check whether the row waits. If it does, implement the chosen option in `app.js` (`convertFile`, around line 320).
- The user needs an answer on what they want in Books. Nothing in FileFit can make an M4B open in Apple Books on High Sierra. Options given: QuickTime Player to listen on the Mac, or an iPhone audiobook app such as Smart AudioBook Player.
- Older open item from the previous session: dropping many WMA files at once can leave the oldest row stuck. Needs the status text and console errors from the user.

**Where things live:**
- Repo: `/home/user/File-compressor-`. Convert logic: `js/convert.js` (`AUDIO_ARGS`, `TARGETS`, `convertMedia`). Row picker and auto-start: `app.js` (`convertFile`). Audio compress: `js/compress.js`. The engine is ffmpeg.wasm in `js/engine.js`.
- Reference PDF: `docs/reference/best-online-file-converters-2026.pdf`.
- Earlier handoffs (other branch, `claude/wonderful-hypatia-9g13bo`): `.claude/handoffs/2026-10-29-filefit-redesign.md`.
