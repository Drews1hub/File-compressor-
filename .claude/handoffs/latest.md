# Handoff: FileFit UX polish (2026-10-29)

**Goal:** FileFit is a free in-browser file compressor and converter (nothing is uploaded). The user asked for a review of the whole app for ways to make it friendlier and more appealing, then asked for the top 6 fixes, but only if they would not cause problems.

**Done** (branch `claude/happy-davinci-4lcx8i`, pushed, no PR opened):
- Compact hero in `index.html` and `styles.css`: the drop box now starts about 750px down instead of 1175px. Stats are one thin line.
- "How It Works" link opens the help section (`app.js`, near `loadSettings()`).
- Compress summary says "N% smaller" via `smallerBy()` in `app.js`.
- Each result row has a tag (Compress, Convert, Zip, tool name) from `makeRow(file, tag)`.
- "Convert all waiting files" button in the Convert tab (`#convert-all`, `row.convertWith`).
- Redo button on compress rows (`row.redo`, `row.clearOutputs()`).
- Tested in headless Chromium: all flows pass, no console errors, no sideways scroll at 390px. Video and audio were not tested (32 MB engine).

**Decisions:**
- A separate results list per tab was NOT done. It would affect Download all, the progress ring and Clear. Row tags were used instead.
- Redo is only on Compress rows. Convert rows already have "Convert again".

**Open** (ideas from the review, not started):
- Paste to add files; drop anywhere on the page; progress in the tab title; warn before leaving mid-job; remember the last tab and put it in the URL.
- Screen-reader announcements (`aria-live` on row status), arrow keys on tabs, bigger remove buttons.
- Image thumbnails and before/after, time remaining for video and audio, shorter download buttons.
- Offline install (service worker and manifest); gentler PDF compression that keeps text; AAC instead of MP3 for audio compression.
- Footer credits are missing Tesseract, OpenCascade, LibreDWG, mobi-parser and dxf; link the GPL licenses on the page.
- Older items still open: convert auto-starts from the saved "Convert to" setting, and a row can get stuck when many WMA files are dropped at once.

**Where things live:**
- Repo `/home/user/File-compressor-`, branch `claude/happy-davinci-4lcx8i`. Static site, run with `python3 -m http.server`.
- UI: `app.js`, `index.html`, `styles.css`. File handling: `js/`.
- Earlier handoffs: `.claude/handoffs/`.
