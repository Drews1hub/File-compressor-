# Apple design system reference

## Contents
1. Sources and confidence
2. Typography
3. Color
4. Space and layout
5. Marketing mode (apple.com)
6. App mode (HIG / iOS-macOS)
7. Liquid Glass and materials
8. Motion
9. Icons and imagery
10. Do and don't

## 1. Sources and confidence

- Apple Human Interface Guidelines (developer.apple.com/design): principles Clarity, Deference, Depth, plus Consistency. Official.
- Dynamic Type scale, 44pt tap target, semantic system color names, Liquid Glass (introduced June 2025, iOS 26 / macOS Tahoe 26 generation): official.
- apple.com marketing values: **measured from the live site on 2026-10-29** (homepage at 1440px and 390px, and the iPhone product page at 1440px), using computed styles and apple.com's own `--sk-*` CSS custom properties. These are what the site ships, but Apple doesn't publish them as a spec, and they shift between pages and redesigns.
- 8pt grid with 4pt subdivisions: a reliable convention that matches Apple's output, not an Apple mandate.

## 2. Typography

**Family.** SF Pro (Display for large sizes, Text for small), New York as the companion serif, SF Mono for code. apple.com ships `"SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif` as a webfont it hosts itself. You can't embed SF on other sites, so on the web use the system stack:

```
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
             "Helvetica Neue", Helvetica, Arial, sans-serif;
```

**App mode: iOS Dynamic Type at the default size.** Name styles by role, not pixel.

| Style       | Size | Weight                  |
|-------------|------|-------------------------|
| Large Title | 34   | Regular (bold emphasis) |
| Title 1     | 28   | Regular (bold)          |
| Title 2     | 22   | Regular (bold)          |
| Title 3     | 20   | Regular (semibold)      |
| Headline    | 17   | Semibold                |
| Body        | 17   | Regular                 |
| Callout     | 16   | Regular                 |
| Subhead     | 15   | Regular                 |
| Footnote    | 13   | Regular                 |
| Caption 1   | 12   | Regular                 |
| Caption 2   | 11   | Regular                 |

17pt body is the legibility floor for arm's-length reading. Hierarchy comes from the jump between styles.

**Marketing mode (apple.com), measured 2026-10-29.** Desktop is 1440px wide; mobile is 390px.

| Role                         | Desktop size / line height | Mobile    | Weight | Tracking  | Where |
|------------------------------|----------------------------|-----------|--------|-----------|-------|
| Page title (product page)    | 80 / 84px                  | (smaller) | 600    | -1.2px    | "iPhone", left-aligned at the top of a product page |
| Hero tile headline           | 56 / 60px                  | 32 / 36px | 600    | -0.28px   | Product name on a full-width homepage tile |
| Section headline             | 48 / 52px                  | 32 / 36px | 600    | -0.144px  | "Explore the lineup." Left-aligned on product pages |
| Promo tile headline          | 40 / 44px                  | 32 / 36px | 600    | normal    | 2-up homepage tiles |
| Hero subhead                 | 28 / 32px                  | 19 / 23px | 400    | +0.196px  | "Hello, hello." under the hero headline |
| Card headline                | 28 / 32px                  |           | 600    | +0.196px  | Feature cards ("Love it. Lease it. Upgrade it.") |
| Feature-card title           | 24 / 28px                  |           | 600    | +0.216px  | |
| Promo tile subhead           | 21 / 25px                  | 19 / 23px | 400    | +0.231px  | |
| Availability line            | 19 / 23px on hero, 14 / 18px on promo | 14px | 400 | | "Available starting 11.6" in tertiary grey |
| Body / eyebrow / buttons     | 17 / 21-25px               | 17px      | 400 (600 for card eyebrows) | -0.374px | |
| Small body / small buttons   | 14 / 18px                  | 14px      | 400    | -0.224px  | |
| Footer and legal             | 12 / 16px                  | 12px      | 400    | -0.12px   | |

