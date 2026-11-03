# Handoff: file names, chapters and drop-anywhere (2026-11-03)

**Goal:** FileFit is a free in-browser file converter (nothing is uploaded). The user, on an old MacBook (High Sierra), turns CD tracks into audiobooks for iTunes. This session: stop numbers being added to the front of file names, let them remove numbers that are already there, and a few small fixes.

**Done** (all merged to the live site, PRs #9 to #12 in `Drews1hub/File-compressor-`):
- Drop files anywhere on the page: they go to the open tab (`app.js`, bottom, `activeDrop`).
- Unreadable-track error now says why, with ffmpeg's own message (`js/engine.js` `probe().problem`, `js/tools.js`). Audio check is less strict about sample rate and layout.
- "Number files in list order" starts unticked and isn't saved. Join "Separate tracks" and split keep original names; the track tag holds the order.
- New box under the drop area, "Remove numbers from the front of file names" (`#strip-numbers`, saved in the browser). It strips the file name (`addDownloads` in `app.js`) and the title tag (`js/convert.js` batchTags, `js/tools.js` separateTracks). Helper `withoutNumber` is in `js/util.js`: removes 1-3 digits plus a separator, repeatedly; keeps years like 2001 and number-only names.
- Checked in headless Chromium with ffprobe. **Not checked on the user's Mac or iTunes.**

**Decisions:**
- No DRM stripping: Audible files (aax/aaxc/aa) are not supported and won't be built. The user's Audible web player error WP-18 and a filter on audible.ca (someone else's, so no bypass) are theirs to sort out with Audible and the filter's owner.
- Chapters: the live site's "Chapters where track numbering resets" was kept; my own Track 1 option was dropped. The live FAQ page replaced my `help.html`.
- The user likes the box where it is: "leave it like it is". Don't restyle it unless asked.
- Only merge to the live site when the user says "ship it".

**Open:**
- Unconfirmed that Track 8 (`08 Track 8.mp3`) now joins. If it still fails, the new error text will say why; a damaged file can be re-saved in iTunes (File, Convert, Create AAC Version).
- Without numbers, Finder won't list separate tracks in order; iTunes uses the track tag. Offered numbering them, undecided.
- Older items: iTunes result unconfirmed, WMA batch stuck row, AAC copy join adds ~0.02 s at each join.

**Where things live:**
- Repo `/home/user/File-compressor-`, working branch `claude/clever-edison-ad8mje`. Default branch `claude/wonderful-hypatia-9g13bo` serves GitHub Pages: https://drews1hub.github.io/File-compressor-/
- To ship: merge the default branch into the working branch, push, open a PR into the default branch, merge it. Pages caches about 10 minutes (hard refresh Cmd+Shift+R).
- Tests: `npm ci` then `npm test`. Browser checks: Playwright (`NODE_PATH=$(npm root -g)`) against `python3 -m http.server`. Don't use `pkill -f` with a pattern that appears in your own command (exit 144); use `[h]ttp.server`.
- Tool tabs use cards (`data-tool-choice`), not the hidden `#tool` select.
