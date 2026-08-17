---
name: YoungCreative Professional
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e0c0b6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a78a81'
  outline-variant: '#58413a'
  surface-tint: '#ffb59c'
  primary: '#ffb59c'
  on-primary: '#5c1900'
  primary-container: '#f26b3a'
  on-primary-container: '#571700'
  inverse-primary: '#a93705'
  secondary: '#e0c298'
  on-secondary: '#402d0f'
  secondary-container: '#584323'
  on-secondary-container: '#ceb188'
  tertiary: '#5dd5f8'
  on-tertiary: '#003642'
  tertiary-container: '#00a2c3'
  on-tertiary-container: '#00323e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832700'
  secondary-fixed: '#fedeb2'
  secondary-fixed-dim: '#e0c298'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#584323'
  tertiary-fixed: '#b3ebff'
  tertiary-fixed-dim: '#5dd5f8'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5f'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  surface-dark: '#242424'
  surface-light: '#FFFFFF'
  border-dark: '#333333'
  text-primary: '#F3F4F6'
  text-muted: '#9CA3AF'
  success: '#4CAF50'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  mono-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  unit-1: 0.25rem
  unit-2: 0.5rem
  unit-4: 1rem
  unit-8: 2rem
  gutter: 1px
  margin-mobile: 16px
  margin-desktop: 24px
  bento-gap: 12px
---

## Brand & Style

The design system is engineered for professional photographers who require a high-performance, low-distraction environment for rapid decision-making. The brand persona is **Cinematic, Technical, and Precise**. It balances the "darkroom" intensity of an editor’s workspace with the "gallery" elegance of a client-facing review portal.

The aesthetic follows a **Structured Bento-Grid Minimalism**. This approach utilizes 1px precision borders and rigid alignment to create a utilitarian "tool" feel, inspired by high-end software like Lightroom and the Vercel dashboard. The UI emphasizes high-density information layouts while maintaining clarity through intentional whitespace and a strict mathematical hierarchy.

Key style principles:
- **Utilitarian Rigor:** Every element has a defined place within the grid.
- **Cinematic Focus:** Dark backgrounds pull the user’s eye toward the vibrant photography.
- **Functional Accents:** Use of "Vibrant Orange" is reserved strictly for primary actions and critical status indicators to prevent visual fatigue.

## Colors

The system employs a dual-mode strategy to serve two distinct user journeys: **The Editor (Dark)** and **The Client (Light)**.

### Photographer Dark Mode (Default)
This mode is optimized for color accuracy and reduced eye strain during long culling sessions. The background is a deep charcoal (#161616), with UI surfaces rendered in a slightly lifted #242424. The **Vibrant Orange** (#F26B3A) serves as the high-energy primary color, used for selection states and primary CTAs.

### Client Light Mode
Designed for a premium gallery experience, this mode shifts to a sophisticated "Champagne Gold" (#C5A880) or deep Slate (#111827) primary accent against a clean, off-white background (#FAFAFA). This evokes a high-end editorial feel suitable for client approvals.

**Functional Colors:** 
- **Success:** A muted #4CAF50 for "Approved" or "Selected" status.
- **Border:** A consistent #333333 in dark mode creates the signature "wireframe" structure.

## Typography

The typography strategy leverages **Inter** for all UI-related metadata, labels, and headings to maintain a technical, clean-room feel. **Plus Jakarta Sans** is used for body text and descriptive content to introduce a subtle warmth and friendliness that balances the stark UI.

**Hierarchy Rules:**
- **Metadata:** Use `label-sm` with uppercase styling and slight letter spacing for EXIF data, file names, and camera settings.
- **Headlines:** Use `display-lg` sparingly for high-impact dashboard greetings or gallery titles.
- **Body:** `body-md` is the workhorse for all tooltips, descriptions, and settings panels.

## Layout & Spacing

This design system uses a **Bento Grid** layout model, characterized by modular rectangular containers that fit together like a puzzle. 

**The Grid:**
- **Desktop:** A 12-column grid with a custom 12px `bento-gap`.
- **Containers:** All containers are defined by 1px solid borders (#333333 in dark mode).
- **Alignment:** Elements must align to a strict 4px baseline.

**Bento Logic:**
Containers should have varying spans (e.g., a large 8-column hero image block next to two 4-column metadata stacks). This creates a structured yet dynamic visual interest. In mobile views, the bento blocks stack vertically, maintaining the 12px gap.

## Elevation & Depth

To maintain the "High-tech / Modern" aesthetic, this system avoids traditional soft shadows. Depth is instead communicated through **Tonal Layering** and **1px Outlines**.

- **Z-0 (Background):** The base canvas (#161616).
- **Z-1 (Bento Cells):** Surfaces (#242424) with a 1px solid border (#333333).
- **Z-2 (Popovers/Modals):** Floating elements use the same surface color but include a subtle "ambient glow"—a very low-opacity shadow (15% black) with a 0px offset and 20px blur to separate it from the background without looking "soft."
- **Active State:** Elements being dragged or interacted with may use a 1px primary-colored border (#F26B3A) to indicate focus.

## Shapes

The shape language is **Soft-Sharp**. While the overall grid feels rigid and architectural, a subtle `0.25rem` (4px) corner radius is applied to all buttons, input fields, and bento cells. This prevents the UI from feeling aggressive or dated while maintaining the precision of a professional tool.

- **Standard Radius:** 4px (Soft).
- **Interactive Elements:** Buttons and Inputs follow the standard radius.
- **Selection Brackets:** Use sharp corners or 2px radius for technical indicators like crop marks or selection overlays.

## Components

### Buttons
- **Primary:** Solid #F26B3A with white text. High-contrast, 4px radius.
- **Secondary:** Transparent background with a 1px #333333 border. White text.
- **Ghost:** No border, muted text, highlights to #242424 on hover.

### Cards (Bento Cells)
- 1px border (#333333), #242424 background. 
- Padding should be a consistent 16px or 24px depending on content density.

### Input Fields
- Dark grey background (#1a1a1a), 1px border.
- On focus: Border changes to #F26B3A. 
- Typography: Inter 14px.

### Chips / Tags
- Small, uppercase metadata tags.
- Background: #333333; Text: #F3F4F6. 
- Radius: 2px (sharper than standard buttons).

### Specialized Components
- **Filmstrip:** A horizontal scroll of images at the bottom of the viewport with a 1px top border separation.
- **Histogram:** A monochromatic, high-density data visualization container using the Success and Primary colors for clip warnings.