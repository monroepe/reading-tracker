ALTER TABLE "authors" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "library_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_sync_id_unique" UNIQUE("sync_id");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_sync_id_unique" UNIQUE("sync_id");--> statement-breakpoint
ALTER TABLE "genres" ADD CONSTRAINT "genres_sync_id_unique" UNIQUE("sync_id");--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_sync_id_unique" UNIQUE("sync_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_sync_id_unique" UNIQUE("sync_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_library_id_unique" UNIQUE("library_id");