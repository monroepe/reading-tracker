import { describe, expect, it } from 'vitest';
import { buildMix } from './readingMix';

describe('reading mix', () => {
    it('preserves empty years and counts separate readings', () => {
        const result = buildMix([{ year: 2024, items: [] }, { year: 2025, items: [{ format: 'Print', count: 3 }, { format: 'Kindle', count: 1 }] }], 'format');
        expect(result.data[0]).toMatchObject({ total: 0, s0: 0 });
        expect(result.data[1]).toMatchObject({ total: 4, s0: 3, s1: 1 });
    });
    it('uses consistent top genres with alphabetical ties and groups the rest', () => {
        const result = buildMix([{ year: 2024, items: ['F', 'E', 'D', 'C', 'B', 'A'].map(genre => ({ genre, count: 1 })) }, { year: 2025, items: [{ genre: 'F', count: 2 }] }], 'genre');
        expect(result.series.map(s => s.name)).toEqual(['F', 'A', 'B', 'C', 'D', 'Other']);
        expect(result.data[0]).toMatchObject({ total: 6, other: 1 });
        expect(result.data[1]).toMatchObject({ total: 2, s0: 2, other: 0 });
    });
});
