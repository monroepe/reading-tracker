CREATE TABLE "transfer_changes" (
	"change_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"library_id" uuid,
	"origin_device_id" uuid NOT NULL,
	"previous_revision" uuid,
	"revision" uuid NOT NULL,
	"before_state" json,
	"after_state" json
);
--> statement-breakpoint
CREATE TABLE "transfer_device" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"device_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	CONSTRAINT "transfer_device_device_id_unique" UNIQUE("device_id"),
	CONSTRAINT "transfer_device_singleton" CHECK ("transfer_device"."singleton" = true)
);
--> statement-breakpoint
CREATE TABLE "transfer_states" (
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"library_id" uuid,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"state" json,
	CONSTRAINT "transfer_states_entity_type_entity_id_pk" PRIMARY KEY("entity_type","entity_id")
);
