# DJI design system reference

## Contents
1. Sources and confidence
2. Surfaces and rhythm
3. Color
4. Typography
5. Shape and elevation
6. Spacing and layout
7. Components
8. Photography
9. Motion
10. Do and don't

## 1. Sources and confidence

Rebuilt on 2026-10-29 from the live www.dji.com (desktop 1440px and the mobile site at /mobile, 390px). Each value below is marked by how it was confirmed:

- **Verified live**: page structure and section order, nav categories, all copy, the Open Sans webfont (the page loads `OpenSans-Regular.woff2`), and the two colors set inline in the HTML: `#eeeeed` (product-info card) and `#3b63a9` (category cards).
- **Not re-verified**: DJI's stylesheets are served from `www-cdn.djiits.com`, which this capture could not reach, so computed sizes, the Sky CTA blue, radii, and spacing come from the earlier third-party extraction of the homepage. Treat them as approximations.
- Not captured at all: hover states, forms and error states, modals, cart and checkout, and the DJI Fly / DJI Store app interfaces. For those, extend the same restraint rather than inventing a new look, and say so.
- A correction from the earlier version: it listed "hyperlink blue `#0000ee`" as a brand color. That is the browser's default link color, which shows up when DJI's CSS fails to load. It is not part of the design; don't use it.

## 2. Surfaces and rhythm

Homepage order (verified live, same on desktop and mobile):

1. **Hero carousel** (`homepage-big-banner`): full-width slides, one product each, with a strip of product-name tabs under it ("DJI Air 3S", "DJI Mavic 3 Pro", "Osmo Action 6", "Osmo Pocket 3", "DJI RS 5", "DJI Matrice 400", "DJI AGRAS T100", "DJI FlyCart 100"). Each slide is a full-bleed photo or product render with descriptor, product name, tagline and CTAs over it. Consumer, then pro, then enterprise and agriculture, all in one carousel.
2. **Product grid** (`homepage-products-banner`): three product cards (Osmo 360, Flip, Osmo Mobile 8) plus a fourth utility card on `#eeeeed`: "Product Info / Compare Camera Drones / See product overviews and comparisons here / Help Me Choose / Buy Now".
3. **"Shot on" gallery** (`homepage-skypixel-module`): six sample shots, each labeled "Shot on" + product name + Learn More (Buy Now on some). Sourced from SkyPixel, DJI's creator community.
4. **Stories** (`homepage-stories-module`): heading "Standing at the Forefront of Innovation", one mission sentence, then two editorial cards, each with a small category label ("Industry Insight Report", "Engineering, Science & Technology"), a headline, and Learn More.
5. **Category cards** (`homepage-child-module`): heading "Explore DJI Products in Different Fields", three cards filled with brand blue `#3b63a9` (Video Production, Enterprise, Agriculture), each with a one-line descriptor and Learn More.
6. **Service row** (`homepage-service-module`): Where to buy, Support, Fly Safe, each with Learn More.
7. Newsletter sign-up ("Get the latest news from DJI") and a dense multi-column footer.

Product slides and cards are photography-led: dark slides for flagship hardware, light ones elsewhere, so the flip between dark and light still acts as the divider. Sections are separated by space and surface change, not rules or shadows.

## 3. Color

| Role                 | Value     | Confidence | Use |
|----------------------|-----------|------------|-----|
| Sky CTA (primary)    | `#0070d5` | earlier extraction | Pill buttons: Buy Now, Learn More. Never body text or hairlines. |
| DJI Brand Blue       | `#3b63a9` | verified live | Full-card fill for category cards (Video Production, Enterprise, Agriculture) with white text; also small badges and chips. Never a button. |
| Ink / black          | `#000000` | earlier extraction | Dark slide surface and body text on white. |
| Near-black soft      | `#272727` | earlier extraction | Video frames and embeds where pure black feels inert. |
| Body strong          | `#303233` | earlier extraction | Secondary body text, stroke. |
| Body mute            | `#6c7073` | earlier extraction | Captions, product subtitles, fine print, input stroke. |
| Soft grey wash       | `#eeeeed` | verified live | Utility and product cards (the "Product Info / Help Me Choose" card). Earlier extraction measured `#ededed`; use `#eeeeed`. |
| White                | `#ffffff` | earlier extraction | Light surfaces, text on dark and on brand blue. |

Rules: two blues with two separate jobs. Sky blue is the action color; brand blue is a surface color for category cards. Don't merge them into one variable. Hierarchy never comes from tinting text grey except at the explicit caption tier. No gradient tokens.

## 4. Typography

**Family:** Open Sans at every tier (verified: dji.com self-hosts the Open Sans webfont), with a localized fallback stack:
`"Open Sans", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", "Hiragino Sans GB", "WenQuanYi Micro Hei", Arial, sans-serif`.
Open Sans is on Google Fonts. If substituting, Inter at weight 500 with about `-0.2px` tracking on body sizes is close; Source Sans is the nearer humanist cousin.

| Role         | Size | Weight | Line height | Tracking | Use |
|--------------|------|--------|-------------|----------|-----|
| display-xl   | 40px | 500    | 1.1         | 0        | Hero product name on black ("Osmo Pocket 4") |
| display-lg   | 32px | 500    | 1.125       | 0        | Section heads, editorial headline |
| display-md   | 32px | 600    | 1.125       | -0.96px  | Rare emphasis head |
| heading-md   | 24px | 500    | 1.5         | 0        | Sub-section head |
| heading-sm   | 20px | 500    | 1.2         | 0        | Product card title |
| body-lg      | 16px | 400    | 1.5         | -0.32px  | Paragraph copy |
| body-md      | 14px | 400    | 1.43        | -0.28px  | Card metadata, nav labels, button label |
| body-sm      | 12px | 400    | 2.0         | 0        | Legal, footer links |
| caption      | 12px | 500    | 2.0         | 0        | Promo strip, micro-heads |

