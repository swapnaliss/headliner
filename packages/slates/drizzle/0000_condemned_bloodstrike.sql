CREATE TABLE "budgets" (
	"ip_hash" text NOT NULL,
	"day" date NOT NULL,
	"qloo_calls" integer DEFAULT 0 NOT NULL,
	"llm_tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budgets_ip_hash_day_pk" PRIMARY KEY("ip_hash","day")
);
--> statement-breakpoint
CREATE TABLE "qloo_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slates" (
	"id" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "qloo_cache_expires_at_idx" ON "qloo_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "slates_expires_at_idx" ON "slates" USING btree ("expires_at");