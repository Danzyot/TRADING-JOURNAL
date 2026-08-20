ALTER TABLE "prop_firms" ALTER COLUMN "platform" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "plan_label" text;--> statement-breakpoint
ALTER TABLE "prop_firms" ADD COLUMN "plans" jsonb DEFAULT '[]'::jsonb NOT NULL;