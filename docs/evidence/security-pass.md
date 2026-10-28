# M4-03 security pass

Run 2026-10-28 (UTC) on branch `feat/m4-03-security-pass-28-10-2026`, base `6ed4875` (main after #91). Production URL `https://headliner-ai.vercel.app`. No secret value appears in this file; every grep is by pattern and prints names or counts only. No live Qloo or OpenAI call, no POST to production, no deploy, no database write was made.

## Status of the acceptance criteria

| AC | Result |
|---|---|
| gitleaks over full history: zero findings | PASS (agent-run, below) |
| Owner confirms key-literal history count is `0` | **OWNER-RUN, PENDING**: `! bash scripts/owner-key-history-check.sh` (below) |
| Redaction test passes and fails when a header is added to Evidence | PASS, mutation shown (below) |
| Production responses carry the Scope 3 header set; shared pages noindex | PASS (below); `X-Frame-Options` not sent, `frame-ancestors 'none'` is |
| `npm audit --omit=dev` no unaddressed high/critical | PASS: 0 vulnerabilities of any severity |
| Build output and screenshots contain no key; fixtures log has no header names | PASS (below) |
| Each forced upstream failure returns a sanitized client body | PASS: `tests/security/upstream-errors.test.ts` |
| This file exists, no secret value | PASS |

## 1. Secret scan over full history (scope 1)

| Command | Result |
|---|---|
| `gitleaks detect --source . --log-opts="--all" --redact --no-banner` | 167 commits scanned, `no leaks found`, exit 0 |
| `./scripts/check-no-secrets.sh` | `check-no-secrets: ok` |
| `git log -p --all \| grep -ciE 'x-api-key *[:=] *[A-Za-z0-9_-]{16,}'` | **1** (gate expects 0), see "Gate-command defects" |
| same, excluding the single known false positive (`grep -v canary-value-456`) | 0 |
| `git log -p --all \| grep -cE 'sk-[A-Za-z0-9_-]{32,}'` | 2: the two sides of one commit pair (e762d1b added, 99c92e4 removed) holding the made-up test value that `.gitleaksignore` names |
| `OPENAI_API_KEY *[:=] *<16+ chars>` over history | 0 |
| `QLOO_API_KEY *[:=] *<16+ chars>` over history | 1: `CANARY_KEY=... QLOO_API_KEY=... npm test` in `.github/plan/M3-05-observability-baseline.md` (commit 25ef648), a placeholder in a plan document, not a key (gitleaks agrees) |
| `postgres://user:password@` over history | 8 lines, every one with host `localhost`/`127.0.0.1`/placeholder in tests (M2-05, M2-06); 0 hosts matching `*.neon.tech` anywhere in history |

### `.gitleaksignore` entries

The task statement said three fingerprints; the file holds **two** (checked 2026-10-28, `grep -v '^#'`, values not shown):

| Line | Fingerprint (commit prefix : file : rule : line) | What it is |
|---|---|---|
| 3 | `e762d1b0…` : `apps/web/test/slates.route.test.ts` : generic-api-key : 7 | made-up key in a test, removed in 99c92e4; test now assembles it at run time |
| 5 | `19e45f19…` : `scripts/m3-gate-fallback.sh` : generic-api-key : 33 | dummy `sk-invalid-…` model key in the first version of the fallback proof; the script now builds it at run time |

No third entry exists, so there is nothing to explain: gitleaks passes with only these two.

## 2. Key literal in history, tree and screenshots (OWNER-RUN, PENDING)

The agent never reads `.env` or the key file. `scripts/owner-key-history-check.sh` is for the owner:

```
! bash scripts/owner-key-history-check.sh
```

It parses `QLOO_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` from the repo-root `.env` as text into shell variables (never sourced, never exported), and for each prints only `NAME: history=<n> tracked-tree=<n> screenshots=<n>`. The value reaches grep through a file descriptor (`grep -cF -f <(printf ...)`), so it is in no argument list; the script sets `set +x`, writes nothing to disk, and refuses to run when stdout is a regular file. Expected: `0` everywhere and `RESULT: 0 everywhere`.

Logic tested only with a throwaway repo and `.env` in a temp directory holding obviously fake values assembled at run time from parts (the helper was a scratch file, not committed):

```
== run 1: clean repo (expect 0 everywhere)
QLOO_API_KEY: history=0 tracked-tree=0 screenshots=0
OPENAI_API_KEY: history=0 tracked-tree=0 screenshots=0
DATABASE_URL: history=0 tracked-tree=0 screenshots=0
RESULT: 0 everywhere                                  exit=0
== run 2: fake QLOO value committed then removed; fake OPENAI value in a PNG text chunk
QLOO_API_KEY: history=2 tracked-tree=0 screenshots=0
OPENAI_API_KEY: history=0 tracked-tree=1 screenshots=1
DATABASE_URL: history=0 tracked-tree=0 screenshots=0
RESULT: NONZERO count above. ...                      exit=1
== run 3: stdout redirected to a regular file
refusing to run: stdout is a regular file. ...         (0 bytes written; no value in any output)
```

Limit: `git log -p` shows binary files as "Binary files differ", so a key inside a committed image would not be counted in the `history` column (the `screenshots` column covers the current files; section 6 reads every PNG chunk).

## 3. Redaction (scope 2) and mutation proof

`tests/security/redaction.test.ts` (2 tests) runs the whole create-slate route on the Qloo adapter with a live transport over a fetch that answers from the recorded fixtures. It first asserts the (fake, run-time-built) key really was sent as `X-Api-Key` and never in the URL, then asserts the key and the header names `x-api-key`, `authorization`, `cookie`, `set-cookie`, `proxy-authorization` are absent from: the API response, every console line of the run, every cache row written, and the stored slate; and that every Evidence object has only the fields `id, endpoint, redactedParams, responseDigest, fetchedAt, status`.

Mutation, shown once (reverted, not committed): in `packages/qloo/src/evidence.ts` `makeEvidence`, add `headers: { "X-Api-Key": "mutant" }` to the returned Evidence.

```
× sends the credential upstream but leaks it nowhere
AssertionError: expected [ 'x-api-key' ] to deeply equal []
Tests  1 failed | 1 passed (2)
```

After reverting: `Tests 16 passed (16)` for `npx vitest run tests/security`. Existing coverage reused, not duplicated: `packages/qloo/test/redaction.test.ts` (M1-01, adapter level, every failure status), `apps/web/test/slates.route.test.ts` (route, no key in response or logs), `apps/web/test/log.test.ts` (M3-05), `evals/` (M3-03).

`vitest.config.ts` change (the only config change): added `"tests/security/**/*.test.ts"` to `test.include`; the existing globs did not match that path.

## 4. Headers (scope 3)

Production, `curl -sI`, 2026-10-28T09:26Z to 09:30Z, GET/HEAD only:

| Header | `/` | `/api/health` | `/s/<malformed id>` (404) | `/s/sample-berlin-electronic` (200) |
|---|---|---|---|---|
| `Content-Security-Policy` | present | present | present | present |
| `X-Content-Type-Options` | `nosniff` | `nosniff` | `nosniff` | `nosniff` |
| `Referrer-Policy` | `no-referrer` | `no-referrer` | `no-referrer` | `no-referrer` |
| `frame-ancestors` (in CSP) | `'none'` | `'none'` | `'none'` | `'none'` |
| `X-Robots-Tag` | none | none | `noindex, nofollow` | `noindex, nofollow` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (Vercel) | same | not printed | not printed |

The CSP on `/` is `default-src 'self'; script-src 'self' 'nonce-<per request>' 'strict-dynamic'; style-src 'self' 'nonce-…'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. Counts of `unsafe-eval`: 0; `unsafe-inline` inside `script-src`: 0; `http://` or `https://` origins anywhere in the policy: 0 (no third-party script origin). The sample page HTML carries `<meta name="robots" content="noindex, nofollow">`; slate pages also send `Cache-Control: private, no-store`.

Missing, reported honestly: **`X-Frame-Options` is not sent** (0 headers on `/`). Framing is blocked by CSP `frame-ancestors 'none'`, which the ticket accepts ("or"); no separate header added (ADR 0008 addendum records this).

Local production build (`next start -p 3200`, `DEMO_MODE=fixtures`, no keys): `/` and a real stored slate `/s/<id>` carry the same headers; `/s/<id>` adds `x-robots-tag: noindex, nofollow`, `cache-control: private, no-store`, the robots meta, and 0 `<script>` tags without a nonce. Unit coverage: `apps/web/test/security-headers.test.ts` (CSP parse, per-request nonce, noindex paths).

## 5. Dependency audit (scope 4)

`npm audit --omit=dev --audit-level=high` (2026-10-28): `found 0 vulnerabilities`; by severity `info 0, low 0, moderate 0, high 0, critical 0`. No `latest` or bare `*` third-party specifier in any `package.json`; the only `*` specifiers are the workspace packages `@headliner/*`, resolved by npm workspaces to local directories.

## 6. Key patterns in bundle, screenshots, logs (scope 5)

Build: `npm run build` (Next, 14 dynamic routes), output in `apps/web/.next` (note: the gate's `.next/static` at the repo root does not exist; the grep there passes vacuously, so it was also run on `apps/web/.next/static`).

| Check | Result |
|---|---|
| `apps/web/.next/static` (18 files, 0 source maps): `X-Api-Key`, `QLOO_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `Authorization: Bearer`, `sk-…` | 0 files |
| same: `hackathon.api.qloo.com`, `api.openai.com` | 0 files |
| whole `.next`: files with `hackathon.api.qloo.com` | all under `.next/server/` (server chunks and their maps); none outside `server/` |
| whole `.next`: `sk-` followed by 32+ characters | 0 files |
| Production client chunks (GET `/`, sample page, sample act page): 12 chunks, 735,058 bytes; patterns `X-Api-Key`, Qloo host, OpenAI host, key names, `sk-…`, Bearer | 0 matches in chunks, 0 in page HTML |
| Screenshots: `exiftool` not installed; every PNG chunk read with a script (16 files in `docs/screenshots`, the set at 2026-10-28T09:30Z) | chunk types only `IHDR, IDAT, IEND`; 0 `tEXt/iTXt/zTXt/eXIf` chunks; 0 findings (no paths, localhost, tokens). Re-run after the screenshots worker's final set before the repo goes public (M4-GATE) |
| Fixtures-mode server log (local production run, request carrying `x-api-key`, `authorization`, `cookie` canary headers; 25 lines incl. startup) | 0 matches for `x-api-key`, `authorization`, `cookie`, `bearer`, the canary |
| Key/header-with-value patterns over `fixtures/` (253 files), `docs/evidence/` (20), `docs/screenshots/` (16), `docs/design/` (8) | 0 files match any of: `sk-<20+>`, `X-Api-Key: <16+>`, `(QLOO\|OPENAI)_API_KEY=<16+>`, `Bearer <20+>`, `AIza<35>` |
| Header name without a value | `fixtures/agent/evals/intake/adv-ke-print-keys.json` (an adversarial prompt asking a model to print keys) and prose in `docs/evidence/{harness-check,m1-gate,m2-gate,m3-gate}.md`; no value follows any of them |
| Tracked `*.log` files | 0 |

`evals/` contains 3 pattern hits that are deliberate adversarial canaries (a fake `sk-` string in a hostile model reply and its matcher test, and a fake Bearer string in an error text); none is a credential.

## 7. Forced upstream failures (scope 6)

`tests/security/upstream-errors.test.ts` (9 tests). The route is called with a live adapter over a fake fetch returning a hostile body (marker text, an internal path, a Qloo URL with a query key, the fake key):

| Forced | Client status and body |
|---|---|
| 429 verbose body | 429 `{"error":{"code":"rate_limited","message":"Too many requests to the data provider. Try again in a minute."}}` |
| 500 verbose body; 502 HTML page; 401; fetch throwing an error that carries URL and key | 503 `upstream_unavailable`, fixed message |
| timeout (signal abort, `timeoutMs` 15) | 503 `upstream_unavailable` |
| malformed JSON on a 200; 200 with wrong shape | 503 `upstream_unavailable` |
| non-Qloo exception inside the pipeline | no marker in body or logs |

Each case asserts: exactly the keys `error.code` and `error.message`; the message is one of the four fixed strings; `Cache-Control: no-store`; the body and every console line contain none of the marker, the key, `qloo.com`, a path, a stack, `x-api-key`. Adapter-level counterparts: `packages/qloo/test/redaction.test.ts`, `reliability.test.ts`.

## 8. Injection and abuse spot checks (scope 7)

`tests/security/injection.test.ts` (5 tests): `Evil&filter.type=urn:entity:place`, `x&take=999&bogus=1` and `<script>alert(1)</script>` reach Qloo only as the whole value of `query` (no extra `filter.type`, `bogus` or `take=999` parameter on any call); a 10,000-character name returns 400, makes no Qloo call, is not echoed (body under 300 bytes); a markup city name is not echoed in the error. Existing tests reused:

| Check | Test |
|---|---|
| Names render as plain text (`<script>`, `<img onerror>`, `&filter.type=`) | `apps/web/test/ui/confirm.test.tsx` (hostile list, `textContent` equals the raw string), `apps/web/test/confirm.test.ts` |
| Caps: 13th candidate, 7th crowd act, 81-char name or city, 20 KB body, control chars, 6th city, all server-side, no Qloo call, no budget spent | `apps/web/test/budget.route.test.ts` "input caps at the edge" |
| Per-IP budget: 429 `demo_limit_reached` + `Retry-After`, other IP unaffected; global ceiling serves cache only; store unreachable fails closed | `apps/web/test/budget.route.test.ts` |
| LLM per-IP/global ceiling gives the deterministic answer (not an error page) | `apps/web/test/intake.route.test.ts` (budget reserve and refusal, no model call), `apps/web/test/explain.test.tsx` (spent budget falls back to the template) |

## 9. Gate-command defects (logged to BL-01, owner M4-GATE)

1. Gate line 3 (`git log -p --all | grep -ciE 'x-api-key *[:=] *[A-Za-z0-9_-]{16,}' | grep -qx 0`) returns **1**, not 0, and cannot be made to return 0 without rewriting history (forbidden). The one match is `-H 'x-api-key: canary-value-456'` in `.github/plan/M3-05-observability-baseline.md` (commit 25ef648), a made-up canary header value in a plan document (16 characters, just over the `{16,}` threshold), not a credential. Use `... | grep -v 'canary-value-456' | grep -c . | grep -qx 0`-style exclusion (verified: 0 remaining).
2. Gate line `! grep -rIl 'X-Api-Key' .next/static` runs from the repo root where no `.next` exists, so it passes vacuously. The build lives in `apps/web/.next`; use `apps/web/.next/static` (verified clean above).

## Validation Gate run (2026-10-28)

`gitleaks` no leaks; `check-no-secrets: ok`; history line: see defect 1 (1, one explained false positive; 0 with it excluded); `npx vitest run tests/security`: 3 files, 16 tests pass; `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities; `npm run build`: ok; static grep clean; `curl -sI https://headliner-ai.vercel.app` has `content-security-policy`, `x-content-type-options`, `referrer-policy`. `./scripts/landing-checks.sh` (full): typecheck, lint, 835 tests passed (6 skipped), check-fixtures 197, demo-mode-smoke ok.
