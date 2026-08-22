CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"network" text NOT NULL,
	"address" text NOT NULL,
	"assets" text,
	"custody" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "crypto_network" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "crypto_tx_hash" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "crypto_address" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "crypto_network" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "crypto_tx_hash" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "crypto_address" text;