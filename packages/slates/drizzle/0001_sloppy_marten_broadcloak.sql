CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "runs_expires_at_idx" ON "runs" USING btree ("expires_at");