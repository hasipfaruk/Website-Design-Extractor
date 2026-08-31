# Design Extractor

Paste a website URL, get its design system: colours, fonts, heading sizes, line
heights, spacing scale, radii, shadows, icons and component styles — as a
browsable report and a downloadable `design.md`.

Unlike tools that scrape raw CSS, this renders the page in headless Chromium and
reads **computed styles** off the live DOM. That means the numbers are what the
browser actually shipped: real `h1` sizes after every cascade, media query and
JS-applied class, on sites that render entirely client-side.

## Quick start

```bash
npm install
npm run setup     # downloads Chromium for Playwright (~150 MB, one time)
npm run dev       # http://localhost:3000
```

Then enter a URL and hit **Extract design**.

## What it pulls out

| Area | Detail |
| --- | --- |
| **Colours** | Full palette ranked by weighted usage, hex/RGB/HSL/OKLCH, human names, WCAG contrast on white, black and the page's own background, plus gradients and colour custom properties |
| **Semantic tokens** | Inferred `background`, `surface`, `text-primary`, `text-muted`, `border`, `primary`, `accent` |
| **Typography** | Families with their source (Google / Adobe / self-hosted / system), plus per-role specs for h1–h6, body, links, buttons, labels, captions, code and nav — size in px and rem, weight, line height and ratio, letter spacing, transform, colour |
| **Type scale** | Every size in use with the ratio between consecutive steps |
| **`@font-face`** | Family, weight, style, `font-display`, formats and source URLs |
| **Spacing** | Inferred base unit and the full spacing scale with multiples |
| **Shape** | Border radii, box shadows and border styles, ranked by use |
| **Layout** | Container max-widths, media-query breakpoints, flex/grid usage |
| **Components** | Computed styles for buttons, inputs, cards, badges, header and footer |
| **Icons** | Inline SVG markup (deduplicated), image icons, and icon-font glyphs |
| **Tech** | Framework, CSS framework, font provider and icon set detection |

## Exports

Every extraction can be taken away as:

- **`design.md`** — the complete report as one markdown file
- **`tokens.json`** — structured design tokens
- **`tokens.css`** — CSS custom properties
- **`tailwind.config.js`** — a Tailwind theme extension

## How it works

```
src/lib/
  guard.ts        URL validation + SSRF protection (DNS resolution, private-range blocking)
  browser.ts      Shared Chromium instance, one context per extraction
  page-script.ts  The collector that runs inside the target page
  extract.ts      Orchestration: navigate, scroll, collect, screenshot
  css-parse.ts    postcss pass over intercepted stylesheets (@font-face, vars, @media)
  color.ts        Colour parsing, conversion, WCAG contrast, naming
  analyze.ts      Raw signals -> structured DesignReport
  markdown.ts     DesignReport -> design.md
  exporters.ts    DesignReport -> tokens / CSS / Tailwind
```

Two things are worth knowing about the design:

**The in-page collector is a string, not a function.** `page.evaluate(fn)` relies
on `Function.prototype.toString()`, which bundlers can rewrite. Shipping the
collector as a `String.raw` literal makes it immune to that.

**Stylesheets are captured off the network, not from the DOM.** Cross-origin
stylesheets are opaque to `document.styleSheets`, so `extract.ts` intercepts CSS
responses and parses them server-side. That is the only way to see `@font-face`
and custom properties on most real sites.

### Colour ranking

Backgrounds are weighted by painted area, text by glyph volume, borders by edge
length. Each role is normalised to its own maximum before being combined —
otherwise a single full-page background would outweigh every accent colour on
the site.

## Security

This service fetches arbitrary user-supplied URLs server-side, which is an SSRF
sink by construction. Mitigations:

- Only `http:` / `https:`, no embedded credentials
- Hostnames resolved before navigation; requests refused if **any** resolved
  address is loopback, link-local (`169.254.0.0/16` — cloud metadata),
  private, CGNAT, or otherwise not publicly routable
- Redirects re-checked, since a public host can 302 into a private address
- Extracted SVG is rendered through `<img src="data:image/svg+xml,…">`, where
  the SVG spec forbids scripting, and stripped of scripts and event handlers
  before it is handed to anyone copying the markup
- Per-IP rate limiting and a concurrency cap on the API route

Rate limiting is in-memory, so a multi-instance deployment needs shared state.

## Deployment

Needs a Node runtime that can run Chromium — Railway, Render, Fly.io, or a VPS.
Standard Vercel serverless functions cannot; that would need
`@sparticuz/chromium` with `playwright-core`.

```bash
npm run build && npm start
```

## Limits

- Analyses the **single page** you give it, not the whole site
- Caps at 8,000 elements per page
- Desktop viewport only (1440×900); mobile-only styles are not captured
- Sites behind a login, hard bot protection, or a consent wall may return the
  interstitial's design rather than their own
