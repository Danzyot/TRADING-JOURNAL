CREATE TABLE "model_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"trading_day" date NOT NULL,
	"verdict" text NOT NULL,
	"score" integer NOT NULL,
	"reasoning" text NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chart_observations" text,
	"ai_model" text NOT NULL,
	"feedback" text,
	"feedback_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"timeframe" text,
	"instruments" text,
	"entry_rules" text,
	"exit_rules" text,
	"risk_rules" text,
	"invalidations" text,
	"ai_guidance" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "model_id" integer;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "model_review" jsonb;--> statement-breakpoint
ALTER TABLE "model_reviews" ADD CONSTRAINT "model_reviews_model_id_trading_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."trading_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_reviews_model_idx" ON "model_reviews" USING btree ("model_id","created_at");--> statement-breakpoint
CREATE INDEX "model_reviews_trade_idx" ON "model_reviews" USING btree ("account_id","entry_at","symbol");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_model_id_trading_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."trading_models"("id") ON DELETE set null ON UPDATE no action;