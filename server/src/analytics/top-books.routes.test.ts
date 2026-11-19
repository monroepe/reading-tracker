import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as service from './analytics.service.js';

vi.mock('./analytics.service.js');
const app = createApp();

describe('GET /api/analytics/top-books', () => {
    it.each([
        ['tagId=2', { tagId: 2, includeGraphicNovels: false }],
        ['genreId=3', { genreId: 3, includeGraphicNovels: false }],
        ['tagId=2&genreId=3&includeGraphicNovels=true', { tagId: 2, genreId: 3, includeGraphicNovels: true }],
        ['genreId=3&includeGraphicNovels=false', { genreId: 3, includeGraphicNovels: false }],
    ])('forwards validated filters and the current user: %s', async (query, filters) => {
        const result = [{ bookId: 1, title: 'Book', authorId: 4, firstName: 'Jane', middleName: '', lastName: 'Doe', averageRating: 8.75 }];
        vi.mocked(service.getTopBooks).mockResolvedValue(result);
        const response = await request(app).get(`/api/analytics/top-books?${query}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(result);
        expect(service.getTopBooks).toHaveBeenCalledWith(1, filters);
    });

    it.each(['', 'includeGraphicNovels=true', 'tagId=0', 'genreId=-1', 'tagId=1.5', 'genreId=abc', 'tagId=', 'genreId=', 'tagId=1&tagId=2', 'genreId=1&genreId=2', 'tagId=1&includeGraphicNovels=yes', 'tagId=1&includeGraphicNovels=true&includeGraphicNovels=false'])('rejects invalid filters: %s', async (query) => {
        const response = await request(app).get(`/api/analytics/top-books?${query}`);
        expect(response.status).toBe(400);
        expect(service.getTopBooks).not.toHaveBeenCalled();
    });

    it('returns an empty array for no matches', async () => {
        vi.mocked(service.getTopBooks).mockResolvedValue([]);
        const response = await request(app).get('/api/analytics/top-books?tagId=1');
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('handles service failures', async () => {
        vi.mocked(service.getTopBooks).mockRejectedValue(new Error('Database unavailable'));
        expect((await request(app).get('/api/analytics/top-books?genreId=1')).status).toBe(500);
    });
});