Quirk worth keeping: DJI tightens *body* tracking slightly and leaves display at 0, the reverse of most type systems. Weight 500 is the display tier; 600 is rare. On wide screens you may scale the hero up (the whole system favors a few large words), but keep weight 500.

## 5. Shape and elevation

**Radius is polarized:**
- `0` for full-bleed tiles, hero canvas, footer.
- `4px` for product cards, inputs, editorial card. Structural surfaces.
- `pill` (effectively a full pill, `9999px` works) for every primary and secondary button.
- `50%` for circular icon controls and avatars.
- A rare `60px` large pill appears on promo strips.
- Nothing between 4px and the pill. A 12px or 24px card corner breaks the system.

**Elevation:** effectively none. No card shadows. Elevation is surface contrast (black tile vs white tile) and the grey wash under product photos so silver drone bodies read. Hairlines are `1px` in `#6c7073` or `#eeeeed` and used sparingly.

## 6. Spacing and layout

- 8px base unit. Scale: 4, 8, 12, 16, 24, 48, 112 (section).
- Section top padding 112px; horizontal tile padding 48px; card padding 24px; editorial card padding 48px.
- Nav bar: 64px tall, white, `0 48px` padding, no border or shadow.
- Product grid: 2-up on desktop, 1-up on mobile. Hero full bleed with product centered in roughly a 1392px content frame.
- Whitespace: nothing crowds the aircraft. At least 24px of air around a product render in a card, 16px minimum to nearest content.
- The footer is the one place density is allowed (multi-column link lists, 12px text).

## 7. Components

- **Primary button**: bg `#0070d5`, white text, 14px/400, full pill, height 32px, padding `8px 16px` (extra left padding, about 34px, when a leading icon is present). Press state: a slight `scale(0.97)`, no color change.
- **Secondary button**: white fill, `#0070d5` text, 1px `#0070d5` border, full pill. Used beside the primary ("Learn More" next to "Buy Now").
- **Accent chip**: bg `#3b63a9`, white text, pill, `5px 16px`. Tertiary only.
- **Text link**: inline anchor in Sky blue or inherited text color. (Not `#0000ee`; see section 1.)
- **Top nav** (categories verified live): wordmark left, then Camera Drones, Handheld, Power, Specialized (Enterprise, Agriculture, DJI Delivery), Explore (Who We Are, SkyPixel, DJI Forum, Media Center, DJI Trust Center, DJI Blog, Careers), Support, Where to Buy; on the right search, account, region ("United States") and Store with a cart. 14 to 16px text.
- **Search input**: 32px tall, 4px radius, 1px `#6c7073` stroke, `4px 0 4px 12px` padding.
- **Hero slide**: descriptor (14px) then product name (40px/500) then tagline, then the CTA pair (Learn More + Buy Now; enterprise products get Learn More only), over a full-bleed product photo. Slides rotate, with a row of product-name tabs underneath to jump between them.
- **Product card**: descriptor, product photo, name, tagline, then Learn More / Buy Now. 4px radius, 24px padding, title 20px/500, meta 14px in `#6c7073`.
- **Utility card**: `#eeeeed` bg, small label ("Product Info"), title ("Compare Camera Drones"), one line, then "Help Me Choose" and "Buy Now". Sits as the last cell of the product grid.
- **Category card**: `#3b63a9` fill, white text, field name ("Enterprise"), one-line descriptor ("Drone Solutions for a New Generation of Work"), Learn More. Three in a row.
- **Service row**: three short items (Where to buy, Support, Fly Safe), each with a Learn More link.
- **Stories block**: section heading plus one mission sentence, then editorial cards with a small category label, a headline, and Learn More. Use full-bleed landscape photography with white text overlaid.
- **"Shot on" gallery**: sample footage or photos with a small "Shot on" label above the product name and a Learn More link. A strong trust device for camera products.
- **Spec strip** (extrapolated from the brand's spec-forward style): 3 or 4 big numbers ("1″ CMOS", "8K", "46 min") with 12 to 14px captions, on a black or white tile. Mark this as an extension, not extracted.

## 8. Photography

- Hero: full-bleed product render on pure black, dead center, rectangular (no rounding).
- Cards: 1:1 or 4:3 silver or matte-black hardware on the `#eeeeed` wash, 4px corners.
- Editorial: wide 21:9 landscape with a human operator and aircraft in scale against nature (alpine water, ridgelines, coast). Natural light, real places, sense of altitude and freedom.
- When no real image is available, use a flat labeled placeholder block in the right ratio rather than a gradient or illustration. Say it is a placeholder.

## 9. Motion

Restraint, matching the flat look: subtle fade or slide on tile entry, video backgrounds in heroes, a small scale on button press. Keep durations about 200 to 500ms with `ease-out`. Wrap non-essential motion in `prefers-reduced-motion: no-preference`. Auto-playing video should be muted, looped, with a static poster.

## 10. Do and don't

Do: alternate dark and light surfaces; one Sky-blue pill per action; brand blue only as a card surface; Open Sans 500 for display; 4px cards; photography as the mood; real specs; 112px section air.

Don't: gradients or glow behind products; card shadows; radii between 4px and a pill; blue headlines or blue backgrounds for whole sections (brand-blue cards, yes; brand-blue page bands, no); `#0000ee` links; a second typeface; merging the two blues; grey-tinted body text for "softness"; busy icon grids; decorative illustrations in place of product imagery.
