# Handoff: Redo button (2026-10-30)

**Goal:** FileFit is a free in-browser file compressor, converter and toolkit (nothing is uploaded). The user wants to change output settings and press Redo on a finished row, instead of deleting the file and dropping it in again.

**Done:**
- Redo is live on the site: https://drews1hub.github.io/File-compressor-/ . Checked in a real browser on 2026-10-30: the row shows "Redo", and "Redo all" shows in the bar.
- Commit `e30165b` on `claude/wonderful-hypatia-9g13bo` (the live branch). It adds `app.js`, `index.html` and `styles.css` changes.
  - Per row: "Redo" re-runs the file with the current settings and replaces its old downloads.
  - "Redo all" re-runs every finished row in list order.
  - Compress uses the current target, strength, percent, format, size, resolution and mute settings.
  - Convert uses the current "Convert to" format. If it's set to "Choose for each file", it repeats the last format.
  - Single-file Tools (trim, split PDF, photo edit, open archive) use the current settings.
  - Redo is not offered for merge PDFs, photos to PDF, Zip or audiobook join, which build one output from a list that clears on press.
- Tested in a headless browser before pushing: Compress redo changed 18 parts to 4 after the target changed, Convert redo switched JPG to WebP, and Redo all ran with no page errors.

**Decisions:**
- The live branch is `claude/wonderful-hypatia-9g13bo`. GitHub Pages serves it. Do not push to it without the user's explicit permission.
- Redo was rebuilt on top of the live branch, not merged. The old Redo branch `claude/nice-ptolemy-gx39vn` is based on the older version and is not live. Leave it alone.
- Do not include model names in commits or PR text.

**Open:**
- Video, audio and OCR conversions are not browser-tested for Redo. They need the large converter download.
- Redo on the single-file Tools is not browser-tested.
- The user hasn't confirmed on their own device yet. A hard refresh may be needed to see the button.
- Ideas from earlier, not started: multi-thread video (needs COOP/COEP), spreadsheet and subtitle conversion, DOCX to text, PDF compression that keeps text selectable.

**Where things live:**
- Repo: `/home/user/File-compressor-`, local branch `redo-live`, tracking `claude/wonderful-hypatia-9g13bo`.
- Redo code: `app.js` (`makeRow` → `setRedo`/`reset`, `compressFile`, `convertFile`, `runSingleTool`, `redo-all` listener), `index.html` (`#redo-all`), `styles.css` (`.redo`).
- Older handoffs: `.claude/handoffs/2026-10-29-*.md`.
