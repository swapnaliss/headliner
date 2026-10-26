// Live proof of one heatmap through the adapter (M2-03). Usage:
//   node --env-file=<env file holding the hackathon key> node_modules/tsx/dist/cli.mjs scripts/live-heatmap-proof.mts
// Makes ONE live call to hackathon.api.qloo.com (the entity id is Khruangbin's, from the recorded search),
// then repeats it to show the cache read-through makes no second call. Prints request summaries only:
// the key is read from the environment by liveTransportFromEnv and is never printed or stored.
import { cityStrengthFromAggregate } from "../packages/core/src/index";
import { createQlooClient, fetchHeatmap, InMemoryCacheStore, liveTransportFromEnv } from "../packages/qloo/src/index";

const ENTITY_ID = "BAF6317A-DF94-4C90-92AE-63F86560C21B"; // Khruangbin (fixtures/qloo/search--khruangbin.json)
const CITY = "Paris"; // not among the recorded fixtures: a real, uncached answer

const calls: { status: number; ms: number; attempt: number }[] = [];
const client = createQlooClient({
  transport: liveTransportFromEnv(),
  cache: new InMemoryCacheStore(),
  onEvent: (e) => {
    if (e.type === "live_call") calls.push({ status: e.status, ms: e.ms, attempt: e.attempt });
  },
});

const first = await fetchHeatmap(client, { entityId: ENTITY_ID, city: CITY });
const afterFirst = client.stats();
const second = await fetchHeatmap(client, { entityId: ENTITY_ID, city: CITY });
const afterSecond = client.stats();

if (first.status !== "ok") {
  console.log(JSON.stringify({ outcome: first }, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      request: { endpoint: first.evidence.endpoint, redactedParams: first.evidence.redactedParams },
      liveCalls: calls,
      statsAfterFirst: afterFirst,
      statsAfterSecond: afterSecond,
      secondCallCached: second.status === "ok" ? second.cached : null,
      aggregate: first.aggregate,
      summary: cityStrengthFromAggregate(first.aggregate),
      evidence: { responseDigest: first.evidence.responseDigest, fetchedAt: first.evidence.fetchedAt },
    },
    null,
    2,
  ),
);
