---
name: Warm Merchant System
colors:
  surface: '#fff8f4'
  surface-dim: '#e4d8cd'
  surface-bright: '#fff8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fef1e6'
  surface-container: '#f8ece0'
  surface-container-high: '#f3e6db'
  surface-container-highest: '#ede0d5'
  on-surface: '#201b14'
  on-surface-variant: '#514536'
  inverse-surface: '#362f28'
  inverse-on-surface: '#fbefe3'
  outline: '#837564'
  outline-variant: '#d6c4b1'
  surface-tint: '#845400'
  primary: '#845400'
  on-primary: '#ffffff'
  primary-container: '#c98a2c'
  on-primary-container: '#442900'
  inverse-primary: '#ffb958'
  secondary: '#44664b'
  on-secondary: '#ffffff'
  secondary-container: '#c5ecc9'
  on-secondary-container: '#4a6c50'
  tertiary: '#006491'
  on-tertiary: '#ffffff'
  tertiary-container: '#4a9ed3'
  on-tertiary-container: '#00324b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb6'
  primary-fixed-dim: '#ffb958'
  on-primary-fixed: '#2a1800'
  on-primary-fixed-variant: '#643f00'
  secondary-fixed: '#c5ecc9'
  secondary-fixed-dim: '#aad0ae'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#2c4e34'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#8aceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004b6e'
  background: '#fff8f4'
  on-background: '#201b14'
  surface-variant: '#ede0d5'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is built on a foundation of warmth, reliability, and human-centric utility. Moving away from the cold, neon-lit aesthetics of traditional fintech, it embraces a "small-business tool" personality that feels like high-quality stationery or a well-organized physical workshop. It is informal yet professional, using a "Paper and Ink" philosophy where digital elements mimic the tactility of physical goods.

The visual style is a blend of **Modern Minimalism** and **Tactile Flat Design**. It avoids the artificiality of gradients and glows in favor of solid fills, organic color tones, and generous whitespace. The goal is to evoke a sense of calm and clarity for users managing their finances, ensuring the interface feels like a helpful partner rather than a complex machine.

## Colors

This design system utilizes a sophisticated, earth-toned palette that prioritizes legibility and emotional comfort. 

- **Background (Paper):** A warm off-white that reduces eye strain and provides a tactile, "analog" feel.
- **Primary Text (Ink):** A high-contrast near-black used for all critical information and body text.
- **Primary Accent (Ochre):** Reserved for primary actions, highlights, and brand moments. It provides warmth without the aggression of typical "action" oranges.
- **Positive/Income (Sage):** A muted, natural green used to denote growth, success, and positive balances.
- **Anomaly/Alert (Brick):** A desaturated red used sparingly for errors or critical warnings, maintaining the organic feel of the palette.
- **Secondary/Borders (Stone):** A soft gray used for structural lines, disabled states, and secondary metadata to keep the hierarchy clean.

## Typography

**Plus Jakarta Sans** is the sole typeface for this design system. Its modern, geometric construction is softened by friendly, open apertures and a warm "double-story" 'a', making it exceptionally legible for financial data while remaining approachable.

Headlines should use tighter letter spacing and heavier weights to create a strong visual anchor. Body text utilizes the regular weight with generous line heights to ensure a comfortable reading experience on the warm background. Labels use a semi-bold weight and slight tracking to distinguish them from interactive elements.

## Layout & Spacing

The layout philosophy follows a **fluid grid** model with fixed maximum widths for desktop to maintain readability. The system relies on an 8px base unit to create a consistent rhythm.

- **Desktop:** 12-column grid with 24px gutters. Max content width of 1280px.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.

Whitespace is used aggressively to separate logical groups of information, avoiding the need for heavy containers or lines. Vertical rhythm is maintained by ensuring all component heights and margins are multiples of the 8px base unit.

## Elevation & Depth

This design system uses a **Tonal Layering** approach combined with **Ambient Shadows**. Depth is not created by "lifting" elements high off the page, but by subtle shifts in surface color and soft, diffused shadows.

- **Base Layer:** The "Paper" background (#EDEAE1).
- **Surface Layer:** Pure white (#FFFFFF) is used for cards and primary containers to make them "pop" slightly against the off-white background.
- **Shadows:** Use a single, very soft shadow style: `0px 4px 20px rgba(27, 27, 31, 0.06)`. This mimics the look of a heavy card resting on a desk.
- **Borders:** Instead of heavy shadows, use 1px solid "Stone" (#8A8578) borders at 20% opacity for secondary containment.

## Shapes

The shape language is consistently **Rounded**. This reinforces the friendly and approachable brand personality. 

- **Small Components:** Checkboxes and small tags use 0.5rem (8px).
- **Standard Components:** Buttons, input fields, and standard cards use 1rem (16px).
- **Large Containers:** Hero sections or large modal overlays use 1.5rem (24px).

Avoid completely square corners, as they appear too rigid for the "small-business tool" aesthetic.

## Components

- **Buttons:** Primary buttons use the Ochre fill with Ink text. Secondary buttons use a Stone border with Ink text. All buttons have a 1rem corner radius and a subtle hover state that slightly darkens the fill.
- **Input Fields:** Use a white background with a Stone border. On focus, the border thickens to 2px and changes to Ochre. Labels always sit above the field in "Label-md" style.
- **Cards:** Cards are white with a 1rem corner radius and a soft ambient shadow. They should have generous internal padding (24px).
- **Chips/Tags:** Used for categories. These use a very light tint of the category color (e.g., 10% opacity Sage) with full-opacity text of the same hue.
- **Lists:** Transaction lists should be borderless, using 1px Stone dividers at low opacity. Use Sage for positive numbers and Ink for expenses.
- **Checkboxes/Radios:** Circular or heavily rounded forms. When active, they use the Ochre fill with a white checkmark/dot.
- **Navigation:** Use a clean sidebar or top bar with simple iconography and "Body-md" text. The active state is indicated by a vertical Ochre "pill" indicator.