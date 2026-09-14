---
name: PlusQueue Parent
description: Daylight waiting-room frost for parent and shared auth surfaces only.
colors:
  ink: "#16344a"
  ink-soft: "#3a5c6e"
  ink-faint: "#5a7a88"
  paper: "#e4f3f4"
  wash-aqua: "#c8e8ee"
  wash-peach: "#f8ddd6"
  wash-gold: "#f6ecc0"
  canvas-aqua: "#eaf7f8"
  canvas-peach: "#f3ece4"
  canvas-mist: "#e7f2f4"
  mark-blue: "#2f6fdb"
  mark-blue-deep: "#1e4ea8"
  mark-coral: "#d45374"
  mark-coral-bright: "#ee7a96"
  mark-gold: "#c79212"
  mark-gold-bright: "#f0c53a"
  live: "#0f7a5a"
  live-wash: "#d8f3ea"
  alert: "#b4232c"
  alert-wash: "#fde8e8"
  alert-deep: "#8f1c24"
  wait: "#9a5b12"
  wait-wash: "#f8e7c8"
  glass: "color-mix(in srgb, #ffffff 78%, transparent)"
  glass-strong: "color-mix(in srgb, #ffffff 88%, #d4eef2 12%)"
  glass-edge: "rgba(255, 255, 255, 0.82)"
  glass-line: "rgba(22, 52, 74, 0.1)"
  glass-nav: "color-mix(in srgb, #ffffff 86%, #d4eef2 14%)"
  modal: "#ffffff"
  glass-fallback: "#f7fbfb"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Lexend, Segoe UI, sans-serif"
    fontSize: "clamp(3rem, 8vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Lexend, Segoe UI, sans-serif"
    fontSize: "clamp(1.125rem, 2.4vw, 1.5rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Lexend, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Lexend, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Lexend, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  pane: "1.35rem"
  sm: "0.95rem"
  modal: "1.5rem"
  now: "1.1rem"
  row: "0.9rem"
  wait-key: "0.85rem"
  note: "1rem"
  pill: "999px"
spacing:
  touch: "44px"
  chip: "0.2rem 0.7rem"
  gap-wait: "0.5rem"
  control: "0.65rem 1.15rem"
  field: "0.7rem 0.95rem"
  pane: "1rem"
  auth: "1.25rem"
  content: "1rem 1.5rem 2rem 2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.mark-blue}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-primary-hover:
    backgroundColor: "{colors.mark-blue-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-secondary:
    backgroundColor: "color-mix(in srgb, #ffffff 70%, transparent)"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mark-blue-deep}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-danger:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-danger-hover:
    backgroundColor: "{colors.alert-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  button-warn:
    backgroundColor: "{colors.wait-wash}"
    textColor: "{colors.wait}"
    rounded: "{rounded.sm}"
    padding: "{spacing.control}"
    height: "{spacing.touch}"
  icon-button:
    backgroundColor: "color-mix(in srgb, #ffffff 70%, transparent)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
    height: "44px"
    width: "44px"
  input:
    backgroundColor: "color-mix(in srgb, #ffffff 72%, transparent)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.field}"
    height: "{spacing.touch}"
  input-focus:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.field}"
    height: "{spacing.touch}"
  chip-live:
    backgroundColor: "{colors.live-wash}"
    textColor: "{colors.live}"
    rounded: "{rounded.pill}"
    padding: "{spacing.chip}"
    height: "28px"
  chip-wait:
    backgroundColor: "{colors.wait-wash}"
    textColor: "{colors.wait}"
    rounded: "{rounded.pill}"
    padding: "{spacing.chip}"
    height: "28px"
  chip-alert:
    backgroundColor: "{colors.alert-wash}"
    textColor: "{colors.alert}"
    rounded: "{rounded.pill}"
    padding: "{spacing.chip}"
    height: "28px"
  chip-info:
    backgroundColor: "color-mix(in srgb, #2f6fdb 12%, white)"
    textColor: "{colors.mark-blue-deep}"
    rounded: "{rounded.pill}"
    padding: "{spacing.chip}"
    height: "28px"
  glass-pane:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pane}"
    padding: "{spacing.pane}"
  glass-nav:
    backgroundColor: "{colors.glass-nav}"
    textColor: "{colors.ink}"
    rounded: "0"
  modal-pane:
    backgroundColor: "{colors.modal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
    padding: "{spacing.pane}"
  ticket-num:
    backgroundColor: "color-mix(in srgb, #2f6fdb 14%, transparent)"
    textColor: "{colors.mark-blue-deep}"
    padding: "1.15rem 1rem 1.25rem"
  ticket-ahead:
    backgroundColor: "color-mix(in srgb, #f0c53a 16%, transparent)"
    textColor: "{colors.ink}"
    padding: "1.15rem 1rem 1.25rem"
  now-serving:
    backgroundColor: "{colors.live-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.now}"
    padding: "1rem 1.1rem"
  wait-key:
    backgroundColor: "color-mix(in srgb, #ffffff 58%, transparent)"
    textColor: "{colors.ink}"
    rounded: "{rounded.wait-key}"
    padding: "0.45rem 0.7rem"
    height: "{spacing.touch}"
    width: "3.25rem"
  wait-key-you:
    backgroundColor: "color-mix(in srgb, #ee7a96 22%, white)"
    textColor: "{colors.ink}"
    rounded: "{rounded.wait-key}"
    padding: "0.45rem 0.7rem"
    height: "{spacing.touch}"
  row:
    backgroundColor: "color-mix(in srgb, #ffffff 55%, transparent)"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "0.7rem 0.9rem"
    height: "52px"
  switch-on:
    backgroundColor: "{colors.mark-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "28px"
    width: "48px"
  note-info:
    backgroundColor: "color-mix(in srgb, #2f6fdb 12%, white)"
    textColor: "{colors.mark-blue-deep}"
    rounded: "{rounded.note}"
    padding: "0.85rem 1rem"
