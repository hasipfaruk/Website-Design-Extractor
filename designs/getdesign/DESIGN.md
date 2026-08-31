---
version: alpha
name: "getdesign.md Analysis"
description: "Browse independent design system analyses from popular websites. Drop one into your project as design reference for your coding agent."

colors:
  primary: "#ffb1ee"
  on-primary: "#a0a0a0"
  ink: "#a0a0a0"
  ink-soft: "#a0a0a0"
  text-muted: "#878787"
  text-faint: "#6d6d6d"
  canvas: "#000000"
  canvas-soft: "#0f1013"
  field: "#0f1013"
  hairline-soft: "#242424"
  hairline: "#242424"
  accent: "#f5a623"

typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.44px
  heading-1:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.44px
  heading-2:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: 0
  heading-3:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.52px
  heading-4:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  title:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  body-lg:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  body:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.3
    letterSpacing: 0
  link:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 450
    lineHeight: 1.45
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 7px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px
  section-lg: 120px

components:
  button-primary:
    backgroundColor: "#ffffff"
    textColor: "{colors.canvas}"
    rounded: "9999px"
    padding: "8px 12px"
    borderColor: "#ffffff"
  button-outline:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "8px"
    padding: "10px 16px"
    borderColor: "{colors.canvas}"
  text-input:
    backgroundColor: "#00000000"
    textColor: "#ededed"
    padding: "12px 0px"
    borderColor: "#ededed"
  nav:
    backgroundColor: "#000000d9"
    textColor: "#ededed"
  footer:
    backgroundColor: "#00000000"
    textColor: "#ededed"
    padding: "0px 0px 32px"
---


## Overview

getdesign.md is captured here as a reusable visual language for AI coding agents. The system is built from **live computed styles** on https://getdesign.md/ (Tailwind CSS), not from a published design-token file. Ink sits at `{colors.ink}`, the canvas is `{colors.canvas}`, and the commercial accent is `{colors.accent}`.

Type is led by Geist, Geist Mono, GeistPixel-Square. Display size is 48px at weight 600; body sits at 13px / 400. Corners run 6px → 7px, with pills at `{rounded.full}`.

