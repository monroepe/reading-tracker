CREATE TABLE "import_receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"batch_key" text NOT NULL,
	"user_id" integer NOT NULL,
	"csv_sha256" text NOT NULL,
	"mapping_sha256" text NOT NULL,
	"inserted_ids" json NOT NULL,
	"inserted_sha256" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_receipts" ADD CONSTRAINT "import_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_receipts_batch_user_unique" ON "import_receipts" USING btree ("batch_key","user_id");