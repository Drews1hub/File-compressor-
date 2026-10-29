# Handoff: audiobook join and iTunes (2026-10-29)

**Goal:** FileFit is a free in-browser file converter (nothing is uploaded). The user, on a MacBook running High Sierra, wants audiobooks from CD tracks to show up in iTunes under Audiobooks as one book. Opening it should list the individual tracks, like their "Escape / Old Time Radio Shows" example, not many separate books.

**Done** (all merged to the live site, PRs #1 to #5 in `Drews1hub/File-compressor-`):
- Tools tab, "Join audio tracks into one audiobook (M4B)": `joinAudiobook` in `js/tools.js`. Book title and Author boxes. Output choice: separate tracks (default) or one file with a chapter per track.
- Separate tracks: one `.m4b` per track, tagged with the same album, artist, album artist, `track n/N`, media type 2, genre Audiobook, M4B brand. Files are named `01 Name.m4b` and so on.
- Quality: AAC tracks in the same format are copied (lossless). Everything else is re-encoded to AAC 192k. Several tracks encode at once on separate engines (`openEngine` and `ffmpegJob(..., { engine })` in `js/engine.js`). A 40-minute set took 36 s.
- Convert tab: choosing M4B on a file's row shows Book title and Author boxes (`audiobookTags` in `js/convert.js`). Picking M4B in the top menu now waits for Convert, so no auto-start.
- Checked in headless Chromium with ffprobe: tags, chapters, file names, durations. **Not checked in iTunes.**

**Decisions:**
- Sound quality comes first: no mono, lower bitrate, or fast-coder shortcuts.
- The user chose separate tracks tagged as one album over one file with chapters.
- Only merge to the live site when the user asks. They have said yes each time.

**Open:**
- The user says the Convert tab's title and author boxes "never came live". A test of the live site shows them after M4B is chosen in the file's row dropdown. Likely causes: an old cached page (Pages keeps files 10 min; tell them Cmd+Shift+R), or the saved top "Convert to" menu starting another format on drop. Ask what they see on the row. Possible follow-up: show the boxes for every audio row, or stop auto-start completely.
- iTunes: dragging the `.m4b` onto iTunes did nothing. Advised File → Add to Library (Cmd+O). Not yet confirmed that separate-track output groups as one book. Next step: ask what iTunes shows after adding all tracks together.
- Older: dropping many WMA files at once can leave the oldest row stuck (needs status text and console errors). Apple Books on High Sierra can't open M4B, so iTunes is the right place.

**Where things live:**
- Repo `/home/user/File-compressor-`, working branch `claude/clever-edison-ad8mje`. Default branch `claude/wonderful-hypatia-9g13bo` serves GitHub Pages: https://drews1hub.github.io/File-compressor-/
- To ship: merge the default branch into the working branch, push, open a PR into the default branch, merge it.
- Testing: Playwright (`NODE_PATH=$(npm root -g)`) against `python3 -m http.server` in the repo, then ffprobe on the downloaded files. Don't use `pkill -f` with a pattern that appears in your own command; it kills the shell (exit 144).
- Earlier handoffs: `.claude/handoffs/2026-10-29-audiobook-join.md`, `2026-10-29-m4b-convert.md`.
