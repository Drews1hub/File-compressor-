# Brand skills: apple and dji

Rebuilt from the live sites on 2026-10-29. These are the source files for the `apple` and `dji` Claude skills, which live in your claude.ai account. Editing this folder doesn't change the installed skills.

To install an update, upload `dist/apple.zip` and `dist/dji.zip` in claude.ai's Skills settings, replacing the old versions.

## What changed

**apple** (measured from apple.com: homepage at 1440px and 390px, plus the iPhone page)
- Buttons: "Learn more" is the filled blue pill, and the buying action ("Buy", "Shop", "Pre-order") is an outline pill in link blue. The old skill described a text link plus a filled "Buy" button. Sizes are 44px / 17px (large) and 36px / 14px (small), radius 980px.
- Homepage layout: full-width tiles separated by 12px white gaps, then a 2-up checkerboard of black and `#f5f5f7` tiles. Measured type sizes for desktop and mobile.
- Product-page pattern: 80px left-aligned title, chapter nav, 28px-radius cards, 144px section padding, 1260px content width.
- Colors now come from apple.com's own `--sk-*` variables. Added tertiary grey `#86868b`, `#fafafc`, `#e8e8ed`, and the "New" orange `#b64400`. Corrected success and error to `#008009` / `#e30000`.
- Voice: live headline examples; the product-tile pattern (the product name is the headline, and a short line under it carries the voice); sentence-case CTAs.
- Tokens CSS: outline, small, and media buttons; the tile grid; product-page cards; `border-box` sizing so buttons come out at the measured heights.

**dji** (measured from the live dji.com, desktop and mobile, with its stylesheets loaded)
- CTAs: "Learn More ›" / "Buy Now ›" are chevron text links, and white outline pills (32px, 1px border) on hero photos. The old skill made them Sky-blue pills; Sky blue `#0070d5` is only on the nav Store button.
- Square corners on all tiles and cards, with 16px gaps. The old skill said 4px.
- Product names are uppercase wordmark images, not Open Sans text. The skill says to echo them with an uppercase geometric sans and never copy the real artwork.
- Text color is ink at three alphas (`.85` / `.65` / `.45`), white and white-65% on photos.
- `#3b63a9`, `#eeeeed`, and `#ededed` are image placeholder colors, not a palette. `#0000ee` was the browser default link color. Both corrections are noted in the skill.
- Measured page anatomy and type scale: 800px hero with 112px top padding, 2x2 product grid, "Shot on" carousel, stories, photo category cards, `#f7f9fa` service band, `#272727` footer; 40/32/24/20/16px type, smaller on mobile.
- Tokens CSS rewritten to match (outline pill, text-link CTA, Store button, photo tiles, nav over hero, footer).
- Voice: unchanged copy, verified live; notes that CTAs are chevron links.