---

# Design System: PlusQueue Parent

## Overview

**Creative North Star: "The Daylight Waiting-Room Window"**

This system applies only to parent surfaces and shared auth screens mounted under `.pq-shell`; staff dashboards must not inherit this palette or font. PlusQueue’s parent world is a frost pane onto a live clinic waiting room: a daylight aqua-to-peach canvas, one laminated glass layer, and a ticket that stays in view. It is not a SaaS dashboard, not charcoal instrumentation, and not a drum-machine board.

Personality is calm, sunlit, and operational. Density stays phone-first. The official PlusQueue mark (stylized plus/cross with parent/child hands, served from `/brand/plusqueue-logo.png`) is the window badge. Lexend carries deep teal ink across every label. WCAG 2.2 AA is the accessibility floor.

**Key Characteristics:**
- Scoped to `.pq-shell` on parent routes and shared auth only
- Fixed daylight wash (aqua, peach, gold) behind one frost layer
- Lexend extra-bold tabular ticket numbers in deep teal ink
- Official PlusQueue PNG as the identity mark
- Inset rows and wait keys inside a pane — never a second glass stack
- Solid mark-blue primary actions; coral-gold pip on now-serving

## Colors

Daylight clinic light: aqua mist, peach warmth, and a gold flare, with logo blue as the only solid action fill.

### Primary
- **Mark Blue** (`{colors.mark-blue}` / `--pq-mark-blue`): Solid primary actions, focus rings, caret, selection wash, and the live side-nav fill. Hover and pressed links deepen to **Mark Blue Deep** (`{colors.mark-blue-deep}`).

### Secondary
- **Coral** (`{colors.mark-coral}` / `--pq-mark-coral`) and **Coral Bright** (`{colors.mark-coral-bright}`): The now-serving pip and the “you” wait-key wash. Coral is a lit mark, not a second primary button.

### Tertiary
- **Gold Bright** (`{colors.mark-gold-bright}` / `--pq-mark-gold-bright`): The ticket’s “patients ahead” half. **Gold** (`{colors.mark-gold}`) is the quieter companion on the canvas wash.

