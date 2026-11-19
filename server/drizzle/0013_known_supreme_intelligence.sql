CREATE TABLE "author_countries" (
	"author_id" integer NOT NULL,
	"country_id" integer NOT NULL,
	CONSTRAINT "author_countries_author_id_country_id_pk" PRIMARY KEY("author_id","country_id")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "countries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sync_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "countries_sync_id_unique" UNIQUE("sync_id"),
	CONSTRAINT "countries_name_nonblank" CHECK ("countries"."name" ~ '[^[:space:]]')
);
--> statement-breakpoint
ALTER TABLE "author_countries" ADD CONSTRAINT "author_countries_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_countries" ADD CONSTRAINT "author_countries_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "author_countries_country_idx" ON "author_countries" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_name_unique" ON "countries" USING btree (lower("name"));--> statement-breakpoint
INSERT INTO countries(name) SELECT DISTINCT ON (lower(btrim(country))) btrim(country) FROM authors WHERE country IS NOT NULL AND btrim(country) <> '' ORDER BY lower(btrim(country)), id;
INSERT INTO author_countries(author_id,country_id) SELECT a.id,c.id FROM authors a JOIN countries c ON lower(c.name)=lower(btrim(a.country));
--> statement-breakpoint
CREATE FUNCTION transfer_author_countries(target int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a authors%ROWTYPE; value jsonb;
BEGIN
 SELECT * INTO a FROM authors WHERE id=target;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT jsonb_build_object('version',2,'fields',jsonb_build_object('first_name',a.first_name,'middle_name',a.middle_name,'last_name',a.last_name,'gender',a.gender,'countryIds',coalesce(jsonb_agg(c.sync_id ORDER BY c.sync_id),'[]'::jsonb))) INTO value FROM author_countries ac JOIN countries c ON c.id=ac.country_id WHERE ac.author_id=target;
 PERFORM transfer_record('authors',a.sync_id,NULL,value);
END $$;
CREATE FUNCTION transfer_author_flush() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='authors' THEN
  IF TG_OP='DELETE' THEN PERFORM transfer_record('authors',OLD.sync_id,NULL,NULL); ELSE PERFORM transfer_author_countries(NEW.id); END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM transfer_author_countries(OLD.author_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM transfer_author_countries(NEW.author_id); END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION transfer_author_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM authors WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.author_id ELSE NEW.author_id END FOR UPDATE;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER transfer_track ON authors;
CREATE CONSTRAINT TRIGGER transfer_author_flush AFTER INSERT OR UPDATE OR DELETE ON authors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transfer_author_flush();
CREATE TRIGGER transfer_author_lock BEFORE INSERT OR UPDATE OR DELETE ON author_countries FOR EACH ROW EXECUTE FUNCTION transfer_author_lock();
CREATE CONSTRAINT TRIGGER transfer_author_flush AFTER INSERT OR UPDATE OR DELETE ON author_countries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transfer_author_flush();
CREATE TRIGGER transfer_track AFTER INSERT OR UPDATE OR DELETE ON countries FOR EACH ROW EXECUTE FUNCTION transfer_row();
DO $$ DECLARE a record; c record; BEGIN
 FOR c IN SELECT * FROM countries LOOP PERFORM transfer_record('countries',c.sync_id,NULL,transfer_project('countries',to_jsonb(c))); END LOOP;
 FOR a IN SELECT id FROM authors LOOP PERFORM transfer_author_countries(a.id); END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION author_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sync_id IS DISTINCT FROM OLD.sync_id THEN RAISE EXCEPTION 'Transfer identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER author_identity_immutable BEFORE UPDATE ON authors FOR EACH ROW EXECUTE FUNCTION author_identity_immutable();
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM authors a WHERE a.country IS NOT NULL AND btrim(a.country)<>'' AND NOT EXISTS (SELECT 1 FROM author_countries ac JOIN countries c ON c.id=ac.country_id WHERE ac.author_id=a.id AND lower(c.name)=lower(btrim(a.country)))) THEN RAISE EXCEPTION 'Country backfill did not preserve every association'; END IF;
END $$;
