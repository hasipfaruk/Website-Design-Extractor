import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * This service fetches arbitrary user-supplied URLs from the server, which is a
 * textbook SSRF sink. Everything here exists to keep a submitted URL from
 * reaching loopback, link-local (cloud metadata), or private network addresses.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local - AWS/GCP/Azure metadata lives at 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
];

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    for (const [base, bits] of V4_BLOCKED) {
      const b = ipv4ToInt(base);
      if (b === null) continue;
      const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
      if ((n & mask) >>> 0 === (b & mask) >>> 0) return true;
    }
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // IPv4-mapped (::ffff:10.0.0.1) must be judged on the embedded v4 address.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (lower === '::1' || lower === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
    if (lower.startsWith('ff')) return true; // multicast
    return false;
  }

  return true; // Unrecognised literal - refuse rather than guess.
}

const BLOCKED_HOSTNAMES = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa|metadata\.google\.internal)$/i;

/**
 * Normalise user input into a URL we are willing to load.
 * Accepts "example.com" as well as a full URL.
 */
export function normalizeUrl(input: string): URL {
  const trimmed = (input || '').trim();
  if (!trimmed) throw new BlockedUrlError('Enter a website URL.');
  if (trimmed.length > 2048) throw new BlockedUrlError('That URL is too long.');

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new BlockedUrlError(`"${trimmed}" is not a valid URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https URLs can be analysed.');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('URLs with embedded credentials are not allowed.');
  }
  if (BLOCKED_HOSTNAMES.test(url.hostname)) {
    throw new BlockedUrlError('Local and internal hostnames cannot be analysed.');
  }

  const bare = url.hostname.replace(/^\[|\]$/g, '');
  if ((net.isIP(bare) !== 0) && isPrivateIp(bare)) {
    throw new BlockedUrlError('Private and loopback addresses cannot be analysed.');
  }

  return url;
}

/** Resolve the hostname and refuse if any address it points at is private. */
export async function assertPublicHost(hostname: string): Promise<string[]> {
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(bare) !== 0) {
    if (isPrivateIp(bare)) throw new BlockedUrlError('That address is not publicly routable.');
    return [bare];
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(bare, { all: true });
  } catch {
    throw new BlockedUrlError(`Could not resolve "${bare}". Check the domain name.`);
  }
  if (!addresses.length) throw new BlockedUrlError(`Could not resolve "${bare}".`);

  for (const a of addresses) {
    if (isPrivateIp(a.address)) {
      throw new BlockedUrlError('That hostname resolves to a private address and cannot be analysed.');
    }
  }
  return addresses.map((a) => a.address);
}

/**
 * Synchronous check used inside Playwright's request interceptor, where a DNS
 * round-trip per request is too slow. Catches redirects to obvious internals.
 */
export function isObviouslyBlockedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    if (BLOCKED_HOSTNAMES.test(u.hostname)) return true;
    const bare = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(bare) !== 0 && isPrivateIp(bare)) return true;
    return false;
  } catch {
    return true;
  }
}
