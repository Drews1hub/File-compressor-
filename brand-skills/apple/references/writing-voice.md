# Apple writing voice reference

## Contents
1. Two registers
2. Core principles (Apple Style Guide)
3. Marketing copy: headlines, taglines, product descriptions
4. UI strings and errors
5. Documentation and how-to steps
6. Naming and mechanics
7. Before / after examples
8. Edit pass

## 1. Two registers

Apple writes in two related but different registers. Pick one deliberately.

- **Marketing register** (apple.com, announcements, keynote slides): confident, spare, benefit-led. Fragments allowed. Rhythm matters.
- **Instructional / UI register** (Apple Style Guide, support articles, interface text): plain, exact, friendly. Full sentences, no flourish.

Both share the same temperament: warm without chatter, confident without hype, specific instead of vague.

## 2. Core principles (from the Apple Style Guide)

The Apple Style Guide (June 2025) governs text in Apple's instructional materials, documentation, and user interface, and tells third-party developers to follow it for user-facing text. It defers to *The Chicago Manual of Style* for style and *Merriam-Webster's Collegiate Dictionary* for spelling, and uses U.S. English conventions. Its voice rules, in practice:

1. **Active voice, present tense, second person.** "You can connect your iPhone to a Mac." Not "Your iPhone may be connected to a Mac."
2. **Specific over generic.** "Choose File > Save." Not "Use the menu to save the file."
3. **Plain words over jargon.** "Turn on" over "activate". "Log in" over "authenticate" (unless authenticate is technically exact).
4. **Don't make the product the subject of what the user does.** "You can create a database with FileMaker Pro." Not "FileMaker Pro allows you to create a database."
5. **Things appear; they aren't displayed.** "The setup assistant appears."
6. **Say why, not what, in code comments.**
7. **Respect product names exactly** (see section 6).

## 3. Marketing copy

**Live examples (apple.com, captured 2026-10-29).** Use these as the calibration set.

| Product name (headline) | Line under it |
|-------------------------|---------------|
| iPhone Duo | Hello, hello. |
| iPhone 18 Pro | Pro further. |
| MacBook Pro | 14-inch model now with M6. |
| iMac | Allllll that. And a brand-new chip. |
| iPad mini | More than a little awesome. |
| Apple Watch Series 12 | The most accurate heart rate sensing in a wearable. |
| Apple Upgrade | Love it. Lease it. Upgrade it. |
| Apple Card | Get up to 3% Daily Cash back with every purchase. |

Section headlines: "Endless entertainment." "Explore the lineup." "iPhone essentials." "Significant others." "Why Apple is the best place to shop iPhone."
One-line product pitches in a lineup: "Foldable. Posable. And durable." "Incredibly light and thin with pro performance." "Powerful, durable, and delightful." "Feature stacked. Value packed."

**How a product tile reads**
- The headline is the **product name** with no period. The line under it carries the voice, and it ends with a period.
- That line is one of two things: a playful, short sentence ("Hello, hello.", "Pro further.") or one plain fact ("14-inch model now with M6."). Pick one; don't combine them.
- An optional availability line follows: "Available starting 11.6". Facts that need a qualifier get a footnote number, and the footnote goes in the page footer.

**Headlines (section and campaign)**
- 2 to 6 words. One idea. A complete thought that ends with a period, even when it is a fragment: "Endless entertainment." "Significant others." "Think different."
- Lead with the benefit or a feeling, not the spec. The spec comes in the line below.
- Wordplay is allowed when it is light and short: a pun ("Significant others." for devices that work together), a stretched word ("Allllll that."), a repeated word ("Hello, hello."). One per headline.
- Prefer concrete nouns and strong verbs. Cut adverbs and intensifiers ("really", "very", "amazing").
- Rhythm: short, short, slightly longer. Parallel structure in pairs and triplets works ("Love it. Lease it. Upgrade it." "Feature stacked. Value packed.").

**Subheads / lead lines**
- One sentence, 10 to 25 words, plain and specific. This is where the number or proof goes: "Get up to 3% Daily Cash back with every purchase." Quantify when it is true and meaningful.

**Product descriptions**
- Start with what it lets you do, then how. Product name as subject is fine in marketing ("iPhone captures..."); the "don't make the product the subject" rule is for instructions.
- One feature per paragraph, one claim per sentence. Superlatives only when they are factual and defensible, and footnote them ("The most accurate heart rate sensing in a wearable.1").
- Use "you" and "your" sparingly and naturally; marketing is often impersonal and declarative.

