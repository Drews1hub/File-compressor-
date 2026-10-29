# Handoff: File Squeeze + brand skills (2026-10-29)

**Goal:** Free in-browser file compressor + converter (images, video, audio, PDFs, Office, text). Nothing is uploaded to a server. Default target 30 MB (Claude's upload limit).

**Done** (branch `claude/wonderful-hypatia-9g13bo`, repo `Drews1hub/File-compressor-`):
- Static site: `index.html`, `styles.css`, `app.js` (UI), modules in `js/` (`compress.js`, `convert.js`, `engine.js`, `images.js`, `pdf.js`, `util.js`).
- Three tabs: **Compress** (goal = Fit a size in MB/KB with presets, Pick a strength Light/Balanced/Strong, or Shrink by %; More options: photo format auto/jpg/webp, photo max side, video max res, remove sound), **Convert** (global "Convert to" select, or per-file picker), **Zip** (ZIP or TAR.GZ, keeps dropped folder structure, `js/archive.js`).
- **Tools** tab (`js/tools.js`, pdf-lib vendored and lazy-loaded): trim video/audio (exact cut by default, optional quick stream-copy cut), merge PDFs (reorderable list), split PDF (every page / ranges), photos → one PDF (fit/A4/Letter), rotate/flip/resize photos, open ZIP/TAR.GZ. Inspired by tangerineformac.com (Mac app): its file tools, not its radial-wheel UI.
- "Download all as ZIP" + "Clear list" under the tabs; settings saved in localStorage.
- Feature set modelled on compress2go.com (features only; own names, wording, layout, colors — user asked not to copy so closely it could cause trouble).
- Compress: images → JPEG (incl. HEIC via heic2any, TIFF via ffmpeg); video → H.264 MP4 at computed bitrate, ≤30 fps, auto-downscale, `superfast` preset, up to 3 retries; audio → MP3; PDF rasterize; Office media shrink; text split; other → zip.
- Convert: image ↔ jpg/png/webp/gif/bmp/tiff/pdf; video ↔ mp4/webm/mov/mkv/avi/gif + audio extract; audio ↔ mp3/wav/m4a/ogg/flac/opus; PDF → jpg/png (zip) / txt. Stream copy when codecs fit.
- ffmpeg.wasm 0.12 (single-thread, no COOP/COEP needed) vendored in `vendor/ffmpeg*`; 32 MB core lazy-downloaded with a progress bar; files mounted via WORKERFS (no memory copy). Cancel button for video/audio jobs.
- All paths tested headless in Chromium (30 s 1080p clip → 10 MB in ~55 s; rotated iPhone HEVC .mov comes out upright).

**Decisions:**
- Hosting via GitHub Pages from this branch, `/ (root)`. Live at https://drews1hub.github.io/File-compressor-/
- User has no custom domain; suggested renaming repo to `drews1hub.github.io` for a shorter URL (not done).
- No PR (user hasn't asked).
- Network access was opened up by the user; compress2go.com and tangerineformac.com were both reviewed. Recommended order for next Tangerine-inspired work: spreadsheets & subtitles conversion (SheetJS, SRT↔VTT), then documents (DOCX→text/HTML/MD via mammoth), then our own quick format picker (not a copy of Tangerine's radial wheel).

**Open / ideas:**
- User should hard-refresh the live site and try real files (their 45.9 MB PDF, phone videos).
- Video encoding is single-threaded: long/4K videos are slow. Multi-thread core would need COOP/COEP (e.g. coi-serviceworker) — not done.
- Folder drop into Zip tab not tested with a real folder (headless can't simulate it).
- Possible next: spreadsheets/subtitles/docs conversions (above), PDF compression that keeps text selectable (pdf-lib is now vendored, could recompress embedded images).

**Where things live:** test files/scripts were in the session scratchpad (lost when container ends).

## Brand skills rebuild (branch `claude/nice-ptolemy-gx39vn`)

- Both www.apple.com and www.dji.com resolved and returned 200. The `apple` and `dji` skills were rebuilt from the live sites into `brand-skills/` (sources), with uploadable `brand-skills/dist/apple.zip` and `brand-skills/dist/dji.zip`. `brand-skills/README.md` lists what changed.
- The installed skills are synced from claude.ai and are **not** updated yet. The user needs to upload the zips.
- Apple: fully measured (computed styles plus the site's `--sk-*` variables). Main fix: "Learn more" is the filled pill and "Buy" is the outline pill.
- DJI: after the user allowed `www-cdn.djiits.com`, the capture was re-run with CSS loaded and the DJI skill was rebuilt from measured values. Main corrections: chevron-link / white-outline CTAs (not blue pills), square tiles, wordmark images, and placeholder colors are not a palette.