### Neutral
- **Deep Teal Ink** (`{colors.ink}` / `--pq-ink`): Default type and chrome. Soft (`{colors.ink-soft}`) and faint (`{colors.ink-faint}`) step labels and placeholders down without going gray.
- **Paper** (`{colors.paper}` / `--pq-paper`): Shell fallback fill under the wash.
- **Aqua / Peach / Gold washes** (`{colors.wash-aqua}`, `{colors.wash-peach}`, `{colors.wash-gold}`): Radial stains on the fixed canvas, mixed into `{colors.canvas-aqua}` → `{colors.canvas-peach}` → `{colors.canvas-mist}`.
- **Glass** (`{colors.glass}` / `--pq-glass`): One 78% white laminate. Stronger and nav mixes add a hint of aqua (`{colors.glass-strong}`, `{colors.glass-nav}`). Edges are white (`{colors.glass-edge}`); inner rules use ink at 10% (`{colors.glass-line}`).
- **Modal** (`{colors.modal}`): Opaque white dialog plate. Modals are not glass — they sit above frost chrome as a solid surface.
- **Live / Wait / Alert**: Status pairings — green wash for now-serving and success, amber wash for waiting, red wash for danger and unread. Alert deep (`{colors.alert-deep}`) is danger hover only.

### Named Rules
**The Scoped Shell Rule.** These colors exist only as custom properties on `.pq-shell`. Do not hoist them to `:root` or paint secretary, doctor, or admin chrome with this palette.

**The Mark-Blue Action Rule.** The one next action is a solid mark-blue fill. Coral, gold, and live green are signals, not competing CTAs.

## Typography

**Display Font:** Lexend (with Segoe UI, sans-serif)
**Body Font:** Lexend (with Segoe UI, sans-serif)

**Character:** One geometric humanist face, loaded at 400–800. Extra-bold and tight tracking make ticket numbers feel like a painted window numeral, not a dashboard metric.

### Hierarchy
- **Display** (800, clamp 3rem–3.75rem, line-height 0.9, tracking -0.04em, tabular-nums): Permanent queue number and patients-ahead count (`.pq-num` at ticket scale).
- **Headline** (800, 1.125rem–1.5rem, tight tracking): Auth titles (“Sign in”) and sticky page titles.
- **Title** (800, 1.05rem, tracking -0.03em): PlusQueue wordmark beside the mark; compact 0.95rem, stacked 1.15rem.
- **Body** (500, 1rem, line-height 1.5): Fields, supporting copy, and reservation detail.
- **Label** (600, 0.875rem): Field labels (`.pq-label`). Micro labels (11px / 10px, 700–800) sit on ticket halves and chips. Nav keys are 0.65rem / 600, 800 when active. Buttons are 0.9375rem / 700 / tracking -0.01em. Chips are 0.7rem / 800 / tracking 0.02em.

### Named Rules
**The Ticket Number Rule.** Queue identity is extra-bold tabular Lexend. Do not switch ticket numerals to a display serif, monospace novelty, or system UI face.

## Layout

Phone is the first viewport. The parent shell is a column: frost header (logo or back, title, bell), scrollable content, four-key frost footer. From the `md` breakpoint the footer hides, a 16rem frost sidebar appears, and the main column keeps a transparent wash. Content pads `1rem` / `1.5rem` / `2rem` / `2.5rem` and caps at 64rem; the live ticket window itself caps near 32rem.

Auth recenters a single glass card at `max-width: 26.5rem` with `1.25rem` page inset. Controls and nav keys honor a 44px minimum. Waiting chips are a horizontal, non-wrapping row with hidden scrollbars. The ticket is a two-column split inside the same pane, not a separate card.

**The Phone-First Window Rule.** Compose for one ticket window on a phone wash. Widen the chrome at `md`; do not turn the ticket into a multi-widget dashboard.

## Elevation & Depth

Depth is laminated glass over a fixed wash, not stacked drop shadows. One blur layer (`18px`, saturate 1.35) on panes; nav and strong glass step to `20px` / 1.4. A soft teal umbra plus a white inset highlight reads as frosted plate, not Material elevation. When `backdrop-filter` is missing, panes fall back to solid `{colors.glass-fallback}`.

