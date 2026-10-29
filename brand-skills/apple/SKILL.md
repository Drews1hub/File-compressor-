---
name: apple
description: Make anything look, feel, and read like Apple. Covers Apple's visual design language (Human Interface Guidelines, SF Pro typography, apple.com marketing pages, Liquid Glass, iOS/macOS-style UI) and Apple's writing voice (Apple Style Guide, short confident product copy, plain UI strings). Use this skill whenever the user says "Apple style", "Apple-like", "like apple.com", "iOS style", "iPhone-style", "HIG", "Cupertino", "minimal like Apple", "keynote style", or asks for a landing page, product page, app UI, dashboard, slide deck, poster, tagline, product description, release notes, or UI copy that should feel premium, clean, and Apple-ish, even if they never say the word "design system".
---

# Apple

Build things the way Apple would: calm, precise, content first. This skill covers two connected halves, and most requests need both.

- **Look** (design): layout, type, color, space, motion, components. Read `references/design-system.md`.
- **Voice** (writing): headlines, product copy, UI strings, documentation. Read `references/writing-voice.md`.

Pick the half the request needs, read that reference, then build. If the user wants a whole page or app, use both: the words are part of the design, and Apple never lets one carry the other.

## The idea underneath everything

Apple's Human Interface Guidelines rest on three principles. Every concrete rule below is one of these applied.

1. **Clarity.** Text is legible at every size, icons are precise, decoration is subtle. If an element doesn't help someone understand or act, remove it.
2. **Deference.** The interface serves the content and never competes with it. Chrome (nav, borders, controls) is thin and quiet. The product, photo, or message gets the weight.
3. **Depth.** Layers, translucency, and motion show hierarchy and relationship. Depth is functional (what sits above what), never ornamental.

Consistency ties them together: reuse the same few patterns everywhere so people never relearn anything.

When a decision isn't covered by a rule, ask: *what would make this quieter and clearer?* That is almost always the Apple answer.

## Workflow

1. **Identify the surface.** Marketing page (apple.com feel), native-style app UI (iOS/macOS feel), slides, or pure copy. The two visual modes differ (see below).
2. **Read the matching reference file(s).** Don't work from memory; the reference has the tokens and the do/don't lists.
3. **Start from the tokens.** For HTML/CSS output, copy `assets/apple-tokens.css` into the page and build on its variables instead of inventing values.
4. **Write the words with the same care.** Draft headlines and labels using `references/writing-voice.md`, then cut them by a third.
5. **Run the checklist** at the bottom before presenting.

## Two visual modes

**Marketing mode (apple.com).** On the homepage, a stack of full-width product tiles alternating black and soft grey (`#f5f5f7`), separated by thin 12px white gaps, then a 2-up checkerboard of smaller tiles. Each tile: product name as the headline, one short line under it, a filled "Learn more" pill next to an outline "Buy" pill, and the product image filling the rest. Product pages switch to a left-aligned 80px title, 28px-radius cards in horizontal scrollers, and `#f5f5f7` sections. Use for landing pages, product pages, announcements, keynote-style slides.

**App mode (HIG / iOS-macOS).** Dense-but-calm functional UI: Dynamic Type scale, semantic system colors that adapt to light/dark, grouped lists, 44pt tap targets, translucent Liquid Glass bars floating over content, SF Symbols-style line icons. Use for dashboards, tools, settings screens, mobile mockups.

If unclear, ask which one in a single short question; otherwise default to marketing mode for anything public-facing and app mode for anything interactive or tool-like.

## Hard-won rules (quick reference)

- One typeface family: SF Pro (system stack in the browser). Weight and size make hierarchy, not extra fonts.
- One accent color (Apple blue). Blue means "you can act on this". Never use it for headlines or decorative fills.
- Buttons come in pairs: one filled blue pill ("Learn more") and one outline pill in link blue ("Buy", "Shop", "Pre-order"). Never two filled buttons side by side. Labels are sentence case.
- Whitespace does the hierarchy work. When a layout feels crowded, remove things before shrinking things.
- Minimum 44x44 pt tap target for anything interactive.
- Design to semantic roles (label, secondary label, background, accent), not scattered hex values, so dark mode comes for free.
- Imagery carries emotion. Never fake it with decorative gradients, stock-icon clutter, or emoji. If there's no real image, let typography and space carry the page.
- Motion is short, eased, and purposeful, and always disabled under `prefers-reduced-motion`.
- Copy: active voice, present tense, second person, plain words. Section headlines are short declarative sentences with a period. On product tiles the product name is the headline (no period) and the voice goes in the line under it ("Hello, hello.", "Pro further.").

## Honest limits

- Apple does not publish exact hex values for its adaptive system colors. The marketing values in the references were measured from the live apple.com on 2026-10-29 (homepage and iPhone page, desktop and mobile), largely from the site's own `--sk-*` CSS variables. They are what the site ships today, not an official spec, and Apple changes them between redesigns.
- SF Pro and SF Symbols are licensed for Apple-platform use and can't be embedded on arbitrary web pages. Use the system font stack (`-apple-system, BlinkMacSystemFont, ...`), which renders SF on Apple devices and a clean fallback elsewhere.
- Produce work *in the style of* Apple, not as Apple. Don't recreate the Apple logo, use Apple product photography, or imply Apple endorsement. Use placeholder imagery or the user's own.

## Final checklist

- [ ] Could any element be removed without losing meaning? Remove it.
- [ ] Is there exactly one accent color, used only for interaction, with at most one filled button per tile?
- [ ] Do headlines read in one breath, in 2 to 6 words where possible?
- [ ] Is every interactive target at least 44pt, and is contrast readable in light and dark?
- [ ] Does the page have a clear rhythm of bands/sections with generous vertical space?
- [ ] Is motion subtle, and does it respect reduced-motion?
- [ ] Do UI labels use plain verbs ("Turn on", "Choose", "Continue") and no jargon?
