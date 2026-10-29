# File Squeeze

A free file compressor that runs entirely in your web browser. It shrinks files to fit under a size limit
(30 MB by default) so you can upload them to Claude. Your files are never uploaded to a server.

## How each file type is handled

| File type | What happens |
|---|---|
| Images (JPG, PNG, WebP, GIF, BMP, AVIF) | Saved as a JPEG. The quality goes down first, then the resolution if that isn't enough. |
| PDF | Each page is turned into a compressed image and put back into a new PDF. Claude can still read it, but you can't select the text anymore. |
| Word / PowerPoint / Excel (`.docx`, `.pptx`, `.xlsx`) | Pictures inside the file are made smaller. Text and layout stay the same. |
| Text, CSV, JSON, Markdown, code | Split into parts that each fit the limit. Every CSV/TSV part keeps the header row. |
| Anything else | Zipped at maximum compression (last resort). |

Files that are already under the limit are left as they are.

## Run it

It's just static files, so there's no build step.

- **Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000.
  (Opening `index.html` straight from disk won't work, because browsers block the PDF engine on `file://`.)
- **Free hosting with GitHub Pages:** in the repo, go to **Settings → Pages**, set **Source** to
  "Deploy from a branch", pick the branch and `/ (root)`, and save. The site will be at
  `https://<your-username>.github.io/<repo-name>/`.

## Libraries

These are copied into `vendor/`, so the site doesn't need any outside CDN:
[pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), [jsPDF](https://github.com/parallax/jsPDF) (MIT),
[fflate](https://github.com/101arrowz/fflate) (MIT).
