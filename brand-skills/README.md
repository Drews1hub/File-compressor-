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

**dji** (from the live dji.com desktop and mobile HTML)
- Verified live: section order, nav, all copy, Open Sans, `#3b63a9`, and `#eeeeed`.
- Fixed: `#0000ee` was not a brand color. It is the browser's default link color, which shows when DJI's CSS fails to load. Removed.
- Fixed: brand blue `#3b63a9` fills whole category cards (Video Production, Enterprise, Agriculture). The old skill said it was only for small accents.
- Fixed: card wash is `#eeeeed`, not `#ededed`.
- Added: the hero is a product carousel with name tabs, plus the utility card, "Shot on" gallery, stories, category cards, and service row, and which products get Learn More only.
- Not re-verified: type sizes, the Sky CTA blue `#0070d5`, radii, and spacing. DJI's stylesheets are on `www-cdn.djiits.com`, which this environment's network policy blocks. The references mark each value by its source.