What this tells you:
- Headlines stay at weight 600. Subheads drop to 400 and lose a lot of size, which is where the contrast comes from.
- Tracking tightens as size grows (-1.2px at 80px) and loosens slightly at subhead sizes (+0.2px at 21 to 28px). Body text is tightened a little (-0.374px at 17px).
- Mobile uses one headline size for every tile (32px) and one subhead size (19px).
- The homepage centers its hero and promo tile copy. Product pages left-align their page title and section headlines and put a "Compare all models >" style link on the same line, aligned right.

## 3. Color

Design to roles first, hex second.

**Semantic roles (app mode):** `label`, `secondaryLabel`, `tertiaryLabel`, `separator`, `systemBackground`, `secondarySystemBackground`, `systemBlue` (accent), plus `systemRed/Orange/Yellow/Green/Teal/Indigo/Purple/Pink` for status and data. Gray ramp is `systemGray` through `systemGray6`. These adapt to light, dark, and increased contrast.

**Web values, taken from apple.com's own `--sk-*` custom properties on 2026-10-29:**

| Role                         | Light                         | Dark            | Site variable |
|------------------------------|-------------------------------|-----------------|---------------|
| Page canvas                  | `#ffffff`                     | `#000000`       | `--sk-fill` |
| Off-white fill               | `#fafafc`                     | `#161617`       | `--sk-fill-secondary`, nav menu open |
| Alternate band / tile        | `#f5f5f7`                     | `#1d1d1f`       | `--sk-fill-tertiary`, `--global-section-background-color-alt(-dark)` |
| Primary text                 | `#1d1d1f`                     | `#f5f5f7`       | `--sk-glyph-gray` |
| Secondary text               | `#6e6e73`                     | `#a1a1a6`*      | `--sk-glyph-gray-secondary` |
| Tertiary text (availability) | `#86868b`                     | `#86868b`       | `--sk-glyph-gray-tertiary` |
| Hairline / quiet fill        | `#d2d2d7`, `#e8e8ed`          | `#424245`*      | `--sk-fill-gray-tertiary/-quaternary` |
| Action fill (filled button)  | `#0071e3`                     | `#0071e3`       | `--sk-fill-blue`, also `--sk-focus-color` |
| Link / outline button        | `#0066cc`                     | `#2997ff`       | `--sk-glyph-blue`; `#2997ff` measured on dark tiles |
| "New" eyebrow                | `#b64400` (text), `#f56300` (fill) |            | `--sk-glyph-orange`, `--sk-fill-orange` |
| Success / error              | `#008009` / `#e30000` text, `#03a10e` / `#e30000` fill | | `--sk-glyph-green/-red` |

\* Not exposed as a site variable; a commonly used dark-mode value.

Alpha variants exist for text on tinted surfaces: primary `rgba(0,0,0,.88)`, secondary `rgba(0,0,0,.56)`, tertiary `rgba(0,0,0,.48)`. The footer uses them (headings `.88`, links and legal `.56`).

Rules: pure black for dark product tiles, near-black (`#1d1d1f`) rather than `#000` for body text, `#f5f5f7` tiles and sections for rhythm, blue only on things you can act on. The one place color shows up in a headline is a product's own wordmark or a single gradient word (the homepage's "PROLED XDR Display" subhead is set in product colors). Treat that as a product-specific exception and avoid it in generic work.

## 4. Space and layout

- 8pt grid, 4pt subdivisions.
- Product-page sections: 144px top padding (`--global-section-padding`), 120px reduced. Homepage hero tiles: about 56px from the tile top to the headline, with the image filling the rest.
- Widths from the site: content max 1260px (`--global-content-max-width`), hero max 1680px. Text columns stay narrow (about 600 to 700px).
- Global nav 44px; product sub-nav ("local nav") 52px.
- Minimum tap target 44x44pt. Large buttons on apple.com are exactly 44px tall.
- Alignment is strict. Things line up on a few shared edges, and that is what makes the page feel engineered.
- Tiles and cards: see section 5. No borders, no drop shadows on flat tiles. Depth comes from contrast (a white card on a `#f5f5f7` section).

