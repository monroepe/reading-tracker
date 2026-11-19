CREATE TABLE "transfer_refreshes" (
  "import_id" uuid PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "payload" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_refreshes" ADD CONSTRAINT "transfer_refreshes_import_id_transfer_imports_transfer_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."transfer_imports"("transfer_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transfer_refreshes" ADD CONSTRAINT "transfer_refreshes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
