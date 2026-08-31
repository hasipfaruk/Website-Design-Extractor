#!/usr/bin/env node
/**
 * Drop a design.md into the current project.
 *
 *   npx websift add mobbin
 *   npx websift list
 *
 * Talks to the WebSift API (default http://localhost:3000).
 * Override with --api or WEBSIFT_API / GETDESIGN_API.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const DEFAULT_API =
  process.env.WEBSIFT_API || process.env.GETDESIGN_API || process.env.DESIGN_EXTRACTOR_URL || 'http://localhost:3000';

function usage() {
  console.log(`
  websift — install a design.md for your AI coding agent

  Usage
    npx websift add <slug> [--force] [--out <path>] [--api <url>]
    npx websift list [--api <url>]

  Examples
    npx websift add mobbin
    npx websift add stripe --force
    npx websift add linear --out ./docs/design.md
`);
}

function arg(flag, argv) {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function has(flag, argv) {
  return argv.includes(flag);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

async function fetchMarkdown(url) {
  const res = await fetch(url, { headers: { Accept: 'text/markdown, text/plain' } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.text();
}

function writeDesign(target, markdown, force, slug) {
  if (existsSync(target) && !force) {
    const nested = resolve(process.cwd(), slug || 'design', 'design.md');
    mkdirSync(dirname(nested), { recursive: true });
    writeFileSync(nested, markdown, 'utf8');
    return nested;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, markdown, 'utf8');
  return target;
}

async function cmdList(api) {
  const data = await fetchJson(`${api.replace(/\/$/, '')}/api/designs`);
  const rows = data.designs ?? [];
  const width = Math.max(8, ...rows.map((r) => r.slug.length));
  console.log('');
  for (const row of rows) {
    const mark = row.ready ? '●' : '○';
    console.log(`  ${mark}  ${row.slug.padEnd(width)}  ${row.description}`);
  }
  console.log(`
  ${rows.length} references. Ready ones (●) download instantly.
  Others extract the live site the first time you add them.

    npx websift add <slug>
`);
}

async function cmdAdd(slug, argv) {
  if (!slug) {
    usage();
    process.exit(1);
  }
  const api = (arg('--api', argv) || DEFAULT_API).replace(/\/$/, '');
  const force = has('--force', argv);
  const out = arg('--out', argv);
  const target = resolve(process.cwd(), out || 'design.md');

  process.stdout.write(`\n  Fetching ${slug}…`);
  const markdown = await fetchMarkdown(`${api}/api/designs/${encodeURIComponent(slug)}`);
  process.stdout.write('\r');

  const written = writeDesign(target, markdown, force, slug);
  const rel = relative(process.cwd(), written) || written;

  console.log(`
  ✓ design.md inspired by ${slug} installed
    → ${rel}

  Tell your coding agent to use this file as
  reference before writing any UI.
  Customize it as your project evolves.
`);
}

const argv = process.argv.slice(2);
const command = argv[0];
const api = (arg('--api', argv) || DEFAULT_API).replace(/\/$/, '');

if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}

try {
  if (command === 'list') {
    await cmdList(api);
  } else if (command === 'add') {
    await cmdAdd(argv[1] && !argv[1].startsWith('-') ? argv[1] : undefined, argv);
  } else {
    usage();
    process.exit(1);
  }
} catch (err) {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : err}`);
  console.error(`    API: ${api}\n`);
  process.exit(1);
}