## 5. Marketing mode (apple.com)

### Homepage

1. **Global nav**: 44px, fixed, 12px links centered, logo left, search and bag right. On the homepage it is dark glass: `rgba(29,29,31,0.8)` with `backdrop-filter: saturate(1.8) blur(20px)`. On light product pages it is light and translucent.
2. **Hero tiles**: full-width, about 692px tall on desktop. They stack with 12px of white gap between them, and the background alternates black and `#f5f5f7`. Each tile, centered top to bottom:
   - product name (56px/600), which is the headline
   - one-line subhead (28px/400), often a playful sentence ("Hello, hello.") or a fact ("14-inch model now with M6.")
   - optional availability line (19px, tertiary grey): "Available starting 11.6"
   - **button pair**: primary filled pill **"Learn more"** (white on `#0071e3`) and secondary outline pill **"Buy" / "Shop" / "Pre-order"** (transparent, 1px border and text in link blue). Large size: 17px text, 44px tall, `11px 21px` padding, `border-radius: 980px`.
   - product image fills the lower part of the tile, often bleeding off the bottom.
3. **Promo grid**: 2-up tiles, each about 702 x 580px, with 12px gaps showing white between them. They alternate `#f5f5f7` and black in a checkerboard. Square corners on the homepage. Same anatomy, smaller: 40px headline, 21px subhead, 14px availability line, small buttons (14px, 36px tall, `8px 15px` padding).
4. **Media gallery** ("Endless entertainment."): a 56px headline over a horizontal carousel of 16:9 video tiles. Each tile has a **white pill** button ("Stream now", "Watch now", "Play now", "Listen now") and one line of copy. Dot pagination and a play/pause control sit below.
5. **Footer**: footnotes first (numbered, 12px, `rgba(0,0,0,.56)`), then a multi-column directory with 12px headings and links, then the copyright line. The footer is the only dense area on the page.

The background change *is* the section divider; don't add rules or borders.

### Product page (iPhone page pattern)

1. Optional thin promo ribbon under the nav (14px, one sentence, a "Learn more >" link).
2. Page title, 80px/600, left-aligned, then a **chapter nav**: a row of small product images with 12px labels ("iPhone Duo", "iPhone 18 Pro", "Compare", "Accessories"), a "New" tag in orange under new items.
3. **Rounded media cards** in a horizontal scroller, `border-radius: 28px`, image-filled, with the headline and subhead top-left and the button pair top-right ("Buy" outline + "Learn more" filled).
4. **"Explore the lineup."** section on `#f5f5f7`: 48px left-aligned headline with a right-aligned text link ("Compare all models >"). Below it, product tiles in a horizontal scroller: image, color swatches, "New" eyebrow, name (about 20px/600), a one-line pitch (17px/600), price lines (14px), then **"Learn more"** filled pill and a **"Buy >"** text link.
5. **Feature cards** ("Why Apple is the best place to shop iPhone."): white cards on `#f5f5f7`, `border-radius: 28px`, 32px padding, 17px/600 eyebrow ("Apple Upgrade"), 28px/600 headline, 17px body, image pinned to the bottom, round "+" or ">" control bottom-right. Previous/next arrow buttons below the scroller.
6. More sections (accessories, "Significant others." ecosystem section), then a closing link directory with columns "Explore iPhone / Shop iPhone / More from iPhone", then the footer.

### Buttons and links (measured)

| Kind              | Fill                     | Text                           | Border                  | Size |
|-------------------|--------------------------|--------------------------------|-------------------------|------|
| Primary pill      | `#0071e3`                | white                          | 1px transparent         | 17px / 44px tall or 14px / 36px tall |
| Secondary pill    | transparent              | `#0066cc` (light), `#2997ff` (dark) | 1px same blue      | same |
| Media pill        | white (or `#f5f5f7`)     | black                          | none                    | 14 to 17px |
| Text link         | none                     | `#0066cc` / `#2997ff`, with " >" chevron | none          | inherits |

