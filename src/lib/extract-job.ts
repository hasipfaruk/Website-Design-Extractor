import { extractDesign, ExtractionError } from './extract';
import { toDesignMd } from './design-md';
import { toMarkdown } from './markdown';
import { toCssVariables, toTailwindConfig, toTokens, type TokenBundle } from './exporters';
import { saveDesignMarkdown, saveExtractBundle } from './catalog';
import { slugFromUrl } from './catalog-data';
import type { DesignReport } from './types';

export interface ExtractBundle {
  report: DesignReport;
  designMd: string;
  markdown: string;
  css: string;
  tailwind: string;
  tokens: TokenBundle;
}

export class ExtractorBusyError extends Error {
  constructor() {
    super('The extractor is busy with other sites. Try again in a moment.');
    this.name = 'ExtractorBusyError';
  }
}

const MAX_CONCURRENT = 3;
let inFlight = 0;
const byKey = new Map<string, Promise<ExtractBundle>>();

export function isExtractBundle(value: unknown): value is ExtractBundle {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const report = v.report as DesignReport | undefined;
  return !!(
    report &&
    typeof report === 'object' &&
    report.meta &&
    Array.isArray(report.colors) &&
    Array.isArray(report.typeRoles) &&
    typeof v.markdown === 'string' &&
    typeof v.css === 'string'
  );
}

/**
 * Run an extract, sharing in-flight work for the same slug/URL so React Strict
 * Mode and double-clicks cannot launch two Chromium contexts.
 */
export function runExtract(url: string, slug?: string): Promise<ExtractBundle> {
  const key = (slug || url).toLowerCase();
  const existing = byKey.get(key);
  if (existing) return existing;

  if (inFlight >= MAX_CONCURRENT) {
    return Promise.reject(new ExtractorBusyError());
  }

  inFlight++;
  const job = (async () => {
    try {
      const report = await extractDesign(url);
      const resolvedSlug = slug || slugFromUrl(report.meta.domain || report.meta.finalUrl);
      const designMd = toDesignMd(report);
      const markdown = toMarkdown(report);
      const css = toCssVariables(report);
      const tailwind = toTailwindConfig(report);
      const tokens = toTokens(report);
      const bundle: ExtractBundle = { report, designMd, markdown, css, tailwind, tokens };
      try {
        saveDesignMarkdown(resolvedSlug, designMd);
        saveExtractBundle(resolvedSlug, bundle);
      } catch (err) {
        console.warn('[extract] could not cache extract:', err);
      }
      return bundle;
    } finally {
      inFlight--;
      byKey.delete(key);
    }
  })();

  byKey.set(key, job);
  return job;
}
