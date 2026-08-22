CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"label" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"firm_id" integer,
	"account_id" integer,
	"document_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_prop_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."prop_firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_kind_idx" ON "documents" USING btree ("kind","created_at");