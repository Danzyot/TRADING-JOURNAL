ALTER TABLE "accounts" ADD COLUMN "opening_balance" numeric(20, 4);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_balance_at" date;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "buffer" numeric(20, 4);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "min_payout" numeric(20, 4);