import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, newNonce, securityHeaders } from "./src/security";

/**
 * Next 16's `proxy` (the former middleware): a fresh CSP nonce per request, passed to the renderer
 * in the request headers so Next stamps it on its own scripts, and the security headers on the response.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = newNonce();
  const dev = process.env.NODE_ENV === "development";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce, dev));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(securityHeaders(request.nextUrl.pathname, nonce, dev))) response.headers.set(name, value);
  return response;
}

export const config = {
  // Everything except Next's static assets and the favicon; pages and API routes all get the headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
