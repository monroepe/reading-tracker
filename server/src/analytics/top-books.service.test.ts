import { expect, it, vi } from 'vitest';
import { getTopBooks } from './analytics.service.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]) => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
    const { drizzle } = await import('drizzle-orm/pg-proxy');
    return { db: drizzle(execute) };
});

it('averages eligible rereads per book with stable ordering and no result limit', async () => {
    await getTopBooks(7, { genreId: 3, includeGraphicNovels: false });
    const [query, params] = execute.mock.calls[0];
    expect(query).toContain('avg("readings"."rating")');
    expect(query).toContain('"readings"."user_id" =');
    expect(query).toContain('"readings"."abandoned" =');
    expect(query).toContain('"readings"."finished_on" is not null');
    expect(query).toContain('"readings"."rating" is not null');
    expect(query).toContain('"readings"."format" <>');
    expect(query).toContain('"books"."genre_id" =');
    expect(query).toContain('group by "books"."id"');
    expect(query).toContain('order by avg("readings"."rating") desc, "books"."title", "books"."id"');
    expect(query).not.toMatch(/limit|round\(|distinct|finished_on" >=/i);
    expect(params).toEqual([7, false, 'Graphic Novel', 3]);
});

it('requires both filters and scopes tag existence to the user without multiplying readings', async () => {
    await getTopBooks(7, { tagId: 2, genreId: 3, includeGraphicNovels: true });
    const [query, params] = execute.mock.calls[0];
    expect(query).toContain('"books"."genre_id" =');
    expect(query).toContain('and exists (select');
    expect(query).toContain('"book_tags"."book_id" = "books"."id"');
    expect(query).toContain('"book_tags"."user_id" =');
    expect(query).toContain('"book_tags"."tag_id" =');
    expect(query).not.toContain('join "book_tags"');
    expect(query).not.toContain('"readings"."format" <>');
    expect(params).toEqual([7, false, 3, 7, 2]);
});

it('supports a personal tag without a genre restriction', async () => {
    await getTopBooks(7, { tagId: 2, includeGraphicNovels: false });
    const [query, params] = execute.mock.calls[0];
    expect(query).not.toContain('"books"."genre_id" =');
    expect(query).toContain('exists (select');
    expect(params).toEqual([7, false, 'Graphic Novel', 7, 2]);
});
