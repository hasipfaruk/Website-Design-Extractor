import path from 'node:path';
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

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV,
  );
}

/** Render / tiny Docker boxes are ~512MB. Hugging Face Spaces has more RAM. */
export function isLowMemoryHost(): boolean {
  if (process.env.SPACE_ID) return false;
  return Boolean(process.env.LOW_MEMORY || process.env.RENDER);
}

const LOCAL_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

const CONTAINER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--single-process',
  '--no-zygote',
];

async function launchLocal(): Promise<Browser> {
  const args = isLowMemoryHost() ? [...LOCAL_ARGS, ...CONTAINER_ARGS] : LOCAL_ARGS;
  return chromium.launch({ headless: true, args });
}

/**
 * Vercel / Lambda have no system Chromium and no Playwright browser cache.
 * @sparticuz/chromium ships a brotli-compressed binary that unpacks to /tmp.
 */
async function launchServerless(): Promise<Browser> {
  const [{ chromium: core }, pack] = await Promise.all([
    import('playwright-core'),
    import('@sparticuz/chromium'),
  ]);
  const Chromium = pack.default;
  Chromium.setGraphicsMode = false;

  const executablePath = await Chromium.executablePath();
  const libDir = path.dirname(executablePath);
  process.env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

  return core.launch({
    args: Chromium.args,
    executablePath,
    headless: true,
  }) as Promise<Browser>;
}

function wrapLaunchError(err: Error): never {
  const detail = err.message.split('\n')[0] ?? err.message;
  if (isServerless()) {
    throw new BrowserUnavailableError(
      'Live extract needs Chromium. Vercel serverless has no system browser, so we unpack a serverless build — that failed here. ' +
        'In the Vercel project set AWS_LAMBDA_JS_RUNTIME=nodejs22.x, give this function ≥60s and ≥1024MB, and turn Fluid Compute off if launch still fails. ' +
        `Detail: ${detail}`,
    );
  }
  if (/Executable doesn't exist|browserType.launch/i.test(err.message)) {
    throw new BrowserUnavailableError(
      'Chromium is not installed. Run "npm run setup" (playwright install chromium) and try again.',
    );
  }
  throw new BrowserUnavailableError(`Could not start Chromium: ${detail}`);
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

  slot.promise = (isServerless() ? launchServerless() : launchLocal())
    .then((b) => {
      b.on('disconnected', () => {
        if (slot.promise) slot.promise = null;
      });
      return b;
    })
    .catch((err: Error) => {
      slot.promise = null;
      wrapLaunchError(err);
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
