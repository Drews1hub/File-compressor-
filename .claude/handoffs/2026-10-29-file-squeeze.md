# Handoff: File Squeeze (2026-10-29)

**Goal:** Free in-browser file compressor + converter (images, video, audio, PDFs, Office, text). Nothing is uploaded to a server. Default target 30 MB (Claude's upload limit).

**Done** (branch `claude/wonderful-hypatia-9g13bo`, repo `Drews1hub/File-compressor-`):
- Static site: `index.html`, `styles.css`, `app.js` (UI), modules in `js/` (`compress.js`, `convert.js`, `engine.js`, `images.js`, `pdf.js`, `util.js`).
- Two tabs: **Compress** (fit under target MB; presets Claude 30 / Email 25 / Discord 10) and **Convert** (global "Convert to" select, or per-file picker).
- Compress: images → JPEG (incl. HEIC via heic2any, TIFF via ffmpeg); video → H.264 MP4 at computed bitrate, ≤30 fps, auto-downscale, `superfast` preset, up to 3 retries; audio → MP3; PDF rasterize; Office media shrink; text split; other → zip.
- Convert: image ↔ jpg/png/webp/gif/bmp/tiff/pdf; video ↔ mp4/webm/mov/mkv/avi/gif + audio extract; audio ↔ mp3/wav/m4a/ogg/flac/opus; PDF → jpg/png (zip) / txt. Stream copy when codecs fit.
- ffmpeg.wasm 0.12 (single-thread, no COOP/COEP needed) vendored in `vendor/ffmpeg*`; 32 MB core lazy-downloaded with a progress bar; files mounted via WORKERFS (no memory copy). Cancel button for video/audio jobs.
- All paths tested headless in Chromium (30 s 1080p clip → 10 MB in ~55 s; rotated iPhone HEVC .mov comes out upright).

**Decisions:**
- Hosting via GitHub Pages from this branch, `/ (root)`. Live at https://drews1hub.github.io/File-compressor-/
- User has no custom domain; suggested renaming repo to `drews1hub.github.io` for a shorter URL (not done).
- No PR (user hasn't asked).
- compress2go.com was used as a reference from memory (blocked by session network policy).

**Open / ideas:**
- User should hard-refresh the live site and try real files (their 45.9 MB PDF, phone videos).
- Video encoding is single-threaded: long/4K videos are slow. Multi-thread core would need COOP/COEP (e.g. coi-serviceworker) — not done.
- Possible next: combine many images into one PDF, video trim, quality slider, docx → PDF.

**Where things live:** test files/scripts were in the session scratchpad (lost when container ends).
