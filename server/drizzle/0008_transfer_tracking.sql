INSERT INTO transfer_device DEFAULT VALUES;
--> statement-breakpoint
CREATE FUNCTION transfer_project(kind text, row_data jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 result := row_data - 'id' - 'sync_id' - 'user_id' - 'created_by_user_id' - 'book_id' - 'author_id' - 'genre_id';
 IF kind = 'books' THEN
  result := result || jsonb_build_object('authorId', (SELECT sync_id FROM authors WHERE id = (row_data->>'author_id')::int), 'genreId', (SELECT sync_id FROM genres WHERE id = (row_data->>'genre_id')::int));
 ELSIF kind = 'readings' THEN
  result := result || jsonb_build_object('bookId', (SELECT sync_id FROM books WHERE id = (row_data->>'book_id')::int));
 ELSIF kind = 'tags' THEN
  result := result || jsonb_build_object('creatorLibraryId', (SELECT library_id FROM users WHERE id = (row_data->>'created_by_user_id')::int));
 END IF;
 RETURN jsonb_build_object('version', 1, 'fields', result);
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_record(kind text, identity uuid, owner uuid, value jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE prior transfer_states%ROWTYPE; next_revision uuid := gen_random_uuid();
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(kind || identity::text, 0));
 SELECT * INTO prior FROM transfer_states WHERE entity_type = kind AND entity_id = identity FOR UPDATE;
 IF FOUND AND prior.state::jsonb IS NOT DISTINCT FROM value THEN RETURN; END IF;
 INSERT INTO transfer_changes(entity_type, entity_id, library_id, origin_device_id, previous_revision, revision, before_state, after_state)
 VALUES(kind, identity, owner, (SELECT device_id FROM transfer_device), prior.revision, next_revision, prior.state, value);
 INSERT INTO transfer_states(entity_type, entity_id, library_id, revision, state) VALUES(kind, identity, owner, next_revision, value)
 ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision, state = excluded.state;
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data jsonb; owner uuid; assignment record;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.sync_id IS DISTINCT FROM OLD.sync_id THEN RAISE EXCEPTION 'Transfer identity is immutable'; END IF;
 data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME = 'readings' THEN SELECT library_id INTO owner FROM users WHERE id = (data->>'user_id')::int; END IF;
 IF TG_TABLE_NAME = 'books' AND TG_OP = 'DELETE' THEN
  FOR assignment IN SELECT * FROM transfer_states WHERE entity_type = 'bookTags' AND state::jsonb->>'bookId' = data->>'sync_id' LOOP
   PERFORM transfer_record('bookTags', assignment.entity_id, assignment.library_id, NULL);
  END LOOP;
 END IF;
 PERFORM transfer_record(TG_TABLE_NAME, (data->>'sync_id')::uuid, owner, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE transfer_project(TG_TABLE_NAME, data) END);
 RETURN NULL;
END $$;
--> statement-breakpoint
DO $$ DECLARE kind text; BEGIN
 FOREACH kind IN ARRAY ARRAY['authors','genres','tags','books','readings'] LOOP
  EXECUTE format('INSERT INTO transfer_states(entity_type, entity_id, library_id, state) SELECT %L, sync_id, %s, transfer_project(%L, to_jsonb(t)) FROM %I t', kind, CASE WHEN kind = 'readings' THEN '(SELECT library_id FROM users WHERE id = t.user_id)' ELSE 'NULL::uuid' END, kind, kind);
  EXECUTE format('CREATE TRIGGER transfer_track AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION transfer_row()', kind);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_tag_set(owner_id int, target_book int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE owner uuid; book uuid; identity uuid; value jsonb;
BEGIN
 SELECT library_id INTO owner FROM users WHERE id = owner_id;
 SELECT sync_id INTO book FROM books WHERE id = target_book;
 IF owner IS NULL OR book IS NULL THEN RETURN; END IF;
 identity := md5(owner::text || ':' || book::text)::uuid;
 SELECT jsonb_build_object('version', 1, 'bookId', book, 'tagIds', coalesce(jsonb_agg(t.sync_id ORDER BY t.sync_id), '[]'::jsonb)) INTO value FROM book_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.user_id = owner_id AND bt.book_id = target_book;
 PERFORM transfer_record('bookTags', identity, owner, value);
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_tags_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM books WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.book_id ELSE NEW.book_id END FOR UPDATE;
 RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_tags_flush() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN PERFORM transfer_tag_set(OLD.user_id, OLD.book_id); END IF;
 IF TG_OP <> 'DELETE' THEN PERFORM transfer_tag_set(NEW.user_id, NEW.book_id); END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER transfer_tags_lock BEFORE INSERT OR UPDATE OR DELETE ON book_tags FOR EACH ROW EXECUTE FUNCTION transfer_tags_lock();
CREATE CONSTRAINT TRIGGER transfer_tags_flush AFTER INSERT OR UPDATE OR DELETE ON book_tags DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transfer_tags_flush();
--> statement-breakpoint
DO $$ DECLARE pair record; BEGIN
 FOR pair IN SELECT DISTINCT user_id, book_id FROM book_tags LOOP PERFORM transfer_tag_set(pair.user_id, pair.book_id); END LOOP;
 DELETE FROM transfer_changes;
END $$;
--> statement-breakpoint
CREATE FUNCTION transfer_library_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.library_id IS DISTINCT FROM OLD.library_id THEN RAISE EXCEPTION 'Library identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_library_immutable BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION transfer_library_immutable();