### Shadow Vocabulary
- **Pane frost** (`box-shadow: 0 12px 28px -14px rgba(22, 52, 74, 0.28), 0 1px 0 rgba(255, 255, 255, 0.85) inset`): Default glass (`--pq-shadow`).
- **Nav frost** (`box-shadow: 0 8px 24px -16px rgba(22, 52, 74, 0.35), 0 1px 0 rgba(255, 255, 255, 0.9) inset`): Sticky header and sidebar/footer.
- **Mark glow** (`box-shadow: 0 8px 18px -10px rgba(47, 111, 219, 0.7)`): Primary button. Active side links use `0 8px 16px -10px rgba(47, 111, 219, 0.8)`.
- **Focus halo** (`box-shadow: 0 0 0 3px color-mix(in srgb, #2f6fdb 22%, transparent)`): Focused fields. Error fields swap the halo to alert at 20%.
- **Pip halo** (`box-shadow: 0 0 0 4px color-mix(in srgb, #ee7a96 35%, transparent)`): Now-serving coral pip.
- **Modal lift** (`box-shadow: 0 18px 40px -12px rgba(22, 52, 74, 0.32), 0 6px 16px -8px rgba(22, 52, 74, 0.18)`): Solid modal pane (`--pq-modal-shadow`). Offset umbra, no inset frost highlight.
- **Modal scrim** (`background: color-mix(in srgb, #16344a 48%, transparent)`): Dims the page behind a solid modal. No backdrop blur.

Motion is short (`160ms`, `--pq-ease: cubic-bezier(0.22, 1, 0.36, 1)`). Primary and icon buttons scale to `0.98` while pressed. The pip breathes `1.6s`; the spinner turns `700ms`. `prefers-reduced-motion` kills pip/spinner animation and press scale.

### Named Rules
**The One Frost Layer Rule.** A pane is one blur. Rows, ticket halves, wait keys, and notes are inset fills inside that pane — never a second `backdrop-filter` stack. Modals are not frost: they are opaque plates with lift shadow, not a second glass layer.

## Shapes

Panes use a large continuous radius (`1.35rem`). Controls tighten to `0.95rem`. Modals open to `1.5rem`. Now-serving is `1.1rem`; inset rows `0.9rem`; wait keys `0.85rem`; notes and side links `1rem`. Chips, switches, icon buttons, and the pip are full pills. Header, footer, and desktop sidebar square their outer corners so the chrome reads as one window frame, not floating cards.

Borders are 1px: white edge on glass, ink-at-10% on insets and fields. The ticket split is a single inner rule, not a gap.

## Components

### Buttons
Solid, slightly tight Lexend. Shared control: `min-height 44px`, padding `0.65rem 1.15rem`, radius `0.95rem`, weight 700.
- **Primary:** Mark-blue fill, white type, blue glow. Hover deepens to mark-blue-deep. This is the one next action.
- **Secondary:** 70% white, ink type, glass-line border. Hover goes solid white.
- **Ghost:** Transparent, mark-blue-deep type. Hover is mark-blue at 10%.
- **Danger:** Alert fill, white type. Hover alert-deep.
- **Warn:** Wait-wash fill, wait type, wait-tinted border.
- **Icon button:** 44×44 pill, 70% white, glass-line. Hover white with mark-blue-deep icon.
- **Disabled:** 0.55 opacity, no press scale. Pressed primary/secondary/icon scale to 0.98.

### Chips
Pill, 28px min height, 0.7rem / 800 / tracking 0.02em, 1px tinted border.
- **Live:** Live wash / live ink — now-serving and completed.
- **Wait:** Wait wash / wait ink.
- **Alert:** Alert wash / alert ink — cancelled, forfeited.
- **Info:** Mark-blue 12% on white / mark-blue-deep — unread, branch, generic status.

