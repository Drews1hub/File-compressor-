# Handoff: File Squeeze (2026-10-29)

**Goal:** Free in-browser file compressor, converter and toolkit (photos, video, audio, PDFs, Office, text, archives). Nothing is uploaded. Default target 30 MB (Claude's upload limit). Features modelled on compress2go.com and tangerineformac.com, but with our own names, wording, layout and design (the user asked not to copy too closely).

**Done** (branch `claude/wonderful-hypatia-9g13bo`, repo `Drews1hub/File-compressor-`, latest commit `5842644`):
- Live at https://drews1hub.github.io/File-compressor-/ (GitHub Pages from this branch, `/ (root)`).
- Tabs: **Compress**, **Convert**, **Tools**, **Zip**.
  - Compress: goal = Fit a size (MB/KB, presets Claude 30 / Email 25 / Discord 10), Pick a strength (Light/Balanced/Strong), or Shrink by %. More options: photo format (auto keeps transparency via WebP), max photo size, max video resolution, remove sound.
  - Convert: images, video, audio, PDF (see `js/convert.js`).
  - Tools (`js/tools.js`): trim video/audio (exact cut default), merge PDFs, split PDF, photos → PDF, rotate/flip/resize photos, open ZIP/TAR.GZ.
  - Zip: ZIP or TAR.GZ, keeps dropped folder structure (`js/archive.js`).
- Every row: Cancel (any job) and ✕ (remove from list). "Download all as ZIP", "Clear list". Settings saved in localStorage.
- Code: `app.js` (UI + queue), `js/compress.js`, `js/convert.js`, `js/tools.js`, `js/engine.js` (ffmpeg.wasm wrapper), `js/images.js`, `js/pdf.js`, `js/util.js`, `js/archive.js`. Vendored libs in `vendor/` (pdf.js, jsPDF, fflate, heic2any, ffmpeg.wasm 0.12.x, pdf-lib). License notes in `vendor/LICENSE-*`.
- Engine safety: start (download + load) times out after 90 s; any ffmpeg run silent for 120 s fails with a message; engine is shut down after every job; Cancel releases the queue even if a job is stuck.

**Decisions:**
- No PR opened; user hasn't asked for one.
- Jobs run one at a time on purpose (memory).
- No custom domain; user is fine with the GitHub Pages URL.
- Features copied only at the level of functionality; wording and visual design are our own.

**Open:**
- **Unresolved bug:** user reports that dropping many audio files at once (e.g. a folder of WMA tracks, 3.3 MB each) leaves the oldest row stuck, while a single track converts instantly. Could not reproduce here (batches of 14 files, 10-minute WMA, all WMA variants all work). Mitigations shipped in `5842644`; user has not yet confirmed. Next step: ask the user for the stuck row's exact status text and any red browser-console errors (F12 → Console), or for a sample file.
- Earlier WMA file "Track 1.wma" was waiting behind the stuck one.
- Safari not tested (only Chromium available here). User is on Chrome.
- Folder drop into Zip tab not tested with a real folder (headless can't simulate it).
- PDF compression rasterizes pages, so text is no longer selectable. Possible improvement: keep text (pdf-lib is vendored).
- Possible next from Tangerine: spreadsheets (XLSX↔CSV↔JSON), subtitles (SRT↔VTT), docs (DOCX→text/HTML/MD), then our own quick format picker (not a copy of Tangerine's radial wheel).

**Where things live:**
- Repo: `/home/user/File-compressor-` (clean at handoff).
- Test scripts and sample files were in the session scratchpad (`/tmp/claude-0/-home-user-File-compressor-/1218ab51-81f4-40bc-b9e6-14c0a36866a3/scratchpad/test`); lost when the container ends.
- Network access: compress2go.com, www.compress2go.com, tangerineformac.com, www.tangerineformac.com are allowed in the environment settings.
