# Qloo fixtures

Real responses recorded from `https://hackathon.api.qloo.com` by `scripts/qloo-record.ts` (M0-02) on 2026-10-26.
Each file is `{ endpoint, params, status, recordedAt, latencyMs, body }`. Request headers are never recorded.
`index.json` maps `<endpoint>?<normalised params>` (keys sorted, URLSearchParams encoding) to a fixture file; DEMO_MODE=fixtures
and the adapter tests resolve calls through it. Replay needs no key and no network.

Redistribution of these responses is pending the organiser answer (M0-04). Do not republish them outside this repo until then.

Re-record: `node --env-file=<env file holding the hackathon key> scripts/qloo-record.ts <search|insights|compare|heatmap|trending|invalid|index>`
(`burst` runs the quota probe and writes `docs/evidence/qloo-burst.json`). Stages after `search` resolve entity ids from the search fixtures.

Entity ids in params are abbreviated below as counts; the exact ids are in each file and in `index.json`.

| Fixture | Call | Params | Status | Recorded |
|---|---|---|---|---|
| `compare--list6-crowd-vs-khruangbin.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-26 |
| `compare--list6-crowd-vs-list2-cands.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<2 entity ids>&filter.type=urn:entity:artist` | 200 | 2026-10-26 |
| `compare--list6-crowd-vs-radiohead.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-26 |
| `compare--list6-crowd-vs-reality-club.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-26 |
| `compare--single-apparat-vs-khruangbin.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<1 entity id>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-26 |
| `heatmap--apparat-berlin.json` | `GET /v2/insights` | `filter.location.query=Berlin&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-jakarta.json` | `GET /v2/insights` | `filter.location.query=Jakarta&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-lagos.json` | `GET /v2/insights` | `filter.location.query=Lagos&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-leipzig.json` | `GET /v2/insights` | `filter.location.query=Leipzig&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-london.json` | `GET /v2/insights` | `filter.location.query=London&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-mumbai.json` | `GET /v2/insights` | `filter.location.query=Mumbai&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-reykjavik.json` | `GET /v2/insights` | `filter.location.query=Reykjavik&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--apparat-tromso.json` | `GET /v2/insights` | `filter.location.query=Tromsø&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--odunsi-the-engine-lagos.json` | `GET /v2/insights` | `filter.location.query=Lagos&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `heatmap--reality-club-jakarta.json` | `GET /v2/insights` | `filter.location.query=Jakarta&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-26 |
| `insights--apparat.json` | `GET /v2/insights` | `filter.type=urn:entity:artist&signal.interests.entities=<1 entity id>&take=10` | 200 | 2026-10-26 |
| `insights--moderat.json` | `GET /v2/insights` | `filter.type=urn:entity:artist&signal.interests.entities=<1 entity id>&take=10` | 200 | 2026-10-26 |
| `insights--modeselektor.json` | `GET /v2/insights` | `filter.type=urn:entity:artist&signal.interests.entities=<1 entity id>&take=10` | 200 | 2026-10-26 |
| `invalid--bogus-parameter.json` | `GET /v2/insights` | `bogus.parameter=definitely-not-real&filter.type=urn:entity:artist&signal.interests.entities=<1 entity id>&take=5` | 200 | 2026-10-26 |
| `search--amaarae.json` | `GET /search` | `query=Amaarae&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--apparat.json` | `GET /search` | `query=Apparat&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--bjork.json` | `GET /search` | `query=Björk&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--boys-noize.json` | `GET /search` | `query=Boys Noize&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--brandt-brauer-frick.json` | `GET /search` | `query=Brandt Brauer Frick&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--hindia.json` | `GET /search` | `query=Hindia&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--hundreds.json` | `GET /search` | `query=Hundreds&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--khruangbin.json` | `GET /search` | `query=Khruangbin&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--moderat.json` | `GET /search` | `query=Moderat&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--modeselektor.json` | `GET /search` | `query=Modeselektor&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--odunsi-the-engine.json` | `GET /search` | `query=Odunsi (The Engine)&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--phoenix.json` | `GET /search` | `query=Phoenix&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--radiohead.json` | `GET /search` | `query=Radiohead&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--reality-club.json` | `GET /search` | `query=Reality Club&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--sigur-ros.json` | `GET /search` | `query=Sigur Rós&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `search--zzqxv-nonexistentact-9731.json` | `GET /search` | `query=Zzqxv Nonexistentact 9731&take=5&types=urn:entity:artist` | 200 | 2026-10-26 |
| `trending--artist-no-signal.json` | `GET /v2/trending` | `filter.end_date=2026-10-24&filter.start_date=2026-07-24&filter.type=urn:entity:artist&take=10` | 400 | 2026-10-26 |
| `trending--artist-signal-apparat.json` | `GET /v2/trending` | `filter.end_date=2026-10-24&filter.start_date=2026-07-24&filter.type=urn:entity:artist&signal.interests.entities=<1 entity id>&take=10` | 200 | 2026-10-26 |
| `compare--sample-4632712ee5.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<4 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-5922e4b821.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<4 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-5df0a866af.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-678a6bd16e.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<4 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-aa6a6c9168.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<6 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-ab1cd0b1b6.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<4 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `compare--sample-cbac780d71.json` | `GET /v2/insights/compare` | `a.signal.interests.entities=<4 entity ids>&b.signal.interests.entities=<1 entity id>&filter.type=urn:entity:artist` | 200 | 2026-10-27 |
| `heatmap--sample-33800e69e4.json` | `GET /v2/insights` | `filter.location.query=London&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-27 |
| `heatmap--sample-9db3a67f33.json` | `GET /v2/insights` | `filter.location.query=Leipzig&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-27 |
| `heatmap--sample-c99cab4794.json` | `GET /v2/insights` | `filter.location.query=Jakarta&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-27 |
| `heatmap--sample-d9e2aad93e.json` | `GET /v2/insights` | `filter.location.query=Tromsø&filter.type=urn:heatmap&signal.interests.entities=<1 entity id>` | 200 | 2026-10-27 |

The `*--sample-*` files were recorded by `scripts/prewarm-samples.ts --record-fixtures` (M2-06) from the same adapter calls the sample rooms in `apps/web/samples/rooms.json` make; they cover each room's compares and the top act's city heatmaps.

`proof/` (M3-04) holds the one-time live recording for `npm run proof` (130 responses recorded 2026-10-27 by `evals/proof/run.ts --live` through the adapter, with its own `index.json` and a `run-log.json` of call counts and latency). It is replayed with `new FixtureTransport("fixtures/qloo/proof")`; it is deliberately not merged into the top-level `index.json`.
