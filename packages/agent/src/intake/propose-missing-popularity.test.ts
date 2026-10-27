import { describe, expect, it } from "vitest";
import type { QlooClient } from "@headliner/qloo";
import { proposeMatches } from "./tools";

const entity = (entityId: string, name: string, popularity: number | null) => ({ entityId, name, popularity, types: [], disambiguation: null, description: null, tags: [] });

describe("propose_matches with a search result that has no popularity", () => {
  it("returns popularity null for it (never 0) and the number for the others", async () => {
    const client = { search: async () => ({ data: [entity("A", "Rich Brian", 0.98), entity("B", "Rich Brian Tribute", null)] }) } as unknown as QlooClient;
    const out = await proposeMatches(client, "Rich Brian");
    expect(out.status).toBe("ok");
    expect(out.matches.map((m) => m.popularity)).toEqual([0.98, null]);
    expect(JSON.stringify(out)).toContain('"popularity":null');
  });
});
