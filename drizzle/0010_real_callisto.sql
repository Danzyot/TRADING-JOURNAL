ALTER TABLE "accounts" ADD COLUMN "max_micro_contracts" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "profit_split" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payout_policy" text;