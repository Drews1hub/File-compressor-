# Handoff: File Squeeze business research (2026-10-29)

**Goal:** Decide whether File Squeeze (free in-browser compressor/converter, nothing uploaded) can become a money-making website, and how.

**Product state (unchanged this session):** Static site with Compress / Convert / Tools / Zip tabs, live at https://drews1hub.github.io/File-compressor-/ (GitHub Pages). Full feature notes in `.claude/handoffs/2026-10-29-file-squeeze.md`.

**Done this session (research only, no code changes):**
- Market read: the features are a crowded commodity. The edge is client-side processing: privacy, near-zero hosting cost, no server file limits.
- Competitor pricing (mostly third-party sources; official pages weren't reachable then):
  - Smallpdf Pro: about $9/mo billed yearly or $15/mo billed monthly. Free tier reportedly 2 tasks/day.
  - iLovePDF Premium: about $7/mo or $45–48/yr.
  - Adobe Acrobat Pro: about $19.99/mo on annual billing, $29.99/mo monthly.
  - TinyPNG/Tinify API: 500 free per month, then $0.009 each, $0.002 each above 10k.
  - FreeConvert: $12.99 / $24.99 / $29.99 per month.
  - CloudConvert: 25 free conversions/day, then credits (prices not found).
  - Offline one-time desktop compressors: about $15–20.
- Upload test (headless Chromium, dummy PDF, every outgoing request logged):
  - File Squeeze: 0 outgoing requests while processing. Claim holds.
  - Smallpdf: uploads the whole file to Cloudflare R2 as soon as it is picked. Confirmed.
  - iLovePDF: uploads to `api28.ilovepdf.com/v1/upload`. Confirmed.
  - FreeConvert, CloudConvert: automation couldn't get through their pages. Reviews say both process on their servers and delete files later (about 8 h and at most 24 h).
  - Smallpdf and FreeConvert load Microsoft Clarity session recording, plus ad and analytics trackers.

**Decisions:**
- Network access was set to full by the user.
- Positioning to pursue: "nothing leaves your device," with proof (for example a network-panel demo).
- Keep basic compression free. A paid tier should cover batch, large video, or no ads, at about $5–10/mo or $15–20 one-time.

**Open / next steps:**
1. User to check FreeConvert and CloudConvert by hand: DevTools Network tab, drop a file, look for a large request.
2. Pick one niche (for example private PDF tools for lawyers or clinics, or fitting a specific upload limit) and write a landing page for it.
3. Check search demand for that niche's phrases (Google Keyword Planner) and see who ranks.
4. Add a waitlist or "Pro" button to the live site and measure clicks, then test a single price.
5. Licensing: the ffmpeg core is GPL-2.0-or-later. Get legal advice or use a compatible build before charging. Check whether the repo has its own LICENSE.
6. Any analytics added must be privacy-friendly: no session replay, no file names.
- I offered to draft landing-page copy and pricing options once a niche is chosen.

**Where things live:**
- Repo `Drews1hub/File-compressor-`, branch `claude/trusting-fermat-1p3xvp` (no PR).
- Test scripts and screenshots were in the session scratchpad and are lost when the container ends.
