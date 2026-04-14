# 03 — Design System

Extracted from the 3 approved v0 designs. Single source of truth for all UI.

## Philosophy
Sharp brutalist minimalism. Zero rounded corners anywhere (`border-radius: 0 !important`). Premium, calm, architectural.

## Colors
```
base:    #FAFAFA   — background
ink:     #0A0A0A   — text, primary elements
accent:  #C4653A   — warm clay, CTAs, active states, pending indicators
outline: #E5E5E5   — borders, dividers
```
Opacity variants used: ink/60 (secondary text), ink/50 (muted), ink/40 (section headers), ink/30 (inactive icons), accent/[0.02] (subtle highlight bg).

## Typography
- **Sans:** Inter (400, 500, 700, 900) — body text, labels, descriptions
- **Mono:** Space Mono (400, 700) — numbers, prices, section headers, navigation labels, dates, badges, structural elements

### Scale
- Section headers: `font-mono font-bold text-lg uppercase tracking-widest text-ink/40` — "01 / BOISSONS CHAUDES"
- Item names: `text-[16px] font-bold leading-tight`
- Item descriptions: `text-[14px] text-ink/60 leading-snug`
- Prices: `font-mono text-[16px] font-bold` with MAD in `text-xs text-ink/50`
- Form labels: `font-mono text-[11px] uppercase tracking-widest text-ink`
- Nav labels: `font-mono text-[9px] uppercase tracking-widest font-bold`
- Badges: `text-[10px] uppercase font-mono px-1.5 py-0.5`
- Status badges: `text-[9px] uppercase font-mono font-bold tracking-widest`

## Layout
- Max width: 480px (storefront + dashboard), 390px (forms)
- Centered with `mx-auto`, side borders `border-x border-outline/50`
- Padding: `px-6` for content, `p-6` for cards/items
- Section dividers: `border-b-4 border-outline` between major sections
- Item dividers: `border-b border-outline` between rows

## Components

### Section Header
```
"01 / Section Name" pattern
font-mono font-bold text-lg uppercase tracking-widest text-ink/40
Contained in: px-6 py-6 border-b border-outline bg-base/50
```

### Menu Item Card
```
Horizontal layout: content left, optional 80×80 image right
Hover: bg-black/[0.02] + left accent bar animation
Left bar: absolute w-1 h-full bg-accent scale-y-0 → group-hover:scale-y-100
Image: w-[80px] h-[80px] border border-ink, sharp corners
```

### Category Pills (horizontal scroll)
```
Active: bg-ink text-base border border-ink
Inactive: bg-base text-ink border border-outline hover:border-ink
Shared: px-5 py-2.5 text-sm font-bold uppercase tracking-wider
Container: overflow-x-auto no-scrollbar
```

### Sticky Bottom Bar
```
fixed bottom-0, max-w-[480px] centered
bg-base border-t-2 border-ink p-4
CTA button: full-width, bg-accent (storefront) or bg-ink (forms)
```

### Bottom Navigation (merchant)
```
5 equal tabs, flex items-center
Icons: w-5 h-5, stroke-width-2, stroke-linecap-square
Active: text-accent
Inactive: text-ink/30, hover → text-ink
Labels: font-mono text-[9px] uppercase tracking-widest
Notification dot: w-2 h-2 bg-accent on relevant tab
```

### Form Inputs
```
border border-outline px-4 py-3.5
Focus: border-ink bg-white + left accent bar (w-[3px] bg-accent)
No rounded corners, no shadows
Labels above: font-mono text-[11px] uppercase tracking-widest
```

### Toggle Switch
```
w-12 h-6 border-2 border-ink
On: bg-ink, knob at right (bg-base)
Off: bg-base, knob at left
Knob: w-4 h-4 bg-base border border-ink
```

### Status Badges
```
En attente: border border-accent text-accent (outline style)
Confirmée: bg-ink text-base border border-ink (filled)
Terminée: bg-outline text-ink/60 border border-outline (muted)
All: px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest
```

### "Popular" Badge
```
bg-ink text-base text-[10px] uppercase font-mono px-1.5 py-0.5
Inline with item name
```

## Image Treatment
```css
.brutalist-img {
    filter: contrast(1.1) saturate(0.9);
}
```

## Interactions
- Hover accent bar: `scale-y-0 → group-hover:scale-y-100 transition-transform origin-top`
- Background hover: `hover:bg-black/[0.02]`
- Color transitions: `transition-colors`
- Focus rings: `focus:ring-4 focus:ring-accent/20`

## Global CSS Rules
```css
* { border-radius: 0 !important; }
```
No scrollbar on horizontal scroll containers. Hide number input spinners.