**Calls to action** (sentence case, never Title Case): "Learn more", "Buy", "Shop", "Pre-order", "Apply now", "Compare all models", "Stream now", "Watch now", "Play now", "Listen now", "Watch the film". Text links take a trailing chevron ("Buy >", "Compare all models >"). Short verbs, no exclamation marks.

**Avoid**: exclamation points, hype ("revolutionary", "game-changing", "cutting-edge", "next-level"), jargon stacks, rhetorical questions as headlines, ALL CAPS, emoji, stacked buzzwords.

## 4. UI strings and errors

- Buttons and menu items are verbs: "Continue", "Turn On", "Choose Photo", "Delete". Name the action, not "OK" (unless it is only an acknowledgement).
- Alerts: a short title that states the situation as a sentence or question, one line of explanation if needed, and two clearly labeled actions. Destructive action named explicitly: "Delete Photo" not "Yes".
- Errors: say what happened, then what the person can do. No blame, no codes up front, no "Oops". "Couldn't connect to the network. Check your connection and try again."
- Empty states: one sentence about what goes here and one action. "No Photos. Add photos to see them here."
- Placeholder and helper text is brief and concrete.
- Be consistent: the same thing has the same name everywhere.

## 5. Documentation and how-to steps

- One action per numbered step, in the order the person performs it, starting with a verb: "Open Settings. Tap Wi-Fi. Turn on Wi-Fi."
- Name UI elements as they appear on screen, in the correct vocabulary: you *choose* a menu item, *click* a button or link on Mac, *tap* on touch devices, *turn on/off* a setting, *select* an item or text, *enter* text in a field.
- State the result after the step when it helps: "The sheet appears."
- Put the goal first ("To add a contact, ..."), then the steps. Add a short note for a common problem instead of a long troubleshooting essay.

## 6. Naming and mechanics

- **Product names are exact:** iPhone, iPad, iPadOS, macOS, watchOS, visionOS, MacBook Air, Apple Watch, AirPods, Apple Pencil, App Store, iCloud, AirDrop, FaceTime, Siri. Never "Airpods", "I-phone", "ICloud".
- **Numbers:** spell out zero through nine, use digits for 10 and up, always digits with units and percentages ("5 GB", "20%"). Use "4K", "2D", "24/7" as written. Check the guide for edge cases before finalizing.
- **Compounds:** hyphenate a compound modifier before a noun ("user-friendly app"), not after the verb ("the app is user friendly").
- **Punctuation:** serial comma. Straight consistency over decoration. Use an en dash for ranges, avoid stacking em dashes; a period often works better than a dash.
- **Capitalization:** headlines and taglines in marketing are sentence-style with a final period, and buttons on apple.com are sentence case ("Learn more", "Apply now"); product and feature names keep their official caps. For button, menu, and heading capitalization in UI and docs, look up the entry in the Apple Style Guide capitalization rules rather than guessing.
- **Inclusive language:** write for everyone; avoid idioms that don't translate, avoid ableist or violent metaphors, and prefer neutral terms (allowlist/blocklist, primary/secondary).
- **International:** plain, translatable sentences, no idioms or puns in text that will be localized.

Full source: Apple Style Guide, https://support.apple.com/guide/applestyleguide/welcome/web

## 7. Before / after

| Before | After |
|--------|-------|
| Our revolutionary new phone is packed with amazing next-gen features you'll love! | iPhone. Meet the one that does it all. |
| The battery has been optimized to provide extended usage time. | All-day battery. Then some. |
| Click here to activate the Wi-Fi functionality. | Turn on Wi-Fi in Settings. |
| Oops! Something went wrong. Error 5003. | Couldn't save. Check your connection and try again. |
| The file can be displayed by double-clicking the icon. | Double-click the icon to open the file. |
| Utilize our cutting-edge platform to leverage your data. | See all your data in one place. |

## 8. Edit pass

1. Read the draft aloud. Cut any word you wouldn't say.
2. Cut a third. Then check it still makes complete sense.
3. Replace every adjective with a fact, or delete it.
4. Convert passives to active, future/conditional to present, third person to "you" (in instructions).
5. Check names, numbers, and capitalization against section 6.
6. Does the headline end with a period and fit on one line at large size?
