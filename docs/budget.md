# Budget

Status: ceiling set by the owner on 2026-10-25 ("shrink it to around 6 USD"); recorded as approved on the M0-00 issue (prerequisite `P-08`). Ceiling: **6 USD total**.

## Cost table

| Service | Plan | Dev cost | Judging-window cost (to 2026-11-05) | Used by | Notes |
|---|---|---|---|---|---|
| Qloo hackathon API | hackathon key | 0 | 0 | M0-02 onward | Quota unpublished; measured in M0-02, asked in Discord. Key deactivates after judging, so `DEMO_MODE=fixtures` is the fallback. |
| Vercel | Hobby (free) | 0 | 0 | M0-01, M1-05 | No payment method attached, so it cannot bill. If a limit is hit the site stops; fixtures mode and a redeploy elsewhere are the fallback. |
| Neon Postgres | Free | 0 | 0 | M0-05 onward | No payment method attached. Free-tier storage and compute limits apply; the cache is small (3 tables). |
| LLM API (OpenAI, owner decision 2026-10-26) | pay as you go, **5 USD hard limit** | up to 2 | up to 3 | M3-01, M3-02 | Hard limit set in the provider console. See assumptions. |
| GitHub | free (public repo, Actions free minutes) | 0 | 0 | all | CI target is 5 minutes per PR. |
| Uptime monitor | UptimeRobot or Better Stack free | 0 | 0 | M3-05 | Plus the `uptime.yml` Action. |
| Domain, video tools, paid SaaS | not bought | 0 | 0 | - | See purchases. |
| **Total** | | **up to 2** | **up to 3** | | LLM share is bounded by the 5 USD limit; the other 1 USD of the ceiling is unallocated contingency. |

## Assumptions

- The LLM is used only for intake (at most 3 steps, `MAX_INTAKE_STEPS`) and for phrasing the explanation (ADR 0009). Scores never involve it.
- The agent eval suite runs on recorded fixtures with no API key (M3-03 gate runs with `OPENAI_API_KEY` unset), so CI spends nothing.
- Development spend comes from manual runs of M3-01 and M3-02 and the M3 gate. Judging-window spend comes from visitors using the live intake. The split of 2 and 3 USD is an allocation of the cap, not a measured figure. Measured spend will be recorded in `docs/evidence/` at the M3 gate.
- Per-IP daily and global daily LLM token ceilings (M2-05) keep the app under the cap; at the global ceiling the app returns deterministic template output (`deterministic_only`) instead of calling the model.
- Per-token prices are not recorded here. The owner chooses `LLM_MODEL` against OpenAI's current pricing page before M3-01, and checks it again before setting ceilings in M2-05.

## Purchases decision

| Item | Decision | Why |
|---|---|---|
| Vercel Pro | do not buy | Hobby is enough for a read-mostly demo. Pro is billed per seat per month (check vercel.com/pricing). |
| Neon paid plan | do not buy | Free tier fits 3 small tables. Paid plans are billed monthly (check neon.com/pricing). |
| Custom domain | do not buy | M0-01 lists it out of scope; the `*.vercel.app` URL is the demo URL. |
| Paid uptime, tracing or logging | do not buy | ADR 0010 chooses JSON logs and a free monitor. |
| Video tooling or hosting | do not buy | Video is optional; unlisted YouTube is free. |

## LLM provider (decided)

Owner decision 2026-10-26: the provider is OpenAI, chosen for cost (ADR 0009, Update 2026-10-26). The totals above are unchanged: 6 USD total, 5 USD provider-side hard limit. The stack lines in `CLAUDE.md` and `PROJECT.md` §4, the scope of M3-01 and M3-02, and prerequisites `P-05` and `P-13` follow it. The model is not fixed in this repo: the owner picks `LLM_MODEL` against OpenAI's current pricing page before M3-01.

## Always-on during judging

Decision requested from the owner: keep the production deploy and the Neon database running through **2026-11-05** (finalist live demos). Cost: 0 on the free tiers. Fallback if Qloo keys deactivate or a free-tier limit is hit: `DEMO_MODE=fixtures`.

## Alerts and enforcement

| Control | Enforces | Where |
|---|---|---|
| OpenAI project budget limit 5 USD (platform.openai.com -> Settings -> Billing / Limits, monthly budget limit) | hard cap on LLM spend | provider console |
| No payment method on Vercel or Neon | free tiers cannot produce a bill | each console |
| Global daily LLM and Qloo ceilings, fail closed | app stops spending before the cap | M2-05 |
| Per-IP daily budgets | one visitor cannot use the shared quota | M2-05 |
| Owner reviews the provider usage page at each milestone gate | catches drift early | M1, M2, M3 gates |

## Environment names the plan expects

Names only. Values live in `.env` (gitignored) and the Vercel project, never in the repo.

| Name | Set by | Used by |
|---|---|---|
| `DEMO_MODE` (`fixtures` or `live`) | owner in `.env`, Vercel | all |
| `QLOO_API_KEY`, `QLOO_BASE_URL`, `QLOO_LIVE` | owner (`QLOO_LIVE=1` only for the opt-in smoke test) | M0-02, M1-01 |
| `DATABASE_URL`, `TEST_DATABASE_URL` | owner (Neon; the test one is a throwaway branch) | M0-05, M2-05 |
| `OPENAI_API_KEY`, `LLM_MODEL` (model chosen by the owner) | owner | M3-01, M3-02 |
| `BUDGET_SALT` | owner (random string) | M2-05 |
| `HEADLINER_PROD_URL`, `PROD_URL`, `DEMO_URL` | exported by the person running a gate, from the Vercel production URL | M0-01, M0-05, M0-GATE, M2-GATE, M3-05, M3-GATE, M4-GATE, M4-SUBMIT |
| `REPO_URL`, `REPO_SLUG`, `DEVPOST_URL` | exported by the person running M4-SUBMIT | M4-SUBMIT |
