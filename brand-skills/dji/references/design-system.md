# DJI design system reference

## Contents
1. Sources and confidence
2. Page anatomy
3. Color
4. Typography
5. Shape and elevation
6. Spacing and layout
7. Components
8. Photography
9. Motion
10. Do and don't

## 1. Sources and confidence

Measured from the live www.dji.com on 2026-10-29, with its stylesheets loaded: desktop at 1440px and the mobile site (/mobile) at 390px. Values are computed styles plus DJI's own CSS variables. They are what the site ships, not an official DJI spec, and they change with each campaign.

- Not captured: hover states, forms and error states, product subpages, cart and checkout, and the DJI Fly / DJI Store app interfaces. For those, extend the same restraint rather than inventing a new look, and say so.
- Corrections to the earlier version of this skill, which came from a third-party extraction:
  - CTAs are not Sky-blue pills. On the homepage they are white outline pills on hero photos and chevron text links everywhere else. Sky blue appears only on the nav "Store" button and the cookie banner.
  - Cards have square corners, not 4px.
  - `#0000ee` was the browser's default link color showing through, not a brand color.
  - Product names are uppercase wordmark images, not Open Sans text.
  - `#3b63a9` and `#eeeeed` are image placeholder colors (see section 3), not surface colors.

## 2. Page anatomy

Homepage order (same on desktop and mobile):

1. **Promo ribbon**: one line on white, small, with a blue text link ("Download the DJI Store app and be the first to experience... Download the App >") and a close X.
2. **Nav** (64px): over the hero it is transparent with white text. Once you scroll it becomes sticky and white with dark text.
3. **Hero carousel**: full-bleed photo slides, 800px tall on desktop, 576px on mobile. Content is centered at the top with 112px of padding: descriptor eyebrow, product wordmark, tagline, then white outline pill CTAs. The product photo fills the slide behind. A list of product names sits on the slide to switch between products (active name bold, the rest light).
4. **Product grid**: 2x2 on desktop (1-up on mobile), 16px gaps, 16px side padding, square-cornered tiles about 696 x 576px. Each tile is a soft grey studio photo with the same stack centered at the top: grey eyebrow, black wordmark, tagline, text-link CTAs. The fourth tile is the "Product Info / Compare Camera Drones" utility tile.
5. **"Shot on" carousel**: 720px tall, a centered photo with neighboring slides peeking in on each side, prev/next arrows, and dot pagination. White overlay text: "Shot on" over the product name, both 40px/500, then "Learn More >".
6. **Stories**: 96px above. Centered 40px/600 heading, an 18px grey mission line, then two photo cards with eyebrow, 32px/600 headline, and "Learn More >".
7. **Category cards**: 64px above. Centered 40px/500 heading ("Explore DJI Products in Different Fields"), then three portrait photo cards (about 389 x 512px) with centered white text over a blue-sky photo: 32px/500 field name, 16px descriptor, "Learn More >".
8. **Service row**: a pale `#f7f9fa` band with 64px padding. Three columns, each with a 72px line icon, a 24px/500 title (Where to buy, Support, Fly Safe), and "Learn More >".
9. **Footer**: `#272727`. An app promo comes first ("Only in the DJI Store App", one line, a translucent "Download App" pill). Then six link columns with 12px/500 white headings and 12px links at 65% white, a newsletter field, the wordmark and social icons, and a legal row.

Sections are separated by space and by photography, not by rules, shadows, or flat color bands.

## 3. Color

DJI's UI color system is near-black ink at three alpha levels on white, plus one blue for buying. Everything else is photography.

