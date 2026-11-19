import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { getYearInReview } from './year-in-review.service.js';

vi.unmock('../middleware/auth.js');
vi.mock('../middleware/session.js', () => ({
    createSessionMiddleware: () => (req: { session: object }, _res: unknown, next: () => void) => {
        req.session = {};
        next();
    },
}));
vi.mock('./year-in-review.service.js');

it('requires authentication for year in review', async () => {
    const res = await request(createApp()).get('/api/analytics/year-in-review?year=2025');
    expect(res.status).toBe(401);
    expect(getYearInReview).not.toHaveBeenCalled();
});
