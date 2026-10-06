# The Nexus — AI Branding & UI Consistency Guide

This document defines the official design system, aesthetic principles, component patterns, and UI conventions for **The Nexus**. All AI assistants and developers modifying or creating pages in this repository **must** follow these guidelines to maintain visual excellence, brand cohesion, and premium user experience.

---

## 1. Brand Identity & Design Philosophy

The Nexus is the premier collegiate Super Smash Bros. Ultimate crew league. The design identity is **dark, high-contrast, modern esports aesthetic**—combining neon accents (Emerald & Magenta), stroked hero typography, and dynamic micro-animations.

### Core Principles
1. **Premium Esports Aesthetics**: Interfaces must feel polished, high-energy, and state-of-the-art.
2. **Harmonious Palette**: Use exact brand tokens (`--nexus-emerald`, `--nexus-magenta`, `--nexus-black`, `--nexus-white`). Never introduce off-palette colors (e.g. standard Tailwind `blue-500` or plain `red`).
3. **Structured Hierarchy**: Every section uses tracked uppercase kickers, bold balance-wrapped headings, and crisp muted copy.
4. **Dynamic & Alive**: Interactive elements feature subtle hover lifts (`translateY(-2px)` or `translateY(-5px)`), border glow transitions.

---

## 2. Color System & Design Tokens

Defined in `frontend/app/globals.css` and extended via `tailwind.config.ts`:

### Brand Palette Tokens
| Variable | Value | Purpose / Usage |
| :--- | :--- | :--- |
| `--nexus-emerald` | `#50c878` | Primary brand color, primary CTA buttons, winner indicators, active state glows, primary borders |
| `--nexus-magenta` | `#c850a0` | Secondary accent, section kickers, VS dividers, highlight accents, live broadcast tags |
| `--nexus-black` | `#1a1921` | Dark base background for card fills, panels, hero overlays |
| `--nexus-white` | `#f9fafd` | Primary typography color for high contrast readability |
| `--panel` | `rgba(26, 25, 33, 0.75)` | Glassmorphic card fill backdrop |
| `--container-muted` / `--muted-text` | `#595657` / `#b7b4c2` | Secondary body text, captions, inactive labels |
| `--yt-red` | `#e14664` | YouTube live stream / video indicators |
| `--border-color` | `#383535` | Standardized subtle panel & section divider borders |

### Tailwind Color Extension
Tailwind utilities mapping to brand tokens:
- `text-nexus-emerald` / `bg-nexus-emerald`
- `text-nexus-magenta` / `bg-nexus-magenta`
- `text-nexus-black` / `bg-nexus-black`
- `text-nexus-white` / `bg-nexus-white`

### Border Radii Standards
- `--radius-xs`: `2px` (Small badge borders)
- `--radius-sm`: `4px` (Tags, small controls)
- `--radius-md`: `6px` (Standard buttons, inputs, match thumbnails)
- `--radius-lg`: `8px` (Cards, panels, content blocks)
- `--radius-xl`: `10px` / `16px` (Hero cards, callout sections)
- `--radius-pill`: `999px` (Pill buttons, active links, tags)
- `--radius-circle`: `50%` (Avatars, indicator dots)

---

## 3. Typography & Text Hierarchy

### Font Family
The global typeface is **Tomorrow** (loaded in `globals.css`):
```css
font-family: 'Tomorrow', system-ui, sans-serif;
```

### Text Formatting Rules
- `h1, h2, h3, h4, h5, h6`: Always set `text-wrap: balance;`.
- `p`: Always set `text-wrap: pretty;`.
- Headings are uppercase (`text-transform: uppercase`) with tight line-heights (`0.8` to `0.98`) and tight letter-spacing (`-0.055em` to `-0.07em`).

### Typography Scale & Utility Snippets

#### 1. Hero Title (Page Headline)
```tsx
<h1>
  Where crews
  <span>become legends.</span>
</h1>
```
```css
/* Stroked Outline & Glow Effect */
h1 span {
  display: block;
  color: transparent;
  -webkit-text-stroke: 1px var(--nexus-emerald);
  text-shadow: 0 0 35px rgba(80, 200, 120, 0.08);
}
```