**Key Characteristics:**
- Palette: `primary` (#ffb1ee), `on-primary` (#a0a0a0), `ink` (#a0a0a0), `ink-soft` (#a0a0a0), `text-muted` (#878787), `text-faint` (#6d6d6d)
- Type families: Geist, Geist Mono, GeistPixel-Square
- Radius scale: 6px / 7px / 9999px
- Spacing base: 2px
- Elevation: `rgba(0, 0, 0, 0.16) 0px 10px 28px 0px`; `rgba(0, 0, 0, 0.45) 0px -16px 48px 0px`

## Colors

Source: getdesign.md. 39 colours were ranked by painted area, glyph volume and edge length.

### Brand & Accent
- **Primary** (`{colors.primary}` — #ffb1ee): Filled CTAs and brand chrome.
- **Accent** (`{colors.accent}` — #f5a623): Highlight, links, and commercial emphasis.
- **Ink** (`{colors.ink}` — #a0a0a0): Headings and primary copy.

### Surface
- **Canvas** (`{colors.canvas}` — #000000): Default page background.
- **Soft canvas** (`{colors.canvas-soft}` — #0f1013): Panels, featured cards, nav tracks.
- **Field** (`{colors.field}` — #0f1013): Form fills.
- **Hairline** (`{colors.hairline}` — #242424): Control and card edges.

### Text
- **Ink** (`{colors.ink}` — #a0a0a0)
- **Muted** (`{colors.text-muted}` — #878787)
- **Faint** (`{colors.text-faint}` — #6d6d6d)
- **On primary** (`{colors.on-primary}` — #a0a0a0): Label colour on filled buttons.

## Typography

### Font Family

**Geist** is the lead face, with Geist Mono and GeistPixel-Square in supporting roles. Fallback: system sans (`-apple-system, "Helvetica Neue", Arial, sans-serif`).

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display}` | 48px | 600 | 1.1 | Hero statements |
| `{typography.heading-1}` | 48px | 600 | 1.1 | Page heroes |
| `{typography.heading-2}` | 36px | 650 | 1.15 | Section headings |
| `{typography.heading-3}` | 26px | 600 | 1.15 | Card titles |
| `{typography.heading-4}` | 22px | 600 | 1.25 | Sub-section headings |
| `{typography.body-lg}` | 20px | 400 | 1.4 | Lead paragraphs |
| `{typography.body}` | 13px | 400 | 1.5 | Default copy |
| `{typography.body-sm}` | 14px | 450 | 1.45 | Supporting copy |
| `{typography.link}` | 15px | 600 | 1.55 | Links and button labels |
| `{typography.label}` | 13px | 500 | 1.4 | Badges and chips |

## Layout

### Spacing System
- Base unit: 2px
- Tokens: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px · `{spacing.section-lg}` 120px

### Grid & Container
- Content max-width observed around 1152px.
- Layout mix: flex 211, grid 82.

### Responsive Strategy

- `(min-width:40rem)` (640px)
- `(min-width:48rem)` (768px)
- `(min-width:64rem)` (1024px)
- `(min-width:80rem)` (1280px)
- `(min-width:96rem)` (1536px)
- `(min-width:2200px)` (2200px)

## Elevation & Depth

Shadows in use: `rgba(0, 0, 0, 0.16) 0px 10px 28px 0px`; `rgba(0, 0, 0, 0.45) 0px -16px 48px 0px`. Prefer the lightest shadow for cards and save heavier ones for overlays.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed media |
| `{rounded.sm}` | 6px | Inputs, compact cards |
| `{rounded.md}` | 7px | Content cards, tiles |
| `{rounded.full}` | 9999px | Pills, avatars, toggles |

## Components

### `Button`

Sample: “Feedback”

- **backgroundColor:** `rgb(255, 255, 255)`
- **color:** `rgb(0, 0, 0)`
- **borderRadius:** `9999px`
- **padding:** `8px 12px`
- **border:** `1px solid rgb(255, 255, 255)`
- **boxShadow:** `rgba(0, 0, 0, 0.16) 0px 10px 28px 0px`
- **fontFamily:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **fontSize:** `13px`

### `Button (variant 2)`

Sample: “Accept All”

- **backgroundColor:** `rgb(255, 177, 238)`
- **color:** `rgb(0, 0, 0)`
- **borderRadius:** `8px`
- **padding:** `10px 16px`
- **border:** `0px solid rgb(0, 0, 0)`
- **fontFamily:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **fontSize:** `13px`
- **fontWeight:** `500`

### `Input field`


- **backgroundColor:** `rgba(0, 0, 0, 0)`
- **color:** `rgb(237, 237, 237)`
- **padding:** `12px 0px`
- **border:** `0px solid rgb(237, 237, 237)`
- **fontFamily:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **fontSize:** `13px`
- **fontWeight:** `500`

### `Header / nav`

Sample: “getdesign.mdRequest a DESIGN.mdBrowse website catalog550+111”

- **backgroundColor:** `rgba(0, 0, 0, 0.85)`
- **color:** `rgb(237, 237, 237)`
- **fontFamily:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **fontSize:** `16px`
- **fontWeight:** `400`

### `Footer`

Sample: “getdesign.mdDesign, build, launch and grow products with the”

- **backgroundColor:** `rgba(0, 0, 0, 0)`
- **color:** `rgb(237, 237, 237)`
- **padding:** `0px 0px 32px`
- **fontFamily:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **fontSize:** `16px`
- **fontWeight:** `400`

## Do's and Don'ts

### Do
- Keep surfaces on `{colors.canvas}` / `{colors.canvas-soft}` and put brand chroma in `{colors.primary}` and `{colors.accent}`.
- Set headings in Geist at the weights above; pair heavy display type with lighter `{typography.body-lg}` leads.
- Use `{rounded.full}` for primary actions when the source does; otherwise stay on `{rounded.md}`.
- Treat this file as the source of truth before writing or restyling any UI.

### Don't
- Do not invent extra accent hues that are not in the color map.
- Do not replace the type scale with generic 16/24/32 defaults.
- Do not add drop shadows if the source system is hairline-and-fill only.

Extracted from https://getdesign.md/ on Mon, 31 Aug 2026 11:44:15 GMT (946 elements, 2 stylesheets).
