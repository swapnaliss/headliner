---
title: "M2-04 · Shareable slates: unguessable links, 30-day TTL, hardened read-only page"
milestone: "M2 · Core Loop"
labels: ["backend", "security", "frontend"]
blocked_by: ["M1-GATE"]
estimate: "2h"
resources: []
needs: []
---

## Context

The journey ends with "shareable slate link" and a buyer shares a slate with a co-booker or artist manager (Potential Impact). A shared page is a stored-abuse surface, so ADR 0008 fixes the controls: nanoid 21 ids, noindex, 30-day TTL, only resolved Qloo entity names rendered, strict CSP, never raw upstream errors.

## Scope

- `packages/slates`: `saveSlate(slate): id` using `nanoid(21)` in the `slates` table (ADR 0002) with `expires_at = created_at + 30 days`; `loadSlate(id)` returns null for unknown or expired rows (expired rows are also deleted lazily on read). Ids are validated against `^[A-Za-z0-9_-]{21}$` before any query.
- Stored content: only resolved Qloo entity names, ids, computed numbers, caveats and redacted evidence. Raw user input strings are never stored or rendered; a test posts hostile input and asserts it is absent from the stored JSON.
- Route `GET /s/[id]` (server component): read-only slate view, plain-text rendering (no `dangerouslySetInnerHTML` anywhere, lint rule), `<meta name="robots" content="noindex,nofollow">` plus `X-Robots-Tag: noindex, nofollow` header, `Cache-Control: private, no-store` for expired states, and a distinct "This slate has expired or does not exist" page with the same status 404 for both unknown and expired (no oracle).
- Security headers on all routes via `next.config` or middleware: strict `Content-Security-Policy` (default-src 'self', no inline script except nonce-based, frame-ancestors 'none', object-src 'none', base-uri 'none'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- "Copy link" control on the slate screen built to `docs/design/screen-slate.md`, with a confirmation message and keyboard access; banner present on the shared page too.
- DEMO_MODE=fixtures: an in-memory slate store with the same interface so sharing works with no DB (non-persistent, stated in the UI note).

## Out of scope

- Editing or deleting shared slates; accounts.
- Social preview images.
- Rate limiting of share creation (M2-05 budgets cover creation).

## Acceptance Criteria

- [ ] Saved ids are 21 characters from the nanoid alphabet; 1,000 generated ids have no collision (test).
- [ ] A slate past `expires_at` returns the same 404 page as an unknown id (test with a fake clock).
- [ ] A malformed id (path traversal, SQL metacharacters, 22 chars) returns 404 without a database query (test with a counting stub).
- [ ] Response headers for `/s/<id>` include noindex and the CSP; a test parses the CSP and asserts no `unsafe-inline` or `unsafe-eval` in `script-src`.
- [ ] An entity name `<img src=x onerror=alert(1)>` and one containing `&filter.type=` render as literal text (rendered-output test).
- [ ] The shared page contains the banner "aggregate affinity, not a ticket forecast".
- [ ] The ui-reviewer agent pass is recorded with no blocking findings.

## Deliverables

- `packages/slates/src/{store,id}.ts` and tests
- `apps/web/app/s/[id]/page.tsx`, `not-found` state
- `apps/web/middleware.ts` or header config, `apps/web/tests/security-headers.test.ts`
- Copy-link component

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm ci && npm run lint && npm run typecheck
npx vitest run packages/slates apps/web/tests/security-headers.test.ts
npm run build
npm run start -- -p 3108 & PID=$!; sleep 6
ID=$(curl -s -X POST localhost:3108/api/slates -H 'content-type: application/json' -d @fixtures/requests/sample-room.json | jq -r '.id')
curl -sI "localhost:3108/s/$ID" | grep -iE 'x-robots-tag|content-security-policy'
curl -s -o /dev/null -w '%{http_code}\n' localhost:3108/s/not-a-real-id   # expect 404
kill $PID
./scripts/check-no-secrets.sh
```

## Handoff

- M2-06 pins sample rooms so their shared links do not expire.
- M3-06 covers states and accessibility polish of the shared page.
- M4-03 re-checks CSP and headers.