Radius is always `980px`. "Learn more" is the filled one; the buying action is the outline one. There is never more than one filled button in a tile.

Scroll behavior: headlines and images reveal with a slight fade/translate as they enter, galleries autoplay with a visible pause control, some sequences pin while content changes. Always provide a static fallback when reduced motion is requested.

## 6. App mode (HIG / iOS-macOS)

- Navigation: large title that collapses on scroll, tab bar (bottom, iOS) or sidebar (macOS/iPad), back-chevron + label.
- Lists: inset grouped lists with rounded group containers, hairline separators inset from the leading edge, trailing chevrons for drill-in, disclosure in secondary grey.
- Controls: segmented control for 2 to 5 mutually exclusive views, toggle switches (green on), filled buttons for the single primary action, plain text buttons for secondary.
- Sheets for focused tasks (bottom sheet with grabber on iOS), alerts only for must-answer decisions with 2 clear verbs, destructive action in red.
- Search lives at the top of the content, pull-down or in the bar.
- States: always design empty, loading, and error states with a short sentence and one action.
- Support light and dark, and scale with Dynamic Type; don't clip text.
- Data viz: restrained, a single accent hue plus greys, labels direct on the chart, no 3D, no chart junk.

## 7. Liquid Glass and materials

Liquid Glass (2025) is a translucent material that reflects and refracts what is behind it. Navigation bars, tab bars, toolbars, sheets, and floating controls become a distinct functional layer above content that gives way to it. On the web, approximate with what apple.com's own nav uses:

```
background: rgba(255,255,255,0.72);          /* light */
background: rgba(29,29,31,0.8);              /* dark, as on the apple.com homepage nav */
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
```

Use glass for the controls layer only (bars, floating buttons, sheets), never for body content. Content stays opaque and readable; glass sits above it. Keep a solid fallback when `backdrop-filter` isn't supported.

## 8. Motion

- Duration 200 to 500ms for UI, up to ~700ms for hero reveals. apple.com's gallery uses 800ms slides and 600ms copy fades.
- Easing is smooth and slightly decelerating, e.g. `cubic-bezier(0.28, 0.11, 0.32, 1)` or `ease-out`. No bounce or elastic on productivity UI. Springs are allowed on touch gestures in native-style mocks.
- Animate opacity and transform only. Stagger sparingly.
- Anything that autoplays needs a visible pause control.
- Wrap all non-essential motion in `@media (prefers-reduced-motion: no-preference)`.

## 9. Icons and imagery

- Icons: line icons with consistent weight matching the text weight (SF Symbols feel). Use simple inline SVG strokes (stroke-width about 1.5 to 2, round caps). Never emoji as icons in an Apple-style UI.
- Imagery: large, high-quality, product-forward, one subject per frame, lots of negative space. Products often bleed off the tile edge. When no real image is supplied, use a clean placeholder block (soft grey, labeled) and say so, rather than generating clutter.
- Rounded corners everywhere are continuous ("squircle") in native UI; on the web a plain `border-radius` is fine.

## 10. Do and don't

Do: one filled blue pill per tile, with an outline pill beside it; big short headlines at 600; lighter, smaller subheads; alternate black and `#f5f5f7` tiles with thin white gaps; 28px-radius cards on product pages; generous whitespace; thin chrome; 44pt targets; semantic colors; glass only on the control layer; support dark mode.

Don't: second display font; colored headlines (product wordmarks aside); borders and shadows on everything; gradient or patterned page backgrounds; dense bullet walls; two filled buttons side by side; centered long paragraphs; stock-icon or emoji decoration; bouncy animation; hardcoding hex as if Apple published it.
