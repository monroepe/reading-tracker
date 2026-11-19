CREATE TABLE "transfer_exports" (
	"transfer_id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"destination_device_id" uuid,
	"payload_sha256" text NOT NULL,
	"manifest" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_exports" ADD CONSTRAINT "transfer_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;