| Role                  | Value                    | Use |
|-----------------------|--------------------------|-----|
| Ink, strong           | `rgba(0,0,0,0.85)`       | Headings, taglines, text-link CTAs, nav links (CSS variable `--text-blod`) |
| Ink, default          | `rgba(0,0,0,0.65)`       | Body and description lines, dropdown links (`--text-default`) |
| Ink, quiet            | `rgba(0,0,0,0.45)`       | Eyebrow descriptors above product names |
| White, strong / quiet | `#ffffff` / `rgba(255,255,255,0.65)` | Taglines and CTAs on photos / eyebrows on photos and footer links |
| Sky blue (buy)        | `#0070d5`                | The nav "Store" pill and primary buttons in dialogs. Nothing else. |
| Link blue             | `#1890ff`                | Inline text links in small copy (ribbon, sign-up text) |
| Service band          | `#f7f9fa` (mobile `#f0f1f2`) | The service row, and the stories block on mobile |
| Footer                | `#272727`                | Footer background |
| Translucent fill      | `rgba(255,255,255,0.08)` / `rgba(0,0,0,0.04)` | Pill on the dark footer / secondary button fill on light |
| Hairline              | `rgba(0,0,0,0.15)`       | Borders on inputs and dialogs |

**Image placeholder colors.** The homepage sets a background color on each image slot, matched to its photo: `#ededed` behind hero slides, `#eeeeed` behind the compare tile, `#3b63a9` behind the blue-sky category photos. They show only while the image loads. If you have no photography, a flat tile in a color pulled from the intended photo is a fair stand-in, but say it is a placeholder. Don't present these colors as the brand palette.

No gradients, glows, or tinted section bands. Hierarchy comes from size and weight, and from the three ink alphas.

## 4. Typography

**Family:** Open Sans for all UI text, weights 300 to 700 (verified: dji.com self-hosts the Open Sans webfont), with a localized fallback stack:
`"Open Sans", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", "Hiragino Sans GB", "WenQuanYi Micro Hei", Arial, sans-serif`.
Open Sans is on Google Fonts.

**Product names are not set in Open Sans.** Each one is an image of an uppercase wordmark in a geometric sans (32px tall on the homepage: OSMO ACTION 6, DJI FLIP, OSMO 360), and an invisible heading carries the text for screen readers. To echo this without DJI's artwork, set the product name in uppercase in a geometric sans at about 32 to 40px, weight 500. Never reproduce DJI's actual wordmarks.

| Role                 | Desktop (size/line, weight) | Mobile      | Color | Use |
|----------------------|-----------------------------|-------------|-------|-----|
| Section heading      | 40/44, 500-600              | 28/32       | ink .85 | "Standing at the Forefront of Innovation" (600), "Explore DJI Products in Different Fields" (500) |
| Overlay title        | 40/44, 500                  | 28/32, 600  | white | "Shot on" / "DJI RS 5"; utility tile "Compare Camera Drones" |
| Card headline        | 32/36-40, 500-600           |             | ink .85 or white | Category name (500), story headline (600) |
| Service title        | 24/36, 500                  |             | ink .85 | "Where to buy" |
| Tagline              | 20/24, 500                  | 18/24       | ink .85 or white | "Chase the View" under the wordmark |
| Lead                 | 18/28, 400                  |             | ink .65 | Section intro line |
| Eyebrow / descriptor | 16/20, 400                  | 14/20       | ink .45 or white .65 | "Dual-Camera Drone for Travel Photography" |
| Body / text CTA      | 16/24, 400                  | 16/24       | ink .85 | "Learn More >" |
| Pill CTA / nav       | 14/20, 400                  | 14/20       | white / ink .85 | Hero pills; nav links at -0.28px tracking |
| Footer               | 12/24 headings (500), 12/16 links | 12    | white / white .65 | |

Headings and taglines use normal tracking. Small UI text (14 to 16px in the nav, buttons, and footer) is tightened by about -0.02em.

## 5. Shape and elevation

- **Square corners** on hero slides, product tiles, story cards, category cards, and images.
- **Full pills** for buttons: hero CTAs (`border-radius: 64px`), the Store button, and the footer "Download App" pill.
- **4px** only on dialog and cookie-banner buttons, and on inputs.
- **No shadows** on content. Depth comes from photography.

## 6. Spacing and layout

- 8px base. The values that recur: 16px gaps and side gutters on the product grid; 64px between later sections; 96px above stories; 112px of padding from the top of the hero to its content; 64px vertical padding in the service band.
- Content width about 1200px for stories and category cards; the product grid and hero run edge to edge (inside a 16px gutter).
- Content in hero, tile, and card blocks is centered and stacked: eyebrow, wordmark, tagline, CTAs. Text stays at the top and the product photo fills the rest.
- Mobile: everything goes 1-up with 8px between sections, the hero shrinks to 576px, headings drop to 28px, and taglines to 18px.

