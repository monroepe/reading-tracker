CREATE TABLE "authors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "authors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text NOT NULL,
	"country" text,
	"gender" text
);
--> statement-breakpoint
CREATE TABLE "book_tags" (
	"book_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "book_tags_book_id_tag_id_pk" PRIMARY KEY("book_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "books_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"author_id" integer NOT NULL,
	"co_authors" text,
	"genre_id" integer NOT NULL,
	"category" text NOT NULL,
	"page_count" integer
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "genres_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "readings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"book_id" integer NOT NULL,
	"started_on" date NOT NULL,
	"finished_on" date,
	"abandoned" boolean DEFAULT false NOT NULL,
	"format" text NOT NULL,
	"rating" numeric(3, 1),
	"review" text,
	CONSTRAINT "readings_abandoned_no_finish" CHECK (NOT ("readings"."abandoned" AND "readings"."finished_on" IS NOT NULL)),
	CONSTRAINT "readings_finish_after_start" CHECK ("readings"."finished_on" IS NULL OR "readings"."finished_on" >= "readings"."started_on"),
	CONSTRAINT "readings_rating_range" CHECK ("readings"."rating" BETWEEN 0.5 AND 10 AND ("readings"."rating" * 2) % 1 = 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_unique" ON "authors" USING btree (lower("first_name"),lower("last_name"));--> statement-breakpoint
CREATE INDEX "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_title_author_unique" ON "books" USING btree (lower("title"),"author_id");--> statement-breakpoint
CREATE INDEX "books_author_idx" ON "books" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "books_genre_idx" ON "books" USING btree ("genre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_name_unique" ON "genres" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "readings_book_idx" ON "readings" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "readings_finished_on_idx" ON "readings" USING btree ("finished_on");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique" ON "tags" USING btree (lower("name"));