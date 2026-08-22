ALTER TABLE "trades" ADD COLUMN "screenshot" "bytea";--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "screenshot_type" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "screenshot_bytes" integer;