## 7. Components

- **Nav**: 64px tall. Wordmark at left, then Camera Drones, Handheld, Power, Specialized (Enterprise, Agriculture, DJI Delivery), Explore (Who We Are, SkyPixel, DJI Forum, Media Center, DJI Trust Center, DJI Blog, Careers), Support, Where to Buy. Search, account, a region pill ("United States") and the blue **Store** pill sit at right. Links are 14px with -0.28px tracking. Dropdown items are 14/20 at ink .65 with `0 16px` padding and 40px rows.
- **Store pill** (the only Sky-blue button): `#0070d5`, white 14px text, 32px tall, `8px 16px` padding (34px on the left for a bag icon), full pill.
- **Hero outline pill**: transparent, 1px white border, `border-radius: 64px`, `5px 16px` padding, 32px tall, 14/20 white text, then a small right chevron (›). Pairs: "Learn More ›" + "Buy Now ›". Agras uses per-model pills ("DJI AGRAS T100 ›").
- **Text-link CTA**: no box. 16/24 text at ink .85 (or white on photos) followed by a chevron (›). Used in product tiles, stories, category cards, and the service row. Pairs sit side by side with about 16px between them.
- **Product tile**: square-cornered photo tile. Grey eyebrow, uppercase wordmark, tagline, then text-link CTAs, centered in the top third.
- **Utility tile**: same shell. "Product Info" eyebrow, a 40px title, a 20px line, then "Help Me Choose ›" and "Buy Now ›".
- **"Shot on" slide**: a full-height photo with "Shot on" over the product name (40px white, 500) and "Learn More ›". Neighboring slides peek in from the sides, with arrows and dots. This is a strong trust device for camera products.
- **Story card**: photo card, eyebrow, 32/40 600 headline, "Learn More ›", with text at the top over a pale part of the photo.
- **Category card**: portrait photo with centered white text: 32/36 500 name, 16/24 descriptor, "Learn More ›".
- **Service item**: 72px outline icon, 24/36 500 title, "Learn More ›".
- **Footer pill**: `rgba(255,255,255,0.08)` fill, white 16px text, `10px 16px` padding, 40px tall, full pill.
- **Spec strip** (an extension, not on the homepage): 3 or 4 big numbers ("1″ CMOS", "8K", "46 min") with 12 to 14px captions. Mark it as an extension.

## 8. Photography

Photography does almost all the visual work on dji.com.

- **Hero**: cinematic, full-bleed, with the product shown in a dramatic setting (ice and spray behind an action camera, a drone over a landscape). Keep the top third calm enough for white text.
- **Product tiles**: soft grey studio scenes, with the product floating or resting on a pale surface. Light from above, with gentle shadows inside the photo. Keep the top third empty for text.
- **Category and story cards**: blue sky and landscape, with the aircraft or gimbal in use in the lower half.
- **"Shot on"**: real footage stills from creators, with people in frame.
- If there's no real image, use a flat placeholder in the right aspect ratio and a color sampled from the intended photo, and label it as a placeholder. Don't use a gradient or an illustration.

## 9. Motion

Carousels drive the page: the hero auto-advances, and the "Shot on" slides peek and swipe. Beyond that, keep motion restrained: subtle fades, about 200 to 500ms, `ease-out`. Autoplaying carousels need visible controls, and their autoplay goes inside `prefers-reduced-motion: no-preference`. Video should be muted, looped, and have a poster frame.

## 10. Do and don't

Do: let photography carry every tile; center a short stack (eyebrow, wordmark, tagline, CTAs) at the top of each tile; use chevron text links as the default CTA and white outline pills on hero photos; keep blue for the single buying button; use square tiles with 16px gaps; use ink at .85 / .65 / .45; set product names as uppercase wordmarks.

Don't: blue pill buttons on every tile; rounded cards; drop shadows; gradients or glows; flat colored bands as section dividers; placeholder colors passed off as a palette; `#0000ee` links; a second text typeface for UI copy; reproducing DJI's actual wordmark artwork or photography.
