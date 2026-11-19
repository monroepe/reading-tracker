import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpReadData } from './readData';

afterEach(() => vi.unstubAllGlobals());

describe('HTTP read adapter', () => {
  it('preserves list parameters and passes cancellation to fetch', async () => {
    const result = { data: [], total: 0, page: 2, pageSize: 50 };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    expect(await httpReadData.tags.list({ q: 'space opera', page: 2, pageSize: 50 }, { signal: controller.signal })).toEqual(result);
    const [path, options] = fetch.mock.calls[0];
    const url = new URL(path, 'https://example.test');
    expect(url.pathname).toBe('/api/tags');
    expect(url.searchParams.get('q')).toBe('space opera');
    expect(url.searchParams.get('page')).toBe('2');
    expect(options.signal).toBe(controller.signal);
  });
});
