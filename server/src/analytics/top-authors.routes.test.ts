import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as service from './analytics.service.js';

vi.mock('./analytics.service.js');

const app = createApp();
const result: Awaited<ReturnType<typeof service.getTopAuthors>> = [
    { authorId: 1, firstName: 'Jane', middleName: '', lastName: 'Austen', bookCount: 3, averageRating: 9.25, weightedScore: 8.625 },
    { authorId: 2, firstName: 'Octavia', middleName: '', lastName: 'Butler', bookCount: 2, averageRating: null, weightedScore: null },
];

describe('GET /api/analytics/top-authors', () => {
    it('defaults to books and passes the current user ID', async () => {
        vi.mocked(service.getTopAuthors).mockResolvedValue(result);
        const response = await request(app).get('/api/analytics/top-authors');
        expect(response.status).toBe(200);
        expect(response.body).toEqual(result);
        expect(service.getTopAuthors).toHaveBeenCalledWith(1, 'books', false);
    });

    it.each(['books', 'rating'] as const)('forwards sort=%s', async (sort) => {
        vi.mocked(service.getTopAuthors).mockResolvedValue(result);
        const response = await request(app).get(`/api/analytics/top-authors?sort=${sort}`);
        expect(response.status).toBe(200);
        expect(service.getTopAuthors).toHaveBeenCalledWith(1, sort, false);
    });

    it.each(['books', 'rating'] as const)('includes graphic novels for sort=%s when enabled', async (sort) => {
        vi.mocked(service.getTopAuthors).mockResolvedValue(result);
        const response = await request(app).get(`/api/analytics/top-authors?sort=${sort}&includeGraphicNovels=true`);
        expect(response.status).toBe(200);
        expect(service.getTopAuthors).toHaveBeenCalledWith(1, sort, true);
    });

    it('accepts explicitly excluding graphic novels', async () => {
        vi.mocked(service.getTopAuthors).mockResolvedValue(result);
        const response = await request(app).get('/api/analytics/top-authors?includeGraphicNovels=false');
        expect(response.status).toBe(200);
        expect(service.getTopAuthors).toHaveBeenCalledWith(1, 'books', false);
    });

    it.each([
        'sort=unknown',
        'sort=',
        'sort=books&sort=rating',
        'includeGraphicNovels=yes',
        'includeGraphicNovels=',
        'includeGraphicNovels=true&includeGraphicNovels=false',
    ])('rejects %s', async (query) => {
        const response = await request(app).get(`/api/analytics/top-authors?${query}`);
        expect(response.status).toBe(400);
        expect(service.getTopAuthors).not.toHaveBeenCalled();
    });

    it('returns an empty array when no authors qualify', async () => {
        vi.mocked(service.getTopAuthors).mockResolvedValue([]);
        const response = await request(app).get('/api/analytics/top-authors?sort=rating');
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('handles service failures', async () => {
        vi.mocked(service.getTopAuthors).mockRejectedValue(new Error('Database unavailable'));
        const response = await request(app).get('/api/analytics/top-authors');
        expect(response.status).toBe(500);
    });
});