#### 2. Section Headings & Kickers
```tsx
<div className="matches-section-heading">
  <div>
    <div className="kicker">
      <span /> {/* Optional accent indicator dot */}
      Spring 2026 Season
    </div>
    <h2>Current Standings</h2>
  </div>
  <p>Section subtitle description text explaining the context.</p>
</div>
```
```css
.kicker {
  color: var(--nexus-magenta);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

#### 3. Numbered Index Markers
```tsx
<div className="about-section-index">01 / The Mission</div>
```
```css
.about-section-index {
  color: #696c74;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

---

## 4. Page Layout & Background Architecture

### 1. Global Shell Setup (`app/layout.tsx`)
```tsx
<body className="antialiased">
  <div className="app-shell">
    <BackgroundLayer />
    <Navbar />
    <main>{children}</main>
    <Footer />
  </div>
</body>
```

### 2. Main Content Container
- Standard container max-width is **1300px**:
  ```css
  main {
    padding: 6rem 1.5rem 1.5rem 1.5rem;
    max-width: 1300px;
    margin: 0 auto;
  }
  ```
- Full-bleed pages (Homepage, About, Rulebook, Past Matches, Schedule) reset padding and max-width using CSS selector:
  ```css
  .app-shell > main:has(>.home-page),
  .app-shell > main:has(>.about-page),
  .app-shell > main:has(>.rulebook-page) {
    max-width: none;
    padding: 0;
    overflow: hidden;
  }
  ```

### 3. Background Texture & Perspective Grids
Full-bleed sections feature clean linear perspective or masked grid overlays. **Avoid random floating background circle glow elements or radial gradient blobs**—backgrounds should remain dark, structural, and clean.
```css
.about-hero-grid {
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.18;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(to right, #000, transparent 75%);
  -webkit-mask-image: linear-gradient(to right, #000, transparent 75%);
}
```

---

## 5. Key UI Components & Design Tokens

### Buttons (`.btn`)
Standardized button components in `globals.css`:

```tsx
/* Primary CTA Button (Solid Emerald) */
<Link href="/signup" className="btn btn-primary">
  Enter The Nexus <RiArrowRightSFill />
</Link>

/* Secondary Button (Glass Panel with subtle border) */
<Link href="/matches" className="btn btn-secondary">
  Explore Matches
</Link>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.8rem 1.4rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  transition: transform 0.2s ease, filter 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.btn-primary {
  background: var(--nexus-emerald);
  color: #07110c;
  border: 1px solid transparent;
}

.btn-secondary {
  background: var(--panel);
  color: var(--nexus-white);
  border: 1px solid var(--border-color);
}
```

### Cards & Elevation Surfaces
All interactive cards (Match Cards, Pillar Cards, Rulebook Subsections, Flow Steps) share standard elevation effects:

```css
.card-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent), var(--nexus-black);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.25s ease, box-shadow 0.25s ease;
}

.card-surface:hover {
  transform: translateY(-5px);
  border-color: var(--nexus-emerald);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
}
```

### Avatars & Player Profile Pictures
Player profile pictures, roster avatars, team profile badges, and user avatars **must always be displayed as circles**:
- CSS rule: `border-radius: var(--radius-circle);` (or `border-radius: 50%;`)
- Layout rule: `overflow: hidden;` with `object-fit: cover;` on image elements.
- Never use square or rounded-rectangle avatars for user or player profile pictures.

### Badges & Pill Tags
```tsx
<span className="badge">LIVE</span>
<span className="team-tag">Buddwaur</span>
```
```css
.badge {
  color: #0f1;
  background: rgba(0, 255, 100, 0.12);
  border: 1px solid rgba(0, 255, 100, 0.3);
  border-radius: var(--radius-pill);
  padding: 0.2rem 0.6rem;
  font-size: 0.85rem;
}
```

### Dynamic Match Graphic
- Match card thumbnails use `DynamicMatchGraphic` (`app/components/dynamic-match-graphic.tsx`).
- Match card artwork preserves a `2160 / 2600` aspect ratio on desktop layouts.
- Versus graphic elements use angled polygon masks:
  - Home side: `polygon(0 0, 100% 0, 0 100%)` with Emerald background tint (`rgba(80, 200, 120, 0.14)`).
  - Away side: `polygon(100% 0, 100% 100%, 0 100%)` with Magenta background tint (`rgba(200, 80, 160, 0.14)`).

---

## 6. Icons & Media Guidelines

1. **Icon Library & Fill Style**: Use `@remixicon/react` icons exclusively. **Always use "Fill" variant icons** (e.g. `RiTrophyFill`, `RiTeamFill`, `RiCalendarFill`, `RiShieldCheckFill`, `RiArrowRightSFill`, `RiEditBoxFill`, `RiPencilFill`, `RiCloseFill`, `RiMailFill`) instead of "Line" variants.
   ```tsx
   import { RiArrowRightSFill, RiTrophyFill, RiShieldCheckFill } from '@remixicon/react';
   ```
2. **Logos**: Always use vector SVG brand assets from `public/logos/`:
   - Primary: `/logos/Primary/SVG/Nexus Emerald.svg`
   - B&W Variants: `/logos/B&W/SVG/Solid Currant.svg`, `/logos/B&W/SVG/Solid White.svg`
3. **Background Images**: Reference `/backgrounds/Nexus BG.jpg` or video overlays through `BackgroundLayer`.

---

## 7. AI Assistant Checklist for New / Modified Pages

When writing code or adding components:
- [ ] **Check Layout Scope**: Ensure full-bleed pages add their root selector to `globals.css` if resetting `main` padding.
- [ ] **Verify Colors**: Use CSS variables (`var(--nexus-emerald)`, `var(--nexus-magenta)`) or Tailwind classes (`text-nexus-emerald`, etc.).
- [ ] **Typography Check**: Ensure `Tomorrow` font is inherited and titles use uppercase balance-wrapped formatting.
- [ ] **Micro-Interactions**: Include hover lifts (`translateY(-2px)` or `-5px`) and border color transitions on all clickable cards and buttons.
- [ ] **Icon Consistency**: Import icons from `@remixicon/react`.
- [ ] **Responsive Breakpoints**: Verify layout behavior at `900px` (tablet) and `640px` (mobile).
- [ ] **Accessibility**: Use semantic HTML5 elements (`<section>`, `<article>`, `<header>`, `<nav>`, `<main>`) and proper ARIA labels.

---

## 8. Copywriting & Terminology Rules

1. **NEVER USE THE WORD "FIXTURE"**:
   - Strictly forbidden across all UI text, user copy, headings, labels, kickers, descriptions, comments, and documentation.
   - Always use **"match"**, **"matches"**, or **"matchup" / "matchups"** instead.
   - Prohibited / Approved Examples:
     - ❌ "Upcoming fixture" ➔ ✅ "Upcoming match"
     - ❌ "Scheduled fixture" ➔ ✅ "Scheduled match"
     - ❌ "Fixture scheduled" ➔ ✅ "Match scheduled"
     - ❌ "Pick a fixture" ➔ ✅ "Pick a match"
     - ❌ "Fixture details" ➔ ✅ "Match details"

