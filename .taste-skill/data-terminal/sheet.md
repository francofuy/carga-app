# APP SHEET — Data terminal
seed 388776151 · drawn 2026-11-03 · kind wallet · dark
Brief: Registro de cargas de un auto eléctrico en iPhone: una pantalla, un número grande (cuánto gasté), una acción para registrar una carga, historial escondido

This is the style for this product. Adopt it whole and keep its move intact; everything the sheet does not fix comes from the
shared defaults in references/app-screens.md. Redraw only for a reason you can state (it contradicts the brand, or the product is
used in a way the style does not suit) and say why in your report. The values were measured on real product screens: use them
as given rather than rounding them towards your habits.

## 1. The style
A research or monitoring screen read in long sessions: cards darker than the ground, tabular digits that stack, signs instead of colour, and every selection marked by the same 1px accent line.

**The move:** Every selection (tab, toggle, range, nav item) is a 1px accent line exactly as wide as its label, placed on the nearest existing edge; numbers stay white or grey and carry their sign in the text ('+$24,000,000').

**Colour budget:** under 3%; the accent is never more than a 1px line.
**Off-style here:** filled pill tabs or a coloured segmented control; a chart with no scale and no dates (the studied screen had none and was flagged); tertiary text under 4.5:1 (#4c4c4f read at about 2:1 in the study); lighter cards with borders and a glow; green and red on every number; the one column whose job is "what moved today" and a negative headline figure may carry the polarity colours.
Distilled from 1 screen: a stock research view. Keep it narrow.. The studied screen's muted grey #82848a and red #d4405d were lifted to #8a8c92 and #e5566f so text passes 4.5:1 on the card. Its card list rows sit on a 28px pitch and its table rows on 42px.

**Its face.** Choose one of these (or one of your own of the same weight) before you build, write it in your notes next to
the screen's question, and check that it shows on the first screen. Without one the screen reads as a well-applied kit.
- Every figure in a monospace as the style's decision (IBM Plex Mono or JetBrains Mono for each price, count and time, digits that stack), with the text in Public Sans. Lint and the inspector flag mono; give the reason in the report.
- The one accent line from the product's world in place of the dealt blue (the exchange's or the team's hue): still the only selection mark, never violet or indigo.
- A signature of the market or the system as the lead: an order book's depth as two mirrored bar lists, an incident as a minute-by-minute strip, a region map with the list beside it.

## 2. Tokens
```css
:root {
  --ground: #171719;
  --surface: #131217;
  --raised: #212023;
  --border: #222224;
  --rule: #1b1a1f;
  --control: #3a3a3e;
  --text: #ffffff;
  --muted: #8a8c92;
  --accent: #4a8ad6;
  --positive: #44a282;
  --negative: #e5566f;
  --warning: #d9a441;
  --chart-1: #f2f2f3;
  --chart-2: #e5566f;
  --chart-3: #4a8ad6;
  --pill-positive-bg: #1b2828; --pill-positive-ink: #5fc39c;
  --pill-negative-bg: #2c1a20; --pill-negative-ink: #e5566f;
  --pill-warning-bg: #2a2416; --pill-warning-ink: #d9a441;
  --pill-neutral-bg: #212023; --pill-neutral-ink: #bdbdc0;
  --shadow: 0 12px 28px rgba(0,0,0,.2);
  --radius-card: 6px;
  --radius-control: 999px;
  --row-height: 42px;
  --sidebar-width: 50px;
  --gap: 24px;
  --pad: 32px;
  --control-height: 34px;
  --fs-title: 26px;
  --fs-section: 20px;
  --fs-kpi: 20px;
  --fs-body: 13px;
  --fs-small: 12px;
}
```
Density: dense. One gap value, horizontally and vertically. The shadow belongs to this dark style's cards only; nothing else casts one.

## 3. Type — Public Sans
```html
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```
`font-family: "Public Sans", Inter, system-ui, sans-serif`. Weights 400, 500, 600, 700. Sizes: title 26px · section 20px · kpi 20px · body 13px · small 12px. Section titles 20/400 in the muted grey; card titles 16/600; tabular figures everywhere.
Numbers: `font-variant-numeric: tabular-nums` on every table, KPI and anything that updates. Sentence case; no tracked capitals.

## 4. Shell — Icon rail
An unlabelled rail of 50-60px carries the brand mark at the top and 15-18px outline icons on a 34-49px pitch; groups are split by 20px hairlines, utilities sit at the bottom. The rail sits on the page ground with a 1px edge, or is white with a faint 4px shadow on a grey ground. It saves about 180px of width against a labelled sidebar, so it suits products with few destinations and screens that need the width. Icons need tooltips and an accessible name.
Numbers: railWidth 50-60, median 55; icon 15-18px outline; pitch 34-49; active icon colour alone, or a full-bleed 50px band at a 2% tint, or a 1px accent bar on the rail's border; groups short 20px hairlines, no labels; utilities pushed to the bottom after a gap of about 200px.
On a phone: The rail becomes a bottom bar with the same four or five icons, each with a short label under it.

## 5. Screens

### wallet — Balance, actions and assets
One column whose every element snaps to its two edges. A balance card (1px border, 16px radius, about 134px tall) holding one 32px figure and one line under it in which only the change is coloured ('-$0.09 in the last 30 days'); the title says what the figure is, so it needs no label. 32px below, 4 equal action tiles in a pale tint with dark same-hue icon and 12-14px label (4 x 144 + 3 x 16 = 624 in the study; scale the column and keep the arithmetic). 32-40px below, text tabs for the asset kinds on a 1px rule with a 2px ink indicator as wide as the word, a network or account select on the right of the same row. Then the asset table: 72px rows (48px round icon plus 24px), no dividers, two-line cells pairing a 16px value with a 14px grey unit amount, numeric columns right-aligned to shared edges, change as a small solid triangle and a coloured percentage, zero change grey, a missing share a grey em dash. On a desktop do not leave the column at phone width: the study's 624px column was flagged as a stretched phone screen; widen it to 864-1100 or give it a second column.
On a phone: This pattern is phone-first: the same column at full width with 16px margins, the 4 tiles in one row, the table as two-line rows with the value right-aligned.

### home
No pattern in the library for this screen. Compose it from the rules in references/app-screens.md.

### list
No pattern in the library for this screen. Compose it from the rules in references/app-screens.md.

## 6. Always
Real data for this product, written before the markup: names, amounts that add up, dates in order, units on every figure,
honest zeros and dashes. One chart answers one question. No gradients, glows, glass, icons in tinted squares, sparklines on KPIs,
rainbow charts, emoji, lorem or Acme. `<skill>/assets/app.css` and `<skill>/assets/charts.js` are a neutral start set to these
rules. Check with `node <skill>/scripts/lint.mjs <files>` and `node <skill>/scripts/inspect.mjs <page>`: this sheet switches both
to app rules.

Saved to C:/Users/Franco/OneDrive/Escritorio/NUEVA APP AUTO/.taste-skill/data-terminal/direction.json · reprint with `node draw.mjs --show`
