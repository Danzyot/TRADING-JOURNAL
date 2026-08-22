CREATE TABLE "document_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_setups" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"symbol" text,
	"direction" text,
	"entry_price" numeric(20, 8),
	"stop_price" numeric(20, 8),
	"stop_points" numeric(20, 8),
	"target_price" numeric(20, 8),
	"target_points" numeric(20, 8),
	"risk_reward" numeric(12, 6),
	"model_id" integer,
	"notes" text,
	"screenshot" "bytea",
	"screenshot_type" text,
	"screenshot_bytes" integer,
	"ai_extract" jsonb,
	"ai_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "trade_setups" ADD CONSTRAINT "trade_setups_model_id_trading_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."trading_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_setups_date_idx" ON "trade_setups" USING btree ("entry_date");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE set null ON UPDATE no action;