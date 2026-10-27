import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { setRuntimeForTests, type Runtime } from "../src/config";
import { createSlate } from "../src/pipeline/createSlate";
import { contentSecurityPolicy, newNonce, securityHeaders } from "../src/security";
import { MemorySlateStore } from "../src/slateStore";
import SharedSlatePage from "../app/s/[id]/page";
import { proxy } from "../proxy";
import { fixtureTransport, ROOM, runtimeWith } from "./helpers";

afterEach(() => setRuntimeForTests(undefined));

function directives(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

describe("Content-Security-Policy", () => {
  const nonce = newNonce();
  const csp = directives(contentSecurityPolicy(nonce));

  it("script-src has no unsafe-inline and no unsafe-eval, and allows only 'self' and the nonce", () => {
    const script = csp.get("script-src") ?? [];
    expect(script).toContain("'self'");
    expect(script).toContain(`'nonce-${nonce}'`);
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    for (const value of script) expect(value).toMatch(/^('self'|'nonce-[A-Za-z0-9+/=]+'|'strict-dynamic')$/);
  });

  it("sets the fixed directives", () => {
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("style-src")).not.toContain("'unsafe-inline'");
  });

  it("only the development policy adds unsafe-eval", () => {
    expect(directives(contentSecurityPolicy(nonce, true)).get("script-src")).toContain("'unsafe-eval'");
  });

  it("nonces are unique per request", () => {
    expect(new Set(Array.from({ length: 200 }, () => newNonce())).size).toBe(200);
  });
});

describe("proxy response headers", () => {
  function run(path: string) {
    return proxy(new NextRequest(`http://localhost${path}`));
  }

  it("a shared slate path carries noindex, no-store, the CSP, nosniff and no-referrer", () => {
    const res = run("/s/abcdefghijklmnopqrstu");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const script = directives(res.headers.get("content-security-policy") ?? "").get("script-src") ?? [];
    expect(script.join(" ")).not.toMatch(/unsafe-(inline|eval)/);
  });

  it("every route gets the security headers; only slate paths get noindex", () => {
    for (const path of ["/", "/api/health", "/slates/abcdefghijklmnopqrstu", "/run/abcdefghijklmnopqrstu/confirm"]) {
      const res = run(path);
      expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(run("/").headers.get("x-robots-tag")).toBeNull();
    expect(run("/slates/abcdefghijklmnopqrstu").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(securityHeaders("/s", "n")["X-Robots-Tag"]).toBe("noindex, nofollow");
  });
});

/** A store that counts every call, so "no database query" is measurable. */
function countingRuntime(base: Runtime & { store: MemorySlateStore }): { rt: Runtime; gets: string[] } {
  const gets: string[] = [];
  const store = {
    save: (s: Parameters<MemorySlateStore["save"]>[0]) => base.store.save(s),
    update: (s: Parameters<MemorySlateStore["update"]>[0]) => base.store.update(s),
    updateWith: (id: string, patch: Parameters<MemorySlateStore["updateWith"]>[1]) => base.store.updateWith(id, patch),
    get: (id: string) => {
      gets.push(id);
      return base.store.get(id);
    },
  };
  return { rt: { ...base, store }, gets };
}

async function status(id: string): Promise<number | "ok"> {
  try {
    await SharedSlatePage({ params: Promise.resolve({ id }) });
    return "ok";
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    const match = /^NEXT_HTTP_ERROR_FALLBACK;(\d+)$/.exec(digest);
    if (match) return Number(match[1]);
    throw e;
  }
}

describe("GET /s/[id] outcomes", () => {
  it.each([
    ["22 characters", "a".repeat(22)],
    ["path traversal", "..%2F..%2Fetc%2Fpasswd"],
    ["SQL metacharacters", "x' OR '1'='1"],
    ["empty", ""],
  ])("a malformed id (%s) is a 404 with no store query", async (_label, id) => {
    const { rt, gets } = countingRuntime(runtimeWith(fixtureTransport()));
    setRuntimeForTests(rt);
    expect(await status(id)).toBe(404);
    expect(gets).toHaveLength(0);
  });

  it("an unknown id and an expired slate give the same 404 (fake clock)", async () => {
    let now = new Date("2026-10-26T12:00:00.000Z");
    const rt = runtimeWith(fixtureTransport());
    const store = new MemorySlateStore(() => now);
    setRuntimeForTests({ ...rt, store });
    const outcome = await createSlate(ROOM, { ...rt, store });
    if (outcome.status !== "done") throw new Error("expected done");
    expect(await status(outcome.id)).toBe("ok");
    expect(await status("A".repeat(21))).toBe(404);
    now = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(await status(outcome.id)).toBe(404);
  });
});

