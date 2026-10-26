# Harness-as-library check (M0-04)

Date: 2026-10-26 · Package: `@qloo/qloo-harness@0.1.26` (kit minimum) · Node: v24.22.1

## Verdict

**Importable but different.** The package can be imported as an ES module and exposes a direct (in-process, no child process) workflow executor, but it is a large terminal-agent runtime rather than a thin client, it is ESM-only, it targets `api.qloo.com` by default, and its result envelope is not the raw REST shape the Headliner adapter and fixtures use. The one live programmatic call was **not attempted** (see Limits), so "equivalent" cannot be claimed.

## Consequence for ADR 0012

**Stay on REST.** The adapter keeps calling `hackathon.api.qloo.com` with `X-Api-Key` behind the typed interface named after the harness workflows (`find_tags`, `recommend`, `rank`, `compare_audiences`, `where_popular`). Nothing blocks switching later: `createDirectQlooWorkflowExecutor` exposes the same nine operations, so the adapter interface is compatible with a harness-backed implementation. ADR 0012 is unchanged in status and decision; an "Update" note links this file. The harness is not added as a runtime dependency.

## Commands run

All in a throwaway directory outside the repo (session scratchpad under `$TMPDIR`); nothing was installed in the repo.

```bash
mkdir harness && cd harness && npm init -y
npm i @qloo/qloo-harness@0.1.26
```

Install result: success, 301 lines of `npm ls --all`, `node_modules` 146 MB. npm warned that two transitive packages have install scripts (`@google/genai` preinstall no-op, `protobufjs` postinstall).

## package.json facts

| Field | Value |
|---|---|
| `type` | `module` |
| `main` | `./dist/index.js` |
| `types` | `./dist/index.d.ts` |
| `exports` | `.` -> `{ types, import }` only (no `require` condition) |
| `bin` | `qloo` -> `./dist/bin.js` |
| `engines.node` | `>=22.19.0` |
| `license` | MIT |
| `dependencies` | `@earendil-works/pi-coding-agent@0.84.2`, `typebox@1.3.7` |

## Import attempts

```text
import * as m from '@qloo/qloo-harness'      -> OK, 172 exports
await import('@qloo/qloo-harness')           -> OK (CommonJS can use dynamic import)
require('@qloo/qloo-harness')                -> ERR_PACKAGE_PATH_NOT_EXPORTED
```

`HARNESS_VERSION` is `0.1.26`.

## Exports relevant to a library use

172 runtime exports. Most are terminal UI, session, journey, plan and Pi-runtime helpers (`runQloo`, `runHarnessCli`, `launchInteractiveHarness`, `createPiHarnessRuntime`, ...). The relevant ones:

- `createDirectQlooWorkflowExecutor(client, observer?, resolutionProvider?)` and `createDirectQlooWorkflowExecutorFromEnvironment(options?)`: in-process executor, no child process.
- `createCliQlooWorkflowExecutor`, `createMcpQlooWorkflowExecutor`, `createDelegatingQlooWorkflowExecutor`: other transports (CLI and MCP spawn or connect to a process).
- `QlooWorkflowExecutor.execute(operation, input, context?)` with operations `recommend`, `rank`, `describe`, `where_popular`, `compare_audiences`, `entity_tags`, `audience_demographics`, `trends`, `find_tags`.
- `createQlooTools`, `createQlooToolsFromEnvironment`: Pi agent tool definitions (needs a model provider).

Offline check (no network, key removed from the environment):

```text
createDirectQlooWorkflowExecutorFromEnvironment({ env: <no QLOO_API_KEY> })  -> undefined
```

The typings document `undefined` as "an explicit unauthenticated state"; there is no silent fallback to another transport.

## Environment and runtime needs

- Node >= 22.19.0 (Headliner requires Node >= 24 per `package.json`, so this is satisfied).
- Key from `QLOO_API_KEY` or `~/.qloo` config; base URL from config. `ProbeQlooConnectivityOptions` states a base URL other than the exact production endpoint needs `allowCustomBaseUrl: true`; the hackathon host would be a custom base URL.
- Serverless: the direct executor itself spawns nothing, but the package pulls the Pi coding-agent runtime (about 300 packages, 146 MB installed), which is heavy for a Vercel function bundle. The CLI and MCP executors would need a child process and are unsuitable.
- Response shape: results come wrapped in `QlooWorkflowResultEnvelope` (schema `1.0-preview.1`) with its own provenance, not the raw `{ success, results }` REST body that M0-02 records. An adapter on the harness would need to map back to the REST-shaped fixtures.

## Limits of this check

- No live Qloo call was made. The M0-02 worker holds the Qloo quota and records fixtures in parallel, and `QLOO_API_KEY` was not present in this session. Equivalence of responses against the M0-02 fixtures is therefore unverified.
- To close it later: with the key set, call `createDirectQlooWorkflowExecutorFromEnvironment({ env: { QLOO_API_KEY, QLOO_BASE_URL: <hackathon host> } })?.execute('find_tags', ...)` and diff the envelope's payload against the matching M0-02 fixture. The exact env var name for the base URL must be confirmed from the package README; not verified here.
- Version checked is 0.1.26 only.
