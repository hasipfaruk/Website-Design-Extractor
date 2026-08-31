import { chromium, type Browser } from 'playwright';

/**
 * One Chromium process shared across requests - launching costs ~300ms and a
 * lot of memory, so we keep it warm and give each extraction its own context.
 *
 * Stored on globalThis so Next's dev-mode module reloading does not leak a new
 * browser on every edit.
 */
const KEY = Symbol.for('design-extractor.browser');

interface Slot {
  promise: Promise<Browser> | null;
}

const slot: Slot = ((globalThis as Record<symbol, unknown>)[KEY] as Slot) ?? { promise: null };
(globalThis as Record<symbol, unknown>)[KEY] = slot;

export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserUnavailableError';
  }
}

export async function getBrowser(): Promise<Browser> {
  if (slot.promise) {
    try {
      const b = await slot.promise;
      if (b.isConnected()) return b;
    } catch {
      // Fall through and relaunch.
    }
    slot.promise = null;
  }

  slot.promise = chromium
    .launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // The page is untrusted content; keep the sandbox on where possible but
        // allow these hardening-neutral flags for headless stability.
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    })
    .then((b) => {
      b.on('disconnected', () => {
        if (slot.promise) slot.promise = null;
      });
      return b;
    })
    .catch((err: Error) => {
      slot.promise = null;
      if (/Executable doesn't exist|browserType.launch/i.test(err.message)) {
        throw new BrowserUnavailableError(
          'Chromium is not installed. Run "npm run setup" (playwright install chromium) and try again.',
        );
      }
      throw err;
    });

  return slot.promise;
}

export async function closeBrowser(): Promise<void> {
  if (!slot.promise) return;
  const p = slot.promise;
  slot.promise = null;
  try {
    const b = await p;
    await b.close();
  } catch {
    // Already gone.
  }
}
