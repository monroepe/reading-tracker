ALTER TABLE "book_tags" DROP CONSTRAINT "book_tags_tag_id_tags_id_fk";
--> statement-breakpoint
DROP INDEX "authors_name_unique";--> statement-breakpoint
ALTER TABLE "book_tags" DROP CONSTRAINT "book_tags_book_id_tag_id_pk";--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "middle_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "book_tags" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "created_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
-- The migration runner sets this session value from --owner-email.
-- Fail rather than assigning existing data to an arbitrary account.
DO $$
DECLARE
  owner_email text := nullif(current_setting('reading_tracker.owner_email', true), '');
  owner_id integer;
BEGIN
  IF owner_email IS NOT NULL THEN
    SELECT id INTO STRICT owner_id FROM users WHERE lower(email) = lower(owner_email);
    UPDATE tags SET created_by_user_id = owner_id WHERE created_by_user_id IS NULL;
    UPDATE book_tags SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE users SET role = 'admin' WHERE id = owner_id;
  ELSIF EXISTS (SELECT 1 FROM tags) OR EXISTS (SELECT 1 FROM book_tags) THEN
    RAISE EXCEPTION 'Existing tags require an explicit --owner-email; no changes were committed';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "book_tags" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_user_id_book_id_tag_id_pk" PRIMARY KEY("user_id","book_id","tag_id");
--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_tags_book_idx" ON "book_tags" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_unique" ON "authors" USING btree (lower("first_name"),lower("middle_name"),lower("last_name"));--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_last_name_nonblank" CHECK ("authors"."last_name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_gender_allowed" CHECK ("authors"."gender" IN ('Female', 'Male', 'Non-binary'));--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_title_nonblank" CHECK ("books"."title" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_page_count_positive" CHECK ("books"."page_count" > 0);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_category_allowed" CHECK ("books"."category" IN ('Fiction', 'Non-fiction'));--> statement-breakpoint
ALTER TABLE "genres" ADD CONSTRAINT "genres_name_nonblank" CHECK ("genres"."name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_format_allowed" CHECK ("readings"."format" IN ('Print', 'Kindle', 'Audiobook', 'Graphic Novel'));--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_name_nonblank" CHECK ("tags"."name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_allowed" CHECK ("users"."role" IN ('admin', 'user'));