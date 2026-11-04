# Handoff: joining M4B parts, file names (2026-11-04)

**Goal:** FileFit is a free in-browser file converter (nothing is uploaded). The user, on an old MacBook (High Sierra), builds audiobooks for iTunes. Now they are joining several M4B parts of one book (Joel C. Rosenberg: "Book 1-The Third Target", "Book 2-The First Hostage", 570-610 MB each) with the Tools tab, Join audiobook.

**Done** (all merged to the live site, PRs #9 to #12 in `Drews1hub/File-compressor-`, nothing unmerged except the recap files):
- Drop files anywhere on the page (`app.js`, `activeDrop`).
- Unreadable-track error shows ffmpeg's reason (`js/engine.js` `probe().problem`, `js/tools.js`).
- "Number files in list order" is unticked by default and not saved. New saved box under the drop area, "Remove numbers from the front of file names" (`#strip-numbers`), strips the file name and the title tag; helper `withoutNumber` in `js/util.js`. The user likes it as it is: don't restyle.
- Chapter rule for joins is `js/chapters.js` (`trackNumber`, `chapterPlan`): number after "Track", else a leading number, else an error. Tests: `npm test`.

**Decisions:**
- No DRM stripping: Audible files (aax, aaxc, aa) will not be supported. The user's Audible web player error WP-18 and the audible.ca filter (someone else's) are not ours to bypass.
- Chapters: the live site's "Chapters where track numbering resets" stays; no separate Track 1 option.
- Only merge to the live site when the user says "ship it".

**Open (this session's problems):**
- The user's parts are named like `The Third Target - Joel C. Rosenberg (2).m4b`, with no track number, so the default Chapter names rejects them. Advice given: set **Chapter names** to "Use original filenames", check the order with the arrows ("(2)" may be a duplicate download, not Part 2), and keep in mind that each part's own chapters are replaced by one chapter per file.
- Offered but not built, waiting on the user: a **"Keep each file's own chapters"** option (carry each part's chapters across, shifted by the earlier parts' length). Ask whether the parts have chapters of their own; recommend building it if so.
- Book 2 failed with `NotFoundError ... readAsArrayBuffer on FileReaderSync`: the browser lost the file (cloud-only iCloud file, unplugged drive, or moved after dropping). Advice given: copy the parts to a local folder, clear the list, drop them again. If it still fails from a local folder, look at how the app reads files this big (`ffmpegJob` mounts with WORKERFS in `js/engine.js`).
- Older: iTunes result unconfirmed, WMA batch stuck row, the AAC copy join adds about 0.02 s at each join.

**Where things live:**
- Repo `/home/user/File-compressor-`, working branch `claude/clever-edison-ad8mje`. Default branch `claude/wonderful-hypatia-9g13bo` serves GitHub Pages: https://drews1hub.github.io/File-compressor-/
- To ship: merge the default branch into the working branch, push, open a PR into the default branch, merge it. Pages caches about 10 minutes (hard refresh Cmd+Shift+R).
- Tests: `npm ci` then `npm test`. Browser checks: Playwright (`NODE_PATH=$(npm root -g)`) against `python3 -m http.server`. Don't use `pkill -f` with a pattern that appears in your own command (exit 144); use `[h]ttp.server`.
- Tool tabs use cards (`data-tool-choice`), not the hidden `#tool` select.
