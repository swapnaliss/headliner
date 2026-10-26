import { z } from "zod";

const modeSchema = z.enum(["fixtures", "live"]);

const liveSchema = z.object({
  DEMO_MODE: z.literal("live"),
  QLOO_API_KEY: z.string().min(1),
  QLOO_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

const fixturesSchema = z.object({
  DEMO_MODE: z.literal("fixtures"),
});

export type Env =
  | { mode: "fixtures" }
  | {
      mode: "live";
      qlooApiKey: string;
      qlooBaseUrl: string;
      databaseUrl: string;
      anthropicApiKey: string | undefined;
    };

/** Absent or unrecognised DEMO_MODE means fixtures: the zero-key path must always work. */
export function demoMode(source: Record<string, string | undefined> = process.env): "fixtures" | "live" {
  const parsed = modeSchema.safeParse(source["DEMO_MODE"]);
  return parsed.success ? parsed.data : "fixtures";
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (demoMode(source) === "fixtures") {
    fixturesSchema.parse({ DEMO_MODE: "fixtures" });
    return { mode: "fixtures" };
  }
  const live = liveSchema.parse({
    DEMO_MODE: "live",
    QLOO_API_KEY: source["QLOO_API_KEY"],
    QLOO_BASE_URL: source["QLOO_BASE_URL"] || undefined,
    DATABASE_URL: source["DATABASE_URL"],
    ANTHROPIC_API_KEY: source["ANTHROPIC_API_KEY"] || undefined,
  });
  return {
    mode: "live",
    qlooApiKey: live.QLOO_API_KEY,
    qlooBaseUrl: live.QLOO_BASE_URL,
    databaseUrl: live.DATABASE_URL,
    anthropicApiKey: live.ANTHROPIC_API_KEY,
  };
}
