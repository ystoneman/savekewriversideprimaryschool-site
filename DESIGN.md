# Save Kew Riverside: design system ("riverside poster")

> A vintage park poster for a parent-led school campaign: forest green and cream paper, one bright meadow green for actions, giant condensed headlines and a flat drawing of the Kew riverside.

Read this before changing how any page looks. The implementation is [`design.css`](design.css), which loads after every other stylesheet. Content, journeys and protected first-screen budgets are governed by [AGENTS.md](AGENTS.md) and the [journey register](UX-DESIGN-DECISIONS.md#protected-visitor-journeys); this file covers only the visual system.

## Source and adaptation

The direction is adapted from the **Kikin** style on Refero Styles: <https://styles.refero.design/style/87574d45-e35d-4ffd-8560-99fee4008d2b>. Refero's values are its own reconstruction of kikin.io, not an official brand guide. We took the system (palette roles, type duet, radii, poster rhythm, patch badges) and fitted it to this campaign. We do not use Kikin's name, logo, illustrations or copy.

What changed from the export:

| Kikin export | This site | Why |
|---|---|---|
| Deacon (proprietary display face) | **Archivo**, width 62%, weight 850, self-hosted | Free (SIL OFL) substitute closest to Deacon's heavy condensed caps |
| Graphik (proprietary text face) | **Instrument Sans**, weights 400–700, self-hosted | Free substitute; calm, legible at 16–18px for long evidence pages |
| Meadow `#55dd4a` | Kew meadow **`#4fd862`** | Shifted slightly towards the school's crest green |
| Meadow buttons on cream with no edge | Meadow fill **plus a 2px forest edge** | The site's rule: primary buttons stand out at least 3:1 from their background |
| Meadow eyebrow text on cream | Deep Kew green `#17652f` on cream, meadow only on forest | Meadow on cream is about 1.7:1, below text contrast |
| Moss Gray helper text `#999c91` | Sage `#566053` | Moss Gray on cream is 2.4:1 |
| Mountains, pines and a hiker | Kew riverside: pagoda, three-arch bridge, setting sun, Thames, swans, schoolhouse | Local landscape, same limited palette and line style |

### Relationship to the school's branding

The campaign is independent of Kew Riverside Primary School, its PTA and Richmond Council, so the site must never look like an official school page. No published school brand guidelines were found. The school's own site uses green `#1E863C`, Overlock and Open Sans, and a round crest with a sun, bridge arches, river waves and "20 | 02".

- **Echo:** the school green (as `--kew-green` accents) and the riverside subjects (bridge, sun, river) in the illustration.
- **Avoid:** the crest or anything that imitates it (a roundel titled with the school's name, waves inside), the school's fonts, "2002", and school-official wording. The campaign badge reads **PARENT-LED CAMPAIGN · INDEPENDENT** around a megaphone and never sits on a school-credited photo.
- Recruitment content (Discover the school, Parent Voices, Open Days) stays visually and editorially separate from campaign actions. It carries a river-blue badge ring and a tinted panel, never a campaign call to action.
- Use only photographs the school has published or supplied with consent, credited beside the image. No stock photos of children.

## Colour

### Palette

| Token | Value | Role |
|---|---|---|
| `--forest` | `#122315` | Masthead, homepage hero, campaign-page openers, footer, feature cards. Text colour on cream |
| `--forest-2` | `#1a3020` | Orientation bar, menus and cards inside forest bands |
| `--forest-3` | `#0b170d` | Thin status strip above the masthead |
| `--cream` | `#f3ede4` | Light-mode canvas; text on forest |
| `--cream-2` | `#faf6ef` | Cards and inputs on cream |
| `--meadow` | `#4fd862` | **The only action colour**: primary buttons, the header Get involved shortcut, progress fill, accent words on forest |
| `--lichen` | `#7be472` | Links and eyebrows on forest and in dark mode |
| `--kew-green-deep` | `#17652f` | Eyebrows, link underlines and accents on cream (6.1:1) |
| `--kew-green` | `#1e863c` | Large display accents on cream only (3.98:1, large text) |
| `--sage` | `#566053` | Secondary text on cream (5.7:1) |
| `--sun` | `#ffe14d` | Decoration and small highlights: photo sticker, countdown chip, headline underline, focus ring on forest. Never a button |
| `--river` | `#73d3eb` | Illustration water and sky; recruitment badge ring |
| `--navy` | `#0a071b` | Patch-badge fields |

### Light and dark appearance

`design.css` maps the palette onto the token names older components already read (`--paper`, `--ink`, `--body`, `--muted`, `--line`, `--teal`, `--theme-*`, `--voice-*`). Keep the explicit (`data-theme`) and system (`prefers-color-scheme`) blocks identical.

| Token | Light | Dark |
|---|---|---|
| `--paper` (canvas) | `#f3ede4` | `#0d1910` |
| `--white` (cards) | `#faf6ef` | `#15261a` |
| `--ink` (headings) | `#122315` | `#f3ede4` |
| `--body` | `#2f3a31` | `#d9d3c7` |
| `--muted` | `#566053` | `#aab4a5` |
| `--teal` (accent text) | `#17652f` | `#7be472` |
| `--theme-border` (field edges) | `#737c70` | `#6d7d68` |
| `--theme-focus` | `#122315` | `#ffe14d` |

**Forest bands** stay dark in both appearances. A band re-scopes the tokens (`--ink` becomes cream, `--paper` becomes forest), so any component placed inside follows automatically. Current bands: `.site-header`, `.independent-bar`, the homepage `.hero-grid`, campaign-page openers, the Get involved letter card and `footer`.

`tests/browser/theme.spec.js` pins the two canvas colours. Change the test deliberately if the canvas changes.

## Typography

| Role | Face | Settings |
|---|---|---|
| Display: `h1`, `h2`, button labels, card titles, badges | Archivo (`--font-display`) | `font-stretch: 62%` (buttons 80%), weight 850 (buttons 800), uppercase, line-height 0.84–0.9 |
| Reading: body, `h3`, forms, notes | Instrument Sans (`--font-text`) | 17–18px, line-height 1.5–1.55; `h3` weight 650 |
| Eyebrows and kickers | Instrument Sans | 13px, weight 600, uppercase, letter-spacing 0.16em |

- Homepage headline: `clamp(3rem, 6.9vw, 6rem)`, four lines (HELP KEEP / KEW RIVERSIDE / PRIMARY SCHOOL / OPEN.) with "OPEN." in meadow, underlined in sun.
- Campaign-page openers: `clamp(3rem, 6vw, 5rem)`, compact on phones (`clamp(2.5rem, 12vw, 3.2rem)`, 2.4rem at 350px and below). Task pages with forms: `clamp(2.75rem, 6.4vw, 5rem)` so the form or upload stays on the first screen.
- Section `h2`: `clamp(1.75rem, 3vw, 2.4rem)`; card titles `clamp(1.8rem, 3vw, 2.5rem)`.
- Disclosure summaries and headings inside disclosures use the reading face in sentence case: long uppercase labels are hard to read.
- Long research titles stay in `h3` (reading face), not the display face.
- Display headings use `overflow-wrap: anywhere` so enlarged text reflows instead of pushing the page sideways.
- Fonts live in `fonts/` as WOFF2 with their OFL licences, split into Latin and Latin Extended ranges. The security policy allows them with `font-src 'self'`. Pages make no font request to a third party.
- About sixty older rules still name Arial or Helvetica. `design.css` maps those family names to Instrument Sans with `@font-face`. Prefer `var(--font-text)` in new rules and remove the alias once the old rules are gone.

## Shape and spacing

- Radius: cards, disclosures, photos, tables 20px; buttons, inputs and choice cards 10px; chips 999px; stickers 0–4px (sharp, printed).
- Width: content up to 1200px; reading columns up to 780px. Gutters 40px desktop, 20px phone, 16px at 350px and below.
- Section rhythm: 18–26px between campaign sections; 48–96px between homepage bands. Body text stays 17px, as before the redesign: decoration must not lengthen the routes to actions (the Get involved actions arrive within about 100px of their previous positions).
- Shadow: only cards use a soft `0 12px 40px rgba(10,7,27,.07)`. Badges, stickers and buttons are flat.

## Components

- **Primary button** (`.primary`): meadow fill, forest label, 2px forest edge, 10px radius, Archivo 80% width uppercase, minimum 56px (homepage 60–64px). On forest the edge disappears into the band and the fill alone carries the 3:1 contrast.
- **Ghost button** (`.secondary`, non-primary `.simple-actions` links): transparent, 2px edge in the current `--ink`, inverts on hover.
- **Masthead**: forest; meadow square with forest waves as the campaign mark; cream condensed wordmark with CAMPAIGN in bold 14px beneath it (the 9 October 2026 publisher-identity decision; `campaign.spec.js` checks it); Menu as a cream ghost button; on inner pages a meadow Get involved shortcut, drawn as an outline on Get involved itself, and a forest-2 orientation bar.
- **Opener band**: on Dates, Get involved, Campaign updates, About and Questions only. Giant cream `h1`, short intro, optional patch badge on wide screens. Task pages (Letters, Share ideas, Share a video, Corrections, Privacy, Next steps) keep the cream canvas.
- **Patch badge**: inline SVG, `aria-hidden`, 160×160 viewBox, meadow edge, navy field, upright text on two arcs (`Parent-led campaign` over a 220° top arc with a fixed `textLength`, `· Independent ·` along the bottom) and a megaphone in cream and meadow, so the phrase fits even in a fallback face. Each badge needs unique path `id`s. On Home it is pinned in the forest band above the photo, not on it; on Get involved it sits in the opener. Rotated 8–9°; no rotation with reduced motion; hidden on phones.
- **Sticker caption**: sun-yellow rectangle, forest condensed caps, rotated −4°, overlapping the photo's lower edge. Sun, not meadow, so the petition stays the only filled meadow block in the hero.
- **Petition progress**: forest-2 card, meadow progress fill, the count as a display numeral.
- **Cards** (contribution, letters, disclosures, sources): cream-2 surface, 1px line, 20px radius. Action icons sit in forest patch circles with a cream inner ring and a meadow outer ring. School-life cards (`.recruitment-action`, `#school-contributions`) use the tinted `--theme-soft` surface and a river-blue ring.
- **Footer**: forest, cream text, social links as ghost pills. Inner pages open the footer with a short riverside horizon (80–150px); the homepage hero carries the full illustration instead.
- **Video player**: 20px radius with clipped overflow, so the Play focus ring is inset (`outline-offset: -6px`) in sun yellow.

## Imagery

`images/riverside-landscape.svg` is the only illustration: flat fills, cream 3px linework, palette limited to forest, pine `#1d4426`, Kew green, meadow, river blue, sun yellow and cream. No gradients, no perspective and no people. It is decorative: CSS backgrounds only, never announced to screen readers. Keep new illustrations in the same palette and line weight; a sixth hue breaks the poster.

## Accessibility rules

- Text contrast at least 4.5:1 (3:1 for large text) in both appearances; primary buttons at least 3:1 from their background through fill or a 2px edge. `theme.spec.js` checks both.
- Focus: 3px outline, forest on cream and sun yellow on forest.
- First screens: the protected arrivals in the journey register (320×568, 375×667, 390×844) take priority over decoration. Hide badges before shrinking actions.
- Reduced motion: rotations are removed. Print: band colours re-scope to dark-on-white (the band token block is screen-only), and badges and the horizon are dropped. `theme.spec.js` checks printed status text.

## Do and don't

- Do keep meadow for actions and accent words on forest only.
- Do keep display type compressed: line-height 0.84–0.9, uppercase, weight 850.
- Do put new decoration inside an existing band or card, without adding homepage bands or Menu rows (journey register).
- Don't introduce a second action colour, gradients, glassmorphism or pure black text on cream.
- Don't round cards beyond 20px or buttons beyond 10px.
- Don't place a meadow button on a meadow or sun background.
- Don't use the school crest, school fonts or school-official wording.

## Implementation notes

- `build_navigation.py` inserts `design.css?v=DESIGN_VERSION` after `orientation.css` on inner pages and before `</head>` on the homepage. Bump `DESIGN_VERSION` when `design.css` changes, then run the builder and `--check`.
- New public assets must be listed in `PUBLIC_FILES` in `.github/scripts/check_site.py`; the local test servers and production fixtures (`tests/browser/server.js`, `analytics.spec.js`, `petition-progress.spec.js`) serve `fonts/` and `images/`.
- `/visit/` is a recruitment-only redirect and deliberately stays unstyled by the campaign system.

## Quick reference

```css
:root{
  --forest:#122315; --forest-2:#1a3020; --cream:#f3ede4; --cream-2:#faf6ef;
  --meadow:#4fd862; --lichen:#7be472; --kew-green:#1e863c; --kew-green-deep:#17652f;
  --sage:#566053; --sun:#ffe14d; --river:#73d3eb; --navy:#0a071b;
  --font-display:"Archivo Variable","Arial Narrow",sans-serif;   /* font-stretch:62%; weight 850 */
  --font-text:"Instrument Sans Variable",Arial,Helvetica,sans-serif;
  --radius-card:20px; --radius-button:10px; --max:1200px;
}
```
