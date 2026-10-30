# Handoff: audiobook tools and iTunes (2026-10-30)

**Goal:** FileFit is a free in-browser file converter (nothing is uploaded). The user, on a MacBook running High Sierra, wants audiobooks from CD tracks (they have 120 tracks) to show up in iTunes under Audiobooks as one book. Opening it should list the individual tracks, like their "Escape / Old Time Radio Shows" example.

**Done** (all merged to the live site, PRs #1 to #8 in `Drews1hub/File-compressor-`):
- Tools tab, join (`joinAudiobook`, `js/tools.js`): Book title and Author boxes. Output is separate tracks (default: one `.m4b` per track, same album/artist/album artist, `track n/N`, audiobook flag, named `01 Name.m4b`) or one file with a chapter per track. AAC in one format is copied losslessly; everything else is AAC 192k, encoded in parallel on up to 4 engines (`openEngine` in `js/engine.js`).
- Tools tab, split (`splitAudiobook`): cuts one M4B at its chapter markers into numbered, tagged tracks. Chapters are read from ffmpeg's metadata export, not the log text (the log buffer lost the first chapters of a 120-chapter book). A file with no chapters gives an error.
- Convert tab: one Book title and Author pair above the drop area (`#convert-title`, `#convert-author`) applies to the whole batch: album, artist, album artist, each file's name as its track title, files numbered in order. M4B is flagged as an audiobook. Files keep their names. Audio converts start on their own; Redo (from another branch) re-runs with newly typed values.
- Checked in headless Chromium with ffprobe. **Not checked in iTunes.**

**Decisions:**
- Sound quality comes first: no mono, lower bitrate, or fast-coder shortcuts.
- iTunes lists separate files tagged as one album as one book; a single M4B shows as one item, whatever chapters it has. So separate tracks is the default.
- Only merge to the live site when the user asks. They have said yes each time.

**Open:**
- Unconfirmed: the user's join of 120 files gave one file (one-file option or an old cached page). Next step: ask whether they tried the split tool on that big M4B, or reran the join on Separate tracks (then Download all as ZIP, unzip, File → Add to Library with the folder), and what iTunes shows.
- The Convert tab boxes once didn't show for them: old cached page (Pages keeps files 10 min). Hard refresh, Cmd+Shift+R.
- The AAC copy join adds about 0.02 s of padding at each join. Not listened to.
- Older: dropping many WMA files at once can leave the oldest row stuck (needs status text and console errors). Apple Books on High Sierra can't open M4B.

**Where things live:**
- Repo `/home/user/File-compressor-`, working branch `claude/clever-edison-ad8mje`. Default branch `claude/wonderful-hypatia-9g13bo` serves GitHub Pages: https://drews1hub.github.io/File-compressor-/
- To ship: merge the default branch into the working branch, push, open a PR into the default branch, merge it.
- Testing: Playwright (`NODE_PATH=$(npm root -g)`) against `python3 -m http.server` in the repo, then ffprobe on downloaded files. Don't use `pkill -f` with a pattern that appears in your own command (exit 144).
- Earlier handoffs: `.claude/handoffs/2026-10-29-audiobook-itunes.md`, `2026-10-29-audiobook-join.md`.
