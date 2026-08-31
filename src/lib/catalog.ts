import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOG, findCatalogEntry, SLUG_RE, type CatalogEntry, type PublicDesign } from './catalog-data';
import { countMarkdownSections } from './design-md';

export type { PublicDesign };

function rootDir(): string {
  return process.cwd();
}

export function cachedDesignPath(slug: string): string {
  return path.join(rootDir(), 'designs', slug, 'DESIGN.md');
}

export function bundledDesignPath(entry: CatalogEntry): string | null {
  if (!entry.file) return null;
  return path.join(rootDir(), entry.file);
}

export function resolveDesignPath(slug: string): string | null {
  const entry = findCatalogEntry(slug);
  if (entry?.file) {
    const bundled = bundledDesignPath(entry);
    if (bundled && existsSync(bundled)) return bundled;
  }
  const cached = cachedDesignPath(slug);
  if (existsSync(cached)) return cached;
  return null;
}

function isBundledMarkdown(slug: string): boolean {
  const entry = findCatalogEntry(slug);
  if (!entry?.file) return false;
  const bundled = bundledDesignPath(entry);
  return !!(bundled && existsSync(bundled));
}

export function readDesignMarkdown(slug: string): string | null {
  const file = resolveDesignPath(slug);
  if (!file) return null;
  return readFileSync(file, 'utf8');
}

export function saveDesignMarkdown(slug: string, markdown: string): string {
  if (!SLUG_RE.test(slug)) throw new Error('Invalid design slug.');
  if (isBundledMarkdown(slug)) {
    const bundled = bundledDesignPath(findCatalogEntry(slug)!);
    return bundled!;
  }
  const dest = cachedDesignPath(slug);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, markdown, 'utf8');
  return dest;
}

export function extractBundlePath(slug: string): string {
  return path.join(rootDir(), 'designs', slug, 'extract.json');
}

export function saveExtractBundle(slug: string, bundle: unknown): void {
  if (!SLUG_RE.test(slug)) throw new Error('Invalid design slug.');
  const dest = extractBundlePath(slug);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(bundle), 'utf8');
}

export function readExtractBundle(slug: string): Record<string, unknown> | null {
  const dest = extractBundlePath(slug);
  if (!existsSync(dest)) return null;
  try {
    return JSON.parse(readFileSync(dest, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function listPublicDesigns(): PublicDesign[] {
  return CATALOG.map((entry) => {
    const markdown = readDesignMarkdown(entry.slug);
    return {
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      url: entry.url,
      ready: !!markdown,
      sections: entry.sections ?? (markdown ? countMarkdownSections(markdown) : null),
      screens: entry.screens ?? null,
      command: '',
    };
  });
}

export function catalogUrlFor(slug: string): string | null {
  return findCatalogEntry(slug)?.url ?? null;
}
