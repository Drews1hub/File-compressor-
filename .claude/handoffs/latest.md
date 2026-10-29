# Handoff: FileFit converters (2026-10-29)

**Goal:** Free in-browser file compressor, converter and toolkit called FileFit. Nothing is uploaded; everything runs in the browser. Repo `Drews1hub/File-compressor-`, static site on GitHub Pages.

**Done** (branch `claude/great-wright-qym051`, head `eb917b4`):
- Tab icon: `favicon.svg`, linked from `index.html` (`4459467`).
- M4B audiobook output for audio and video (`c083d35`). Also accepted as input; trim keeps M4B.
- Overall progress ring above the file list, green at 100%, engine download excluded (`ff13d1c`).
- OCR (English): scanned PDF/photo → searchable PDF or TXT. `js/ocr.js`, vendored `vendor/tesseract/` (`586969d`).
- E-books: EPUB/MOBI/AZW/AZW3/FB2 → EPUB/PDF/HTML/TXT; text/MD/HTML/text PDF → EPUB. `js/ebook.js`, `vendor/mobi-parser.mjs` (`e96d64a`).
- CAD: DXF → SVG/PNG/PDF; DWG → DXF/SVG/PNG/PDF; STEP/IGES/BREP/STL/OBJ → STL/OBJ/PNG preview. `js/cad.js` (`0cb5963`, `53d4a17` adds DWG via LibreDWG).
- Audio speed: audio-only jobs under 150 MB run 3 at a time; each job has its own ffmpeg engine; cancel stops only its row. 6×1-min WAV → M4B went ~20 s → ~7 s (`eb917b4`).
- Live: `claude/wonderful-hypatia-9g13bo` (GitHub Pages source) was fast-forwarded to `53d4a17`. Live site has OCR, e-books, CAD, DWG and the progress ring. **Not** live: `eb917b4` (parallel audio).
- All conversions tested in headless Chromium with real sample files (Gutenberg EPUB/MOBI/KF8, occt test STEP, dxf/dwg samples). Mixed UI batch passes; cancel and video regression checks pass.

**Decisions:**
- Keep system font stack, no outside CDNs. Repo not renamed.
- Ship the GPL-3.0 LibreDWG part (`vendor/libredwg/`, license in `vendor/LICENSE-libredwg`). Removable by reverting `53d4a17`'s DWG bits.
- No PR opened; user has not asked for one. Live-branch updates were approved for the feature set up to `53d4a17` only.
- Parallel audio only for audio-only jobs; video/other stay serial for memory.
- Browser AAC (WebCodecs) rejected for now: headless Chromium here can't encode AAC, so it can't be verified.

**Open:**
- Ask user to say "push it live" to publish `eb917b4` to `claude/wonderful-hypatia-9g13bo`.
- Known gaps: no MOBI/AZW3 output; no DXF→DWG; e-book PDF is text-only; CAD pictures omit text labels; DWG reader can miss some shapes; OCR is English only; DRM Kindle books refused.
- Not tested: real e-reader/Kindle opening of outputs; Safari; real Chrome folder-save prompt.
- Untested: EPUB/OCR with very large files; parallel jobs on machines with fewer cores.

**Where things live:**
- Code: `app.js` (queue, rows, cancel), `js/engine.js` (ffmpeg per job), `js/convert.js` (targets per type), `js/ocr.js`, `js/ebook.js`, `js/cad.js`, `js/tools.js`, `js/compress.js`.
- Vendored libs: `vendor/` (license texts `vendor/LICENSE-*`); README has the full list.
- Test scripts and samples: session scratchpad only (lost when container ends): `/tmp/claude-0/-home-user-File-compressor-/9a7911cf-d1ba-55f8-a608-33da232e38b3/scratchpad/`.
- Local test server: `python3 -m http.server 8765` in repo root.
