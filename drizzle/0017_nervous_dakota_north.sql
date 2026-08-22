ALTER TABLE "email_events" ADD COLUMN "state" text DEFAULT 'applied' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "proposal" jsonb;