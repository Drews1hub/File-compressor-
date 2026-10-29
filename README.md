# Fitfile

A free file compressor and converter that runs entirely in your web browser. Your files are never uploaded to a server.

- **Compress** makes files smaller. Three ways to say how small:
  - **Fit a size:** under a limit in MB or KB (30 MB by default, with presets for Claude, email and Discord).
  - **Pick a strength:** Light, Balanced or Strong, the same settings for every file.
  - **Shrink by %:** at most a share of each file's current size.

  *More options* sets the photo format (Auto keeps transparency by using WebP), a maximum photo size,
  a maximum video resolution, and whether to remove the sound from videos.
- **Convert** changes a file's format: images, video, audio and PDFs.
- **Tools**: trim a video or audio clip, merge PDFs, split a PDF (every page or chosen ranges, text stays selectable),
  turn photos into one PDF (fit, A4 or Letter), rotate / flip / resize photos, and open ZIP or TAR.GZ archives.
- **Zip** bundles files or whole folders (structure kept) into a ZIP or TAR.GZ.
- **Download all** saves every result in one ZIP. Settings are remembered in your browser.

## Compress: how each file type is handled

| File type | What happens |
|---|---|
| Images (JPG, PNG, WebP, GIF, BMP, AVIF, HEIC, TIFF) | Saved as a JPEG, or WebP if the picture has transparent parts. The quality goes down first, then the resolution. Location and camera details (EXIF/GPS) are removed. |
| Video (MP4, MOV, MKV, WebM, AVI, …) | Re-encoded as MP4 (H.264) at the bitrate that fits, capped at 30 fps. The resolution drops (1080p → 720p → 480p…) when the bitrate gets low. |
| Audio (MP3, WAV, M4A, FLAC, OGG, …) | Re-encoded as MP3 at the highest bitrate that fits. |
| PDF | Each page is turned into a compressed image and put back into a new PDF. Claude can still read it, but you can't select the text anymore. |
| Word / PowerPoint / Excel (`.docx`, `.pptx`, `.xlsx`) | Pictures inside the file are made smaller. Text and layout stay the same. |
| Text, CSV, JSON, Markdown, code | Split into parts that each fit the limit. Every CSV/TSV part keeps the header row. |
| Anything else | Zipped at maximum compression (last resort). |

Files that are already under the limit are left as they are.

Video compression runs on your own processor, so expect it to take roughly 1–3× the length of the video.

## Convert: supported formats

| From | To |
|---|---|
| Images (incl. HEIC, TIFF) | JPG, PNG, WebP, GIF, BMP, TIFF, PDF (animated GIF also → MP4, WebM) |
| Video | MP4, WebM, MOV, MKV, AVI, GIF, or just the sound as MP3, WAV, M4A |
| Audio | MP3, WAV, M4A, OGG, FLAC, Opus |
| PDF | JPG or PNG (one image per page, zipped if more than one), plain text |

When a video's streams already fit the new container (say H.264 MP4 → MKV), they're copied as-is, which is near-instant.

## Run it

It's just static files, so there's no build step.

- **Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000.
  (Opening `index.html` straight from disk won't work, because browsers block the PDF engine on `file://`.)
- **Free hosting with GitHub Pages:** in the repo, go to **Settings → Pages**, set **Source** to
  "Deploy from a branch", pick the branch and `/ (root)`, and save. The site will be at
  `https://<your-username>.github.io/<repo-name>/`.

## Code layout

- `app.js`: the page (tabs, file rows, work queue)
- `js/compress.js`, `js/convert.js`: what happens to each file type
- `js/engine.js`: wrapper around ffmpeg.wasm (video, audio, unusual image formats)
- `js/archive.js`: ZIP / TAR.GZ writing and reading dropped folders
- `js/tools.js`: the Tools tab (trim, PDF merge/split, photos → PDF, photo edits, opening archives)
- `js/images.js`, `js/pdf.js`, `js/util.js`: shared helpers

## Libraries

These are copied into `vendor/`, so the site doesn't need any outside CDN:
[pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), [jsPDF](https://github.com/parallax/jsPDF) (MIT),
[fflate](https://github.com/101arrowz/fflate) (MIT), [heic2any](https://github.com/alexcorvi/heic2any) (MIT),
[pdf-lib](https://github.com/Hopding/pdf-lib) (MIT, loaded only for PDF merge/split),
[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (MIT wrapper; the 32 MB FFmpeg core is GPL-2.0-or-later,
see `vendor/LICENSE-ffmpeg`). The ffmpeg core is only downloaded the first time someone drops a video or audio file.
