# Handoff: Fitfile + brand skills (2026-10-29)

**Goal:** Fitfile (formerly File Squeeze): a free in-browser file compressor and converter. Files never leave the browser. Default target is 30 MB, Claude's upload limit. Also: rebuilt `apple` and `dji` brand skills from the live sites.

**Done** (repo `Drews1hub/File-compressor-`, working branch `claude/nice-ptolemy-gx39vn`, head `1d15f6b`):
- App is feature-complete: Compress, Convert, Zip, and Tools tabs (see `index.html`, `app.js`, `js/`, `vendor/`). Last app commit before the branch change: `a5726c1`.
- Renamed to Fitfile in `index.html`, `README.md`, the download name (`fitfile-results.zip`), and the settings key (`fitfile-settings`). Commit `1d15f6b`. This resets saved settings for existing visitors once.
- Brand skills rebuilt from the live sites, in `brand-skills/`:
  - `apple`: measured from apple.com (desktop and mobile).
  - `dji`: measured from dji.com after the CDN was allowed. Corrected CTAs to chevron links and white outline pills; square tiles; uppercase wordmarks.
  - Uploadable zips are in `brand-skills/dist/apple.zip` and `brand-skills/dist/dji.zip`. Commits `b771557`, `7373c7f`.

**Decisions:**
- No PR yet; the user hasn't asked for one.
- Keep the repo name `File-compressor-`. Renaming it would break the GitHub Pages URL.
- Don't push to `claude/wonderful-hypatia-9g13bo` without explicit permission. It's the old branch.
- Skills: the user will upload the zips as new skills in claude.ai (Skills settings), then disable or delete the old plugin-backed `apple` and `dji`. Claude cannot upload skills to the account.

**Open:**
- Pages still serves `claude/wonderful-hypatia-9g13bo`, so the live site still says "File Squeeze". Fix: in repo Settings → Pages, set the source to `claude/nice-ptolemy-gx39vn` (`/ (root)`). Or give explicit permission to push there. After the switch, hard refresh.
- Skills upload: the user must do it in claude.ai. Confirm the two new skills appear and the old plugin ones are off.
- `brand-skills/apple/assets/apple-tokens.css` changed on disk after the last commit, outside this session. The tree is clean now, so it's in HEAD. Check the diff before relying on it.
- Not yet tested by the user: real phone videos, the 45.9 MB PDF, folder drop into Zip.
- Ideas from before: multi-thread video (needs COOP/COEP); spreadsheets and subtitle conversion (SheetJS, SRT↔VTT); DOCX→text (mammoth); PDF compression that keeps text selectable.
- The plugin `data:definite` MCP failed to connect (ENDPOINT_NOT_FOUND). Not needed for this work.

**Where things live:**
- Live site: https://drews1hub.github.io/File-compressor-/ (currently serves the old branch, see Open).
- Old per-session recap: `.claude/handoffs/2026-10-29-file-squeeze.md`.
- Brand skill sources: `brand-skills/apple/`, `brand-skills/dji/`. Each has a README in `brand-skills/README.md`.
- Live-capture scripts were in the session scratchpad and are lost when the container ends. Rebuild with Playwright if needed.
