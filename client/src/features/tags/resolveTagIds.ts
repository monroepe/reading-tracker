import { api } from '../../api/client';
import type { Tag } from '../../api/types';

export async function resolveTagIds(tags: ({ id: number } | { name: string })[]): Promise<number[]> {
    // Wait for every creation before the caller refreshes caches, including on failure.
    const results = await Promise.allSettled(tags.map(async (tag) => {
        if ('id' in tag) return tag.id;
        return (await api<Tag>('/tags', { method: 'POST', body: { name: tag.name } })).id;
    }));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    return results.map((result) => (result as PromiseFulfilledResult<number>).value);
}
