import { createHash } from "node:crypto";
import { isIP } from "node:net";

/**
 * Client address for budgeting (ADR 0008 addendum).
 *
 * Header used: on Vercel (the production host) the platform sets `x-vercel-forwarded-for` to the
 * connecting client address and a client cannot override it; `x-forwarded-for` and `x-real-ip` are
 * also rewritten by the platform, not appended to. This module therefore reads, in order:
 *   1. `x-vercel-forwarded-for` (first hop),
 *   2. `x-real-ip`,
 *   3. `x-forwarded-for` (first hop, as set by the host).
 * Off the platform (local dev, another host) a client can send these headers itself, so the
 * address is only as trustworthy as the host in front of the app; budgets are an abuse brake, not
 * authentication. Anything missing or not a valid IPv4/IPv6 address maps to ONE shared bucket
 * (`UNKNOWN_IP`), so a spoofed junk header cannot mint fresh buckets. IPv6 addresses are reduced to
 * their /64 prefix, because one subscriber commonly holds a whole /64 and could otherwise rotate.
 */
export const UNKNOWN_IP = "unknown";

function firstHop(value: string | null): string | undefined {
  if (!value) return undefined;
  const first = value.split(",")[0]?.trim();
  return first ? first : undefined;
}

/** Expands an IPv6 address to its 8 groups, or undefined when it is not valid. */
function ipv6Groups(address: string): string[] | undefined {
  let text = address;
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  // An embedded IPv4 tail (::ffff:1.2.3.4) becomes two hex groups.
  const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number];
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return undefined;
  const groups = halves.length === 1 ? head : [...head, ...Array<string>(missing).fill("0"), ...rest];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return undefined;
  return groups.map((g) => g.toLowerCase().padStart(4, "0"));
}

/** The address used for budgeting: a valid IPv4 address, an IPv6 /64 prefix, or `UNKNOWN_IP`. */
export function clientIp(headers: Headers): string {
  const raw = firstHop(headers.get("x-vercel-forwarded-for")) ?? firstHop(headers.get("x-real-ip")) ?? firstHop(headers.get("x-forwarded-for"));
  if (!raw || raw.length > 64) return UNKNOWN_IP;
  const family = isIP(raw.replace(/%.*$/, ""));
  if (family === 4) return raw;
  if (family === 6) {
    const groups = ipv6Groups(raw);
    if (!groups) return UNKNOWN_IP;
    // An IPv4-mapped address is that IPv4 address, not a shared /64.
    if (groups.slice(0, 5).every((g) => g === "0000") && groups[5] === "ffff") {
      const hi = parseInt(groups[6] as string, 16);
      const lo = parseInt(groups[7] as string, 16);
      return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return UNKNOWN_IP;
}

/** `YYYY-MM-DD` in UTC: the budget day. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Whole seconds until the next UTC midnight (at least 1): the `Retry-After` value. */
export function secondsToUtcMidnight(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Salted SHA-256 of the address and the day, hex. The raw address is never stored or logged; the
 * day is mixed in so the same visitor has an unrelated hash tomorrow.
 */
export function ipHash(ip: string, day: string, salt: string): string {
  return createHash("sha256").update(`${salt}\u0000${day}\u0000${ip}`).digest("hex");
}
