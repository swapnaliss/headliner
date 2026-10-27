import { describe, expect, it } from "vitest";
import { cityStrength, cityStrengthFromAggregate, rankCities } from "./cityStrength";

const cells = (n: number, rank = 0.5): { query: { affinity_rank: number } }[] =>
  Array.from({ length: n }, () => ({ query: { affinity_rank: rank } }));

describe("cityStrength", () => {
  it("0 cells: no mean, count 0, thin", () => {
    expect(cityStrength([])).toEqual({ meanAffinityRank: null, cellCount: 0, thin: true });
    expect(cityStrength(null)).toEqual({ meanAffinityRank: null, cellCount: 0, thin: true });
    expect(cityStrength(undefined)).toEqual({ meanAffinityRank: null, cellCount: 0, thin: true });
  });

  it("14 cells is thin", () => {
    expect(cityStrength(cells(14))).toEqual({ meanAffinityRank: 0.5, cellCount: 14, thin: true });
  });

  it("15 cells is not thin", () => {
    expect(cityStrength(cells(15))).toEqual({ meanAffinityRank: 0.5, cellCount: 15, thin: false });
  });

  it("identical ranks give that rank as the mean, in any order", () => {
    expect(cityStrength(cells(20, 0.333)).meanAffinityRank).toBe(0.333);
  });

  it("rounds the mean to three decimals", () => {
    const mixed = [{ query: { affinity_rank: 0.1 } }, { query: { affinity_rank: 0.2 } }, { query: { affinity_rank: 0.2 } }];
    expect(cityStrength(mixed).meanAffinityRank).toBe(0.167);
  });

  it("ignores cells with a missing, null, non-finite or out-of-range affinity_rank", () => {
    const messy = [
      ...cells(15, 0.4),
      {},
      { query: {} },
      { query: { affinity_rank: null } },
      { query: { affinity_rank: Number.NaN } },
      { query: { affinity_rank: 1.5 } },
    ];
    expect(cityStrength(messy)).toEqual({ meanAffinityRank: 0.4, cellCount: 15, thin: false });
  });

  it("all cells missing affinity_rank behaves like 0 cells", () => {
    expect(cityStrength([{}, { query: {} }])).toEqual({ meanAffinityRank: null, cellCount: 0, thin: true });
  });

  it("does not depend on cell order", () => {
    const a = [0.9, 0.1, 0.5].map((r) => ({ query: { affinity_rank: r } }));
    expect(cityStrength([...a].reverse())).toEqual(cityStrength(a));
  });
});

describe("cityStrengthFromAggregate", () => {
  it("rounds in core and applies the thin rule", () => {
    expect(cityStrengthFromAggregate({ cellCount: 295, meanAffinityRank: 0.84712 })).toEqual({ meanAffinityRank: 0.847, cellCount: 295, thin: false });
    expect(cityStrengthFromAggregate({ cellCount: 14, meanAffinityRank: 0.2 })).toEqual({ meanAffinityRank: 0.2, cellCount: 14, thin: true });
    expect(cityStrengthFromAggregate({ cellCount: 15, meanAffinityRank: 0.2 }).thin).toBe(false);
  });

  it("treats zero cells, a missing mean and nonsense values as no data", () => {
    const none = { meanAffinityRank: null, cellCount: 0, thin: true };
    expect(cityStrengthFromAggregate({ cellCount: 0, meanAffinityRank: null })).toEqual(none);
    expect(cityStrengthFromAggregate({ cellCount: 3, meanAffinityRank: null })).toEqual(none);
    expect(cityStrengthFromAggregate({ cellCount: 3, meanAffinityRank: 1.2 })).toEqual(none);
    expect(cityStrengthFromAggregate({ cellCount: 2.5, meanAffinityRank: 0.5 })).toEqual(none);
    expect(cityStrengthFromAggregate({ cellCount: -1, meanAffinityRank: 0.5 })).toEqual(none);
  });
});

describe("rankCities", () => {
  const row = (city: string, meanAffinityRank: number, cellCount: number) => ({ city, meanAffinityRank, cellCount, thin: cellCount < 15 });

  it("orders enough-data cities by mean affinity_rank and keeps thin cities in their own group", () => {
    const out = rankCities([row("Lagos", 0.9, 1), row("London", 0.599, 406), row("Berlin", 0.847, 295), row("Jakarta", 0.276, 13)]);
    expect(out.ranked.map((r) => r.city)).toEqual(["Berlin", "London"]);
    expect(out.thin.map((r) => r.city)).toEqual(["Lagos", "Jakarta"]);
  });

  it("breaks ties by cell count, then by name, deterministically", () => {
    const rows = [row("B", 0.5, 20), row("A", 0.5, 20), row("C", 0.5, 30)];
    expect(rankCities(rows).ranked.map((r) => r.city)).toEqual(["C", "A", "B"]);
    expect(rankCities([...rows].reverse()).ranked.map((r) => r.city)).toEqual(["C", "A", "B"]);
  });

  it("does not mutate its input", () => {
    const rows = [row("B", 0.2, 20), row("A", 0.9, 20)];
    rankCities(rows);
    expect(rows.map((r) => r.city)).toEqual(["B", "A"]);
  });
});