### Cards / Containers
- **Corner Style:** `1.35rem` pane; modal `1.5rem`; chrome frames `0`.
- **Background:** `{colors.glass}` with `blur(18px) saturate(1.35)`. Strong and nav use the aqua-tinted mixes and `20px` blur.
- **Shadow Strategy:** Pane frost + white inset (see Elevation).
- **Border:** 1px `{colors.glass-edge}`.
- **Internal Padding:** `1rem` on ticket chrome; auth card heads `2.5rem 2rem 1.5rem` then `2rem` body. Inset rows are `0.7rem 0.9rem` at 55% white with a glass-line — not glass.

### Inputs / Fields
- **Style:** 72% white, glass-line, `0.95rem` radius, 44px min, body 500, mark-blue caret. Placeholders use ink-soft at full opacity. Labels are 0.875rem / 600 ink with `0.4rem` below.
- **Focus:** White fill, mark-blue border, 3px mark-blue halo at 22%. Shell focus-visible is a 3px mark-blue outline, 2px offset.
- **Error / Disabled:** Alert border (alert halo on focus). Disabled at 0.65 opacity. Error copy is 0.75rem / 600 alert; ok copy uses live.
- **Selection:** Mark-blue 28% on white, ink type.

### Navigation
- **Phone footer:** Fixed frost bar, 64px, four equal keys. Idle ink-faint 0.65rem / 600; active mark-blue-deep / 800 with mark-blue icon.
- **Desktop side:** 16rem frost column. Idle ink-soft 0.9rem / 600, `1rem` radius. Active is solid mark-blue, white, 800, blue glow.
- **Header:** Sticky frost, 64px min. Wordmark + mark on desktop; mark-only on phone home; circular back and bell icon buttons.

### Brand
Official PNG at `/brand/plusqueue-logo.png` (`PqBrand`). Default mark 40px, 0.65rem gap, 44px min row. Wordmark is title-role Lexend “PlusQueue” in ink. Compact and stacked only change size and direction — never the asset.

### Ticket Split
Two equal columns inside the same glass pane. Left: mark-blue at 14% and a glass-line rule — permanent number. Right: gold-bright at 16% — people ahead. Cell padding `1.15rem 1rem 1.25rem`, centered. Numbers use display type.

### Now Serving
Live-wash strip, `1.1rem` radius, live-tinted border, inset in the ticket pane. Coral pip (8px) with coral-bright halo, breathing unless reduced motion.

### Wait Row
Horizontal auto-scroll, `0.5rem` gap, no wrap, scrollbars hidden. Keys are `min-width 3.25rem`, 44px min, 58% white insets. “You” uses coral-bright 22% on white. The served key may use live wash.

### Switch
48×28 pill. On = mark-blue; off = ink 22% on white. 20px white knob, ink-tinted shadow, travels `4px` → `24px` in 160ms.

### Modal
Ink 48% scrim, no blur. Modal pane is solid `{colors.modal}` (`#ffffff`), `1.5rem` radius, `--pq-modal-shadow` lift. Header/footer divide with glass-line; body rows stay inset. Never apply `backdrop-filter` to the panel.

## Do's and Don'ts

### Do:
- **Do** mount parent and shared auth on `.pq-shell` so the wash, Lexend, and tokens stay local.
- **Do** keep one frost pane and put ticket halves, now-serving, wait keys, and rows inside it as insets.
- **Do** use the official PlusQueue PNG as the window badge and the word “PlusQueue” as the wordmark.
- **Do** make the one next action a solid mark-blue control at 44px minimum.
- **Do** keep waiting chips in a single horizontal, non-wrapping row.
- **Do** honor the 3px mark-blue focus ring (2px offset) and `prefers-reduced-motion`.
- **Do** use `.pq-modal` for dialogs: opaque white, lift shadow, no blur.

### Don't:
- **Don't** apply this palette, Lexend stack, or glass language to staff, doctor, or admin dashboards.
- **Don't** stack a second frosted glass card inside a pane.
- **Don't** replace the daylight wash with charcoal, drum-machine black, or SaaS gray.
- **Don't** substitute a generic clinic logo or invent a second wordmark.
- **Don't** outline or ghost the primary next action.
- **Don't** apply glass, translucency, or `backdrop-filter` to modal panels — dialogs are solid elevated plates.
