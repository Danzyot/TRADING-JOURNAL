CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer,
	"label" text NOT NULL,
	"external_id" text,
	"platform" text DEFAULT 'tradovate' NOT NULL,
	"phase" text DEFAULT 'eval' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"starting_balance" numeric(20, 4) DEFAULT 50000 NOT NULL,
	"profit_target" numeric(20, 4),
	"max_drawdown" numeric(20, 4),
	"drawdown_type" text DEFAULT 'trailing_eod' NOT NULL,
	"drawdown_locks_at" numeric(20, 4),
	"daily_loss_limit" numeric(20, 4),
	"max_contracts" integer,
	"min_trading_days" integer,
	"consistency_percent" numeric(12, 6),
	"cost_base" numeric(20, 4) DEFAULT 0 NOT NULL,
	"commission_per_contract" numeric(20, 4) DEFAULT 0 NOT NULL,
	"current_balance" numeric(20, 4),
	"balance_updated_at" timestamp with time zone,
	"started_on" date,
	"ended_on" date,
	"notes" text,
	"exclude_from_stats" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"provider" text NOT NULL,
	"environment" text DEFAULT 'live' NOT NULL,
	"credentials_encrypted" text,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"trading_day" date NOT NULL,
	"trades" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"scratches" integer DEFAULT 0 NOT NULL,
	"gross_pnl" numeric(20, 4) DEFAULT 0 NOT NULL,
	"commission" numeric(20, 4) DEFAULT 0 NOT NULL,
	"fees" numeric(20, 4) DEFAULT 0 NOT NULL,
	"net_pnl" numeric(20, 4) DEFAULT 0 NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"equity" numeric(20, 4) DEFAULT 0 NOT NULL,
	"drawdown_room" numeric(20, 4),
	"r_sum" numeric(12, 6),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"external_id" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"batch_id" integer,
	"contract" text NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" integer NOT NULL,
	"fill_price" numeric(20, 8) NOT NULL,
	"fill_at" timestamp with time zone NOT NULL,
	"trading_day" date NOT NULL,
	"commission" numeric(20, 4) DEFAULT 0 NOT NULL,
	"fees" numeric(20, 4) DEFAULT 0 NOT NULL,
	"trade_id" integer,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"spent_on" date NOT NULL,
	"category" text NOT NULL,
	"vendor" text NOT NULL,
	"description" text,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"fx_rate" numeric(20, 4) DEFAULT 1 NOT NULL,
	"amount_base" numeric(20, 4) NOT NULL,
	"account_id" integer,
	"firm_id" integer,
	"subscription_id" integer,
	"deductible_percent" numeric(12, 6) DEFAULT 1 NOT NULL,
	"vat_amount" numeric(20, 4) DEFAULT 0 NOT NULL,
	"has_receipt" boolean DEFAULT false NOT NULL,
	"receipt_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"filename" text,
	"account_id" integer,
	"rows_seen" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"trades_built" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"impact_base" numeric(20, 4),
	"evidence" jsonb,
	"dismissed_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"plan" text,
	"review" text,
	"mood" integer,
	"sleep_hours" numeric(12, 6),
	"discipline" integer,
	"market_notes" text,
	"lessons" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"firm_id" integer,
	"requested_on" date NOT NULL,
	"paid_on" date,
	"status" text DEFAULT 'requested' NOT NULL,
	"gross_amount" numeric(20, 4) NOT NULL,
	"profit_split" numeric(12, 6) DEFAULT 0.9 NOT NULL,
	"processing_fee" numeric(20, 4) DEFAULT 0 NOT NULL,
	"net_amount" numeric(20, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"fx_rate" numeric(20, 4) DEFAULT 1 NOT NULL,
	"net_amount_base" numeric(20, 4) NOT NULL,
	"method" text,
	"reference" text,
	"tax_reserved" numeric(20, 4) DEFAULT 0 NOT NULL,
	"allocation" jsonb,
	"invoice_number" text,
	"invoiced_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prop_firms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"platform" text DEFAULT 'tradovate' NOT NULL,
	"profit_split" numeric(12, 6) DEFAULT 0.9 NOT NULL,
	"payout_policy" text,
	"payout_cap_base" numeric(20, 4),
	"min_days_to_payout" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"display_name" text DEFAULT 'Trader' NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'Asia/Jerusalem' NOT NULL,
	"day_boundary" text DEFAULT '00:00' NOT NULL,
	"usd_ils" numeric(20, 4) DEFAULT 3.7 NOT NULL,
	"fx_updated_at" timestamp with time zone,
	"tax_profile" jsonb,
	"allocation_plan" jsonb,
	"risk_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'software' NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"started_on" date NOT NULL,
	"next_renewal_on" date NOT NULL,
	"cancelled_on" date,
	"account_id" integer,
	"deductible_percent" numeric(12, 6) DEFAULT 1 NOT NULL,
	"auto_log" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"detail" jsonb,
	"duration_ms" integer,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"contract" text,
	"direction" text NOT NULL,
	"qty" integer NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"trading_day" date NOT NULL,
	"avg_entry" numeric(20, 8) NOT NULL,
	"avg_exit" numeric(20, 8),
	"gross_pnl" numeric(20, 4) DEFAULT 0 NOT NULL,
	"commission" numeric(20, 4) DEFAULT 0 NOT NULL,
	"fees" numeric(20, 4) DEFAULT 0 NOT NULL,
	"net_pnl" numeric(20, 4) DEFAULT 0 NOT NULL,
	"stop_price" numeric(20, 8),
	"target_price" numeric(20, 8),
	"risk_base" numeric(20, 4),
	"r_multiple" numeric(12, 6),
	"mae_base" numeric(20, 4),
	"mfe_base" numeric(20, 4),
	"duration_seconds" integer,
	"status" text DEFAULT 'closed' NOT NULL,
	"setup" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exec_score" integer,
	"emotion" text,
	"notes" text,
	"screenshot_url" text,
	"auto_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_firm_id_prop_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."prop_firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_firm_id_prop_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."prop_firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_firm_id_prop_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."prop_firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_firm_idx" ON "accounts" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_platform_external_idx" ON "accounts" USING btree ("platform","external_id") WHERE "accounts"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_stats_account_day_idx" ON "daily_stats" USING btree ("account_id","trading_day");--> statement-breakpoint
CREATE INDEX "executions_account_time_idx" ON "executions" USING btree ("account_id","fill_at");--> statement-breakpoint
CREATE INDEX "executions_trade_idx" ON "executions" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "executions_day_idx" ON "executions" USING btree ("trading_day");--> statement-breakpoint
CREATE UNIQUE INDEX "executions_source_external_idx" ON "executions" USING btree ("source","external_id") WHERE "executions"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_account_idx" ON "expenses" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insights_key_idx" ON "insights" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "payouts_date_idx" ON "payouts" USING btree ("requested_on");--> statement-breakpoint
CREATE INDEX "payouts_account_idx" ON "payouts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sync_log_job_idx" ON "sync_log" USING btree ("job","ran_at");--> statement-breakpoint
CREATE INDEX "trades_account_day_idx" ON "trades" USING btree ("account_id","trading_day");--> statement-breakpoint
CREATE INDEX "trades_symbol_idx" ON "trades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trades_entry_idx" ON "trades" USING btree ("entry_at");--> statement-breakpoint
CREATE INDEX "trades_status_idx" ON "trades" USING btree ("status");