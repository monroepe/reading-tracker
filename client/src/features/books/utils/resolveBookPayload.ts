import type { Genre } from "@/api/types";
import type { NewBook } from "../api/useCreateBook";
import { api } from "@/api/client";
import { resolveTagIds } from "@/features/tags/resolveTagIds";


export async function resolveBookPayload({ genre, tags, ...book }: NewBook) {
    const genreId =
        'id' in genre
            ? genre.id
            : (await api<Genre>('/genres', { method: 'POST', body: { name: genre.name } })).id;

    const tagIds = await resolveTagIds(tags);

    return { ...book, genreId, tagIds };
}