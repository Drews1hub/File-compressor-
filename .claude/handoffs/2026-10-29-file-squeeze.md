# Handoff: File Squeeze (2026-10-29)

**Goal:** Free in-browser file compressor that shrinks files to under 30 MB so the user can upload them to Claude. Nothing is uploaded to a server.

**Done** (branch `claude/wonderful-hypatia-9g13bo`, repo `Drews1hub/File-compressor-`):
- Static site: `index.html`, `styles.css`, `app.js`, `README.md`, `.nojekyll`.
- Libraries copied into `vendor/` (pdf.js legacy, jsPDF, fflate), no CDN needed.
- Handles images (JPEG re-encode), PDFs (rasterize + rebuild), docx/pptx/xlsx (shrink media), text/CSV (split, keeps CSV header), other (zip).
- Tested headless with a 2 MB target: all types worked.
- Fix pushed for "Promise.withResolvers is not a function" on older browsers: `vendor/polyfills.js` (main thread) and `vendor/pdf.worker.shim.mjs` (worker). Tested with the feature deleted in Chromium.

**Decisions:**
- Hosting via GitHub Pages from branch `claude/wonderful-hypatia-9g13bo`, `/ (root)`. The user made the repo public and enabled Pages; the site is live.
- No PR created (user hasn't asked for one).

**Open:**
- User needs to reload the live page (hard refresh) and retry their 45.9 MB PDF ("Pharo Cattle Company- Fall 2026 Bull Sale Catalog.pdf") to confirm the fix works. Not yet verified on their browser or on a large PDF.
- Large PDFs may be slow or memory-heavy; no test beyond a 6-page, 11.5 MB PDF.
- Not supported: HEIC, video, audio.

**Where things live:**
- Live site: https://drews1hub.github.io/File-compressor-/
- Local test files and scripts are in the session scratchpad, which is lost when the container ends.
