import { z } from "zod";

const modeSchema = z.enum(["fixtures", "live"]);

const liveSchema = z.object({
  DEMO_MODE: z.literal("live"),
  QLOO_API_KEY: z.string().min(1),
  QLOO_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

const fixturesSchema = z.object({
  DEMO_MODE: z.literal("fixtures"),
  // Optional here: fixtures mode runs with no database. Required only in live mode.
  DATABASE_URL: z.string().min(1).optional(),
});

export type Env =
  | { mode: "fixtures"; databaseUrl?: string }
  | {
      mode: "live";
      qlooApiKey: string;
      qlooBaseUrl: string;
      databaseUrl: string;
      openaiApiKey: string | undefined;
    };

/** Absent or unrecognised DEMO_MODE means fixtures: the zero-key path must always work. */
export function demoMode(source: Record<string, string | undefined> = process.env): "fixtures" | "live" {
  const parsed = modeSchema.safeParse(source["DEMO_MODE"]);
  return parsed.success ? parsed.data : "fixtures";
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (demoMode(source) === "fixtures") {
    const fixtures = fixturesSchema.parse({
      DEMO_MODE: "fixtures",
      DATABASE_URL: source["DATABASE_URL"] || undefined,
    });
    return fixtures.DATABASE_URL === undefined
      ? { mode: "fixtures" }
      : { mode: "fixtures", databaseUrl: fixtures.DATABASE_URL };
  }
  const live = liveSchema.parse({
    DEMO_MODE: "live",
    QLOO_API_KEY: source["QLOO_API_KEY"],
    QLOO_BASE_URL: source["QLOO_BASE_URL"] || undefined,
    DATABASE_URL: source["DATABASE_URL"],
    OPENAI_API_KEY: source["OPENAI_API_KEY"] || undefined,
  });
  return {
    mode: "live",
    qlooApiKey: live.QLOO_API_KEY,
    qlooBaseUrl: live.QLOO_BASE_URL,
    databaseUrl: live.DATABASE_URL,
    openaiApiKey: live.OPENAI_API_KEY,
  };
}
