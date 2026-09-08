---
name: Obsidian Command
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e4e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.08em
  display-data:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  element-gap: 8px
  stack-compact: 4px
---

## Brand & Style
The design system is engineered for mission-critical AI traffic management. It evokes a sense of absolute precision, authority, and high-tech sophistication. The brand personality is clinical and efficient, prioritizing data legibility over decorative elements.

The visual style is a blend of **Minimalism** and **Technical Corporate**. It utilizes a "Deep Dark" aesthetic where depth is communicated through subtle tonal shifts in grey rather than traditional shadows. The interface feels like a high-end command terminal—utilitarian yet premium. The emotional response should be one of calm control amidst complex, real-time data streams.

## Colors
The palette is strictly monochrome to minimize visual fatigue and highlight critical data status. 

- **Backgrounds:** The primary interface surface uses `#0A0A0A` (Pure Obsidian) to ensure maximum contrast with active elements.
- **Surface Tiers:** Container levels are defined by `#141414` (Base), `#1A1A1A` (Elevated), and `#2E2E2E` (Interactive).
- **Accents:** Pure `#FFFFFF` is used sparingly for primary actions and active states, creating a "glowing" effect against the dark base. 
- **Functional States:** While the system is monochrome, semantic colors for traffic (Red/Amber/Green) are used only as high-saturation "status pips" to ensure they command immediate attention without breaking the technical aesthetic.

## Typography
The typography system uses **Geist** for its clean, geometric Swiss-style legibility in headings and body text. For data points, coordinates, and technical metadata, **JetBrains Mono** provides the necessary monospaced structure to ensure numbers align perfectly in columns.

Large data displays (like vehicle counts) use the `display-data` role to create a clear information hierarchy. All labels are set in uppercase monospaced type with increased letter spacing to emphasize the "instrument panel" feel.

## Layout & Spacing
This design system utilizes a **Fixed 12-Column Grid** for desktop dashboards to ensure data widgets remain in predictable locations. The layout philosophy is "high-density," using a 4px base unit to pack significant amounts of information into a single view without overcrowding.

- **Desktop:** 12 columns, 16px gutters, 24px outer margins.
- **Tablet:** 6 columns, 12px gutters.
- **Mobile:** 2 columns, 8px gutters, linear reflow for data cards.

Margins between related data points within a card are kept to 4px or 8px, while the spacing between distinct widgets is 16px to maintain a clear visual separation of concerns.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Low-Contrast Outlines**. Avoid drop shadows to maintain a flat, technical aesthetic.

- **Level 0 (Background):** `#0A0A0A`.
- **Level 1 (Cards/Widgets):** `#141414` background with a 1px solid border of `#262626`.
- **Level 2 (Modals/Popovers):** `#1C1C1C` background with a 1px solid border of `#333333`.
- **Active State:** Elements gain a subtle inner glow or a white border stroke to indicate focus.

Embedded maps should be styled with a custom dark-mode JSON (greyscale) and framed with a `#262626` border to integrate seamlessly into the UI.

## Shapes
Shapes are disciplined and industrial. A **Soft (0.25rem)** corner radius is used for all standard UI components (buttons, input fields, cards). This small radius softens the "brutalist" edge just enough for professional use while maintaining a sharp, precise character. 

Status indicators (pips) remain as perfect circles to differentiate them from interactive elements.

## Components
- **Data Cards:** Dark grey background (`#141414`), subtle border, monospaced labels at the top-left, and large `display-data` values center-aligned.
- **Status Indicators:** Small 8px circular pips. Use `#FFFFFF` for 'online', and limited semantic colors (Red/Yellow/Green) only when indicating traffic flow health.
- **Buttons:** 
    - *Primary:* Solid `#FFFFFF` background with `#0A0A0A` text.
    - *Secondary:* Ghost style with 1px `#FFFFFF` border.
- **Input Fields:** Darker than the card surface (`#0A0A0A`), 1px border that turns `#FFFFFF` on focus.
- **Embedded Maps:** Custom monochrome tiles. Map markers should be high-contrast white circles or vector chevrons to indicate traffic direction.
- **Chips/Tags:** Monospaced text inside a `#2E2E2E` container with no border, used for metadata or filtering attributes.