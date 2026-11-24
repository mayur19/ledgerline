import { isIP } from 'node:net';

const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Expand an IPv6 address (no zone id) into its 8 hextets. */
function expandV6(address: string): string[] {
  const [head = '', tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = address.includes('::') ? (tail ? tail.split(':') : []) : [];
  const last = (right.length ? right : left).at(-1) ?? '';
  // Embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) counts as two hextets.
  if (last.includes('.')) {
    const parts = last.split('.').map(Number);
    const words = [
      ((parts[0] ?? 0) << 8) | (parts[1] ?? 0),
      ((parts[2] ?? 0) << 8) | (parts[3] ?? 0),
    ].map((n) => n.toString(16));
    (right.length ? right : left).splice(-1, 1, ...words);
  }
  const missing = 8 - left.length - right.length;
  return [...left, ...Array.from({ length: Math.max(missing, 0) }, () => '0'), ...right].map((h) =>
    (parseInt(h || '0', 16) || 0).toString(16),
  );
}

/**
 * Key used by IP-based limiters. IPv4-mapped IPv6 becomes plain IPv4 and any
 * other IPv6 address collapses to its /64, because one subscriber typically
 * controls a whole /64 and could otherwise rotate addresses to dodge limits.
 */
export function limiterIpKey(raw: string): string {
  const ip = raw.trim().split('%')[0] ?? '';
  const mapped = MAPPED_V4.exec(ip);
  if (mapped?.[1] && isIP(mapped[1]) === 4) return mapped[1];
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) === 6) return `${expandV6(ip).slice(0, 4).join(':')}::/64`;
  return ip || 'unknown';
}
