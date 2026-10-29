---
name: dji
description: Make anything look, feel, and read like DJI, the drone and camera brand. Covers DJI's web visual style (photography-led square tiles, uppercase product wordmarks, chevron text links and white outline pills, Open Sans, one blue Store button) and DJI's marketing voice (category descriptor line plus a short imperative tagline like "Chase the View", Title Case CTAs, spec-forward product naming). Use this skill whenever the user says "DJI style", "DJI-like", "like dji.com", "drone brand", "Osmo", "Mavic", "Mini", "Ronin", "hardware catalog page", "aerial/cinematic product page", or asks for a landing page, product page, spec sheet, product tagline, product description, or slide deck that should feel like a camera, drone, or gimbal brand, even if they never say "design system".
---

# DJI

Build things the way DJI presents them: a hardware catalog staged like an aerospace gallery. The product and its photography are the point; the page is a quiet, flat frame around them. This skill has two halves, and most requests need both.

- **Look** (design): surfaces, type, color, shape, layout. Read `references/design-system.md`.
- **Voice** (writing): descriptor lines, taglines, CTAs, product descriptions, specs. Read `references/writing-voice.md`.

Pick the half the request needs, read that reference, then build. For a whole page, use both.

## The idea underneath everything

1. **Photography is the surface.** Every hero, tile, and card is a photograph: cinematic scenes in the hero, soft grey studio shots in the product grid, blue sky in the category cards. DJI uses no glows, gradients, or flat color bands. The page around the photos is plain white.
2. **One stack, repeated.** Each tile centers the same short stack at the top: a grey descriptor eyebrow, the product name as an uppercase wordmark, a short tagline, then CTAs. The photo fills the rest.
3. **CTAs are quiet.** "Learn More ›" and "Buy Now ›" are chevron text links, or white outline pills on hero photos. Blue is reserved for the single Store button.
4. **Say what it is, then name the feeling.** Every product gets a plain descriptor ("Dual-Camera Drone for Travel Photography") and a short imperative tagline ("Chase the View").

When a decision isn't covered, ask: *does this help the product photograph read better, or compete with it?* Remove whatever competes.

## Workflow

1. **Identify the surface:** marketing/catalog page, product launch page, spec or comparison table, deck, or pure copy.
2. **Read the matching reference file(s).** Don't work from memory.
3. **Start from tokens.** For HTML/CSS, copy `assets/dji-tokens.css` into the page and build on its variables.
4. **Write the words with the same discipline.** Descriptor plus tagline plus CTA, nothing more above the fold.
5. **Run the checklist** below before presenting.

## Quick rules

- Homepage order: hero carousel (800px), 2x2 product grid, "Shot on" carousel, stories, three photo category cards, pale service band (`#f7f9fa`), dark footer (`#272727`).
- Square corners on every tile and card, with 16px gaps. Pills only for buttons. 4px only on dialog buttons and inputs. No shadows.
- Text is ink at three alpha levels: `rgba(0,0,0,.85)` for headings and CTAs, `.65` for body, `.45` for eyebrows. On photos, use white and white at 65%.
- Open Sans for all UI text. Product names are uppercase wordmarks in a geometric sans (DJI ships them as images); never copy DJI's actual wordmarks.
- Type: 40px section headings, a 32 to 36px wordmark, 20px/500 taglines, 16px eyebrows and CTAs. Mobile: 28px headings and 18px taglines.
- CTAs: "Learn More ›" / "Buy Now ›" as 16px text links; on hero photos, 32px white outline pills (1px border). Sky blue `#0070d5` only on the one Store/buy button.
- `#3b63a9`, `#eeeeed`, and `#ededed` are image placeholder colors, not a palette.
- Copy: Title Case taglines (no period), plain descriptor lines with real specs, no hype words.

## Honest limits

- Measured from the live dji.com on 2026-10-29 with its stylesheets loaded (desktop 1440px, mobile 390px). These are the values the site ships, not an official spec. Hover states, product subpages, and the DJI app interfaces were not captured, so don't claim to reproduce those exactly.
- The voice guidance is drawn from DJI's own homepage copy (re-checked live). It describes patterns, not an official style guide.
- Produce work *in the style of* DJI, not as DJI. Don't recreate the DJI logo or product wordmarks, use DJI product photography, or imply DJI endorsement. Use placeholder imagery, clearly labeled, or the user's own photos. DJI and product names are trademarks of SZ DJI Technology.

## Final checklist

- [ ] Is every hero, tile, and card carried by a photo (or a labeled placeholder), with no gradients or flat color bands?
- [ ] Does each tile center eyebrow, wordmark, tagline, and CTAs in its top third?
- [ ] Are tiles square-cornered with 16px gaps, and are pills used only for buttons?
- [ ] Are CTAs chevron text links (or white outline pills on hero photos), with blue used for the single buy button only?
- [ ] Is text in ink .85 / .65 / .45 rather than arbitrary greys?
- [ ] Does each product have a descriptor line and a short imperative tagline?
- [ ] Are CTA labels short and in Title Case ("Learn More", "Buy Now")?
- [ ] Are claims specific (sensor size, resolution, flight time) and not adjectives?
