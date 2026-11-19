import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { getYearInReview } from './year-in-review.service.js';

vi.mock('./year-in-review.service.js');
const app = createApp();
const result: Awaited<ReturnType<typeof getYearInReview>> = {
    year: 2025, total: 0, totalPages: 0, topBooks: [], topAuthors: [], byFormat: [], byCategory: [], byGenre: [], byTag: [],
};

describe('GET /api/analytics/year-in-review', () => {
    it('returns the report and defaults both graphic novel options to false', async () => {
        vi.mocked(getYearInReview).mockResolvedValue(result);
        const res = await request(app).get('/api/analytics/year-in-review?year=2025');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(result);
        expect(getYearInReview).toHaveBeenCalledWith(1, {
            year: 2025, includeGraphicNovelsInBooks: false, includeGraphicNovelsInAuthors: false,
        });
    });

    it.each([[true, false], [false, true], [true, true], [false, false]])(
        'accepts independent inclusion options: books=%s authors=%s', async (books, authors) => {
            vi.mocked(getYearInReview).mockResolvedValue(result);
            const res = await request(app).get(`/api/analytics/year-in-review?year=2025&includeGraphicNovelsInBooks=${books}&includeGraphicNovelsInAuthors=${authors}`);
            expect(res.status).toBe(200);
            expect(getYearInReview).toHaveBeenCalledWith(1, {
                year: 2025, includeGraphicNovelsInBooks: books, includeGraphicNovelsInAuthors: authors,
            });
        },
    );

    it.each(['', 'year=abc', 'year=1899', 'year=2101', 'year=2025.5', 'year=2025&year=2024',
        'year=2025&includeGraphicNovelsInBooks=yes', 'year=2025&includeGraphicNovelsInAuthors=1'])('rejects invalid query %s', async (query) => {
        const res = await request(app).get(`/api/analytics/year-in-review?${query}`);
        expect(res.status).toBe(400);
        expect(getYearInReview).not.toHaveBeenCalled();
    });

    it('handles service failures', async () => {
        vi.mocked(getYearInReview).mockRejectedValue(new Error('Unavailable'));
        expect((await request(app).get('/api/analytics/year-in-review?year=2025')).status).toBe(500);
    });
});
