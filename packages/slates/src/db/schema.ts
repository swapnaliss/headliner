import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Read-through cache for Qloo responses. Heatmap values are stored as aggregates only. */
export const qlooCache = pgTable(
  "qloo_cache",
  {
    key: text("key").primaryKey(),
    json: jsonb("json").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("qloo_cache_expires_at_idx").on(t.expiresAt)],
);

/** Shareable 30-day slates; id is an unguessable nanoid. */
export const slates = pgTable(
  "slates",
  {
    id: text("id").primaryKey(),
    json: jsonb("json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("slates_expires_at_idx").on(t.expiresAt)],
);

/** Per-IP daily budgets. ip_hash is a salted hash, never the IP. */
export const budgets = pgTable(
  "budgets",
  {
    ipHash: text("ip_hash").notNull(),
    day: date("day").notNull(),
    qlooCalls: integer("qloo_calls").notNull().default(0),
    llmTokens: integer("llm_tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ipHash, t.day] })],
);
