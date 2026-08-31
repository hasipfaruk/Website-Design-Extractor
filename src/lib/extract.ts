import type { BrowserContext, Page, Response } from 'playwright';
import { getBrowser } from './browser';
import { normalizeUrl, assertPublicHost, isObviouslyBlockedUrl, BlockedUrlError } from './guard';
import { COLLECT_SCRIPT, type RawCollected } from './page-script';
import { parseCssBundle, type CssSource } from './css-parse';
import { buildReport } from './analyze';
import type { DesignReport } from './types';

export class ExtractionError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ExtractionError';
    this.status = status;
  }
}

const NAV_TIMEOUT = 35_000;
const SETTLE_TIMEOUT = 8_000;
const MAX_CSS_BYTES = 6_000_000;
const VIEWPORT = { width: 1440, height: 900 };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/125.0.0.0 Safari/537.36 DesignExtractor/0.1';

/** Nudge the page down and back up so lazy-loaded sections render before we measure. */
async function autoScroll(page: Page): Promise<void> {
  try {
    await page.evaluate(`
      new Promise((resolve) => {
        const step = Math.max(window.innerHeight * 0.9, 400);
        let y = 0;
        let ticks = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          ticks++;
          if (ticks > 12 || y >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve(true);
          }
        }, 120);
      })
    `);
    await page.waitForTimeout(400);
  } catch {
    // Scrolling is best-effort; a page that blocks it still analyses fine.
  }
}

export async function extractDesign(inputUrl: string): Promise<DesignReport> {
  const started = Date.now();
  const warnings: { code: string; message: string }[] = [];

  const url = normalizeUrl(inputUrl);
  await assertPublicHost(url.hostname);

  const browser = await getBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: UA,
      locale: 'en-US',
      // Lets us evaluate our collector on sites with a strict script-src.
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      serviceWorkers: 'block',
    });
    context.setDefaultTimeout(NAV_TIMEOUT);

    const page = await context.newPage();

    // Re-check every navigation: a public host can 302 into a private address.
    await context.route('**/*', (route) => {
      const req = route.request();
      if (req.isNavigationRequest() && isObviouslyBlockedUrl(req.url())) {
        route.abort('blockedbyclient').catch(() => {});
        return;
      }
      // Video/audio cost bandwidth and tell us nothing about the design system.
      if (req.resourceType() === 'media') {
        route.abort().catch(() => {});
        return;
      }
      route.continue().catch(() => {});
    });

    // Capture stylesheet bodies off the wire - cross-origin sheets are opaque to
    // document.styleSheets, so the page itself cannot read them.
    const cssSources: CssSource[] = [];
    let cssBytes = 0;
    const pendingCss: Promise<void>[] = [];

    page.on('response', (res: Response) => {
      const contentType = res.headers()['content-type'] || '';
      const resUrl = res.url();
      if (!/text\/css/i.test(contentType) && !/\.css(\?|$)/i.test(resUrl)) return;
      if (cssBytes >= MAX_CSS_BYTES) return;

      pendingCss.push(
        res
          .text()
          .then((body) => {
            if (!body || cssBytes >= MAX_CSS_BYTES) return;
            cssBytes += body.length;
            cssSources.push({ href: resUrl, css: body });
          })
          .catch(() => {
            // Body already discarded, or the request was aborted - not fatal.
          }),
      );
    });

    let response;
    try {
      response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    } catch (err) {
      const msg = (err as Error).message || '';
      if (/ERR_NAME_NOT_RESOLVED/.test(msg)) throw new ExtractionError(`Could not resolve ${url.hostname}.`, 400);
      if (/ERR_CONNECTION_REFUSED/.test(msg)) throw new ExtractionError(`${url.hostname} refused the connection.`, 502);
      if (/blockedbyclient/i.test(msg)) throw new BlockedUrlError('That URL redirected to a blocked address.');
      if (/Timeout/i.test(msg)) throw new ExtractionError(`${url.hostname} took too long to respond.`, 504);
      throw new ExtractionError(`Could not load the page: ${msg.split('\n')[0]}`, 502);
    }

    if (response && response.status() >= 400) {
      // HTTP/2 carries no reason phrase, so statusText is often empty.
      const reason = response.statusText() ? ` ${response.statusText()}` : '';
      throw new ExtractionError(`The site returned HTTP ${response.status()}${reason}.`, 502);
    }

    // Redirects are followed by the browser; verify where we actually landed.
    const landed = new URL(page.url());
    if (landed.hostname !== url.hostname) {
      await assertPublicHost(landed.hostname);
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT });
    } catch {
      warnings.push({ code: 'network-busy', message: 'The page kept loading resources; analysed it as-is.' });
    }

    await autoScroll(page);

    try {
      await page.waitForFunction('document.fonts ? document.fonts.status === "loaded" : true', null, { timeout: 4000 });
    } catch {
      warnings.push({ code: 'fonts-pending', message: 'Some webfonts had not finished loading.' });
    }

    let raw: RawCollected;
    try {
      raw = (await page.evaluate(COLLECT_SCRIPT)) as RawCollected;
    } catch (err) {
      throw new ExtractionError(`Could not analyse the page: ${(err as Error).message.split('\n')[0]}`, 502);
    }

    let screenshot: string | null = null;
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: false, timeout: 12_000 });
      screenshot = `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      warnings.push({ code: 'no-screenshot', message: 'Could not capture a preview image.' });
    }

    // Let in-flight stylesheet reads finish, but never hang on them.
    await Promise.race([
      Promise.allSettled(pendingCss),
      new Promise((r) => setTimeout(r, 3000)),
    ]);

    const inlineSources: CssSource[] = (raw.inlineStyles || []).map((css, i) => ({
      href: `${landed.href}#inline-style-${i}`,
      css,
    }));

    const css = parseCssBundle([...inlineSources, ...cssSources]);

    if (raw.stats?.sheetsBlocked > 0 && cssSources.length === 0) {
      warnings.push({
        code: 'css-opaque',
        message: `${raw.stats.sheetsBlocked} cross-origin stylesheet(s) could not be read.`,
      });
    }

    return buildReport(raw, css, {
      requestedUrl: url.href,
      screenshot,
      durationMs: Date.now() - started,
      warnings,
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
