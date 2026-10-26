# Headliner: project spec

Hackathon: Qloo Agentic Hackathon ("Agents, but with taste."). Source facts: `docs/research/RESEARCH.md` (private).

## 1. Hard facts
- Organiser: Qloo (New York); Devpost-hosted. Online, public.
- Deadline: **2026-10-30 11:45pm EDT** (= 2026-10-31 09:15 IST). Judging 2026-11-02 to 11-05; live finals with Jason Calacanis and others on 2026-11-05 (top 3 must appear live).
- Prizes: 1st $15,000, 2nd $6,000, 3rd $4,000; Jason Calacanis may invest $25,000 in his favourite entry.
- Rubric, equal weights: Technological Implementation, Design, Potential Impact, Quality of the Idea. Stage 1 pass/fail: reasonably fits the theme and applies the required APIs.
- Required: functional hosted demo link, public repo with an OSI licence visible in About, text description. Video not required. Demo must be free and unrestricted for judges.
- Disqualifiers: not original work; IP not solely owned; project funded by the sponsor; broken or local-only demo; sanctioned-country residents.
- API: key works only on `https://hackathon.api.qloo.com`, header `X-Api-Key`. Keys deactivate after judging ends.
- Safe use (kit): aggregate affinity only; no inference about an individual, health or finances; no personal data to Qloo.
- Helpdesk: Discord #api-help; Devpost forum.
- Open organiser questions: harness vs REST as "supported surface"; redistribution of recorded Qloo fixtures in the public repo; request quota; finalist slot time in IST.

## 2. Product
- **Users**: independent venue talent buyers, promoters, festival bookers, artist managers, anywhere.
- **Pain** (inference plus vendor sources, unverified): fit is judged by instinct; a miss is an empty room. Buyers weigh "draw, fit, and professionalism" and program 4 to 12 weeks ahead (booking-agent.io blogs).
- **Journey**: describe the room (city and 3 to 6 crowd artists, typed or one sentence parsed by the agent) -> add 3 to 12 candidate acts -> confirm entity matches -> slate: ranked cards with Fit, shared tastes, audience standing, caveats -> act detail with evidence trail and nearby-city strength (lazy) -> shareable slate link.
- **Demo storyboard** (under 3 minutes): empty-room pain (10 s) -> real venue and five acts -> confirm matches -> slate appears -> compare with Qloo popularity-rank order (the order differs) -> open the top act: shared tastes and evidence -> nearby cities strip with a thin-data flag -> an act with no data shows the honest empty state -> close on Lagos, Berlin, Jakarta.
- **Success metric**: measured "home-city check": on a listed evaluation set of acts with known home cities across at least 4 cities, the share where the home city has the highest mean affinity_rank (3 of 3 observed in recon). Plus a Fit sanity test (same-genre acts outrank an off-genre control for a known crowd). Reported as measured, sample listed. A first-time judge completes the core journey in under 3 minutes.
- **Pillars**: evidence-first ranking; audience standing; city strength; agent intake and grounded explanation; honesty layer (caveats, thin data, no individual inference).
- Wording rule: "audience-taste fit", never a ticket-sale or turnout forecast. A banner "aggregate affinity, not a ticket forecast" on every screen.

## 3. Architecture
See [docs/architecture.md](docs/architecture.md).

## 4. Tech stack (versions verified 2026-10-24 via npm time[version])
| Component | Version | Why |
|---|---|---|
| Node.js | 24.22.1 (local) | runtime |
| Next.js | 16.4.3 (published 2026-10-23) | full-stack app; fall back one minor if the build breaks (30 min time-box) |
| TypeScript | 5.9.3 (2025-09-30), fallback taken from 7.0.2 | types; typescript-eslint 8.72.0 does not support 7.x, see `docs/evidence/versions.md` |
| zod | 4.6.7 (2026-10-12) | shared schemas |
| drizzle-orm | 0.45.4 (2026-10-08) | migrations and queries |
| openai | 7.43.0 (published 2026-10-22; checked 2026-10-26 with `npm view openai version time --json`; not installed until M3-01) | intake and explanation, behind a thin provider interface; model chosen by the owner (`LLM_MODEL`) |
| vitest | 5.0.5 (2026-10-15) | tests |
Exact versions are re-verified in M0-01 before the lockfile is committed.

## 5. Services and spend
Vercel free, Neon free, Qloo hackathon key (free), LLM API (OpenAI, owner decision 2026-10-26; 5 USD provider-side hard limit), GitHub free. Total budget ceiling $6. `M0-00` writes `docs/budget.md`.

## 6. Data model
See [docs/architecture.md](docs/architecture.md).

## 7. Deliverables mapped to the rubric
| Criterion | Deliverables |
|---|---|
| Technological Implementation | Qloo adapter with fixtures, shape assertions and caching; multi-endpoint chain; evals; evidence trail |
| Design | design system and hero specs in `docs/design/`; four screens; all states; WCAG AA; mobile-first |
| Potential Impact | named buyer; measured home-city check; caveats; README |
| Quality of the Idea | decision tool, not a consumer recommender; README differentiation |

## 8. Milestones
M0 Recon & Bootstrap (Oct 25), M1 Walking Skeleton (Oct 26), M2 Core Loop (Oct 28), M3 Agent Layer & Proof (Oct 29), M4 Submission (Oct 30). Each ends with a gate. See `.github/plan/`.

## 9. What this does not do
It does not forecast ticket sales or turnout, infer anything about an individual, handle bookings or payments, show momentum (the hackathon trending data is flat), or recommend for consumers. Audience standing is a Qloo popularity rank, not a venue-capacity fit.

### 9.1 Data policy
Real: Qloo hackathon API responses, resolved entity names. Synthetic: none in the product path. No personal data is collected or sent to Qloo. Tests replay recorded real responses. `DEMO_MODE=fixtures` replays them with no keys.

## 10. Risk register
| Risk | Impact | Mitigation |
|---|---|---|
| Qloo quota or latency unknown | slow or failing demo | M0-02 measures; cache; concurrency cap; stale-cache banner |
| REST vs harness "supported surface" | Stage 1 reading | README states approach; Discord question; M0-04 library check |
| Fit formula quality | weak Tech/Idea score | M0-03 spike and ADR; Fit sanity test |
| LLM key or cost (OpenAI) | agent layer blocked, spend | owner `OPENAI_API_KEY` with a 5 USD project budget limit in the first hour; app-side spend cap; deterministic mode |
| Public demo abuse | quota or cost burn | per-IP and global budgets; caps; pre-warmed samples |
| New dependency releases | lost hours | pin; 30-minute fallback; smoke deploy first |
| Qloo keys die after judging | demo breaks Nov 5+ | DEMO_MODE=fixtures fallback |
| Fixture redistribution unclear | licence risk | Discord question; keep fixtures minimal |

## 11. Future vision
Season-long programming plans, multi-venue circuits, a shared view for artists and agents choosing tour cities, then other live categories (comedy, sports).

## 12. Conventions
Branches `m<n>-<nn>-<slug>`; PR per ticket; conventional commits; commit messages carry no Claude co-author line (owner preference in the profile). Identity `swapnaliss <swapnalisbhargude123@gmail.com>`.
