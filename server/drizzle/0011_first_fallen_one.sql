CREATE TABLE "transfer_aliases" (
	"user_id" integer NOT NULL,
	"source_device_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"incoming_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	CONSTRAINT "transfer_aliases_user_id_source_device_id_entity_type_incoming_id_pk" PRIMARY KEY("user_id","source_device_id","entity_type","incoming_id")
);
--> statement-breakpoint
ALTER TABLE "transfer_aliases" ADD CONSTRAINT "transfer_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;