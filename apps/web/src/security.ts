/**
 * Security headers for every route (ADR 0008, M2-04). Pure functions so a test can parse the policy;
 * `proxy.ts` calls them per request with a fresh nonce.
 */

/** Paths that show a stored slate: never indexed, never cached by a shared cache. */
export function isSlatePath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/") || pathname === "/slates" || pathname.startsWith("/slates/");
}

/** A fresh, unpredictable nonce for one response (base64 of 16 random bytes). */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * The strict policy. Scripts run only with the per-request nonce (`strict-dynamic` lets Next load its
 * own chunks); there is no `unsafe-inline` or `unsafe-eval` in `script-src`. React writes a few
 * `style` attributes (bar widths), so only `style-src-attr` allows inline style, never a style element.
 * `dev` adds `unsafe-eval`, which React's development build needs and production does not.
 */
export function contentSecurityPolicy(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The headers every response carries; slate pages add noindex and no-store. */
export function securityHeaders(pathname: string, nonce: string, dev = false): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(nonce, dev),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (isSlatePath(pathname)) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
    headers["Cache-Control"] = "private, no-store";
  }
  return headers;
}
