---
name: dji
description: Make anything look, feel, and read like DJI, the drone and camera brand. Covers DJI's web visual style (flat black and white product tiles, one Sky-blue pill button, Open Sans, photography-first aerospace-catalog feel) and DJI's marketing voice (category descriptor line plus a short imperative tagline like "Chase the View", Title Case CTAs, spec-forward product naming). Use this skill whenever the user says "DJI style", "DJI-like", "like dji.com", "drone brand", "Osmo", "Mavic", "Mini", "Ronin", "hardware catalog page", "aerial/cinematic product page", or asks for a landing page, product page, spec sheet, product tagline, product description, or slide deck that should feel like a camera, drone, or gimbal brand, even if they never say "design system".
---

# DJI

Build things the way DJI presents them: a hardware catalog staged like an aerospace gallery. The product and its photography are the point; the page is a quiet, flat frame around them. This skill has two halves, and most requests need both.

- **Look** (design): surfaces, type, color, shape, layout. Read `references/design-system.md`.
- **Voice** (writing): descriptor lines, taglines, CTAs, product descriptions, specs. Read `references/writing-voice.md`.

Pick the half the request needs, read that reference, then build. For a whole page, use both.

## The idea underneath everything

1. **Photography is the atmosphere.** DJI does not use glows, gradients, or mesh backgrounds. Mood comes from the image (alpine water, a drone over a ridge), and the page stays flat so the image can carry it.
2. **The surface flip is the divider.** Pure black tile, then white tile, then black. No rules, no shadows, no ornament to separate sections.
3. **One action signal.** A single blue pill button says "act here". Everything else is rectilinear and calm.
4. **Say what it is, then name the feeling.** Every product gets a plain descriptor ("Dual-Camera Drone for Travel Photography") and a short imperative tagline ("Chase the View").

When a decision isn't covered, ask: *does this help the product photograph read better, or compete with it?* Remove whatever competes.

## Workflow

1. **Identify the surface:** marketing/catalog page, product launch page, spec or comparison table, deck, or pure copy.
2. **Read the matching reference file(s).** Don't work from memory.
3. **Start from tokens.** For HTML/CSS, copy `assets/dji-tokens.css` into the page and build on its variables.
4. **Write the words with the same discipline.** Descriptor plus tagline plus CTA, nothing more above the fold.
5. **Run the checklist** below before presenting.

## Quick rules

- Homepage order: hero product carousel, product card grid, "Shot on" gallery, stories, brand-blue category cards, service row, footer. Alternate dark and light surfaces; utility cards sit on a soft grey wash (`#eeeeed`).
- Two blues, two jobs: Sky blue (`#0070d5`) for pill buttons, brand blue (`#3b63a9`) as a full card surface with white text for the category cards (Video Production, Enterprise, Agriculture).
- Open Sans throughout, weight 500 for display, hierarchy by size and weight only. No second display font.
- Primary button: Sky blue (`#0070d5`) full pill, short label ("Buy Now", "Learn More"). Secondary: white pill with a blue outline and blue text.
- Corners are polarized: 4px on cards and inputs, a full pill on buttons, nothing in between.
- No drop shadows, no decorative gradients. Depth comes from surface contrast and photography.
- Hero: 2 to 4 words of product name, large and white on black, product render dead center, about 112px of vertical air above.
- Copy: title-case taglines (no period), plain descriptor lines with real specs, no hype words.

## Honest limits

- Rebuilt from the live dji.com on 2026-10-29. Verified live: page structure and section order, nav, all copy, Open Sans, `#3b63a9`, and `#eeeeed`. DJI's stylesheets are served from a CDN this capture couldn't reach, so type sizes, the Sky CTA blue, radii, and spacing still come from an earlier third-party extraction. Each value in the reference is marked by its source. Hover states and the DJI app interfaces were not captured, so don't claim to reproduce those exactly.
- The voice guidance is drawn from DJI's own homepage copy (re-checked live, unchanged). It describes patterns, not an official style guide.
- Produce work *in the style of* DJI, not as DJI. Don't recreate the DJI logo, use DJI product photography, or imply DJI endorsement. Use placeholder imagery, clearly labeled, or the user's own photos. DJI and product names are trademarks of SZ DJI Technology.

## Final checklist

- [ ] Does each section flip surface (dark / light) rather than use rules or shadows?
- [ ] Is brand blue (`#3b63a9`) used only as a card surface, never on a button or link?
- [ ] Is there exactly one action color, used only on pill buttons (plus plain inline links)?
- [ ] Is every card corner 4px and every button a full pill, with no in-between radii?
- [ ] Is the product image the largest, most colorful thing in each tile?
- [ ] Does each product have a descriptor line and a short imperative tagline?
- [ ] Are CTA labels short and in Title Case ("Learn More", "Buy Now")?
- [ ] Are claims specific (sensor size, resolution, flight time) and not adjectives?
