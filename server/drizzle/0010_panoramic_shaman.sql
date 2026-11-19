CREATE TABLE "transfer_import_changes" (
	"change_id" uuid PRIMARY KEY NOT NULL,
	"transfer_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"origin_device_id" uuid NOT NULL,
	"proposal_sha256" text NOT NULL,
	"proposal" json NOT NULL,
	"outcome" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_imports" (
	"transfer_id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"request_sha256" text NOT NULL,
	"result" json NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_import_changes" ADD CONSTRAINT "transfer_import_changes_transfer_id_transfer_imports_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_imports"("transfer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_import_changes" ADD CONSTRAINT "transfer_import_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_imports" ADD CONSTRAINT "transfer_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;